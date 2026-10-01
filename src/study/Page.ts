/**
 * Adapted from The Book of Qbject, src/page.ts and src/util.ts.
 * Copyright (c) 2025 Qbject. SPDX-License-Identifier: MIT
 * https://github.com/Qbject/the-book-of-qbject
 * Full license and adaptation notes: /THIRD_PARTY_NOTICES.md
 */
import * as THREE from 'three'

export interface PageParams {
  front: THREE.Texture
  back: THREE.Texture
  width: number
  height: number
  thickness?: number
  rootThickness?: number
  isCover?: boolean
  isFrontCover?: boolean
  edgeColor?: THREE.ColorRepresentation
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * clamp(t, 0, 1)

const cosineInterpolate = (a: number, b: number, t: number) =>
  a + (b - a) * (1 - Math.cos(Math.PI * t)) / 2

const approach = (value: number, target: number, speed: number, dt: number) => {
  const difference = target - value
  if (Math.abs(difference) < 0.0001) return target
  return value + difference * (1 - Math.exp(-speed * dt))
}

/** A sheet with its root on the book spine; the scene uses +Z as up. */
export default class Page {
  readonly width: number
  readonly height: number
  readonly thickness: number
  readonly rootThickness: number
  readonly isCover: boolean
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial[]>
  readonly pivot: THREE.Group

  elevationLeft = 0
  elevationRight = 0
  turnProgress = 0
  turnProgressLag = 0
  bendingEnabled = true

  private readonly isFrontCover: boolean
  private readonly vertexRelCoords: THREE.Vector3[] = []
  private hasTurnProgressUpdated = false

  constructor(params: PageParams) {
    this.width = params.width
    this.height = params.height
    this.thickness = params.thickness ?? 2
    this.rootThickness = params.rootThickness ?? 4
    this.isCover = params.isCover ?? false
    this.isFrontCover = params.isFrontCover ?? false

    const faceMaterial = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({
        map,
        vertexColors: !this.isCover,
        roughness: this.isCover ? 0.88 : 0.98,
        metalness: 0,
      })
    const edgeMaterial = () =>
      new THREE.MeshStandardMaterial({
        color: params.edgeColor ?? 0xffffff,
        roughness: 0.98,
      })

    // BoxGeometry material order: ±X (page faces), ±Y, ±Z (edges).
    const materials = [
      faceMaterial(params.back),
      faceMaterial(params.front),
      edgeMaterial(),
      edgeMaterial(),
      edgeMaterial(),
      edgeMaterial(),
    ]
    const geometry = new THREE.BoxGeometry(
      this.thickness,
      this.height,
      this.width,
      1,
      1,
      this.isCover ? 1 : 20,
    )
    this.mesh = new THREE.Mesh(geometry, materials)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = true
    this.pivot = new THREE.Group()
    this.pivot.add(this.mesh)

    const position = geometry.attributes.position
    const uv = geometry.attributes.uv
    const colors = new Float32Array(position.count * 3)

    for (let index = 0; index < position.count; index += 1) {
      const coord = new THREE.Vector3(
        position.getX(index) / this.thickness + 0.5,
        position.getY(index) / this.height + 0.5,
        position.getZ(index) / this.width + 0.5,
      )
      if (!this.isCover) {
        // Concentrate vertices near the spine where the paper bends most.
        coord.z = cosineInterpolate(0, 2, coord.z / 2)
        uv.setXY(index, coord.x > 0.5 ? 1 - coord.z : coord.z, coord.y)
      }
      this.vertexRelCoords.push(coord)

      // A little ambient occlusion in the gutter keeps the binding readable.
      const darken = clamp((1 - coord.z) ** 4 - 0.6, 0, 1)
      colors[index * 3] = 1 - darken
      colors[index * 3 + 1] = 1 - darken
      colors[index * 3 + 2] = 1 - darken
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    uv.needsUpdate = true
  }

  getCurve(): THREE.QuadraticBezierCurve | THREE.CubicBezierCurve {
    if (this.isCover) {
      const backShift = this.rootThickness
      const leftShift = this.rootThickness / 2 * (this.isFrontCover ? 1 : -1)
      const angle = (1 - this.turnProgress) * Math.PI / 2
      const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle))
      const perpendicular = new THREE.Vector2(-direction.y, direction.x)
      const start = new THREE.Vector2()
        .addScaledVector(direction, -backShift)
        .addScaledVector(perpendicular, leftShift)
      const end = new THREE.Vector2()
        .addScaledVector(direction, this.width - backShift)
        .addScaledVector(perpendicular, leftShift)
      const middle = new THREE.Vector2().addVectors(start, end).multiplyScalar(0.5)
      return new THREE.QuadraticBezierCurve(start, middle, end)
    }

    const piProgress = Math.abs(this.turnProgress) * Math.PI / 2
    const maxHeight = this.turnProgress > 0 ? this.elevationRight : this.elevationLeft
    const secondElevation = Math.sin(piProgress) * (maxHeight + 30) * 2
    const outerElevation = (1 - Math.cos(piProgress)) * maxHeight
    const outerControl = (progress: number, distance: number) =>
      new THREE.Vector2(
        Math.sin(progress * Math.PI / 2) * distance,
        Math.cos(progress * Math.PI / 2) * distance + outerElevation,
      )

    return new THREE.CubicBezierCurve(
      new THREE.Vector2(),
      new THREE.Vector2(0, secondElevation),
      outerControl(this.turnProgress, this.width * 0.5),
      outerControl(this.turnProgressLag, this.width),
    )
  }

  update(dt: number): void {
    const straightenTarget = this.bendingEnabled
      ? clamp(this.turnProgress * 1.1, -1, 1)
      : this.turnProgress
    this.turnProgressLag = approach(
      this.turnProgressLag,
      straightenTarget,
      this.bendingEnabled ? 5 : 25,
      dt,
    )

    const curve = this.getCurve()
    const curveStretch = Math.max(curve.getLength() / this.width, 1)
    const position = this.mesh.geometry.attributes.position

    for (let index = 0; index < position.count; index += 1) {
      const coord = this.vertexRelCoords[index]
      const sample = coord.z / curveStretch
      const point = curve.getPointAt(sample)
      // Match the thickness normal to the same arc-length sample as the surface.
      const tangent = curve.getTangentAt(sample)
      const direction = Math.atan2(tangent.y, tangent.x) + Math.PI / 2
      const thickness = lerp(this.rootThickness, this.thickness, coord.z)
      const sign = -Math.sign(coord.x - 0.5)
      position.setX(index, point.x + Math.cos(direction) * thickness / 2 * sign)
      position.setZ(index, point.y + Math.sin(direction) * thickness / 2 * sign)
    }

    position.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
    this.mesh.geometry.computeBoundingSphere()
    this.hasTurnProgressUpdated = true
  }

  needsUpdate(): boolean {
    if (!this.hasTurnProgressUpdated) return true
    return (
      (this.turnProgress !== 1 && this.turnProgress !== -1 && this.turnProgress !== 0) ||
      this.turnProgress !== this.turnProgressLag
    )
  }

  setTurnProgress(progress: number): void {
    if (progress === this.turnProgress) return
    if (!this.bendingEnabled) this.turnProgressLag += progress - this.turnProgress
    this.turnProgress = progress
    this.hasTurnProgressUpdated = false
  }

  setElevation(left: number, right: number): void {
    if (this.isCover) return
    this.elevationLeft = left
    this.elevationRight = right
    this.hasTurnProgressUpdated = false
  }

  /** Texture ownership stays with the scene, since sheets share their maps. */
  dispose(): void {
    this.pivot.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.forEach(material => material.dispose())
  }
}

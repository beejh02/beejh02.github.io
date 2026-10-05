import * as THREE from 'three'
import type { VinylRecord } from './Record'
import type { Pencil } from './Pencil'
import type { Eraser } from './Eraser'
import type { Polaroid } from './Polaroid'
import { polaroidPrint } from './Polaroid'
import type { Viewport } from './ScreenContours'

interface DeskLayoutOptions {
  camera: THREE.PerspectiveCamera
  bookFrame: THREE.Group
  bookHeight: number
  getViewport: () => Viewport
}

/** Calibrates the desk and reading cameras, and positions props on the tabletop. */
export function createDeskLayout({ camera, bookFrame, bookHeight, getViewport }: DeskLayoutOptions) {
  const polaroidSourcePositions = new WeakMap<THREE.BufferGeometry, Float32Array>()
  // Props keep their desk positions while the reading camera moves.
  function createDeskCamera() {
    const deskCamera = camera.clone()
    // Keep the prop camera's original depth factor for matching desk placement.
    configureCamera(deskCamera, 0, 0.9165)
    deskCamera.updateMatrixWorld()
    return deskCamera
  }

  function deskPoint(deskCamera: THREE.PerspectiveCamera, x: number, y: number) {
    const point = new THREE.Vector3(x * 2 - 1, 1 - y * 2, 0.5).unproject(deskCamera)
    const ray = new THREE.Ray(deskCamera.position, point.sub(deskCamera.position).normalize())
    return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3())!
  }

  // Compensate the desk camera's foreshortening and skew so flat props
  // remain on the tabletop with level lettering and round lenses or grooves.
  function alignFlatProp(group: THREE.Group, deskCamera: THREE.PerspectiveCamera, center: THREE.Vector3, pixelScale: number) {
    const { width: viewportWidth, height: viewportHeight } = getViewport()
    const projectedCenter = center.clone().project(deskCamera)
    const projectedX = center.clone().add(new THREE.Vector3(1, 0, 0)).project(deskCamera).sub(projectedCenter)
    const projectedY = center.clone().add(new THREE.Vector3(0, 1, 0)).project(deskCamera).sub(projectedCenter)
    const a = projectedX.x * viewportWidth / 2
    const b = projectedY.x * viewportWidth / 2
    const c = projectedX.y * viewportHeight / 2
    const d = projectedY.y * viewportHeight / 2
    const determinant = a * d - b * c
    const depthScale = pixelScale / Math.hypot(a, c)
    group.matrixAutoUpdate = false
    group.matrix.set(
      pixelScale * d / determinant, -pixelScale * b / determinant, 0, center.x,
      -pixelScale * c / determinant, pixelScale * a / determinant, 0, center.y,
      0, 0, depthScale, center.z,
      0, 0, 0, 1,
    )
    group.matrixWorldNeedsUpdate = true
  }

  // Use the book's projected height as one scale for every prop. Independent
  // viewport percentages made the eraser grow wider on wide screens while the
  // pencil stayed tied to the screen height.
  function deskBookHeight(deskCamera: THREE.PerspectiveCamera) {
    const { width: viewportWidth, height: viewportHeight } = getViewport()
    const top = new THREE.Vector3(0, (bookHeight + 28) / 2, 0).applyEuler(bookFrame.rotation).project(deskCamera)
    const bottom = new THREE.Vector3(0, -(bookHeight + 28) / 2, 0).applyEuler(bookFrame.rotation).project(deskCamera)
    return Math.hypot((top.x - bottom.x) * viewportWidth / 2, (top.y - bottom.y) * viewportHeight / 2)
  }

  function positionRecord(record: VinylRecord | null) {
    const { width: viewportWidth, height: viewportHeight } = getViewport()
    if (!record) return
    const portrait = viewportWidth <= viewportHeight
    const deskCamera = createDeskCamera()
    const radius = deskBookHeight(deskCamera) * 0.56
    // Tuck more of the upper rim beyond the viewport, retaining the centre label.
    // On narrow screens move it clear of the heading at the top left.
    const anchorX = portrait ? Math.max(0.42, (130 + radius) / viewportWidth) : 0.54
    const anchorY = portrait ? 0 : radius * 0.20 / viewportHeight
    alignFlatProp(record.group, deskCamera, deskPoint(deskCamera, anchorX, anchorY), radius / 450)
  }

  function stationeryLayout(deskCamera: THREE.PerspectiveCamera) {
    const { width: viewportWidth, height: viewportHeight } = getViewport()
    const portrait = viewportWidth <= viewportHeight
    const stacked = viewportWidth / viewportHeight < 0.8
    const bookHeight = deskBookHeight(deskCamera)
    const length = bookHeight * 0.96
    const angle = THREE.MathUtils.degToRad(portrait ? -32 : -40)
    const x = portrait ? 0.74 : 0.53
    // Leave room below the stationery on square and tablet screens.
    const y = portrait
      ? stacked ? Math.min(0.64, 0.88 - (Math.cos(angle) * length / 2 + bookHeight * 0.31) / viewportHeight) : 0.70
      : 0.64
    const dx = Math.sin(angle) * length / 2 / viewportWidth
    const dy = Math.cos(angle) * length / 2 / viewportHeight
    return {
      tip: new THREE.Vector2(x + dx, y - dy),
      end: new THREE.Vector2(x - dx, y + dy),
      eraser: new THREE.Vector2(
        // Reserve the camera's full-size print below its film exit.
        portrait ? (stacked ? 0.84 : 0.66) : 0.67,
        portrait ? (stacked ? 0.88 : 0.82) : 0.77,
      ),
      eraserWidth: bookHeight * 0.30,
    }
  }

  function positionPencil(pencil: Pencil | null) {
    if (!pencil) return
    const deskCamera = createDeskCamera()
    const layout = stationeryLayout(deskCamera)
    const tip = deskPoint(deskCamera, layout.tip.x, layout.tip.y)
    const end = deskPoint(deskCamera, layout.end.x, layout.end.y)
    const direction = tip.clone().sub(end)
    pencil.group.position.copy(tip).add(end).multiplyScalar(0.5)
    pencil.group.rotation.z = Math.atan2(-direction.x, direction.y)
    pencil.group.scale.setScalar(direction.length() / 1000)
  }

  function positionEraser(eraser: Eraser | null) {
    if (!eraser) return
    const deskCamera = createDeskCamera()
    const layout = stationeryLayout(deskCamera)
    const center = deskPoint(deskCamera, layout.eraser.x, layout.eraser.y)
    alignFlatProp(eraser.group, deskCamera, center, layout.eraserWidth / 800)
  }

  function positionPolaroid(polaroid: Polaroid | null) {
    const { width: viewportWidth, height: viewportHeight } = getViewport()
    if (!polaroid) return
    const portrait = viewportWidth <= viewportHeight
    const deskCamera = createDeskCamera()
    const x = portrait ? (viewportWidth / viewportHeight >= 0.8 ? 0.82 : 0.78) : 0.80
    const y = portrait ? 0.27 : 0.34
    const width = deskBookHeight(deskCamera) * 0.66
    const center = deskPoint(deskCamera, x, y)
    alignFlatProp(polaroid.group, deskCamera, center, width / 800)
    polaroid.group.matrix.elements[10] *= 0.65
    rectifyPolaroid(polaroid, deskCamera, width / 800)
  }

  // The affine tabletop alignment corrects only the centre of a prop. Undo the
  // remaining perspective across each camera surface so its parallel edges stay
  // parallel on screen, while retaining the height offset of each raised part.
  function rectifyPolaroid(polaroid: Polaroid, deskCamera: THREE.PerspectiveCamera, pixelScale: number) {
    const { width: viewportWidth, height: viewportHeight } = getViewport()
    const hoverHeight = polaroid.body.position.z
    polaroid.body.position.z = 0
    polaroid.group.updateMatrixWorld(true)
    // Keep the desk pose as a reference so departure animations still move the print.
    const referenceGroup = polaroid.group.matrixWorld.clone()
    // Preserve 93% of the previous visible dimensions when removing the trapezoid.
    const printBounds = new THREE.Box2()
    for (const x of [-polaroidPrint.width / 2, polaroidPrint.width / 2]) {
      for (const y of [polaroidPrint.exitY - polaroidPrint.travel, polaroidPrint.exitY - polaroidPrint.travel + polaroidPrint.height]) {
        const corner = new THREE.Vector3(x, y, polaroidPrint.elevation + polaroidPrint.hoverLift + 1.5).applyMatrix4(referenceGroup).project(deskCamera)
        printBounds.expandByPoint(new THREE.Vector2(corner.x * viewportWidth / 2, corner.y * viewportHeight / 2))
      }
    }
    const printSize = printBounds.getSize(new THREE.Vector2())
    const deskPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
    const point = new THREE.Vector3()
    const projected = new THREE.Vector3()
    const ray = new THREE.Ray(deskCamera.position.clone())
    function rectify(meshes: THREE.Mesh[], anchorY = 0, scaleX = pixelScale, scaleY = pixelScale) {
      polaroid.group.updateMatrixWorld(true)
      const inverseGroup = polaroid.group.matrixWorld.clone().invert()
      const lift = polaroid.body.position.z
      const horizontalAnchor = new THREE.Vector3(0, 0, lift).applyMatrix4(referenceGroup).project(deskCamera).x
      for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute('position')
        let source = polaroidSourcePositions.get(mesh.geometry)
        if (!source) {
          source = new Float32Array(positions.array)
          polaroidSourcePositions.set(mesh.geometry, source)
        }
        const meshToGroup = new THREE.Matrix4().multiplyMatrices(inverseGroup, mesh.matrixWorld)
        const worldToMesh = new THREE.Matrix4().multiplyMatrices(referenceGroup, meshToGroup).invert()
        for (let index = 0; index < positions.count; index++) {
          point.fromArray(source, index * 3).applyMatrix4(meshToGroup)
          projected.set(0, anchorY, point.z).applyMatrix4(referenceGroup)
          const worldHeight = projected.z
          projected.project(deskCamera)
          // Raised layers recede slightly left, revealing just the right edge
          // the face, lens or print. Hover lift follows the camera's whole body.
          projected.x = horizontalAnchor + (point.x * scaleX - (point.z - lift) * pixelScale * 0.08) * 2 / viewportWidth
          projected.y += (point.y - anchorY) * scaleY * 2 / viewportHeight
          projected.z = 0.5
          projected.unproject(deskCamera)
          ray.direction.copy(projected).sub(ray.origin).normalize()
          deskPlane.constant = -worldHeight
          ray.intersectPlane(deskPlane, point)!
          point.applyMatrix4(worldToMesh)
          positions.setXYZ(index, point.x, point.y, point.z)
        }
        positions.needsUpdate = true
        mesh.geometry.computeVertexNormals()
        mesh.geometry.computeBoundingBox()
        mesh.geometry.computeBoundingSphere()
      }
    }
    rectify(polaroid.meshes)
    polaroid.body.position.z = hoverHeight
    polaroid.group.updateMatrixWorld(true)
    // Rebuild only the paper and photo vertices as the film slides or the body lifts.
    polaroid.setPrintProjection(() => rectify(polaroid.printMeshes, polaroidPrint.exitY, printSize.x / polaroidPrint.width, printSize.y / polaroidPrint.height))
  }

  function configureCamera(target: THREE.PerspectiveCamera, cameraProgress: number, depthScale?: number) {
    const { width: viewportWidth, height: viewportHeight } = getViewport()
    const aspect = viewportWidth / viewportHeight
    target.aspect = aspect
    const focus = THREE.MathUtils.smoothstep(cameraProgress, 0, 1)
    // A longer desk lens softens perspective; the reading view keeps its lens.
    target.fov = THREE.MathUtils.lerp(22, 28, focus)
    const tangent = Math.tan(THREE.MathUtils.degToRad(target.fov / 2))
    const portrait = aspect <= 1
    const deskSpan = portrait ? Math.max(2150, 2300 / aspect) : Math.max(1750, 4000 / aspect)
    const readingSpan = Math.max(1500, 1950 / aspect)
    // Follow the cover's opening progress so the same book becomes the reading view.
    const spanY = THREE.MathUtils.lerp(deskSpan, readingSpan, focus)
    const distance = spanY / (2 * tangent)
    const tilt = THREE.MathUtils.lerp(0.40, 0.12, focus)
    target.position.set(0, -distance * tilt - 70, distance * (depthScale ?? Math.sqrt(1 - tilt * tilt)))
    target.lookAt(0, -70, 0)
    // Keep the book at the sketch's lower-left anchor while reserving the right
    // and upper desktop for props. View offset preserves the book's perspective.
    target.setViewOffset(viewportWidth, viewportHeight, viewportWidth * (portrait ? 0.1 : 0.26) * (1 - focus), -viewportHeight * (portrait ? 0.06 : 0.095) * (1 - focus), viewportWidth, viewportHeight)
    target.updateProjectionMatrix()
  }
  function updateCamera(cameraProgress: number) { configureCamera(camera, cameraProgress) }

  return { createDeskCamera, updateCamera, positionRecord, positionPencil, positionEraser, positionPolaroid }
}

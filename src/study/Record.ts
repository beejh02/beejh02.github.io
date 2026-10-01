import * as THREE from 'three'

export interface VinylRecord {
  group: THREE.Group
  dispose: () => void
}

const radius = 450

/** A lightweight tabletop prop; every GPU resource belongs to this instance. */
export function createVinylRecord(): VinylRecord {
  const group = new THREE.Group()
  const textures: THREE.CanvasTexture[] = []
  const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>[] = []

  function texture(size: number, paint: (context: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('A 2D canvas is required to create the record.')
    paint(context)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    result.anisotropy = 4
    textures.push(result)
    return result
  }

  const vinyl = texture(1024, context => {
    const pixels = context.createImageData(1024, 1024)
    for (let y = 0; y < 1024; y++) {
      for (let x = 0; x < 1024; x++) {
        const dx = x - 512
        const dy = y - 512
        const distance = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx)
        const sheen = Math.abs(Math.cos(angle - 0.25)) ** 10 * 23
        const grooves = distance > 196 && distance < 494
          ? Math.cos(distance * Math.PI / 2.5) * 5.5
          : 0
        const light = 22 + sheen + grooves
        const index = (y * 1024 + x) * 4
        pixels.data[index] = light
        pixels.data[index + 1] = light + 1
        pixels.data[index + 2] = light + 2
        pixels.data[index + 3] = 255
      }
    }
    context.putImageData(pixels, 0, 0)
    context.strokeStyle = 'rgba(111, 114, 119, 0.45)'
    context.lineWidth = 1
    for (const r of [190, 194, 280, 366, 437, 494, 504]) {
      context.beginPath()
      context.arc(512, 512, r, 0, Math.PI * 2)
      context.stroke()
    }
  })

  const label = texture(512, context => {
    context.fillStyle = '#a65340'
    context.fillRect(0, 0, 512, 512)
    context.strokeStyle = 'rgba(249, 240, 222, 0.65)'
    context.lineWidth = 2.5
    for (const r of [235, 39]) {
      context.beginPath()
      context.arc(256, 256, r, 0, Math.PI * 2)
      context.stroke()
    }
    context.fillStyle = '#f9f0de'
    context.textAlign = 'center'
    context.font = '500 21px Arial, sans-serif'
    context.fillText('S I D E', 256, 101)
    context.font = 'bold 108px Arial, sans-serif'
    context.fillText('A', 256, 197)
    context.font = '500 36px Arial, sans-serif'
    context.fillText('33⅓', 256, 359)
    context.font = '18px Arial, sans-serif'
    context.fillText('R P M   /   S T E R E O', 256, 396)
  })

  function add(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], z: number) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.z = z
    group.add(mesh)
    meshes.push(mesh)
    return mesh
  }

  // Extrusion supplies a real rim and spindle hole, with the tabletop visible through it.
  const shape = new THREE.Shape()
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 8, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const body = add(
    new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1, curveSegments: 64 }),
    new THREE.MeshStandardMaterial({ color: '#1b1c20', roughness: 0.42, metalness: 0.06 }),
    1.5,
  )
  body.castShadow = true
  add(
    new THREE.RingGeometry(8, radius, 128),
    new THREE.MeshStandardMaterial({ map: vinyl, roughness: 0.46, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    7.2,
  )
  add(
    new THREE.RingGeometry(8, 166, 96),
    new THREE.MeshStandardMaterial({ map: label, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    7.6,
  )

  const shadow = texture(128, context => {
    const gradient = context.createRadialGradient(64, 64, 46, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(62,48,30,0.28)')
    gradient.addColorStop(0.8, 'rgba(62,48,30,0.18)')
    gradient.addColorStop(1, 'rgba(62,48,30,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
  })
  const contact = add(
    new THREE.PlaneGeometry(1010, 1010),
    new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, toneMapped: false }),
    0.3,
  )
  contact.position.x = 10
  contact.position.y = -12

  return {
    group,
    dispose() {
      group.removeFromParent()
      for (const mesh of meshes) {
        mesh.geometry.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach(material => material.dispose())
      }
      textures.forEach(map => map.dispose())
    },
  }
}

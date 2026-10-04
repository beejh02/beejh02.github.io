import * as THREE from 'three'

export interface Pencil {
  group: THREE.Group
  body: THREE.Group
  meshes: THREE.Mesh[]
  setHover: (amount: number) => void
  dispose: () => void
}

/** A hexagonal lacquered pencil, lying along +Y with its tip at the top. */
export function createPencil(): Pencil {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const meshes: THREE.Mesh[] = []
  const textures: THREE.CanvasTexture[] = []
  const centerHeight = 23

  function add(geometry: THREE.BufferGeometry, material: THREE.Material, y: number, z = centerHeight) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshes.push(mesh)
    body.add(mesh)
    return mesh
  }

  function texture(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('A 2D canvas is required to create the pencil.')
    paint(context)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    textures.push(map)
    return map
  }

  const lacquer = new THREE.MeshStandardMaterial({ color: '#d5a12d', roughness: 0.48 })
  const bodyGeometry = new THREE.CylinderGeometry(22, 22, 770, 6)
  bodyGeometry.rotateY(Math.PI / 6)
  add(bodyGeometry, lacquer, -20)

  const woodGrain = texture(128, 256, context => {
    context.fillStyle = '#d4b58a'
    context.fillRect(0, 0, 128, 256)
    for (let line = 0; line < 32; line++) {
      const x = line * 4 + Math.sin(line * 13) * 2
      context.strokeStyle = line % 3 === 0 ? '#aa815a55' : '#f1dbb833'
      context.lineWidth = 0.8
      context.beginPath()
      context.moveTo(x, 0)
      context.quadraticCurveTo(x + Math.sin(line) * 5, 128, x + 2, 256)
      context.stroke()
    }
  })
  const woodGeometry = new THREE.CylinderGeometry(3.8, 22, 110, 6)
  woodGeometry.rotateY(Math.PI / 6)
  add(woodGeometry, new THREE.MeshStandardMaterial({ map: woodGrain, roughness: 0.93 }), 420)
  add(new THREE.ConeGeometry(3.8, 25, 12), new THREE.MeshStandardMaterial({ color: '#30302d', roughness: 0.78 }), 487.5)

  const brass = new THREE.MeshStandardMaterial({ color: '#bda779', metalness: 0.72, roughness: 0.38 })
  add(new THREE.CylinderGeometry(23, 23, 60, 32), brass, -425)
  for (const y of [-451, -444, -413, -405, -399]) {
    const groove = add(new THREE.TorusGeometry(23, 0.7, 6, 32), brass, y)
    groove.rotation.x = Math.PI / 2
  }

  const eraserProfile = [
    new THREE.Vector2(0, -22.5), new THREE.Vector2(16, -22.5),
    new THREE.Vector2(20, -20), new THREE.Vector2(21.5, -16),
    new THREE.Vector2(21.5, 22.5), new THREE.Vector2(0, 22.5),
  ]
  add(new THREE.LatheGeometry(eraserProfile, 32), new THREE.MeshStandardMaterial({ color: '#b86f64', roughness: 0.98 }), -477.5)

  const imprint = texture(1024, 64, context => {
    context.fillStyle = '#6c4f22'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '500 34px Arial, sans-serif'
    context.fillText('B E E J H   ·   G R A P H I T E   ·   H B', 512, 32)
  })
  const label = add(
    new THREE.PlaneGeometry(440, 27.5),
    new THREE.MeshBasicMaterial({ map: imprint, transparent: true, depthWrite: false, toneMapped: false }),
    -100, centerHeight + 22 * Math.cos(Math.PI / 6) + 0.2,
  )
  label.rotation.z = Math.PI / 2
  label.castShadow = false

  const shadow = texture(128, 1024, context => {
    context.shadowColor = 'rgba(15,9,4,0.38)'
    context.shadowBlur = 14
    context.fillStyle = 'rgba(15,9,4,0.20)'
    context.beginPath()
    context.roundRect(45, 30, 38, 964, 19)
    context.fill()
  })
  const contact = add(
    new THREE.PlaneGeometry(130, 1040),
    new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, toneMapped: false }),
    -5, 0.3,
  )
  contact.position.x = 10
  contact.castShadow = false
  contact.receiveShadow = false
  // Keep the contact shadow on the table when the pencil lifts.
  group.add(contact)
  const materials = new Set<THREE.Material>()
  for (const mesh of meshes) {
    const owned = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    owned.forEach(material => materials.add(material))
  }
  const litMaterials = [...materials].filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial)
  litMaterials.forEach(material => {
    material.emissive.set('#ffcd7b')
    material.emissiveIntensity = 0
  })

  return {
    group,
    body,
    meshes: meshes.filter(mesh => mesh !== contact),
    setHover(amount) {
      body.position.z = amount * 40
      litMaterials.forEach(material => { material.emissiveIntensity = amount * 0.1 })
      contact.position.set(10 + amount * 14, -5 - amount * 12, 0.3)
      contact.scale.set(1 + amount * 0.45, 1 + amount * 0.025, 1)
      contact.material.opacity = 1 - amount * 0.4
    },
    dispose() {
      group.removeFromParent()
      for (const mesh of meshes) {
        mesh.geometry.dispose()
      }
      materials.forEach(material => material.dispose())
      textures.forEach(map => map.dispose())
    },
  }
}

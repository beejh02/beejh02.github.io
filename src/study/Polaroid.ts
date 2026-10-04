import * as THREE from 'three'

export interface Polaroid {
  group: THREE.Group
  body: THREE.Group
  meshes: THREE.Mesh[]
  setHover: (amount: number) => void
  dispose: () => void
}

/** A slim instant camera lying on its back, with the lens facing up. */
export function createPolaroid(): Polaroid {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = []
  const textures: THREE.CanvasTexture[] = []
  const ivory = new THREE.MeshStandardMaterial({ color: '#d8dbd1', roughness: 0.78 })
  const black = new THREE.MeshStandardMaterial({ color: '#1c282b', roughness: 0.63 })
  const rubber = new THREE.MeshStandardMaterial({ color: '#141716', roughness: 0.88 })
  const metal = new THREE.MeshStandardMaterial({ color: '#9dadac', metalness: 0.15, roughness: 0.48 })
  const glass = new THREE.MeshStandardMaterial({ color: '#31565e', metalness: 0.08, roughness: 0.26 })
  const lensRing = new THREE.MeshBasicMaterial({ color: '#678084', toneMapped: false })

  function add(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = body) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    meshes.push(mesh)
    return mesh
  }

  function box(width: number, depth: number, height: number, material: THREE.Material, x: number, y: number, z: number, parent = body) {
    return add(new THREE.BoxGeometry(width, depth, height), material, x, y, z, parent)
  }

  function roundedPlate(width: number, depth: number, thickness: number, radius: number, material: THREE.Material, x: number, y: number, z: number, bevel = 0, parent = body) {
    const left = -width / 2
    const right = width / 2
    const bottom = -depth / 2
    const top = depth / 2
    const shape = new THREE.Shape()
    shape.moveTo(left + radius, bottom)
    shape.lineTo(right - radius, bottom)
    shape.quadraticCurveTo(right, bottom, right, bottom + radius)
    shape.lineTo(right, top - radius)
    shape.quadraticCurveTo(right, top, right - radius, top)
    shape.lineTo(left + radius, top)
    shape.quadraticCurveTo(left, top, left, top - radius)
    shape.lineTo(left, bottom + radius)
    shape.quadraticCurveTo(left, bottom, left + radius, bottom)
    return add(new THREE.ExtrudeGeometry(shape, {
      depth: thickness, bevelEnabled: bevel > 0, bevelSize: bevel,
      bevelThickness: bevel, bevelSegments: 3, curveSegments: 8, steps: 1,
    }), material, x, y, z, parent)
  }

  // A dark protective rim surrounds a pale, nearly square front panel.
  roundedPlate(800, 880, 90, 42, black, 0, 0, 10, 8)
  roundedPlate(724, 798, 8, 20, ivory, 0, 0, 104, 3)
  for (const x of [-403, 403]) {
    for (let y = -320; y <= 270; y += 48) box(8, 20, 25, rubber, x, y, 63)
  }

  const panel = new THREE.Group()
  panel.position.set(0, 0, 115)
  body.add(panel)
  roundedPlate(716, 116, 22, 24, black, 0, 350, 0, 4, panel)
  roundedPlate(716, 42, 8, 10, black, 0, -392, 0, 0, panel)

  function lensCylinder(radius: number, length: number, material: THREE.Material, z: number) {
    const mesh = add(new THREE.CylinderGeometry(radius, radius, length, 64), material, 0, -5, z, panel)
    mesh.rotation.x = Math.PI / 2
    return mesh
  }
  lensCylinder(181, 32, rubber, 19)
  lensCylinder(167, 26, black, 43)
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI * 2 / 48
    const ridge = box(4, 7, 24, black, Math.cos(angle) * 178, -5 + Math.sin(angle) * 178, 20, panel)
    ridge.rotation.z = angle
  }
  add(new THREE.TorusGeometry(151, 4, 10, 64), metal, 0, -5, 58, panel)
  add(new THREE.CircleGeometry(132, 64), rubber, 0, -5, 59, panel)
  add(new THREE.TorusGeometry(119, 2, 8, 64), lensRing, 0, -5, 60, panel)
  add(new THREE.CircleGeometry(105, 64), glass, 0, -5, 61, panel)
  for (const radius of [96, 74]) {
    add(new THREE.RingGeometry(radius - 1, radius + 1, 64), lensRing, 0, -5, 61.3, panel)
  }
  add(new THREE.CircleGeometry(67, 48), new THREE.MeshBasicMaterial({ color: '#071c24', toneMapped: false }), 0, -5, 61.6, panel)
  const reflection = add(
    new THREE.CircleGeometry(25, 32),
    new THREE.MeshBasicMaterial({ color: '#b2d2d6', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }),
    -40, 38, 62, panel,
  )
  reflection.scale.y = 0.18
  reflection.rotation.z = -0.6
  reflection.castShadow = false

  // Flash, viewfinder and shutter sit on the flat front face.
  roundedPlate(130, 128, 12, 8, black, 253, 164, 0, 0, panel)
  const flashMaterial = new THREE.MeshStandardMaterial({ color: '#b9c0b2', roughness: 0.36, metalness: 0.12 })
  roundedPlate(112, 110, 4, 3, flashMaterial, 253, 164, 13, 0, panel)
  for (let i = 0; i < 8; i++) box(2, 95, 1, metal, 207 + i * 13, 164, 18, panel)
  roundedPlate(176, 96, 12, 6, black, -240, 181, 0, 0, panel)
  box(142, 64, 4, glass, -240, 181, 15, panel)
  const buttonRim = add(new THREE.CylinderGeometry(48, 48, 10, 40), black, -255, -152, 6, panel)
  buttonRim.rotation.x = Math.PI / 2
  const shutterMaterial = new THREE.MeshStandardMaterial({ color: '#d05b45', roughness: 0.64 })
  const shutter = add(new THREE.CylinderGeometry(39, 39, 12, 40), shutterMaterial, -255, -152, 16, panel)
  shutter.rotation.x = Math.PI / 2
  add(new THREE.CircleGeometry(15, 24), black, 285, -95, 1, panel)

  // The rainbow stripe and film exit keep the compact shape recognisable.
  for (const [index, color] of ['#bf4939', '#d68b32', '#dbc048', '#6a995d', '#558a9a'].entries()) {
    const stripe = new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    box(19, 205, 1.2, stripe, -38 + index * 19, -255, 1, panel)
  }
  roundedPlate(610, 10, 2, 4, rubber, 0, -423, 55)

  function label(text: string, width: number, height: number, x: number, y: number, z: number, color: string, weight = 500) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * height / width)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('A 2D canvas is required to create the camera label.')
    context.fillStyle = color
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `${weight} ${canvas.height * 0.76}px "Noto Sans KR", Arial, sans-serif`
    context.fillText(text, 256, canvas.height / 2)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    textures.push(texture)
    const mesh = add(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }), x, y, z, panel)
    mesh.castShadow = false
  }
  label('MEMORIES', 220, 40, 0, 350, 27, '#bfc9c6')
  label('경험', 143, 82, 213, -242, 2, '#515951', 600)
  label('MY STORIES', 135, 17, 213, -298, 2, '#737b70')
  label('INSTANT / 03', 210, 21, -125, -392, 10, '#9aaba6')

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 288
  const context = canvas.getContext('2d')
  if (!context) throw new Error('A 2D canvas is required to create the camera shadow.')
  context.shadowColor = 'rgba(15,9,4,0.30)'
  context.shadowBlur = 12
  context.fillStyle = 'rgba(15,9,4,0.16)'
  context.beginPath()
  context.roundRect(25, 25, 206, 238, 12)
  context.fill()
  const shadow = new THREE.CanvasTexture(canvas)
  textures.push(shadow)
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, toneMapped: false })
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(970, 1080), shadowMaterial)
  contact.position.set(12, -15, 0.3)
  group.add(contact)
  const materials = new Set([...meshes.map(mesh => mesh.material), shadowMaterial])
  const litMaterials = [...materials].filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial)
  litMaterials.forEach(material => {
    material.emissive.set('#ffcd7b')
    material.emissiveIntensity = 0
  })

  return {
    group, body, meshes,
    setHover(amount) {
      body.position.z = amount * 40
      litMaterials.forEach(material => { material.emissiveIntensity = amount * 0.012 })
      contact.position.set(12 + amount * 16, -15 - amount * 20, 0.3)
      contact.scale.setScalar(1 + amount * 0.08)
      shadowMaterial.opacity = 1 - amount * 0.35
    },
    dispose() {
      group.removeFromParent()
      for (const mesh of [...meshes, contact]) {
        mesh.geometry.dispose()
      }
      materials.forEach(material => material.dispose())
      textures.forEach(texture => texture.dispose())
    },
  }
}

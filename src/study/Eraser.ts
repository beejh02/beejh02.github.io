import * as THREE from 'three'
import { collectMaterials, createModelResources } from './Resources'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export interface Eraser {
  group: THREE.Group
  body: THREE.Group
  meshes: THREE.Mesh[]
  setHover: (amount: number) => void
  dispose: () => void
}

/** A soft white block eraser in a blue and ivory paper sleeve. */
export function createEraser(): Eraser {
  const group = new THREE.Group()
  const body = new THREE.Group()
  body.rotation.z = THREE.MathUtils.degToRad(-8)
  group.add(body)
  const meshes: THREE.Mesh[] = []
  const resources = createModelResources({ errorMessage: 'A 2D canvas is required to create the eraser.', anisotropy: 8 })
  const { texture } = resources

  function add(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, 0, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    body.add(mesh)
    meshes.push(mesh)
    return mesh
  }


  const rubber = new THREE.MeshStandardMaterial({ color: '#e5e1d3', roughness: 0.98 })
  add(new RoundedBoxGeometry(800, 350, 140, 3, 22), rubber, 0, 72)
  const paper = new THREE.MeshStandardMaterial({ color: '#cdd1c7', roughness: 0.9 })
  add(new RoundedBoxGeometry(555, 358, 148, 3, 9), paper, -96, 76)

  const print = texture(1024, 640, context => {
    context.fillStyle = '#eee9dc'
    context.fillRect(0, 0, 1024, 640)
    context.fillStyle = '#284b68'
    context.fillRect(0, 390, 1024, 250)
    context.fillStyle = '#bd9270'
    context.fillRect(0, 376, 1024, 14)
    context.fillStyle = '#284b68'
    context.font = 'bold 142px Arial, sans-serif'
    context.fillText('BEEJH', 70, 218)
    context.font = '36px Arial, sans-serif'
    context.fillText('P L A S T I C   E R A S E R', 74, 304)
    context.fillStyle = '#f4ecdc'
    context.font = 'bold 63px Arial, sans-serif'
    context.fillText('SOFT', 74, 535)
    context.textAlign = 'right'
    context.font = '48px Arial, sans-serif'
    context.fillText('01', 946, 535)
  })
  const label = add(new THREE.PlaneGeometry(537, 340),
    new THREE.MeshStandardMaterial({ map: print, roughness: 0.9 }), -96, 150.2)
  label.castShadow = false

  const shadowMap = texture(512, 256, context => {
    context.shadowColor = 'rgba(15,9,4,0.42)'
    context.shadowBlur = 20
    context.fillStyle = 'rgba(15,9,4,0.23)'
    context.beginPath()
    context.roundRect(48, 44, 416, 168, 26)
    context.fill()
  })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(990, 510),
    new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false }))
  shadow.position.set(14, -12, 0.3)
  shadow.rotation.z = body.rotation.z
  group.add(shadow)

  const materials = collectMaterials(meshes)
  const litMaterials = [...materials].filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial)
  litMaterials.forEach(material => {
    material.emissive.set('#ffcd7b')
    material.emissiveIntensity = 0
  })

  return {
    group, body, meshes,
    setHover(amount) {
      body.position.z = amount * 45
      litMaterials.forEach(material => { material.emissiveIntensity = amount * 0.06 })
      shadow.position.set(14 + amount * 18, -12 - amount * 15, 0.3)
      shadow.scale.set(1 + amount * 0.12, 1 + amount * 0.18, 1)
      shadow.material.opacity = 1 - amount * 0.35
    },
    dispose() {
      group.removeFromParent()
      resources.dispose([...meshes, shadow])
    },
  }
}

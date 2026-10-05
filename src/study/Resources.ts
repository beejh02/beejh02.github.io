import * as THREE from 'three'

interface TextureOptions {
  errorMessage: string
  anisotropy?: number
  repeat?: boolean
  colorSpace?: THREE.ColorSpace
}

type CanvasPainter = (context: CanvasRenderingContext2D, width: number, height: number) => void

export function createCanvasTexture(width: number, height: number, paint: CanvasPainter, options: TextureOptions) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error(options.errorMessage)
  paint(context, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace
  if (options.anisotropy !== undefined) texture.anisotropy = options.anisotropy
  if (options.repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

export function collectMaterials(meshes: readonly THREE.Mesh[]) {
  return new Set(meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
}

/** Keeps texture ownership local to each model, including its contact shadow. */
export function createModelResources(options: TextureOptions) {
  const textures: THREE.Texture[] = []
  return {
    texture(width: number, height: number, paint: CanvasPainter, overrides: Partial<TextureOptions> = {}) {
      const texture = createCanvasTexture(width, height, paint, { ...options, ...overrides })
      textures.push(texture)
      return texture
    },
    dispose(meshes: readonly THREE.Mesh[]) {
      const geometries = new Set(meshes.map(mesh => mesh.geometry))
      geometries.forEach(geometry => geometry.dispose())
      collectMaterials(meshes).forEach(material => material.dispose())
      textures.forEach(texture => texture.dispose())
    },
  }
}

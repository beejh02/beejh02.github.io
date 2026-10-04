import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

type Color = readonly [number, number, number]

export interface StudyTextures {
  desktop: CanvasTexture
  paper: CanvasTexture
  cloth: CanvasTexture
  edges: CanvasTexture
}

// A fixed seed keeps the desk stable across reloads, without shipping image assets.
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const top = hash(ix, iy, seed) * (1 - sx) + hash(ix + 1, iy, seed) * sx
  const bottom = hash(ix, iy + 1, seed) * (1 - sx) + hash(ix + 1, iy + 1, seed) * sx
  return top * (1 - sy) + bottom * sy
}

function makeTexture(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D, width: number, height: number) => void,
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('A 2D canvas is required to create the study materials.')
  paint(context, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  return texture
}

function setPixel(data: Uint8ClampedArray, index: number, color: Color, light: number) {
  data[index] = color[0] + light
  data[index + 1] = color[1] + light
  data[index + 2] = color[2] + light
  data[index + 3] = 255
}

function paintDesktop(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.createImageData(width, height)
  const sample = random(93601)
  const base: Color = [72, 47, 35]

  for (let y = 0; y < height; y += 1) {
    const v = y / height
    for (let x = 0; x < width; x += 1) {
      const u = x / width
      // Blend opposite edges to keep the walnut continuous across the table.
      const broad = (noise(u * 5, v * 6, 881) * (1 - u)
        + noise((u - 1) * 5, v * 6, 881) * u) * (1 - v)
        + (noise(u * 5, (v - 1) * 6, 881) * (1 - u)
        + noise((u - 1) * 5, (v - 1) * 6, 881) * u) * v
      const bend = Math.sin(u * Math.PI * 2) * 0.014
        + Math.sin(u * Math.PI * 4 + Math.sin(v * Math.PI * 2)) * 0.006
      const growth = (v + bend) * 76
      const grain = Math.pow(0.5 + Math.sin(growth * Math.PI * 2) * 0.5, 10)
      const fibre = noise(x / 110, (v + bend) * 650, 441)
      const light = (broad - 0.5) * 17 - grain * (2 + broad * 4)
        + (fibre - 0.5) * 4 + (sample() - 0.5) * 1.5
      setPixel(pixels.data, (y * width + x) * 4, base, light)
    }
  }
  context.putImageData(pixels, 0, 0)

}

function paintPaper(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.createImageData(width, height)
  const sample = random(68741)
  const base: Color = [247, 244, 233]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const fibre = noise(x / 21, y / 32, 924)
      const light = (fibre - 0.5) * 1.4 + (sample() - 0.5) * 2.1
      setPixel(pixels.data, (y * width + x) * 4, base, light)
    }
  }
  context.putImageData(pixels, 0, 0)
}

function paintCloth(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.createImageData(width, height)
  const sample = random(82711)
  const base: Color = [113, 128, 104]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const warp = Math.cos((x / 4) * Math.PI * 2)
      const weft = Math.cos((y / 4) * Math.PI * 2)
      const crossing = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) * 2 - 1
      const light = warp * 1.25 + weft * 1.25 + crossing * (warp - weft) * 0.55
        + (noise(x / 42, y / 42, 139) - 0.5) * 3 + (sample() - 0.5) * 2.3
      setPixel(pixels.data, (y * width + x) * 4, base, light)
    }
  }
  context.putImageData(pixels, 0, 0)
}

function paintEdges(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.createImageData(width, height)
  const sample = random(25199)
  const base: Color = [233, 227, 208]
  const layers = Array.from({ length: height }, () => sample())
  for (let y = 0; y < height; y += 1) {
    const layer = layers[y]
    // Irregular strengths retain the impression of thin individual leaves.
    const line = y % 4 === 0 ? -6 - layer * 5 : layer * 3
    for (let x = 0; x < width; x += 1) {
      const light = line + (noise(x / 120, y / 20, 778) - 0.5) * 2
        + (sample() - 0.5) * 1.2
      setPixel(pixels.data, (y * width + x) * 4, base, light)
    }
  }
  context.putImageData(pixels, 0, 0)
}

/** Each returned texture is owned by the caller and should be disposed on teardown. */
export function createStudyTextures(): StudyTextures {
  return {
    desktop: makeTexture(1536, 1024, paintDesktop),
    paper: makeTexture(512, 512, paintPaper),
    cloth: makeTexture(512, 512, paintCloth),
    edges: makeTexture(512, 256, paintEdges),
  }
}

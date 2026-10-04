import * as THREE from 'three'

export type ClearanceMode = 'book' | 'record'
type ObjectName = 'book' | 'record' | 'polaroid' | 'pencil' | 'eraser'
type ClearanceObjects = Partial<Record<ObjectName, THREE.Group | null>>

interface Motion {
  dx: number
  dy: number
  angle: number
  delay: number
}

// Distances are fractions of the desk viewport; angles are radians.
// Both transitions share these paths and run them backward when returning.
const motions: Record<ObjectName, Motion> = {
  book: { dx: -.8, dy: .32, angle: -.1, delay: 0 },
  record: { dx: -.12, dy: -.75, angle: -.1, delay: 0 },
  polaroid: { dx: .6, dy: -.3, angle: .08, delay: .04 },
  pencil: { dx: .7, dy: .35, angle: -.16, delay: .09 },
  eraser: { dx: .55, dy: .45, angle: .12, delay: .14 },
}

const participants: Record<ClearanceMode, readonly ObjectName[]> = {
  book: ['record', 'polaroid', 'pencil', 'eraser'],
  record: ['book', 'polaroid', 'pencil', 'eraser'],
}
const motionDuration = .62

interface Departure extends Motion {
  group: THREE.Group
  matrix: THREE.Matrix4
  autoUpdate: boolean
}

export interface DeskClearanceOptions {
  // Resolve current groups after the scene creates or replaces its props.
  getObjects: () => ClearanceObjects
  // Supply the desk camera, even when the reading camera is moving.
  getCamera: () => THREE.PerspectiveCamera
}

/** Moves props and their attached shadows without owning their GPU resources. */
export function createDeskClearance({ getObjects, getCamera }: DeskClearanceOptions) {
  const departures: Departure[] = []
  let currentAmount = 0
  let currentMode: ClearanceMode | null = null

  function reset() {
    for (const item of departures) {
      item.group.matrix.copy(item.matrix)
      item.group.matrixAutoUpdate = item.autoUpdate
      item.group.matrixWorldNeedsUpdate = true
    }
    departures.length = 0
    currentAmount = 0
    currentMode = null
  }

  /** Returns whether a render is needed. Progress 0 restores every original matrix. */
  function setProgress(amount: number, mode: ClearanceMode): boolean {
    amount = THREE.MathUtils.clamp(amount, 0, 1)
    if (amount === currentAmount && (amount === 0 || currentMode === mode)) return false
    if (amount === 0) { reset(); return true }
    if (currentMode && currentMode !== mode) reset()
    if (!departures.length) {
      const objects = getObjects()
      for (const name of participants[mode]) {
        const group = objects[name]
        if (!group) continue
        if (group.matrixAutoUpdate) group.updateMatrix()
        departures.push({ ...motions[name], group, matrix: group.matrix.clone(), autoUpdate: group.matrixAutoUpdate })
        group.matrixAutoUpdate = false
      }
    }
    const camera = getCamera()
    for (const item of departures) {
      const phase = THREE.MathUtils.smoothstep(amount, item.delay, item.delay + motionDuration)
      const origin = new THREE.Vector3().setFromMatrixPosition(item.matrix)
      const projected = origin.clone().project(camera)
      projected.x += item.dx * phase * 2
      projected.y -= item.dy * phase * 2
      projected.z = .5
      const ray = new THREE.Ray(camera.position.clone(), projected.unproject(camera).sub(camera.position).normalize())
      const position = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -origin.z), new THREE.Vector3())!
      item.group.matrix.makeRotationZ(item.angle * phase).multiply(item.matrix).setPosition(position)
      item.group.matrixWorldNeedsUpdate = true
    }
    currentAmount = amount
    currentMode = mode
    return true
  }

  return { setProgress, reset }
}

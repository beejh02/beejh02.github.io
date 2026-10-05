import * as THREE from 'three'

export interface Viewport { width: number; height: number }

export function convexContour(points: THREE.Vector2[]): THREE.Vector2[] {
  points.sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const halfHull = (ordered: THREE.Vector2[]) => {
    const hull: THREE.Vector2[] = []
    for (const point of ordered) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop()
      hull.push(point)
    }
    hull.pop()
    return hull
  }
  return [...halfHull(points), ...halfHull([...points].reverse())]
}

export function projectedContour(meshes: THREE.Mesh[], camera: THREE.Camera, viewport: Viewport): THREE.Vector2[] {
  const points: THREE.Vector2[] = []
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position
    for (let index = 0; index < positions.count; index++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).project(camera)
      points.push(new THREE.Vector2((point.x + 1) * viewport.width / 2, (1 - point.y) * viewport.height / 2))
    }
  }
  return convexContour(points)
}

export function contourPath(points: THREE.Vector2[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' ') + ' Z'
}

export function nearContour(point: THREE.Vector2, contour: THREE.Vector2[], tolerance: number): boolean {
  let inside = false
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const a = contour[i]
    const b = contour[j]
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
    const edge = b.clone().sub(a)
    const fraction = THREE.MathUtils.clamp(point.clone().sub(a).dot(edge) / (edge.lengthSq() || 1), 0, 1)
    if (a.clone().addScaledVector(edge, fraction).distanceToSquared(point) <= tolerance * tolerance) return true
  }
  return inside
}

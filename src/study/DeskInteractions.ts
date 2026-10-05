import * as THREE from 'three'
import { contourPath, convexContour, nearContour, projectedContour } from './ScreenContours'
import type { Viewport } from './ScreenContours'

export type DeskObjectName = 'book' | 'record' | 'pencil' | 'eraser' | 'polaroid'

export interface InteractiveDeskObject {
  liftFrame: THREE.Object3D
  meshes: THREE.Mesh[]
  // Extra visible surfaces join the highlight without extending the hit area.
  outlineMeshes?: THREE.Mesh[]
  setHover: (amount: number) => void
  updateEveryFrame?: boolean
}

interface InteractionState {
  active: boolean
  backgroundOnly: boolean
  destination: number
  progress: number
  busy: boolean
  recordInTransit: boolean
}

interface DeskInteractionsOptions {
  host: HTMLElement
  scene: THREE.Scene
  camera: THREE.Camera
  canvas: HTMLCanvasElement
  recordEntry: HTMLButtonElement | null
  motionQuery: MediaQueryList
  getViewport: () => Viewport
  getState: () => InteractionState
  invalidate: () => void
}

interface Entry {
  name: DeskObjectName
  path: SVGPathElement
  object: InteractiveDeskObject | null
  hovered: boolean
  lift: number
  resting: THREE.Vector2[]
  raised: THREE.Vector2[]
  dirty: boolean
}

/** Owns hover state and SVG contours, while the scene owns models and rendering. */
export function createDeskInteractions({ host, scene, camera, canvas, recordEntry, motionQuery, getViewport, getState, invalidate }: DeskInteractionsOptions) {
  const namespace = 'http://www.w3.org/2000/svg'
  const outlines = document.createElementNS(namespace, 'svg')
  outlines.classList.add('study__outlines')
  outlines.setAttribute('aria-hidden', 'true')
  // Fill the camera and paper silhouettes together, then retain only the outer
  // edge. Overlapping parts have no dividing line or glow inside the camera.
  const outlineFilterId = `polaroid-outline-${THREE.MathUtils.generateUUID()}`
  const definitions = document.createElementNS(namespace, 'defs')
  const outlineFilter = document.createElementNS(namespace, 'filter')
  outlineFilter.setAttribute('id', outlineFilterId)
  outlineFilter.setAttribute('x', '-10%')
  outlineFilter.setAttribute('y', '-10%')
  outlineFilter.setAttribute('width', '120%')
  outlineFilter.setAttribute('height', '120%')
  const expanded = document.createElementNS(namespace, 'feMorphology')
  expanded.setAttribute('in', 'SourceGraphic')
  expanded.setAttribute('operator', 'dilate')
  expanded.setAttribute('radius', '1')
  expanded.setAttribute('result', 'expanded')
  const border = document.createElementNS(namespace, 'feComposite')
  border.setAttribute('in', 'expanded')
  border.setAttribute('in2', 'SourceAlpha')
  border.setAttribute('operator', 'out')
  outlineFilter.append(expanded, border)
  definitions.appendChild(outlineFilter)
  outlines.appendChild(definitions)
  const entries = new Map<DeskObjectName, Entry>()
  for (const name of ['book', 'record', 'pencil', 'eraser', 'polaroid'] as const) {
    const path = document.createElementNS(namespace, 'path')
    path.classList.add('study__outline', `study__outline--${name}`)
    if (name === 'polaroid') path.style.setProperty('--polaroid-outline-filter', `url(#${outlineFilterId})`)
    outlines.appendChild(path)
    entries.set(name, { name, path, object: null, hovered: false, lift: 0, resting: [], raised: [], dirty: true })
  }
  host.appendChild(outlines)
  let outlinesDirty = true

  function interactive() {
    const state = getState()
    return state.active && !state.backgroundOnly && state.destination === 0 && !state.busy && !state.recordInTransit
  }

  function target(entry: Entry) {
    return interactive() && (entry.hovered || (entry.name === 'record' && recordEntry?.matches(':focus-visible'))) ? 1 : 0
  }

  function syncHighlights() {
    let changed = false
    for (const entry of entries.values()) {
      const active = !!target(entry)
      const key = `${entry.name}Hovered`
      changed ||= host.dataset[key] !== String(active)
      if (entry.name === 'book' || entry.name === 'record') entry.path.classList.toggle('study__outline--active', active)
      host.dataset[key] = String(active)
      if (!interactive()) entry.path.style.opacity = '0'
    }
    if (changed) invalidate()
  }

  function clearHover() {
    for (const entry of entries.values()) entry.hovered = false
  }

  function setObject(name: DeskObjectName, object: InteractiveDeskObject | null) {
    const entry = entries.get(name)!
    entry.object = object
    entry.lift = 0
    entry.dirty = true
    entry.resting = []
    entry.raised = []
    if (object) outlinesDirty = true
    else entry.path.setAttribute('d', '')
  }

  function updateHover(dt: number) {
    let moving = false
    const enabled = interactive()
    for (const entry of entries.values()) {
      const desired = target(entry)
      let next = motionQuery.matches ? desired : THREE.MathUtils.damp(entry.lift, desired, desired ? 12 : 10, dt)
      if (Math.abs(next - desired) < .002) next = desired
      const changed = next !== entry.lift
      if (changed) { entry.lift = next; entry.dirty = true }
      if (changed || entry.object?.updateEveryFrame) entry.object?.setHover(next)
      host.dataset[`${entry.name}Lift`] = next.toFixed(3)
      entry.path.style.opacity = String(enabled ? next * .7 : 0)
      moving ||= next !== desired
    }
    return moving
  }

  function updateOutlines() {
    const state = getState()
    if (!outlinesDirty || state.progress !== 0 || state.busy) return
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    const viewport = getViewport()
    outlines.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`)
    for (const entry of entries.values()) {
      if (!entry.object) continue
      // Retain the resting hit area so lifting a thin object cannot flicker hover.
      const { liftFrame, meshes } = entry.object
      const height = liftFrame.position.z
      liftFrame.position.z = 0
      liftFrame.updateMatrixWorld(true)
      entry.resting = projectedContour(meshes, camera, viewport)
      liftFrame.position.z = height
      liftFrame.updateMatrixWorld(true)
      entry.dirty = true
    }
    if (entries.get('record')!.object) outlinesDirty = false
  }

  function positionRecordEntry(rim: THREE.Vector2[]) {
    if (!recordEntry) return
    const left = Math.min(...rim.map(point => point.x))
    const top = Math.min(...rim.map(point => point.y))
    const width = Math.max(...rim.map(point => point.x)) - left
    const height = Math.max(...rim.map(point => point.y)) - top
    Object.assign(recordEntry.style, {
      left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`,
      clipPath: `polygon(${rim.map(point => `${(point.x - left) / width * 100}% ${(point.y - top) / height * 100}%`).join(',')})`,
    })
  }

  function updateLiftOutlines() {
    const state = getState()
    if (state.progress !== 0 || state.busy || !Array.from(entries.values()).some(entry => entry.dirty)) return
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    for (const entry of entries.values()) {
      if (!entry.object || !entry.dirty) continue
      entry.raised = projectedContour(entry.object.meshes, camera, getViewport())
      const silhouettes = [contourPath(entry.raised)]
      for (const mesh of entry.object.outlineMeshes ?? []) {
        if (mesh.visible && mesh.parent?.visible) silhouettes.push(contourPath(projectedContour([mesh], camera, getViewport())))
      }
      entry.path.setAttribute('d', silhouettes.join(' '))
      if (entry.name === 'record') positionRecordEntry(convexContour([...entry.resting, ...entry.raised]))
      entry.dirty = false
    }
  }

  function hit(name: DeskObjectName, event: PointerEvent, tolerance = 3) {
    const state = getState()
    if (state.destination !== 0 || state.busy) return false
    const entry = entries.get(name)!
    if (!entry.object) return false
    const bounds = canvas.getBoundingClientRect()
    const point = new THREE.Vector2(event.clientX - bounds.left, event.clientY - bounds.top)
    return nearContour(point, entry.resting, tolerance) || nearContour(point, entry.raised, tolerance)
  }

  function pointerMove(event: PointerEvent, hitReadingBook: () => boolean) {
    const state = getState()
    const pencilHit = hit('pencil', event)
    const eraserHit = hit('eraser', event)
    const polaroidHit = hit('polaroid', event)
    const overBook = !pencilHit && !eraserHit && !polaroidHit && !state.busy && (state.destination === 0
      ? hit('book', event, 1) : hitReadingBook())
    canvas.style.cursor = overBook ? 'grab' : 'default'
    entries.get('book')!.hovered = state.destination === 0 && overBook
    entries.get('polaroid')!.hovered = polaroidHit
    entries.get('eraser')!.hovered = eraserHit
    const pencil = entries.get('pencil')!
    const changed = pencil.hovered !== pencilHit
    pencil.hovered = pencilHit
    syncHighlights()
    if (changed) invalidate()
  }

  function pointerLeave() {
    const pencilChanged = entries.get('pencil')!.hovered
    for (const name of ['eraser', 'book', 'polaroid', 'pencil'] as const) entries.get(name)!.hovered = false
    canvas.style.cursor = 'default'
    syncHighlights()
    if (pencilChanged) invalidate()
  }

  const onRecordEnter = (event: PointerEvent) => {
    const pencilChanged = entries.get('pencil')!.hovered
    clearHover()
    entries.get('record')!.hovered = event.pointerType === 'mouse'
    syncHighlights()
    if (pencilChanged) invalidate()
  }
  const onRecordLeave = () => { entries.get('record')!.hovered = false; syncHighlights() }
  recordEntry?.addEventListener('pointerenter', onRecordEnter)
  recordEntry?.addEventListener('pointerleave', onRecordLeave)
  recordEntry?.addEventListener('focus', syncHighlights)
  recordEntry?.addEventListener('blur', syncHighlights)

  return {
    setObject, clearHover, syncHighlights, updateHover, updateOutlines, updateLiftOutlines, hit, pointerMove, pointerLeave,
    invalidateOutlines: () => { outlinesDirty = true },
    setBackgroundOnly: (visible: boolean) => { outlines.style.visibility = visible ? 'hidden' : '' },
    showRecord: (visible: boolean) => { entries.get('record')!.path.style.visibility = visible ? '' : 'hidden' },
    dispose() {
      recordEntry?.removeEventListener('pointerenter', onRecordEnter)
      recordEntry?.removeEventListener('pointerleave', onRecordLeave)
      recordEntry?.removeEventListener('focus', syncHighlights)
      recordEntry?.removeEventListener('blur', syncHighlights)
      outlines.remove()
      entries.clear()
    },
  }
}

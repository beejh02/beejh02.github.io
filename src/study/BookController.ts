import * as THREE from 'three'
import type { BookModel } from './Book'
import type { createDeskInteractions } from './DeskInteractions'

interface BookControllerOptions {
  book: BookModel
  scene: THREE.Scene
  camera: THREE.Camera
  canvas: HTMLCanvasElement
  motionQuery: MediaQueryList
  interactions: ReturnType<typeof createDeskInteractions>
  getViewportWidth: () => number
  getState: () => { active: boolean; backgroundOnly: boolean; disposed: boolean; recordInTransit: boolean }
  updateBook: (dt: number, immediate?: boolean) => void
  notify: () => void
  invalidate: () => void
  onSettled: () => void
}

/** Owns book progress, settling and pointer/keyboard input. */
export function createBookController({ book, scene, camera, canvas, motionQuery, interactions, getViewportWidth, getState, updateBook, notify, invalidate, onSettled }: BookControllerOptions) {
  const { frame: bookFrame, width, coverThickness, pages, total } = book
  let progress = 0
  let destination = progress
  let animationStart = progress
  let animationTime = 0
  let duration = 1.1
  let busy = false
  let pointerStart: ({
    x: number
    y: number
    id: number
  } & ({
    kind: 'background'
    moved: boolean
  } | {
    kind: 'page'
    origin: number
    target: number
    span: number
    dragging: boolean
    vertical: boolean
  })) | null = null
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  function animateTo(next: number, seconds: number) {
    destination = next
    interactions.invalidateOutlines()
    interactions.clearHover()
    canvas.style.cursor = 'default'
    animationStart = progress
    animationTime = 0
    duration = seconds
    if (motionQuery.matches || progress === destination) {
      progress = destination
      busy = false
      updateBook(1, true)
    } else busy = true
    notify()
    invalidate()
  }

  function goTo(next: number) {
    const { active, backgroundOnly, disposed, recordInTransit } = getState()
    if (!active || backgroundOnly || busy || pointerStart || disposed || recordInTransit) return
    next = THREE.MathUtils.clamp(next, 0, total)
    if (next === destination) return
    animateTo(next, next === 0 ? Math.min(2, 0.9 + progress * 0.075) : 1.05)
  }

  function turn(direction: -1 | 1) { goTo(destination + direction) }


  function hit(event: PointerEvent, meshes: THREE.Object3D[] = pages.map(page => page.mesh)) {
    const bounds = canvas.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObjects(meshes)[0]
  }

  // Use the projected spread width so the gesture scales with the visible book.
  // Freeze this distance at pointerdown: the camera moves while opening the cover.
  function dragSpan() {
    scene.updateMatrixWorld(true)
    const left = bookFrame.localToWorld(new THREE.Vector3(-width, 0, coverThickness)).project(camera)
    const right = bookFrame.localToWorld(new THREE.Vector3(width, 0, coverThickness)).project(camera)
    return Math.max(120, Math.min(Math.abs(right.x - left.x) * getViewportWidth() / 2, getViewportWidth() * 0.85))
  }

  const onPointerDown = (event: PointerEvent) => {
    const { active, backgroundOnly, disposed, recordInTransit } = getState()
    if (!active || backgroundOnly || disposed || event.button !== 0 || !event.isPrimary || busy || pointerStart || recordInTransit) return
    const intersection = hit(event)
    if (!intersection && !(destination === 0 && interactions.hit('book', event))) {
      // Shadows belong to the background; cover edges and the spine belong to the book.
      if (destination > 0 && !hit(event, book.meshes)) {
        pointerStart = { kind: 'background', x: event.clientX, y: event.clientY, id: event.pointerId, moved: false }
        canvas.setPointerCapture(event.pointerId)
      }
      return
    }
    const point = intersection && bookFrame.worldToLocal(intersection.point.clone())
    const direction = destination === 0 || (point && point.x > 0) ? 1 : -1
    const target = THREE.MathUtils.clamp(destination + direction, 0, total)
    if (target === destination) return
    pointerStart = {
      kind: 'page',
      x: event.clientX, y: event.clientY, id: event.pointerId,
      origin: destination, target, span: dragSpan(), dragging: false, vertical: false,
    }
    canvas.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent) {
    const start = pointerStart
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (start.kind === 'background') {
      if (Math.hypot(dx, dy) >= 6) start.moved = true
      return
    }
    if (start.vertical) return
    if (!start.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return
      if (Math.abs(dy) > Math.abs(dx)) { start.vertical = true; return }
      start.dragging = true
      destination = start.target
      busy = true
      interactions.clearHover()
      interactions.invalidateOutlines()
      notify()
    }
    event.preventDefault()
    // A sheet remains held until release, including when the pointer leaves it.
    const direction = start.target - start.origin
    const fraction = THREE.MathUtils.clamp(-dx * direction / start.span, 0, 1)
    progress = start.origin + direction * fraction
    canvas.style.cursor = 'grabbing'
    invalidate()
  }

  function releasePointer() {
    const start = pointerStart
    pointerStart = null
    if (start && canvas.hasPointerCapture(start.id)) canvas.releasePointerCapture(start.id)
    return start
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return
    moveDrag(event)
    const start = releasePointer()!
    if (start.kind === 'background') {
      if (!start.moved && !hit(event, book.meshes)) goTo(0)
      return
    }
    if (start.dragging) {
      const next = Math.abs(progress - start.origin) >= 0.5 ? start.target : start.origin
      animateTo(next, 0.2 + Math.abs(next - progress) * 0.45)
      return
    }
    if (start.vertical) return
    if (destination === 0 && interactions.hit('book', event)) { goTo(start.target); return }
    const intersection = hit(event)
    if (!intersection) return
    goTo(start.target)
  }
  const onPointerCancel = (event?: PointerEvent) => {
    if (!pointerStart || (event && event.pointerId !== pointerStart.id)) return
    const start = releasePointer()!
    if (start.kind === 'page' && start.dragging) animateTo(start.origin, 0.2 + Math.abs(progress - start.origin) * 0.45)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (getState().recordInTransit) return
    if (pointerStart) { moveDrag(event); return }
    if (event.pointerType !== 'mouse') return
    interactions.pointerMove(event, () => !!hit(event))
  }
  const onPointerLeave = () => {
    if (pointerStart) return
    interactions.pointerLeave()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const { active, backgroundOnly, recordInTransit } = getState()
    if (!active || backgroundOnly || recordInTransit) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
    if (event.key === 'ArrowRight') { event.preventDefault(); turn(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1) }
    else if (event.key === 'Escape') goTo(0)
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('lostpointercapture', onPointerCancel)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('keydown', onKeyDown)
  const onBlur = () => onPointerCancel()
  window.addEventListener('blur', onBlur)

  return {
    get progress() { return progress },
    get destination() { return destination },
    get busy() { return busy },
    get dragging() { return pointerStart?.kind === 'page' && pointerStart.dragging },
    turn,
    close: () => goTo(0),
    cancel: onPointerCancel,
    update(dt: number) {
      if (busy && !(pointerStart?.kind === 'page' && pointerStart.dragging)) {
        animationTime += dt
        const fraction = Math.min(animationTime / duration, 1)
        const eased = fraction * fraction * (3 - 2 * fraction)
        // Gather the open sheets first, then leave enough time to close the cover
        // and bring the props back, even when returning from the last page.
        progress = destination === 0 && animationStart > 1
          ? fraction < .35
            ? THREE.MathUtils.lerp(animationStart, 1, THREE.MathUtils.smoothstep(fraction, 0, .35))
            : 1 - THREE.MathUtils.smoothstep(fraction, .35, 1)
          : THREE.MathUtils.lerp(animationStart, destination, eased)
        if (fraction === 1) {
          progress = destination
          busy = false
          onSettled()
          notify()
        }
      }
    },
    dispose() {
      releasePointer()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('lostpointercapture', onPointerCancel)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onBlur)
    },
  }
}

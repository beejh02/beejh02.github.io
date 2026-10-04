interface WheelDragOptions {
  enabled: () => boolean
  position: () => number
  start: () => void
  move: (position: number) => void
  end: (position: number) => void
}

export function createWheelDrag(wheel: HTMLElement, record: HTMLElement, options: WheelDragOptions) {
  let pointer: { id: number; x: number; y: number; cx: number; cy: number; angle: number; origin: number; position: number; active: boolean } | null = null
  let suppressClick = false
  let clickTimer = 0

  function finish(cancelled: boolean) {
    if (!pointer) return
    const current = pointer
    pointer = null
    delete wheel.dataset.dragging
    if (wheel.hasPointerCapture(current.id)) wheel.releasePointerCapture(current.id)
    if (!current.active) return
    options.end(cancelled ? current.origin : current.position)
    suppressClick = true
    window.clearTimeout(clickTimer)
    clickTimer = window.setTimeout(() => { suppressClick = false }, 350)
  }

  const down = (event: PointerEvent) => {
    if (pointer || !event.isPrimary || event.button !== 0 || !options.enabled()) return
    suppressClick = false
    const bounds = record.getBoundingClientRect()
    const cx = bounds.left + bounds.width / 2
    const cy = bounds.top + bounds.height / 2
    const position = options.position()
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, cx, cy, angle: Math.atan2(event.clientY - cy, event.clientX - cx), origin: position, position, active: false }
  }
  const move = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return
    if (!options.enabled()) { finish(true); return }
    if (!pointer.active) {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return
      pointer.active = true
      wheel.dataset.dragging = 'true'
      wheel.setPointerCapture(event.pointerId)
      options.start()
    }
    event.preventDefault()
    const angle = Math.atan2(event.clientY - pointer.cy, event.clientX - pointer.cx)
    // Unwrap each movement so crossing the angle boundary keeps the same direction.
    const delta = Math.atan2(Math.sin(angle - pointer.angle), Math.cos(angle - pointer.angle))
    pointer.angle = angle
    pointer.position -= delta / (48 * Math.PI / 180)
    options.move(pointer.position)
  }
  const up = (event: PointerEvent) => {
    if (pointer?.id !== event.pointerId) return
    if (pointer.active) move(event)
    finish(false)
  }
  const cancel = (event?: PointerEvent) => {
    if (!event || pointer?.id === event.pointerId) finish(true)
  }
  const reset = () => finish(true)
  const lostCapture = (event: PointerEvent) => {
    // Touch begins with implicit capture on a card; transferring it to the
    // wheel also emits a bubbling loss event from that card.
    if (event.target === wheel) cancel(event)
  }
  const click = (event: MouseEvent) => {
    if (!suppressClick) return
    suppressClick = false
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const preventNativeDrag = (event: DragEvent) => event.preventDefault()
  const preventWheel = (event: WheelEvent) => { if (pointer?.active) event.preventDefault() }

  wheel.addEventListener('pointerdown', down)
  wheel.addEventListener('pointermove', move)
  wheel.addEventListener('pointerup', up)
  wheel.addEventListener('pointercancel', cancel)
  wheel.addEventListener('lostpointercapture', lostCapture)
  wheel.addEventListener('click', click, true)
  wheel.addEventListener('dragstart', preventNativeDrag)
  wheel.addEventListener('wheel', preventWheel, { passive: false })
  window.addEventListener('blur', reset)
  // A click released outside the wheel must also clear a pending gesture.
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('resize', reset)

  return {
    cancel: reset,
    dispose() {
      const id = pointer?.id
      pointer = null
      if (id !== undefined && wheel.hasPointerCapture(id)) wheel.releasePointerCapture(id)
      delete wheel.dataset.dragging
      window.clearTimeout(clickTimer)
      wheel.removeEventListener('pointerdown', down)
      wheel.removeEventListener('pointermove', move)
      wheel.removeEventListener('pointerup', up)
      wheel.removeEventListener('pointercancel', cancel)
      wheel.removeEventListener('lostpointercapture', lostCapture)
      wheel.removeEventListener('click', click, true)
      wheel.removeEventListener('dragstart', preventNativeDrag)
      wheel.removeEventListener('wheel', preventWheel)
      window.removeEventListener('blur', reset)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('resize', reset)
    },
  }
}

import type { RecordVisual, StudyScene } from '../study/types'

export type RecordTransition =
  | { direction: 'out'; visual: RecordVisual; rotation: number }
  | { direction: 'back'; visual: RecordVisual; rotation: number; target: RecordVisual }

export function projectRecordVisual(src: string): { visual: RecordVisual; rotation: number } | null {
  const record = document.querySelector<HTMLElement>('.project-vinyl')
  if (!record) return null
  const bounds = record.getBoundingClientRect()
  // The rotated square's bounding box grows; the circle keeps its own diameter.
  const size = parseFloat(getComputedStyle(record).width) * 1.16
  const transform = new DOMMatrixReadOnly(getComputedStyle(record).transform)
  return {
    visual: { src, left: bounds.left + bounds.width / 2 - size / 2, top: bounds.top + bounds.height / 2 - size / 2, size },
    rotation: Math.atan2(transform.b, transform.a) * 180 / Math.PI,
  }
}


interface RecordAnimationOptions {
  image: HTMLImageElement
  transition: RecordTransition
  scene: StudyScene | null
  desk: HTMLDivElement | null
  destination: HTMLDivElement | null
  onFinish: () => void
}

/** Owns animation frames, DOM styles and cancellation for one transition. */
export function animateRecordTransition({ image, transition, scene, desk, destination, onFinish }: RecordAnimationOptions) {
  const back = transition.direction === 'back'
  const source = transition.visual
  let cancelled = false
  let animation: Animation | undefined
  let frame = 0
  const duration = 1400
  const phase = (time: number, start: number, end: number) => {
    const value = Math.max(0, Math.min(1, (time - start) / (end - start)))
    return value * value * (3 - 2 * value)
  }
  const updateDeparture = () => {
    if (cancelled || !animation) return
    const elapsed = Math.min(Number(animation.currentTime ?? 0) / duration, 1)
    const time = back ? 1 - elapsed : elapsed
    scene?.setDepartureProgress(time)
    if (desk) {
      desk.style.setProperty('--desk-label-opacity', String(1 - phase(time, 0, .25)))
    }
    destination?.style.setProperty('--record-reveal', String(phase(time, .58, .96)))
    frame = requestAnimationFrame(updateDeparture)
  }
  const finish = () => {
    if (cancelled) return
    onFinish()
  }
  async function moveRecord() {
    if (!image.complete || !image.naturalWidth) await image.decode()
    if (cancelled) return
    const target = back ? transition.target : projectRecordVisual(source.src)?.visual
    if (!target) { finish(); return }
    const dx = target.left + target.size / 2 - source.left - source.size / 2
    const dy = target.top + target.size / 2 - source.top - source.size / 2
    animation = image.animate([
      { transform: `translate(0, 0) scale(1) rotate(${transition.rotation}deg)` },
      { transform: `translate(${dx}px, ${dy}px) scale(${target.size / source.size}) rotate(0deg)` },
    ], { duration, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' })
    updateDeparture()
    await animation.finished
    finish()
  }
  void moveRecord().catch(finish)
  window.addEventListener('resize', finish)
  return () => {
    cancelled = true
    animation?.cancel()
    cancelAnimationFrame(frame)
    desk?.style.removeProperty('--desk-label-opacity')
    destination?.style.removeProperty('--record-reveal')
    window.removeEventListener('resize', finish)
  }
}

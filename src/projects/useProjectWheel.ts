import { useCallback, useEffect, useRef, useState } from 'react'
import { projects } from './projects'
import { createWheelDrag } from './WheelDrag'

export const loopSteps = projects.length * 7
const centerStep = projects.length * 3
export const projectIndex = (step: number) => ((step % projects.length) + projects.length) % projects.length

export function useProjectWheel({ onReturn, entering }: { onReturn: () => void; entering: boolean }) {
  const onReturnRef = useRef(onReturn)
  const enteringRef = useRef(entering)
  const wheelDrag = useRef<ReturnType<typeof createWheelDrag> | null>(null)
  const wheel = useRef<HTMLDivElement>(null)
  const vinyl = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [dragging, setDragging] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  const scrollOffset = useRef(-centerStep)
  const selectedStep = Math.round(progress)
  const selected = projectIndex(selectedStep)

  const stepHeight = useCallback(() => {
    if (!scroller.current || !stage.current) return 1
    return (scroller.current.offsetHeight - stage.current.offsetHeight) / loopSteps
  }, [])
  const scrollOrigin = useCallback(() => {
    if (!scroller.current || !header.current) return 0
    return window.scrollY + scroller.current.getBoundingClientRect().top - header.current.offsetHeight
  }, [])

  useEffect(() => { onReturnRef.current = onReturn }, [onReturn])
  useEffect(() => {
    enteringRef.current = entering
    if (entering) wheelDrag.current?.cancel()
  }, [entering])

  useEffect(() => {
    const root = document.documentElement
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    let frame = 0
    let releaseFrame = 0
    let logicalPosition = 0
    let settling: number | null = null
    let settleTimer = 0
    const rebase = (physicalPosition: number) => {
      // Shift the native scroll range by whole cycles without moving the wheel.
      root.classList.add('projects-rebasing')
      window.scrollTo({ top: scrollOrigin() + physicalPosition * stepHeight(), behavior: 'instant' })
      cancelAnimationFrame(releaseFrame)
      releaseFrame = requestAnimationFrame(() => root.classList.remove('projects-rebasing'))
    }
    const updateProgress = () => {
      frame = 0
      const physicalPosition = (window.scrollY - scrollOrigin()) / stepHeight()
      logicalPosition = physicalPosition + scrollOffset.current
      setProgress(logicalPosition)
      if (settling !== null && Math.abs(logicalPosition - settling) < .002) {
        settling = null
        root.classList.remove('projects-dragging')
        window.clearTimeout(settleTimer)
      }
      const shift = physicalPosition < projects.length ? centerStep : physicalPosition > loopSteps - projects.length ? -centerStep : 0
      if (shift) {
        scrollOffset.current -= shift
        rebase(physicalPosition + shift)
      }
    }
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateProgress)
    }
    const onResize = () => {
      const phase = ((logicalPosition % projects.length) + projects.length) % projects.length
      const physicalPosition = centerStep + phase
      scrollOffset.current = logicalPosition - physicalPosition
      rebase(physicalPosition)
      scheduleUpdate()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onReturnRef.current()
    }
    const drag = wheel.current && vinyl.current ? createWheelDrag(wheel.current, vinyl.current, {
      enabled: () => !enteringRef.current,
      position: () => (window.scrollY - scrollOrigin()) / stepHeight() + scrollOffset.current,
      start: () => {
        setDragging(true)
        settling = null
        window.clearTimeout(settleTimer)
        root.classList.add('projects-dragging')
        window.scrollTo({ top: window.scrollY, behavior: 'instant' })
      },
      move: position => {
        window.scrollTo({ top: scrollOrigin() + (position - scrollOffset.current) * stepHeight(), behavior: 'instant' })
        updateProgress()
      },
      end: position => {
        setDragging(false)
        if (enteringRef.current) {
          settling = null
          root.classList.remove('projects-dragging')
          return
        }
        settling = Math.round(position)
        window.scrollTo({ top: scrollOrigin() + (settling - scrollOffset.current) * stepHeight(), behavior: preference.matches ? 'instant' : 'smooth' })
        scheduleUpdate()
        window.clearTimeout(settleTimer)
        settleTimer = window.setTimeout(() => {
          settling = null
          root.classList.remove('projects-dragging')
        }, 1000)
      },
    }) : null
    wheelDrag.current = drag
    scrollOffset.current = -centerStep
    rebase(centerStep)
    updatePreference()
    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
    preference.addEventListener('change', updatePreference)
    return () => {
      wheelDrag.current = null
      drag?.dispose()
      window.clearTimeout(settleTimer)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(releaseFrame)
      root.classList.remove('projects-rebasing')
      root.classList.remove('projects-dragging')
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      preference.removeEventListener('change', updatePreference)
    }
  }, [scrollOrigin, stepHeight])

  function selectProject(step: number) {
    if (!scroller.current || !stage.current || !header.current) return
    window.scrollTo({ top: scrollOrigin() + (step - scrollOffset.current) * stepHeight(), behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  const position = reducedMotion && !dragging ? selectedStep : progress
  return { position, reducedMotion, selectedStep, selected, selectProject, wheel, vinyl, scroller, stage, header }
}

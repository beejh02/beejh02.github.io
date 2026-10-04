import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RecordVisual, StudyScene } from './study/scene'
import ProjectsPage from './projects/ProjectsPage'

const Desk = lazy(() => import('./Desk'))

interface RecordTransition {
  direction: 'out' | 'back'
  visual: RecordVisual
  rotation: number
  target?: RecordVisual
}

function projectRecordVisual(src: string): { visual: RecordVisual; rotation: number } | null {
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

export default function App() {
  const [projects, setProjects] = useState(() => window.location.hash === '#projects')
  const [recordTransition, setRecordTransition] = useState<RecordTransition | null>(null)
  const [recordImage, setRecordImage] = useState<string | null>(null)
  const restoreRecordFocus = useRef(false)
  const movingRecord = useRef<HTMLImageElement>(null)
  const deskScene = useRef<StudyScene | null>(null)
  const deskLayer = useRef<HTMLDivElement>(null)
  const projectLayer = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    // Both views manage their own scroll position, including history traversal.
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])

  useLayoutEffect(() => {
    // Keep native snapping from shifting the project beneath the moving record.
    document.documentElement.classList.toggle('record-in-transit', !!recordTransition)
    return () => document.documentElement.classList.remove('record-in-transit')
  }, [recordTransition])

  useEffect(() => {
    document.title = projects ? '프로젝트 | 나의 책상' : '나의 책상'
    if (!projects && restoreRecordFocus.current) {
      document.querySelector<HTMLButtonElement>('.record-entry')?.focus({ preventScroll: true })
      restoreRecordFocus.current = false
    }
  }, [projects])

  const openProjects = useCallback(async (record: RecordVisual | null) => {
    // The destination is already loaded, so the desk stays visible throughout.
    setRecordImage(record?.src ?? null)
    setRecordTransition(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !record ? null : { direction: 'out', visual: record, rotation: 0 })
    window.location.hash = 'projects'
    setProjects(true)
  }, [])
  const returnToDesk = useCallback(() => {
    if (recordTransition?.direction === 'back') return
    const origin = projectRecordVisual(recordImage ?? '')
    const target = deskScene.current?.getRecordVisual()
    if (recordTransition || !origin || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRecordTransition(null)
      restoreRecordFocus.current = true
      setProjects(false)
      window.location.hash = ''
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    // The same scene and record image survive the project view. Only measure
    // the current desk position, including any resize, before moving back.
    deskScene.current?.setDepartureProgress(1)
    setRecordTransition({ direction: 'back', visual: { ...origin.visual, src: target.src }, rotation: origin.rotation, target })
  }, [recordTransition, recordImage])

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#projects') {
        setProjects(true)
        if (recordTransition?.direction === 'back') setRecordTransition(null)
      } else if (projects && !recordTransition) returnToDesk()
      else if (recordTransition?.direction !== 'back') {
        setProjects(false)
        setRecordTransition(null)
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [projects, recordTransition, returnToDesk])

  useEffect(() => {
    if (!projects || !recordTransition || !movingRecord.current) return
    const image = movingRecord.current
    const scene = deskScene.current
    const desk = deskLayer.current
    const destination = projectLayer.current
    const back = recordTransition.direction === 'back'
    const source = recordTransition.visual
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
        desk.style.opacity = String(1 - phase(time, .5, .9))
        desk.style.setProperty('--desk-label-opacity', String(1 - phase(time, 0, .25)))
      }
      destination?.style.setProperty('--record-reveal', String(phase(time, .58, .96)))
      frame = requestAnimationFrame(updateDeparture)
    }
    const finish = () => {
      if (cancelled) return
      setRecordTransition(null)
      if (back) {
        scene?.setDepartureProgress(0)
        restoreRecordFocus.current = true
        setProjects(false)
        window.location.hash = ''
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
    async function moveRecord() {
      if (!image.complete || !image.naturalWidth) await image.decode()
      if (cancelled) return
      const target = back ? recordTransition!.target : projectRecordVisual(source.src)?.visual
      if (!target) { finish(); return }
      const dx = target.left + target.size / 2 - source.left - source.size / 2
      const dy = target.top + target.size / 2 - source.top - source.size / 2
      animation = image.animate([
        { transform: `translate(0, 0) scale(1) rotate(${recordTransition!.rotation}deg)` },
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
      scene?.setDepartureProgress(0)
      desk?.style.removeProperty('opacity')
      desk?.style.removeProperty('--desk-label-opacity')
      destination?.style.removeProperty('--record-reveal')
      window.removeEventListener('resize', finish)
    }
  }, [projects, recordTransition])

  return (
    <Suspense fallback={<div className={`page-loading${projects ? ' page-loading--projects' : ''}`} role="status">{projects ? '프로젝트를 불러오는 중…' : '책상을 불러오는 중…'}</div>}>
      <div ref={deskLayer} className={projects ? `record-transition-desk${recordTransition ? '' : ' record-transition-desk--hidden'}` : undefined} style={{ opacity: recordTransition?.direction === 'back' ? 0 : undefined }} inert={projects || undefined} aria-hidden={projects || undefined}>
        <Suspense fallback={null}>
          <Desk onOpenProjects={openProjects} active={!projects || !!recordTransition} recordInTransit={projects} sceneRef={deskScene} />
        </Suspense>
      </div>
      {projects && <div ref={projectLayer} className={recordTransition ? 'record-transition-destination' : undefined} inert={!!recordTransition || undefined}>
        <ProjectsPage onReturn={returnToDesk} recordImage={recordImage} entering={!!recordTransition} />
      </div>}
      {recordImage && <img className="record-transition-image" hidden={!projects || !recordTransition} data-direction={recordTransition?.direction} ref={movingRecord} src={recordImage} alt="" aria-hidden="true" style={recordTransition ? { left: recordTransition.visual.left, top: recordTransition.visual.top, width: recordTransition.visual.size, height: recordTransition.visual.size, transform: `rotate(${recordTransition.rotation}deg)` } : undefined} />}
    </Suspense>
  )
}

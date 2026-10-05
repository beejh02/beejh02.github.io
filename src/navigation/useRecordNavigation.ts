import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RecordVisual, StudyScene } from '../study/scene'

import { animateRecordTransition, projectRecordVisual } from './recordTransition'
import type { RecordTransition } from './recordTransition'

type NavigationState =
  | { phase: 'desk' | 'projects' }
  | { phase: 'opening'; transition: Extract<RecordTransition, { direction: 'out' }> }
  | { phase: 'returning'; transition: Extract<RecordTransition, { direction: 'back' }> }

export function useRecordNavigation() {
  const [navigation, setNavigation] = useState<NavigationState>(() => ({ phase: window.location.hash === '#projects' ? 'projects' : 'desk' }))
  const projects = navigation.phase !== 'desk'
  const recordTransition = 'transition' in navigation ? navigation.transition : null
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
    setNavigation(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !record
      ? { phase: 'projects' }
      : { phase: 'opening', transition: { direction: 'out', visual: record, rotation: 0 } })
    window.location.hash = 'projects'
  }, [])
  const finishReturn = useCallback(() => {
    restoreRecordFocus.current = true
    setNavigation({ phase: 'desk' })
    window.location.hash = ''
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const returnToDesk = useCallback(() => {
    if (recordTransition?.direction === 'back') return
    const origin = projectRecordVisual(recordImage ?? '')
    const target = deskScene.current?.getRecordVisual()
    if (recordTransition || !origin || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishReturn()
      return
    }
    // The same scene and record image survive the project view. Only measure
    // the current desk position, including any resize, before moving back.
    deskScene.current?.setDepartureProgress(1)
    setNavigation({ phase: 'returning', transition: { direction: 'back', visual: { ...origin.visual, src: target.src }, rotation: origin.rotation, target } })
  }, [recordTransition, recordImage, finishReturn])

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#projects') {
        setNavigation(current => current.phase === 'desk' || current.phase === 'returning' ? { phase: 'projects' } : current)
      } else if (projects && !recordTransition) returnToDesk()
      else if (recordTransition?.direction !== 'back') {
        setNavigation({ phase: 'desk' })
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [projects, recordTransition, returnToDesk])

  useEffect(() => {
    if (!projects || !recordTransition || !movingRecord.current) return
    const scene = deskScene.current
    return animateRecordTransition({
      image: movingRecord.current, transition: recordTransition, scene,
      desk: deskLayer.current, destination: projectLayer.current,
      onFinish() {
        if (recordTransition.direction === 'back') {
          scene?.setDepartureProgress(0)
          finishReturn()
        } else setNavigation({ phase: 'projects' })
      },
    })
  }, [projects, recordTransition, finishReturn])

  return { projects, recordTransition, recordImage, movingRecord, deskScene, deskLayer, projectLayer, openProjects, returnToDesk }
}

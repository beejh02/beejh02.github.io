import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createStudyScene } from './study/scene'
import type { StudyScene, BookState, RecordVisual } from './study/scene'

export default function Desk({ onOpenProjects, active = true, recordInTransit = false, sceneRef }: { onOpenProjects: (record: RecordVisual | null) => Promise<void>; active?: boolean; recordInTransit?: boolean; sceneRef?: RefObject<StudyScene | null> }) {
  const host = useRef<HTMLDivElement>(null)
  const recordEntry = useRef<HTMLButtonElement>(null)
  const localScene = useRef<StudyScene | null>(null)
  const scene = sceneRef ?? localScene
  const restoreDeskFocus = useRef(false)
  const [book, setBook] = useState<BookState>({ page: 0, total: 17, busy: false })
  const [failed, setFailed] = useState(false)
  const [openingProjects, setOpeningProjects] = useState(false)

  useEffect(() => {
    if (!host.current) return
    try {
      const study = createStudyScene(host.current, setBook, recordEntry.current)
      scene.current = study
      return () => {
        study.dispose()
        scene.current = null
      }
    } catch (error) {
      console.error('책상을 표시하지 못했습니다.', error)
      setFailed(true)
    }
  }, [scene])

  useEffect(() => {
    scene.current?.setActive(active)
  }, [active, scene])

  useEffect(() => {
    scene.current?.showRecord(!recordInTransit)
  }, [recordInTransit, scene])

  async function openProjects() {
    if (openingProjects) return
    setOpeningProjects(true)
    try {
      let record: RecordVisual | null = null
      try { record = scene.current?.captureRecord() ?? null }
      catch (error) { console.warn('레코드 이동 이미지를 만들지 못했습니다.', error) }
      await onOpenProjects(record)
    }
    finally { setOpeningProjects(false) }
  }

  const closed = book.page === 0
  const reading = !closed

  useEffect(() => {
    if (closed && !book.busy && restoreDeskFocus.current) {
      host.current?.focus({ preventScroll: true })
      restoreDeskFocus.current = false
    }
  }, [closed, book.busy])

  function returnToDesk() {
    restoreDeskFocus.current = true
    scene.current?.close()
  }

  return (
    <main className={`study${reading ? ' study--reading' : ''}`} data-view={reading ? 'book' : 'desk'} aria-label={reading ? '빈 책 페이지' : '짙은 월넛 책상 위의 닫힌 책, 레코드, 연필, 지우개와 폴라로이드 즉석카메라'} aria-busy={book.busy}>
      <div ref={host} className="study__scene" tabIndex={-1} />
      {!failed && (
        <button ref={recordEntry} className="record-entry" hidden={!closed || recordInTransit} aria-label="레코드: 프로젝트 보기" title="프로젝트 보기" disabled={book.busy || openingProjects} onClick={openProjects} />
      )}
      <header className="study__heading">
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M14 7v16M14 8C10 5 6 5 2 6v15c4-1 8-1 12 2 4-3 8-3 12-2V6c-4-1-8-1-12 2Z" />
        </svg>
        <h1>{reading ? '나의 책' : '나의 책상'}</h1>
      </header>
      {!failed && (reading || book.busy) && (
        <button className="study__return" disabled={book.busy} onClick={returnToDesk} title="책상으로 돌아가기 (Esc)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6-6 6 6 6M4 12h16" /></svg>
          <span>{closed ? '돌아가는 중…' : '책상으로 돌아가기'}</span>
        </button>
      )}
      {failed ? (
        <div className="study__error" role="alert">
          <p>3D 책상을 불러오지 못했어요.</p>
          <button onClick={() => window.location.reload()}>다시 불러오기</button>
        </div>
      ) : (
        <footer className="study__footer">
          <p className="study__hint">{closed && book.busy ? '책을 덮고 책상으로 돌아가고 있어요' : closed ? '표지를 잡아 왼쪽으로 끌어 펼쳐보세요' : '책장을 잡아 좌우로 끌어 넘겨보세요'}</p>
        </footer>
      )}
    </main>
  )
}

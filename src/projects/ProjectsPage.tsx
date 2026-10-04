import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { projects } from './projects'
import type { Project } from './projects'
import { createWheelDrag } from './WheelDrag'
import './projects.css'

const loopSteps = projects.length * 7
const centerStep = projects.length * 3
const projectIndex = (step: number) => ((step % projects.length) + projects.length) % projects.length

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'm10 6-6 6 6 6M4 12h16'} /></svg>
}

function ProjectCover({ project }: { project: Project }) {
  return (
    <div className="project-cover" aria-hidden="true">
      {project.imageUrl ? <img src={project.imageUrl} alt="" /> : <>
        <svg className="project-cover__art" viewBox="0 0 300 260" fill="none">
          {project.id === '01' ? <>
            <path d="M35 245V125a115 115 0 0 1 230 0v120Z" fill="currentColor" />
            <path d="M108 245V135a42 42 0 0 1 84 0v110Z" className="project-cover__cutout" />
            <circle cx="150" cy="52" r="22" className="project-cover__cutout" />
            <path d="M18 222h264M18 236h264" className="project-cover__fine-line" />
          </> : project.id === '02' ? <>
            <circle cx="150" cy="132" r="102" fill="currentColor" opacity=".1" />
            {[0, 30, 60, 90, 120, 150].map(angle => <ellipse key={angle} cx="150" cy="132" rx="106" ry="43" transform={`rotate(${angle} 150 132)`} stroke="currentColor" strokeWidth="1.7" />)}
            <circle cx="150" cy="132" r="17" fill="currentColor" />
          </> : <>
            {[52, 75, 98, 121, 144, 167, 190, 213, 236, 259, 282].map(radius => <circle key={radius} cx="16" cy="18" r={radius} stroke="currentColor" strokeWidth="2" />)}
            <circle cx="215" cy="184" r="56" fill="currentColor" />
            <circle cx="215" cy="184" r="35" className="project-cover__cutout" />
          </>}
        </svg>
        <span className="project-cover__number">{project.id}</span>
        <span className="project-cover__name">{project.subtitle}</span>
      </>}
    </div>
  )
}

function ProjectLink({ href, children }: { href?: string; children: string }) {
  return href
    ? <a href={href} target="_blank" rel="noreferrer">{children}<Arrow diagonal /></a>
    : <button disabled title="프로젝트 링크 준비 중">{children}<Arrow diagonal /></button>
}

export default function ProjectsPage({ onReturn, recordImage, entering = false }: { onReturn: () => void; recordImage?: string | null; entering?: boolean }) {
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
  const heading = useRef<HTMLHeadingElement>(null)
  const detailScroll = useRef<HTMLDivElement>(null)
  const scrollOffset = useRef(-centerStep)
  const selectedStep = Math.round(progress)
  const selected = projectIndex(selectedStep)
  const active = projects[selected]

  useEffect(() => { onReturnRef.current = onReturn }, [onReturn])
  useEffect(() => {
    enteringRef.current = entering
    if (entering) wheelDrag.current?.cancel()
  }, [entering])

  useEffect(() => {
    if (detailScroll.current) detailScroll.current.scrollTop = 0
  }, [selected])

  useEffect(() => {
    const root = document.documentElement
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    let frame = 0
    let releaseFrame = 0
    let logicalPosition = 0
    let settling: number | null = null
    let settleTimer = 0
    const stepHeight = () => {
      if (!scroller.current || !stage.current) return 1
      return (scroller.current.offsetHeight - stage.current.offsetHeight) / loopSteps
    }
    const scrollOrigin = () => {
      if (!scroller.current || !header.current) return 0
      return window.scrollY + scroller.current.getBoundingClientRect().top - header.current.offsetHeight
    }
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
  }, [])

  useEffect(() => {
    if (!entering) heading.current?.focus({ preventScroll: true })
  }, [entering])

  function selectProject(step: number) {
    if (!scroller.current || !stage.current || !header.current) return
    const top = window.scrollY + scroller.current.getBoundingClientRect().top - header.current.offsetHeight
    const height = (scroller.current.offsetHeight - stage.current.offsetHeight) / loopSteps
    window.scrollTo({ top: top + (step - scrollOffset.current) * height, behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  const metadata = [
    { title: '타입', values: active.type },
    { title: '언어 / DB', values: active.languages },
    { title: '프레임워크 / 라이브러리', values: active.frameworks },
    { title: '도구 / 환경', values: active.tools },
  ]
  const position = reducedMotion && !dragging ? selectedStep : progress
  const slots = Array.from({ length: 5 }, (_, i) => Math.floor(position) + i - 2)

  return (
    <main className="projects-page" style={{ '--project-accent': active.color } as CSSProperties} aria-label="프로젝트 컬렉션">
      <header className="projects-header" ref={header}>
        <button className="projects-back" onClick={onReturn} title="책상으로 돌아가기 (Esc)"><Arrow /><span>책상으로 돌아가기</span></button>
        <span className="projects-header__title">프로젝트</span>
        <span className="projects-header__count">{active.id} <span>/ {String(projects.length).padStart(2, '0')}</span></span>
      </header>
      <div className="projects-scroll" ref={scroller} style={{ '--scroll-steps': loopSteps } as CSSProperties}>
        {Array.from({ length: loopSteps + 1 }, (_, index) => <div key={index} className="project-scroll-stop" style={{ top: `${index * 90}svh` }} aria-hidden="true" />)}
        <div className="projects-stage" ref={stage}>
          <aside className="project-library" aria-label="프로젝트 선택">
            <div className="project-wheel" ref={wheel} title="레코드를 잡아 돌려 프로젝트를 바꿔보세요">
              <div ref={vinyl} className={`project-vinyl${recordImage ? ' project-vinyl--from-desk' : ''}`} aria-hidden="true" style={{ transform: `translate(-50%, -50%) rotate(${-position * 48}deg)` }}>
                {recordImage ? <img className="project-vinyl__image" src={recordImage} alt="" draggable={false} /> : <span className="project-vinyl__label" />}
              </div>
              {slots.map(slot => {
                const project = projects[projectIndex(slot)]
                const offset = slot - position
                const angle = Math.max(-110, Math.min(110, offset * 48))
                const radians = angle * Math.PI / 180
                const distance = Math.abs(offset)
                const hidden = distance > 1.8
                const style = {
                  '--project-accent': project.color,
                  transform: `translate(-50%, -50%) translate(${(Math.cos(radians) - 1) * 155}%, ${Math.sin(radians) * 155}%) rotate(${reducedMotion ? 0 : angle}deg)`,
                  opacity: Math.max(0, 1 - distance * .3),
                  filter: `blur(${reducedMotion ? 0 : Math.min(2, distance * .8)}px)`,
                  zIndex: 10 - Math.round(distance * 3),
                  visibility: distance > 1.8 ? 'hidden' : 'visible',
                } as CSSProperties
                return <button key={slot} className={`project-card${slot === selectedStep ? ' project-card--active' : ''}`} style={style} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : 0} aria-pressed={hidden ? undefined : slot === selectedStep} aria-controls={hidden ? undefined : 'project-details'} aria-label={hidden ? undefined : `${project.title} 선택`} onClick={() => selectProject(slot)} disabled={hidden}>
                  <ProjectCover project={project} />
                </button>
              })}
            </div>
          </aside>
          <div className="project-detail-scroll" ref={detailScroll}>
            <article id="project-details" className="project-details" aria-labelledby="project-title" key={active.id}>
              <div className="project-preview">{active.imageUrl ? <img src={active.imageUrl} alt={`${active.title} 미리보기`} /> : <><span>프로젝트 미리보기</span><span>{active.id}</span></>}</div>
              <div className="project-title-row"><span className="project-eyebrow">PROJECT {active.id}</span><h1 id="project-title" ref={heading} tabIndex={-1}>{active.title}</h1><p className="project-period">{active.period ?? '진행 기간 · 등록 예정'}</p></div>
              <p className={`project-description${active.description ? '' : ' project-placeholder'}`}>{active.description ?? '프로젝트의 목표와 소개가 들어갈 영역입니다.'}</p>
              <dl className="project-metadata">
                {metadata.map(({ title, values }) => <div key={title}><dt>{title}</dt><dd>{values?.length ? values.map(value => <span key={value}>{value}</span>) : <span className="project-placeholder">등록 예정</span>}</dd></div>)}
              </dl>
              <section className="project-features" aria-labelledby="project-features-title">
                <h2 id="project-features-title">주요 기능 및 특징</h2>
                <ul>{(active.features ?? ['주요 기능을 소개할 영역입니다.', '기술적 선택과 문제 해결 과정을 정리할 영역입니다.', '담당 역할과 프로젝트 결과를 기록할 영역입니다.']).map(feature => <li key={feature} className={active.features ? '' : 'project-placeholder'}>{feature}</li>)}</ul>
              </section>
              <div className="project-links"><ProjectLink href={active.siteUrl}>프로젝트 보기</ProjectLink><ProjectLink href={active.repositoryUrl}>GitHub</ProjectLink></div>
            </article>
          </div>
        </div>
      </div>
    </main>
  )
}

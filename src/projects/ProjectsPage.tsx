import { useEffect, useRef } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { projects } from './projects'
import type { Project } from './projects'
import { loopSteps, projectIndex, useProjectWheel } from './useProjectWheel'
import { projectStepAngle } from './wheelGeometry'
import './projects.css'

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
  const { position, reducedMotion, selectedStep, selected, selectProject, wheel, vinyl, scroller, stage, header } = useProjectWheel({ onReturn, entering })
  const heading = useRef<HTMLHeadingElement>(null)
  const detailScroll = useRef<HTMLDivElement>(null)
  const pointerGesture = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const active = projects[selected]

  function trackPointerMovement(event: PointerEvent) {
    const gesture = pointerGesture.current
    if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 6) gesture.moved = true
  }

  useEffect(() => {
    if (detailScroll.current) detailScroll.current.scrollTop = 0
  }, [selected])

  useEffect(() => {
    if (!entering) heading.current?.focus({ preventScroll: true })
  }, [entering])

  const metadata = [
    { title: '타입', values: active.type },
    { title: '언어 / DB', values: active.languages },
    { title: '프레임워크 / 라이브러리', values: active.frameworks },
    { title: '도구 / 환경', values: active.tools },
  ]
  const slots = Array.from({ length: 5 }, (_, i) => Math.floor(position) + i - 2)

  return (
    <main className="projects-page" style={{ '--project-accent': active.color } as CSSProperties} aria-label="프로젝트 컬렉션"
      onPointerDownCapture={event => {
        if (event.isPrimary && event.button === 0) pointerGesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
      }}
      onPointerMoveCapture={trackPointerMovement}
      onPointerUpCapture={trackPointerMovement}
      onPointerCancelCapture={() => { if (pointerGesture.current) pointerGesture.current.moved = true }}
      onClickCapture={event => {
        // A drag or swipe must not become a card selection or background click.
        if (event.detail > 0 && pointerGesture.current?.moved) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onClick={event => {
        if (entering || !(event.target instanceof Element)) return
        if (!event.target.closest('.project-vinyl, .project-card, .project-details, .projects-header')) onReturn()
      }}>
      <header className="projects-header" ref={header}>
        <button className="projects-back" onClick={onReturn} title="책상으로 돌아가기 (Esc)"><Arrow /><span>책상으로 돌아가기</span></button>
        <span className="projects-header__title">프로젝트</span>
        <span className="projects-header__count">{active.id} <span>/ {String(projects.length).padStart(2, '0')}</span></span>
      </header>
      <div className="projects-scroll" ref={scroller} style={{ '--scroll-steps': loopSteps } as CSSProperties}>
        {Array.from({ length: loopSteps + 1 }, (_, index) => <div key={index} className="project-scroll-stop" style={{ top: `${index * 90}svh` }} aria-hidden="true" />)}
        <div className="projects-stage" ref={stage}>
          <aside className="project-library" aria-label="프로젝트 선택">
            <div className="project-wheel" ref={wheel}>
              <div ref={vinyl} className={`project-vinyl${recordImage ? ' project-vinyl--from-desk' : ''}`} aria-hidden="true" style={{ transform: `translate(-50%, -50%) rotate(${-position * projectStepAngle}deg)` }}>
                {recordImage ? <img className="project-vinyl__image" src={recordImage} alt="" draggable={false} /> : <span className="project-vinyl__label" />}
                <span className="project-vinyl__surface" title="레코드를 잡아 돌려 프로젝트를 바꿔보세요" />
              </div>
              {slots.map(slot => {
                const project = projects[projectIndex(slot)]
                const offset = slot - position
                const angle = Math.max(-110, Math.min(110, offset * projectStepAngle))
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

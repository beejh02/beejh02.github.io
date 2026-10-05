import { lazy, Suspense } from 'react'
import ProjectsPage from './projects/ProjectsPage'
import { useRecordNavigation } from './navigation/useRecordNavigation'

const Desk = lazy(() => import('./Desk'))

export default function App() {
  const { projects, recordTransition, recordImage, movingRecord, deskScene, deskLayer, projectLayer, openProjects, returnToDesk } = useRecordNavigation()

  return (
    <Suspense fallback={<div className={`page-loading${projects ? ' page-loading--projects' : ''}`} role="status">{projects ? '프로젝트를 불러오는 중…' : '책상을 불러오는 중…'}</div>}>
      <div ref={deskLayer} className={projects ? `record-transition-desk${recordTransition ? '' : ' record-transition-desk--background'}` : undefined} inert={projects || undefined} aria-hidden={projects || undefined}>
        <Suspense fallback={null}>
          <Desk onOpenProjects={openProjects} active={!projects || !!recordTransition} backgroundOnly={projects && !recordTransition} recordInTransit={projects} sceneRef={deskScene} />
        </Suspense>
      </div>
      {projects && <div ref={projectLayer} className={`project-layer${recordTransition ? ' record-transition-destination' : ''}`} inert={!!recordTransition || undefined}>
        <ProjectsPage onReturn={returnToDesk} recordImage={recordImage} entering={!!recordTransition} />
      </div>}
      {recordImage && <img className="record-transition-image" hidden={!projects || !recordTransition} data-direction={recordTransition?.direction} ref={movingRecord} src={recordImage} alt="" aria-hidden="true" style={recordTransition ? { left: recordTransition.visual.left, top: recordTransition.visual.top, width: recordTransition.visual.size, height: recordTransition.visual.size, transform: `rotate(${recordTransition.rotation}deg)` } : undefined} />}
    </Suspense>
  )
}

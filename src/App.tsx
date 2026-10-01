import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

const Desk = lazy(() => import('./Desk'))
const ProjectsPage = lazy(() => import('./projects/ProjectsPage'))

export default function App() {
  const [projects, setProjects] = useState(() => window.location.hash === '#projects')

  useEffect(() => {
    const onHashChange = () => setProjects(window.location.hash === '#projects')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.title = projects ? '프로젝트 | 나의 책상' : '나의 책상'
  }, [projects])

  const openProjects = useCallback(() => { window.location.hash = 'projects' }, [])
  const returnToDesk = useCallback(() => { window.location.hash = '' }, [])

  return (
    <Suspense fallback={<div className={`page-loading${projects ? ' page-loading--projects' : ''}`} role="status">{projects ? '프로젝트를 불러오는 중…' : '책상을 불러오는 중…'}</div>}>
      {projects ? <ProjectsPage onReturn={returnToDesk} /> : <Desk onOpenProjects={openProjects} />}
    </Suspense>
  )
}

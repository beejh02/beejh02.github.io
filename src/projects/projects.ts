export interface Project {
  id: string
  title: string
  subtitle: string
  color: string
  period?: string
  type?: string[]
  languages?: string[]
  frameworks?: string[]
  tools?: string[]
  description?: string
  features?: string[]
  imageUrl?: string
  siteUrl?: string
  repositoryUrl?: string
}

// Replace these entries with real project details. Missing links stay disabled.
export const projects: Project[] = [
  { id: '01', title: '프로젝트 01', subtitle: '첫 번째 프로젝트', color: '#ca785d' },
  { id: '02', title: '프로젝트 02', subtitle: '두 번째 프로젝트', color: '#93a78e' },
  { id: '03', title: '프로젝트 03', subtitle: '세 번째 프로젝트', color: '#8a9caf' },
]

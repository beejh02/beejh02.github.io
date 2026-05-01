import { profile } from '../data/profile';
import './Projects.css';

function Projects() {
  const placeholder = profile.projectPlaceholder;

  return (
    <section className="page projects-page">
      <header className="page-hero">
        <span className="eyebrow">Projects</span>
        <h1 className="page-title">
          대표 프로젝트는<br />
          <span className="gradient-text">나중에 채울 공간</span>
        </h1>
        <p className="page-description">
          지금은 프로젝트를 억지로 넣지 않고, 나중에 완성도 있는 결과물을 추가할 수 있도록
          자리와 형식만 잡아두었습니다.
        </p>
      </header>

      <section className="project-placeholder">
        <article className="project-card-empty">
          <span>Coming Soon</span>
          <h2>{placeholder.title}</h2>
          <p>{placeholder.description}</p>
        </article>

        <article className="project-checklist">
          <h3>추가할 때 필요한 정보</h3>
          <ul>
            {placeholder.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

export default Projects;

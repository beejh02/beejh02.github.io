import { profile } from '../data/profile';
import './Skills.css';

function Skills() {
  return (
    <section className="page skills-page">
      <header className="page-hero">
        <span className="eyebrow">Skills</span>
        <h1 className="page-title">
          지금 다루는 것과<br />
          <span className="gradient-text">앞으로 넓혀갈 것</span>
        </h1>
        <p className="page-description">
          아직 확정된 포지션이 없기 때문에 기술 스택도 완성형이 아니라 탐색형으로 보여줍니다.
          이후 방향이 정해지면 이 페이지를 직무 중심으로 재정리하면 됩니다.
        </p>
      </header>

      <section className="skill-grid">
        {profile.skills.map((group) => (
          <article className="skill-card" key={group.title}>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            <ul className="chip-list">
              {group.items.map((item) => (
                <li className="chip" key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </section>
  );
}

export default Skills;

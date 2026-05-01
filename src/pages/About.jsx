import { profile } from '../data/profile';
import './About.css';

function About() {
  return (
    <section className="page about-page">
      <header className="page-hero">
        <span className="eyebrow">About</span>
        <h1 className="page-title">
          아직 정해지지 않은 방향을<br />
          <span className="gradient-text">하나씩 좁혀가는 중</span>
        </h1>
        <p className="page-description">
          {profile.name}의 프로필 페이지입니다. 첫 버전은 거창한 소개보다 현재의 학습 방식,
          관심사, 앞으로 채워갈 공간을 분명하게 보여주는 데 초점을 맞췄습니다.
        </p>
      </header>

      <section className="about-grid">
        <article className="card about-main-card">
          <h2>소개</h2>
          <p>{profile.intro}</p>
          <p>
            포지션은 아직 탐색 중이지만, 웹 화면을 구성하고 사용자가 보기 좋은 형태로 정리하는 일에
            관심을 두고 있습니다. 앞으로 대표 프로젝트가 생기면 이 소개도 더 구체적인 방향으로 바꿀 수 있습니다.
          </p>
        </article>

        <article className="about-side-card">
          <span>Profile</span>
          <strong>{profile.name}</strong>
          <p>{profile.role}</p>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </article>
      </section>

      <section className="section">
        <h2 className="section-title">진행 흐름</h2>
        <div className="timeline-list">
          {profile.timeline.map((item) => (
            <article className="timeline-item" key={item.step}>
              <span>{item.step}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default About;

import { Link } from 'react-router-dom';
import { profile } from '../data/profile';
import './Home.css';

function Home() {
  return (
    <section className="page home-page">
      <div className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Growing Developer</span>
          <h1>
            기술을 배우고<br />
            <span className="gradient-text">작게 구현합니다</span>
          </h1>
          <p>{profile.intro}</p>

          <div className="button-row">
            <a className="button" href={`mailto:${profile.email}`}>
              이메일로 연락하기
            </a>
            <Link className="button secondary" to="/projects">
              프로젝트 자리 보기
            </Link>
          </div>
        </div>

        <aside className="hero-profile-card" aria-label="프로필 요약">
          <div>
            <div className="profile-avatar">JH</div>
            <p className="profile-kicker">{profile.handle}</p>
            <h2>{profile.name}</h2>
            <p>{profile.headline}</p>
          </div>
          <ul className="chip-list">
            {profile.keywords.slice(0, 4).map((keyword) => (
              <li className="chip" key={keyword}>{keyword}</li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="section">
        <div className="soft-panel focus-panel">
          <div className="focus-heading">
            <div>
              <span className="eyebrow">Current Direction</span>
              <h2 className="section-title">지금은 방향을 정리하는 단계입니다</h2>
            </div>
            <p>
              목표 포지션은 아직 미정이므로, 첫 버전은 특정 직무를 과하게 강조하지 않고
              학습 태도와 성장 방향이 보이도록 구성했습니다.
            </p>
          </div>

          <div className="focus-grid">
            {profile.currentFocus.map((item, index) => (
              <article className="focus-card" key={item.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section home-split">
        <div>
          <h2 className="section-title">나중에 프로젝트가 생기면 바로 확장됩니다</h2>
          <p className="section-description">
            지금은 대표 프로젝트를 비워두고, 준비가 끝난 뒤 카드만 추가하는 구조로 만들었습니다.
            프로젝트 이름, 설명, 기술 스택, 링크를 넣으면 전체 페이지에 자연스럽게 이어집니다.
          </p>
          <Link className="inline-link" to="/projects">프로젝트 영역 확인하기 →</Link>
        </div>
        <div className="mini-stack-card">
          <span>Next Update</span>
          <strong>프로젝트 카드 추가</strong>
          <p>대표 프로젝트가 준비되면 이 영역을 실제 결과물 중심으로 교체하면 됩니다.</p>
        </div>
      </section>
    </section>
  );
}

export default Home;

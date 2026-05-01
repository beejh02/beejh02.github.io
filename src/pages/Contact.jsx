import { profile } from '../data/profile';
import './Contact.css';

function Contact() {
  return (
    <section className="page contact-page">
      <header className="page-hero">
        <span className="eyebrow">Contact</span>
        <h1 className="page-title">
          지금은 이메일만<br />
          <span className="gradient-text">연락처로 열어둡니다</span>
        </h1>
        <p className="page-description">
          GitHub, 블로그, 이력서 링크는 준비되면 나중에 추가할 수 있도록 구조만 남겨두었습니다.
        </p>
      </header>

      <section className="contact-card">
        <div>
          <span>Email</span>
          <h2>{profile.email}</h2>
          <p>현재 공개 연락처는 이메일 하나만 사용합니다.</p>
        </div>
        <a className="button" href={`mailto:${profile.email}`}>
          이메일 보내기
        </a>
      </section>
    </section>
  );
}

export default Contact;

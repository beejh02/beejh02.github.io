import { Link } from 'react-router-dom';
import './NotFound.css';

function NotFound() {
  return (
    <section className="page not-found-page">
      <div className="not-found-card">
        <span>404</span>
        <h1>페이지를 찾을 수 없습니다</h1>
        <p>주소가 잘못되었거나 아직 준비되지 않은 페이지입니다.</p>
        <Link className="button" to="/">홈으로 돌아가기</Link>
      </div>
    </section>
  );
}

export default NotFound;

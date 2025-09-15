import React, { useState } from 'react';
import './Home.css';

const Home = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="page-container">
      <h1>홈페이지</h1>
      <p>
        React HashRouter를 사용한 GitHub Pages 예제에 오신 것을 환영합니다.
      </p>
      <p>현재 카운트: {count}</p>
      <button onClick={() => setCount(count + 1)}>카운트 증가</button>
    </div>
  );
};

export default Home;

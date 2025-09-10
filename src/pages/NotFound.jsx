import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => (
  <div className="not-found-container">
    <h1 className="not-found-title">404</h1>
    <p className="not-found-text">페이지를 찾을 수 없습니다.</p>
    <Link to="/" className="home-link">
      홈으로 돌아가기
    </Link>
  </div>
);

export default NotFound;

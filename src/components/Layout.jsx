import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import './Layout.css';

const Layout = () => (
  <div className="layout">
    <header>
      <nav>
        <Link to="/" className="logo">
          MySite
        </Link>
        <div className="nav-links">
          <Link to="/" className="nav-link">
            Home
          </Link>
          <Link to="/about" className="nav-link">
            About
          </Link>
          <Link to="/contact" className="nav-link">
            Contact
          </Link>
        </div>
      </nav>
    </header>
    <main>
      <Outlet />
    </main>
    <footer>
        <p>&copy; 2025 MySite. All rights reserved.</p>
    </footer>
  </div>
);

export default Layout;

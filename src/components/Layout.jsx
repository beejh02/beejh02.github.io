import React from 'react';
// Link 대신 NavLink를 import 합니다.
import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

const Layout = () => (
  <div className="layout">
    <header>
      <nav id="navbar">
        <NavLink to="/" className="logo">
          MyPortfolio
        </NavLink>
        <div className="nav-links">
          <NavLink to="/projects" className="nav-link">
            Projects
          </NavLink>
          <NavLink to="/skills" className="nav-link">
            Skills
          </NavLink>
          <NavLink to="/experience" className="nav-link">
            Experience
          </NavLink>
          <NavLink to="/contact" className="nav-link">
            Contact
          </NavLink>
        </div>
      </nav>
    </header>

    <main>
      <Outlet />
    </main>

    <footer>
      <p>&copy; 2025 MyPortfolio. All rights reserved.</p>
    </footer>
  </div>
);

export default Layout;
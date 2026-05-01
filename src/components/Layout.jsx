import { NavLink, Outlet } from 'react-router-dom';
import { profile } from '../data/profile';
import './Layout.css';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/skills', label: 'Skills' },
  { to: '/projects', label: 'Projects' },
  { to: '/contact', label: 'Contact' },
];

function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="navbar" aria-label="주요 메뉴">
          <NavLink to="/" className="brand" aria-label="홈으로 이동">
            <span className="brand-mark">JH</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <small>{profile.role}</small>
            </span>
          </NavLink>

          <div className="nav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>© 2026 {profile.name}</span>
        <span>Built with React · Vite · GitHub Pages</span>
      </footer>
    </div>
  );
}

export default Layout;

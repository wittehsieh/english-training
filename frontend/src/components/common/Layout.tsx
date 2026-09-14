import { NavLink, Link, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/lessons', label: 'Lessons', icon: '📚', end: false },
  { to: '/my-english', label: 'My English', icon: '🗒️', end: false },
  { to: '/progress', label: 'Progress', icon: '📈', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
];

/** Chrome shown on every screen except the full-screen conversation. */
export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="topbar__brand">
          🗨️ Workplace <span>English</span>
        </Link>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
            }
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

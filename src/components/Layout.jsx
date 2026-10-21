import { NavLink, Outlet, Link } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { TeamLogo } from './ui'
import Logo from './Logo'

export default function Layout() {
  const { team, approvedMemberships, setTeamId, isAdmin } = useApp()

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/calendar', label: 'Calendar' },
    { to: '/open-dates', label: 'Open Dates' },
    { to: '/team', label: 'My Team' },
  ]
  if (isAdmin) links.push({ to: '/admin', label: 'Admin' })

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="MatSlate home"><Logo /></Link>
          <div className="topbar-right">
            {approvedMemberships.length > 1 ? (
              <select
                className="team-switch"
                value={team?.id || ''}
                onChange={(e) => setTeamId(e.target.value)}
                aria-label="Choose team"
              >
                {approvedMemberships.map((m) => <option key={m.school_id} value={m.school_id}>{m.school.name}</option>)}
              </select>
            ) : team ? (
              <span className="team-chip"><TeamLogo school={team} size={26} />{team.name}</span>
            ) : null}
            <Link to="/account" className="account-link">Account</Link>
          </div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        Questions or stuck? Email <a href="mailto:support@matslate.com">support@matslate.com</a>
      </footer>
    </div>
  )
}

import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './lib/AppContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Pending from './pages/Pending'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import EventForm from './pages/EventForm'
import EventPage from './pages/EventPage'
import OpenDates from './pages/OpenDates'
import Team from './pages/Team'
import Schedule from './pages/Schedule'
import Admin from './pages/Admin'
import Account from './pages/Account'

export default function App() {
  const { loading, user, profile, memberships, approvedMemberships, isAdmin } = useApp()

  if (loading) return <div className="center-screen"><Spinner label="Loading MatSlate…" /></div>
  if (!user) return <Login />

  const needsSetup = !profile?.full_name || (memberships.length === 0 && !isAdmin)
  if (needsSetup) return <Setup />

  const waiting = approvedMemberships.length === 0 && !isAdmin
  if (waiting) return <Pending />

  return (
    <Routes>
      <Route path="/team/schedule" element={<Schedule />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/events/new" element={<EventForm />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/events/:id/edit" element={<EventForm />} />
        <Route path="/open-dates" element={<OpenDates />} />
        <Route path="/team" element={<Team />} />
        <Route path="/account" element={<Account />} />
        <Route path="/join" element={<Setup inside />} />
        {isAdmin && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

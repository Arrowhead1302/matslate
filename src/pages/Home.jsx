import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { fetchEvents } from '../lib/api'
import { fmtDateRange, roleLabel, todayISO } from '../lib/format'
import EventCard from '../components/EventCard'
import { Empty, ErrorBox, Spinner, TeamName } from '../components/ui'

export default function Home() {
  const { profile, team, isManager, isAdmin } = useApp()
  const [events, setEvents] = useState(null)
  const [requests, setRequests] = useState([])   // teams asking to join events we host
  const [invites, setInvites] = useState([])     // invites to our team
  const [staff, setStaff] = useState([])         // people asking to join our staff
  const [coachReqs, setCoachReqs] = useState(0)  // admin: head coaches waiting
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const evs = await fetchEvents({ from: todayISO() })
      setEvents(evs)
      if (team) {
        const hostedIds = evs.filter((e) => e.host_school_id === team.id && !e.cancelled).map((e) => e.id)
        const [{ data: reqs }, { data: invs }] = await Promise.all([
          hostedIds.length
            ? supabase.from('event_entries').select('*, school:schools(*), event:events(id,title,start_date,end_date)')
                .in('event_id', hostedIds).eq('kind', 'request').in('status', ['pending', 'waitlisted']).order('created_at')
            : Promise.resolve({ data: [] }),
          supabase.from('event_entries').select('*, event:events(*, host:schools!events_host_school_id_fkey(*))')
            .eq('school_id', team.id).eq('kind', 'invite').eq('status', 'pending'),
        ])
        setRequests(reqs || [])
        setInvites((invs || []).filter((i) => i.event && !i.event.cancelled && i.event.end_date >= todayISO()))
        if (isManager) {
          const { data: st } = await supabase.from('memberships')
            .select('*, person:profiles!memberships_user_id_fkey(full_name, email, phone)')
            .eq('school_id', team.id).eq('status', 'pending').neq('role', 'head_coach')
          setStaff(st || [])
        }
      }
      if (isAdmin) {
        const { count } = await supabase.from('memberships').select('id', { count: 'exact', head: true })
          .eq('status', 'pending').eq('role', 'head_coach')
        setCoachReqs(count || 0)
      }
    } catch (e) { setError(friendlyError(e)) }
  }, [team?.id, isManager, isAdmin])

  useEffect(() => { load() }, [load])

  async function respond(entryId, action) {
    setBusyId(entryId); setError('')
    const { error } = await supabase.rpc('respond_to_entry', { entry_id: entryId, action })
    setBusyId(null)
    if (error) setError(friendlyError(error)); else load()
  }
  async function decideStaff(id, approve) {
    setBusyId(id); setError('')
    const { error } = await supabase.rpc('decide_membership', { mid: id, approve })
    setBusyId(null)
    if (error) setError(friendlyError(error)); else load()
  }

  const mine = (events || []).filter((e) => team && (e.host_school_id === team.id ||
    e.entries.some((x) => x.school_id === team.id && ['approved', 'pending', 'waitlisted'].includes(x.status))))
  const firstName = (profile?.full_name || '').split(' ')[0]
  const todo = requests.length + invites.length + staff.length + coachReqs

  return (
    <div className="stack-lg">
      <section>
        <h1>Hi{firstName ? `, ${firstName}` : ''}</h1>
        <div className="big-actions">
          <Link to="/events/new" className="big-action primary">
            <span className="ba-icon">＋</span><span>Host an Event</span>
          </Link>
          <Link to="/calendar" className="big-action">
            <span className="ba-icon">📅</span><span>Find Events</span>
          </Link>
          <Link to="/open-dates" className="big-action">
            <span className="ba-icon">🤝</span><span>Find an Opponent</span>
          </Link>
        </div>
      </section>

      <ErrorBox error={error} />

      {todo > 0 && (
        <section className="card attention">
          <h2>Needs your answer <span className="count">{todo}</span></h2>

          {coachReqs > 0 && (
            <div className="todo-row">
              <span><strong>{coachReqs}</strong> head coach{coachReqs > 1 ? 'es are' : ' is'} waiting for approval.</span>
              <Link to="/admin" className="btn btn-primary">Review</Link>
            </div>
          )}

          {invites.map((i) => (
            <div className="todo-row" key={i.id}>
              <span>
                <TeamName school={i.event.host} size={24} /> invited you to{' '}
                <Link to={`/events/${i.event.id}`}><strong>{i.event.title}</strong></Link> · {fmtDateRange(i.event.start_date, i.event.end_date)}
                {i.note && <em className="note">“{i.note}”</em>}
              </span>
              <span className="btn-row">
                <button className="btn btn-green" disabled={busyId === i.id} onClick={() => respond(i.id, 'accept')}>Accept</button>
                <button className="btn btn-ghost" disabled={busyId === i.id} onClick={() => respond(i.id, 'decline')}>Decline</button>
              </span>
            </div>
          ))}

          {requests.map((r) => (
            <div className="todo-row" key={r.id}>
              <span>
                <TeamName school={r.school} size={24} /> wants to attend{' '}
                <Link to={`/events/${r.event.id}`}><strong>{r.event.title}</strong></Link> · {fmtDateRange(r.event.start_date, r.event.end_date)}
                {r.status === 'waitlisted' && <span className="muted"> (on waitlist)</span>}
                {r.note && <em className="note">“{r.note}”</em>}
              </span>
              <span className="btn-row">
                <button className="btn btn-green" disabled={busyId === r.id} onClick={() => respond(r.id, 'approve')}>Approve</button>
                <button className="btn btn-ghost" disabled={busyId === r.id} onClick={() => respond(r.id, 'decline')}>Decline</button>
              </span>
            </div>
          ))}

          {staff.map((s) => (
            <div className="todo-row" key={s.id}>
              <span><strong>{s.person?.full_name || s.person?.email}</strong> wants to join your staff as <strong>{roleLabel(s.role)}</strong>
                <span className="muted small"> · {s.person?.email}</span></span>
              <span className="btn-row">
                <button className="btn btn-green" disabled={busyId === s.id} onClick={() => decideStaff(s.id, true)}>Approve</button>
                <button className="btn btn-ghost" disabled={busyId === s.id} onClick={() => decideStaff(s.id, false)}>Decline</button>
              </span>
            </div>
          ))}
        </section>
      )}

      {team && (
        <section>
          <div className="row-between">
            <h2>Our upcoming schedule</h2>
            <Link to="/team/schedule" className="btn btn-ghost">Print schedule</Link>
          </div>
          {events === null ? <Spinner /> : mine.length === 0 ? (
            <Empty>Nothing on your schedule yet. <Link to="/calendar">Find events</Link> or <Link to="/events/new">host one</Link>.</Empty>
          ) : (
            <div className="list">{mine.map((ev) => <EventCard key={ev.id} ev={ev} teamId={team.id} />)}</div>
          )}
        </section>
      )}
      {!team && isAdmin && (
        <Empty>You're signed in as an admin without a team. <Link to="/join">Join your team</Link> to host and attend events.</Empty>
      )}
    </div>
  )
}

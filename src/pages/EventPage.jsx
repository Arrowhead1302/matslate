import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { fetchEvent, fetchTeamSchedule, myEntry, approvedCount } from '../lib/api'
import {
  datesOverlap, fmtDate, fmtDateRange, fmtMoney, fmtTimeRange, genderLabel, mapsLink, textOn, todayISO, typeLabel,
} from '../lib/format'
import { Badge, Empty, ErrorBox, Notice, Spinner, TeamLogo, TeamName } from '../components/ui'

export default function EventPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { team, user, isAdmin } = useApp()
  const [ev, setEv] = useState(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [conflicts, setConflicts] = useState([])

  const load = useCallback(async () => {
    try { setEv(await fetchEvent(id)) } catch (e) { setError(friendlyError(e)); setEv(null) }
  }, [id])
  useEffect(() => { load() }, [load])

  // Warn about other events on the same day(s) for my team
  useEffect(() => {
    if (!ev || !team || ev.host_school_id === team.id) return
    fetchTeamSchedule(team.id, { from: ev.start_date, to: ev.end_date, includePending: true })
      .then((list) => setConflicts(list.filter((x) => x.id !== ev.id && !x.cancelled && datesOverlap(x.start_date, x.end_date, ev.start_date, ev.end_date))))
      .catch(() => {})
  }, [ev?.id, team?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (ev === undefined) return <Spinner />
  if (!ev) return <Empty>That event couldn't be found. It may have been deleted. <Link to="/calendar">Back to the calendar</Link></Empty>

  const isHost = !!team && ev.host_school_id === team.id
  const canManage = isHost || isAdmin
  const mine = team ? myEntry(ev, team.id) : null
  const count = approvedCount(ev)
  const full = !!ev.max_teams && count >= ev.max_teams
  const past = ev.end_date < todayISO()
  const host = ev.host

  async function rpc(fn, args) {
    setBusy(true); setError('')
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) { setError(friendlyError(error)); return false }
    await load()
    return true
  }

  async function requestSpot() {
    if (conflicts.length && !window.confirm(
      `Heads up: your team already has ${conflicts.map((c) => `"${c.title}"`).join(', ')} on ${fmtDate(ev.start_date)}. Send the request anyway?`)) return
    if (await rpc('request_to_attend', { eid: ev.id, sid: team.id, note_text: note.trim() || null })) { setNote(''); setShowNote(false) }
  }
  const respond = (entryId, action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    rpc('respond_to_entry', { entry_id: entryId, action })
  }

  async function setCancelled(value) {
    const msg = value
      ? 'Cancel this event? Every team signed up will see that it is cancelled.'
      : 'Bring this event back?'
    if (!window.confirm(msg)) return
    setBusy(true)
    const { error } = await supabase.from('events').update({ cancelled: value }).eq('id', ev.id)
    setBusy(false)
    if (error) setError(friendlyError(error)); else load()
  }
  async function deleteEvent() {
    if (!window.confirm('Delete this event for good? This cannot be undone. (If teams were coming, "Cancel event" is usually better.)')) return
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) setError(friendlyError(error)); else navigate('/')
  }

  const entries = ev.entries || []
  const approved = entries.filter((x) => x.status === 'approved')
  const requests = entries.filter((x) => x.kind === 'request' && x.status === 'pending')
  const waitlist = entries.filter((x) => x.status === 'waitlisted')
  const invited = entries.filter((x) => x.kind === 'invite' && x.status === 'pending')
  const inactive = entries.filter((x) => ['declined', 'withdrawn'].includes(x.status))
  const fees = [fmtMoney(ev.team_fee) && `${fmtMoney(ev.team_fee)} per team`, fmtMoney(ev.individual_fee) && `${fmtMoney(ev.individual_fee)} per wrestler`].filter(Boolean)

  return (
    <div className="stack-lg">
      {params.get('new') && (
        <Notice tone="success">
          Your event is posted! Other coaches can now find it on the calendar.
          {['dual', 'tri_dual'].includes(ev.event_type) && ' Use “Invite a team” below to send invitations.'}
        </Notice>
      )}

      <section className="event-hero" style={{ background: host.primary_color, color: textOn(host.primary_color), borderColor: host.secondary_color }}>
        <div className="eh-top">
          <TeamLogo school={host} size={56} />
          <div>
            <div className="eh-host">Hosted by {host.name}</div>
            <h1>{ev.title}</h1>
          </div>
        </div>
        <div className="eh-badges">
          <Badge tone="light">{typeLabel(ev.event_type)}</Badge>
          <Badge tone="light">{genderLabel(ev.gender)}</Badge>
          <Badge tone="light">{(ev.levels || []).join(' & ')}</Badge>
          {ev.cancelled && <Badge tone="red">Cancelled</Badge>}
        </div>
      </section>

      {ev.cancelled && <Notice tone="error">This event has been cancelled by the host.</Notice>}
      <ErrorBox error={error} />

      {/* ---- My team's action box ---- */}
      {team && !isHost && !ev.cancelled && !past && (
        <section className="card action-box">
          <MyTeamAction
            ev={ev} mine={mine} full={full} busy={busy} team={team}
            note={note} setNote={setNote} showNote={showNote} setShowNote={setShowNote}
            conflicts={conflicts} onRequest={requestSpot} respond={respond}
          />
        </section>
      )}

      <div className="two-col">
        <section className="card stack">
          <h2>Details</h2>
          <dl className="info">
            <dt>When</dt>
            <dd>{fmtDateRange(ev.start_date, ev.end_date)}{fmtTimeRange(ev.start_time, ev.end_time) && <><br />{fmtTimeRange(ev.start_time, ev.end_time)}</>}</dd>
            {(ev.location_name || ev.address) && <>
              <dt>Where</dt>
              <dd>{ev.location_name}{ev.address && <><br /><a href={mapsLink(ev.address)} target="_blank" rel="noreferrer">{ev.address} ↗</a></>}</dd>
            </>}
            <dt>Teams</dt><dd>{ev.max_teams ? `${count} of ${ev.max_teams}${full ? ' — full' : ''}` : `${count} so far (no limit)`}</dd>
            {fees.length > 0 && <><dt>Fees</dt><dd>{fees.join(' · ')}</dd></>}
            {ev.registration_deadline && <><dt>Sign up by</dt><dd>{fmtDate(ev.registration_deadline, { year: 'numeric' })}</dd></>}
            {ev.payment_info && <><dt>How to pay</dt><dd>{ev.payment_info}</dd></>}
            {ev.weigh_in_info && <><dt>Weigh-ins</dt><dd>{ev.weigh_in_info}</dd></>}
            {ev.format_info && <><dt>Format</dt><dd>{ev.format_info}</dd></>}
            {ev.spectator_info && <><dt>Spectators</dt><dd>{ev.spectator_info}</dd></>}
            {(ev.contact_name || ev.contact_phone || ev.contact_email) && <>
              <dt>Contact</dt>
              <dd>
                {ev.contact_name}
                {ev.contact_phone && <><br /><a href={`tel:${ev.contact_phone}`}>{ev.contact_phone}</a></>}
                {ev.contact_email && <><br /><a href={`mailto:${ev.contact_email}`}>{ev.contact_email}</a></>}
              </dd>
            </>}
          </dl>
          {ev.details && <div className="details-text">{ev.details}</div>}
          {ev.flyer_url && (
            /\.(png|jpe?g|gif|webp)$/i.test(ev.flyer_url)
              ? <a href={ev.flyer_url} target="_blank" rel="noreferrer"><img className="flyer-img" src={ev.flyer_url} alt="Event flyer" /></a>
              : <a className="btn btn-ghost" href={ev.flyer_url} target="_blank" rel="noreferrer">📄 Open flyer{ev.flyer_name ? ` (${ev.flyer_name})` : ''}</a>
          )}
        </section>

        <section className="card stack">
          <h2>Teams attending <span className="count">{count}</span></h2>
          <ul className="team-list">
            <li><TeamName school={host} size={30} /><Badge tone="navy">Host</Badge></li>
            {approved.map((x) => (
              <li key={x.id}>
                <TeamName school={x.school} size={30} />
                {canManage && !past && <button className="btn btn-ghost btn-sm" disabled={busy}
                  onClick={() => respond(x.id, 'remove', `Remove ${x.school.name} from this event?`)}>Remove</button>}
              </li>
            ))}
          </ul>

          {canManage && (requests.length > 0 || waitlist.length > 0 || invited.length > 0) && (
            <div className="stack">
              {requests.length > 0 && <h3>Asking to attend</h3>}
              {requests.map((x) => (
                <div className="todo-row" key={x.id}>
                  <span><TeamName school={x.school} size={26} />{x.note && <em className="note">“{x.note}”</em>}</span>
                  <span className="btn-row">
                    <button className="btn btn-green" disabled={busy || full} title={full ? 'Event is full' : ''} onClick={() => respond(x.id, 'approve')}>Approve</button>
                    {ev.max_teams && <button className="btn btn-ghost" disabled={busy} onClick={() => respond(x.id, 'waitlist')}>Waitlist</button>}
                    <button className="btn btn-ghost" disabled={busy} onClick={() => respond(x.id, 'decline')}>Decline</button>
                  </span>
                </div>
              ))}
              {waitlist.length > 0 && <h3>Waitlist</h3>}
              {waitlist.map((x) => (
                <div className="todo-row" key={x.id}>
                  <span><TeamName school={x.school} size={26} />{x.note && <em className="note">“{x.note}”</em>}</span>
                  <span className="btn-row">
                    <button className="btn btn-green" disabled={busy || full} title={full ? 'Event is full' : ''} onClick={() => respond(x.id, 'approve')}>Approve</button>
                    <button className="btn btn-ghost" disabled={busy} onClick={() => respond(x.id, 'decline')}>Decline</button>
                  </span>
                </div>
              ))}
              {full && (requests.length > 0 || waitlist.length > 0) && <p className="muted small">The event is full. Remove a team or raise the team limit (Edit) to approve more.</p>}
              {invited.length > 0 && <h3>Invited — waiting for an answer</h3>}
              {invited.map((x) => (
                <div className="todo-row" key={x.id}>
                  <TeamName school={x.school} size={26} />
                  <Badge tone="yellow">Invited</Badge>
                </div>
              ))}
            </div>
          )}
          {!canManage && (waitlist.length > 0 || requests.length > 0) && (
            <p className="muted small">{requests.length} request{requests.length === 1 ? '' : 's'} waiting · {waitlist.length} on waitlist</p>
          )}
          {canManage && inactive.length > 0 && (
            <details>
              <summary className="muted">Declined or withdrawn ({inactive.length})</summary>
              <ul className="team-list">{inactive.map((x) => <li key={x.id}><TeamName school={x.school} size={24} /><Badge>{x.status === 'withdrawn' ? 'Withdrew' : 'Declined'}</Badge></li>)}</ul>
            </details>
          )}
          {canManage && !ev.cancelled && !past && <InviteBox ev={ev} busy={busy} onInvite={(sid, msg) => rpc('invite_team', { eid: ev.id, sid, note_text: msg || null })} />}
        </section>
      </div>

      <Updates ev={ev} canPost={canManage} userId={user.id} reload={load} />

      {canManage && (
        <section className="card">
          <h2>Host tools</h2>
          <div className="btn-row wrap">
            <Link to={`/events/${ev.id}/edit`} className="btn btn-primary">Edit event</Link>
            <Link to={`/events/new?copy=${ev.id}`} className="btn btn-ghost">Copy for next year</Link>
            {!ev.cancelled
              ? <button className="btn btn-ghost danger" disabled={busy} onClick={() => setCancelled(true)}>Cancel event</button>
              : <button className="btn btn-ghost" disabled={busy} onClick={() => setCancelled(false)}>Un-cancel</button>}
            <button className="btn btn-ghost danger" onClick={deleteEvent}>Delete</button>
          </div>
        </section>
      )}
    </div>
  )
}

function MyTeamAction({ ev, mine, full, busy, team, note, setNote, showNote, setShowNote, conflicts, onRequest, respond }) {
  const conflictNote = conflicts.length > 0 && (
    <p className="warn small">⚠ {team.name} already has {conflicts.map((c) => <Link key={c.id} to={`/events/${c.id}`}>{c.title}</Link>).reduce((a, b) => [a, ', ', b])} on this date.</p>
  )
  const deadlinePassed = ev.registration_deadline && ev.registration_deadline < todayISO()

  if (mine?.status === 'approved') return (
    <div className="row-between wrap">
      <div><Badge tone="green">You're in</Badge> <strong>{team.name}</strong> is attending this event.</div>
      <button className="btn btn-ghost" disabled={busy} onClick={() => respond(mine.id, 'withdraw', 'Withdraw your team from this event? The host will see that you withdrew.')}>Withdraw</button>
    </div>
  )
  if (mine?.status === 'pending' && mine.kind === 'invite') return (
    <div className="stack">
      <div><Badge tone="orange">Invitation</Badge> <strong>{ev.host.name}</strong> invited {team.name} to this event.{mine.note && <em className="note">“{mine.note}”</em>}</div>
      {conflictNote}
      <div className="btn-row">
        <button className="btn btn-green btn-big" disabled={busy || full} onClick={() => respond(mine.id, 'accept')}>Accept</button>
        <button className="btn btn-ghost btn-big" disabled={busy} onClick={() => respond(mine.id, 'decline')}>Decline</button>
      </div>
      {full && <p className="muted small">This event filled up. Ask the host to make room.</p>}
    </div>
  )
  if (mine?.status === 'pending') return (
    <div className="row-between wrap">
      <div><Badge tone="yellow">Request sent</Badge> Waiting for {ev.host.name} to approve.</div>
      <button className="btn btn-ghost" disabled={busy} onClick={() => respond(mine.id, 'withdraw', 'Cancel your request?')}>Cancel request</button>
    </div>
  )
  if (mine?.status === 'waitlisted') return (
    <div className="row-between wrap">
      <div><Badge tone="yellow">Waitlist</Badge> The event is full. You'll be added if a spot opens and the host approves you.</div>
      <button className="btn btn-ghost" disabled={busy} onClick={() => respond(mine.id, 'withdraw', 'Leave the waitlist?')}>Leave waitlist</button>
    </div>
  )
  return (
    <div className="stack">
      {mine?.status === 'declined' && <p className="muted">Your earlier request wasn't approved. You can ask again.</p>}
      {conflictNote}
      {deadlinePassed && <p className="warn small">The sign-up deadline has passed. You can still ask — the host decides.</p>}
      {showNote && (
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional message to the host (e.g. “Bringing about 12 wrestlers”)" />
      )}
      <div className="btn-row wrap">
        <button className="btn btn-primary btn-big" disabled={busy} onClick={onRequest}>
          {busy ? 'Sending…' : full ? 'Join the waitlist' : 'Request to attend'}
        </button>
        {!showNote && <button className="btn btn-ghost" onClick={() => setShowNote(true)}>Add a message</button>}
      </div>
      <p className="muted small">{ev.host.name} will be asked to approve {team.name}.</p>
    </div>
  )
}

function InviteBox({ ev, busy, onInvite }) {
  const [open, setOpen] = useState(false)
  const [schools, setSchools] = useState([])
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (open && !schools.length) supabase.from('schools').select('*').eq('verified', true).order('name').then(({ data }) => setSchools(data || []))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const taken = new Set([ev.host_school_id, ...(ev.entries || []).filter((x) => !['declined', 'withdrawn'].includes(x.status)).map((x) => x.school_id)])
  const list = useMemo(() => schools.filter((s) => !taken.has(s.id) && s.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8),
    [schools, q, ev.entries]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return <button className="btn btn-primary" onClick={() => setOpen(true)}>＋ Invite a team</button>
  return (
    <div className="subcard stack">
      <strong>Invite a team</strong>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools…" autoFocus />
      <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Optional message" />
      <div className="pick-list">
        {list.map((s) => (
          <button key={s.id} type="button" className="pick-item" disabled={busy} onClick={async () => { await onInvite(s.id, msg); setQ('') }}>
            <TeamName school={s} size={26} /> <span className="pick-action">Invite</span>
          </button>
        ))}
        {list.length === 0 && <p className="muted small">No matching schools.</p>}
      </div>
      <button className="btn btn-ghost" onClick={() => setOpen(false)}>Done</button>
    </div>
  )
}

function Updates({ ev, canPost, userId, reload }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const updates = [...(ev.updates || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (!canPost && updates.length === 0) return null

  async function post(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setError('')
    const { error } = await supabase.from('event_updates').insert({ event_id: ev.id, author_id: userId, message: text.trim() })
    setBusy(false)
    if (error) setError(friendlyError(error)); else { setText(''); reload() }
  }
  async function remove(id) {
    if (!window.confirm('Delete this update?')) return
    await supabase.from('event_updates').delete().eq('id', id)
    reload()
  }

  return (
    <section className="card stack">
      <h2>Updates from the host</h2>
      {canPost && (
        <form onSubmit={post} className="stack">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Post a change or reminder for every team (e.g. “Weigh-ins moved to 7:30”)" />
          <ErrorBox error={error} />
          <div><button className="btn btn-primary" disabled={busy || !text.trim()}>Post update</button></div>
        </form>
      )}
      {updates.length === 0 ? <p className="muted">No updates yet.</p> : (
        <ul className="updates">
          {updates.map((u) => (
            <li key={u.id}>
              <div className="u-meta">{u.author?.full_name || 'Host'} · {new Date(u.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {canPost && <button className="link-btn small" onClick={() => remove(u.id)}>Delete</button>}
              </div>
              <div>{u.message}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

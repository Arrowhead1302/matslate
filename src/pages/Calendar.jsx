import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { fetchEvents, spotsLeft } from '../lib/api'
import { EVENT_TYPES, monthKey, parseDate, toISODate, todayISO } from '../lib/format'
import { friendlyError } from '../lib/supabase'
import EventCard from '../components/EventCard'
import { Empty, ErrorBox, Spinner } from '../components/ui'

const PREF_KEY = 'matslate.calendarPrefs'
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {} } catch { return {} }
}

export default function Calendar() {
  const { team } = useApp()
  const saved = loadPrefs()
  const [view, setView] = useState(saved.view || 'list')
  const [gender, setGender] = useState(saved.gender || 'all')
  const [type, setType] = useState('all')
  const [openOnly, setOpenOnly] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ view, gender })) } catch { /* ignore */ }
  }, [view, gender])

  useEffect(() => {
    setEvents(null)
    let from = null, to = null
    if (view === 'month') {
      from = toISODate(new Date(month.getFullYear(), month.getMonth(), 1))
      to = toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    } else if (!showPast) {
      from = todayISO()
    }
    fetchEvents({ from, to }).then(setEvents).catch((e) => setError(friendlyError(e)))
  }, [view, month, showPast])

  const filtered = useMemo(() => (events || []).filter((ev) => {
    if (gender !== 'all' && ev.gender !== gender && ev.gender !== 'both') return false
    if (type !== 'all' && ev.event_type !== type) return false
    if (openOnly && (ev.cancelled || spotsLeft(ev) === 0)) return false
    return true
  }), [events, gender, type, openOnly])

  return (
    <div className="stack">
      <div className="row-between wrap">
        <h1>Calendar</h1>
        <Link to="/events/new" className="btn btn-primary">＋ Host an Event</Link>
      </div>

      <div className="filters card">
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
        </div>
        <div className="seg" role="group" aria-label="Boys or girls">
          {[['all', 'All'], ['boys', 'Boys'], ['girls', 'Girls']].map(([v, l]) => (
            <button key={v} className={gender === v ? 'on' : ''} onClick={() => setGender(v)}>{l}</button>
          ))}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
          <option value="all">All event types</option>
          {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open spots only</label>
        {view === 'list' && <label className="check"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show past events</label>}
      </div>

      <ErrorBox error={error} />
      {events === null ? <Spinner /> : view === 'list'
        ? <ListView events={filtered} teamId={team?.id} />
        : <MonthView events={filtered} month={month} setMonth={setMonth} teamId={team?.id} />}
    </div>
  )
}

function ListView({ events, teamId }) {
  if (!events.length) return <Empty>No events match. Try changing the filters above.</Empty>
  const groups = []
  for (const ev of events) {
    const k = monthKey(ev.start_date)
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [] })
    groups[groups.length - 1].items.push(ev)
  }
  return groups.map((g) => (
    <section key={g.k}>
      <h2 className="month-head">{g.k}</h2>
      <div className="list">{g.items.map((ev) => <EventCard key={ev.id} ev={ev} teamId={teamId} />)}</div>
    </section>
  ))
}

function MonthView({ events, month, setMonth, teamId }) {
  const year = month.getFullYear(), m = month.getMonth()
  const first = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, m, d)))
  while (cells.length % 7) cells.push(null)
  const today = todayISO()
  const [selected, setSelected] = useState(null)

  const onDay = (iso) => events.filter((ev) => ev.start_date <= iso && ev.end_date >= iso)
  const selectedEvents = selected ? onDay(selected) : []

  return (
    <div className="stack">
      <div className="month-nav">
        <button className="btn btn-ghost" onClick={() => { setSelected(null); setMonth(new Date(year, m - 1, 1)) }} aria-label="Previous month">‹ Prev</button>
        <h2>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <button className="btn btn-ghost" onClick={() => { setSelected(null); setMonth(new Date(year, m + 1, 1)) }} aria-label="Next month">Next ›</button>
      </div>
      <div className="month-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="mg-head">{d}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="mg-cell empty" />
          const evs = onDay(iso)
          return (
            <button
              key={iso}
              className={'mg-cell' + (iso === today ? ' today' : '') + (iso === selected ? ' selected' : '') + (evs.length ? ' has' : '')}
              onClick={() => setSelected(iso)}
            >
              <span className="mg-num">{parseDate(iso).getDate()}</span>
              {evs.slice(0, 3).map((ev) => (
                <span key={ev.id} className="mg-ev" style={{ background: ev.host?.primary_color }} title={ev.title}>{ev.title}</span>
              ))}
              {evs.length > 3 && <span className="mg-more">+{evs.length - 3} more</span>}
            </button>
          )
        })}
      </div>
      {selected && (
        <section>
          <h2>{parseDate(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          {selectedEvents.length
            ? <div className="list">{selectedEvents.map((ev) => <EventCard key={ev.id} ev={ev} teamId={teamId} />)}</div>
            : <Empty>No events this day.</Empty>}
        </section>
      )}
    </div>
  )
}

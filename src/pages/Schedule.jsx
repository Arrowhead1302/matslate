import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { fetchTeamSchedule } from '../lib/api'
import { fmtTimeRange, genderLabel, parseDate, seasonFor, textOn, toISODate, typeLabel } from '../lib/format'
import { Spinner, TeamLogo } from '../components/ui'

// Printable, team-branded season schedule
export default function Schedule() {
  const { team } = useApp()
  const [season, setSeason] = useState(seasonFor())
  const [gender, setGender] = useState('all')
  const [events, setEvents] = useState(null)

  useEffect(() => {
    if (!team) return
    setEvents(null)
    fetchTeamSchedule(team.id, { from: season.start, to: season.end }).then(setEvents)
  }, [team?.id, season.start]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (events || [])
    .filter((e) => !e.cancelled)
    .filter((e) => gender === 'all' || e.gender === gender || e.gender === 'both'), [events, gender])

  if (!team) return <div className="main"><Link to="/">Back</Link></div>
  const fg = textOn(team.primary_color)
  const lastYear = parseInt(season.start.slice(0, 4), 10)
  const shift = (n) => setSeason(seasonFor(new Date(lastYear + n, 8, 1)))

  function downloadICS() {
    const esc = (s = '') => String(s).replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n')
    const ymd = (s) => s.replace(/-/g, '')
    const nextDay = (s) => { const d = parseDate(s); d.setDate(d.getDate() + 1); return toISODate(d).replace(/-/g, '') }
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MatSlate//EN', `X-WR-CALNAME:${esc(team.name)} Wrestling`]
    for (const e of rows) {
      lines.push('BEGIN:VEVENT', `UID:${e.id}@matslate.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`)
      if (e.start_time && e.start_date === e.end_date) {
        lines.push(`DTSTART:${ymd(e.start_date)}T${e.start_time.replace(/:/g, '').slice(0, 6).padEnd(6, '0')}`)
        if (e.end_time) lines.push(`DTEND:${ymd(e.end_date)}T${e.end_time.replace(/:/g, '').slice(0, 6).padEnd(6, '0')}`)
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ymd(e.start_date)}`, `DTEND;VALUE=DATE:${nextDay(e.end_date)}`)
      }
      lines.push(`SUMMARY:${esc(e.title)}`, `LOCATION:${esc([e.location_name, e.address].filter(Boolean).join(', '))}`,
        `DESCRIPTION:${esc(`${typeLabel(e.event_type)} · Host: ${e.host.name}\nhttps://matslate.com/events/${e.id}`)}`, 'END:VEVENT')
    }
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${team.name.replace(/\W+/g, '-')}-wrestling-${season.label}.ics`
    a.click()
  }

  return (
    <div className="schedule-page" style={{ '--tp': team.primary_color, '--ts': team.secondary_color, '--tf': fg }}>
      <div className="no-print schedule-tools">
        <Link to="/team" className="btn btn-ghost">‹ Back</Link>
        <div className="seg">
          <button onClick={() => shift(-1)}>‹</button>
          <button className="on">{season.label} season</button>
          <button onClick={() => shift(1)}>›</button>
        </div>
        <div className="seg">
          {[['all', 'All'], ['boys', 'Boys'], ['girls', 'Girls']].map(([v, l]) => (
            <button key={v} className={gender === v ? 'on' : ''} onClick={() => setGender(v)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        <button className="btn btn-ghost" onClick={downloadICS} disabled={!rows.length}>📅 Add to my phone calendar</button>
      </div>

      <div className="sheet">
        <header className="sheet-head">
          <TeamLogo school={team} size={84} />
          <div>
            <div className="sheet-school">{team.name}{team.mascot ? ` ${team.mascot}` : ''}</div>
            <div className="sheet-title">{gender === 'all' ? '' : genderLabel(gender) + ' '}Wrestling Schedule · {season.label}</div>
          </div>
        </header>
        {events === null ? <Spinner /> : rows.length === 0 ? <p className="sheet-empty">No events on the schedule for this season yet.</p> : (
          <table className="sheet-table">
            <thead>
              <tr><th>Date</th><th>Event</th><th>Location</th><th>Time</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const home = e.host_school_id === team.id
                const d = parseDate(e.start_date), d2 = parseDate(e.end_date)
                return (
                  <tr key={e.id} className={home ? 'home' : ''}>
                    <td className="nowrap">
                      <strong>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{e.end_date !== e.start_date ? `–${d2.getMonth() === d.getMonth() ? d2.getDate() : d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</strong>
                      <div className="small">{d.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                    </td>
                    <td>
                      <strong>{e.title}</strong>
                      <div className="small">{typeLabel(e.event_type)}{gender === 'all' && e.gender !== 'boys' ? ` · ${genderLabel(e.gender)}` : ''}{home ? ' · HOME' : ` · at ${e.host.name}`}</div>
                    </td>
                    <td>{e.location_name || e.host.name}{e.address && <div className="small">{e.address}</div>}</td>
                    <td className="nowrap">{fmtTimeRange(e.start_time, e.end_time) || 'TBA'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <footer className="sheet-foot">Schedule subject to change · Made with MatSlate</footer>
      </div>
    </div>
  )
}

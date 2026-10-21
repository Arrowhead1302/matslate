import { Link } from 'react-router-dom'
import { Badge, TeamLogo } from './ui'
import { fmtTimeRange, genderLabel, parseDate, typeLabel } from '../lib/format'
import { approvedCount, myStatus } from '../lib/api'

export function DateBlock({ date, endDate }) {
  const d = parseDate(date)
  const multi = endDate && endDate !== date
  return (
    <div className="date-block">
      <span className="db-month">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
      <span className="db-day">{d.getDate()}{multi ? '+' : ''}</span>
      <span className="db-wd">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
    </div>
  )
}

export default function EventCard({ ev, teamId }) {
  const status = myStatus(ev, teamId)
  const count = approvedCount(ev)
  const full = ev.max_teams && count >= ev.max_teams
  return (
    <Link to={`/events/${ev.id}`} className={'event-card' + (ev.cancelled ? ' cancelled' : '')} style={{ '--team': ev.host?.primary_color }}>
      <DateBlock date={ev.start_date} endDate={ev.end_date} />
      <div className="ec-body">
        <div className="ec-title">{ev.title}</div>
        <div className="ec-host"><TeamLogo school={ev.host} size={20} /> {ev.host?.name}</div>
        <div className="ec-meta">
          <Badge tone="navy">{typeLabel(ev.event_type)}</Badge>
          <Badge tone={ev.gender === 'girls' ? 'purple' : ev.gender === 'both' ? 'teal' : 'blue'}>{genderLabel(ev.gender)}</Badge>
          {ev.cancelled && <Badge tone="red">Cancelled</Badge>}
          {!ev.cancelled && (ev.max_teams
            ? <Badge tone={full ? 'red' : 'gray'}>{full ? 'Full' : `${count} of ${ev.max_teams} teams`}</Badge>
            : <Badge tone="gray">{count} {count === 1 ? 'team' : 'teams'}</Badge>)}
          {fmtTimeRange(ev.start_time, ev.end_time) && <span className="muted small">{fmtTimeRange(ev.start_time, ev.end_time)}</span>}
        </div>
      </div>
      {status && <div className="ec-status"><Badge tone={status.tone}>{status.label}</Badge></div>}
    </Link>
  )
}

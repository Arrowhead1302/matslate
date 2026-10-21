import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { GENDERS, fmtDate, genderLabel, todayISO } from '../lib/format'
import { Badge, ChoiceCards, Empty, ErrorBox, Field, Spinner, TeamName } from '../components/ui'
import { DateBlock } from '../components/EventCard'

const HOME_AWAY = [
  { value: 'home', label: 'At our place' },
  { value: 'away', label: 'We\'ll travel' },
  { value: 'either', label: 'Either' },
]
const haLabel = (v) => ({ home: 'Wants to host', away: 'Will travel', either: 'Home or away' }[v])

export default function OpenDates() {
  const { team, user, isAdmin } = useApp()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ date: '', gender: 'boys', home_away: 'either', notes: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('open_dates')
      .select('*, school:schools(*), poster:profiles(full_name, email, phone)')
      .gte('date', todayISO()).order('date')
    if (error) setError(friendlyError(error)); else setItems(data)
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    if (!form.date) return setError('Choose a date.')
    setBusy(true); setError('')
    const { error } = await supabase.from('open_dates').insert({ ...form, school_id: team.id, created_by: user.id })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setForm({ date: '', gender: 'boys', home_away: 'either', notes: '' }); setAdding(false); load()
  }
  async function markFilled(id, filled) {
    await supabase.from('open_dates').update({ filled }).eq('id', id); load()
  }
  async function remove(id) {
    if (!window.confirm('Remove this open date?')) return
    await supabase.from('open_dates').delete().eq('id', id); load()
  }

  const open = (items || []).filter((i) => !i.filled)
  const filled = (items || []).filter((i) => i.filled && team && i.school_id === team.id)

  return (
    <div className="stack">
      <div className="row-between wrap">
        <div>
          <h1>Open Dates</h1>
          <p className="muted">Teams looking for an opponent. Post a date you have open, or find someone to wrestle.</p>
        </div>
        {team && !adding && <button className="btn btn-primary" onClick={() => setAdding(true)}>＋ Post an open date</button>}
      </div>

      {adding && (
        <form className="card stack narrow" onSubmit={add}>
          <h2>Post an open date</h2>
          <Field label="Date" required><input type="date" min={todayISO()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <div className="field"><span className="field-label">Boys or girls?</span>
            <ChoiceCards options={GENDERS} value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} columns={3} /></div>
          <div className="field"><span className="field-label">Where?</span>
            <ChoiceCards options={HOME_AWAY} value={form.home_away} onChange={(v) => setForm({ ...form, home_away: v })} columns={3} /></div>
          <Field label="Notes" hint="Optional — e.g. “Looking for a varsity + JV dual, evening.”">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <ErrorBox error={error} />
          <div className="btn-row">
            <button className="btn btn-primary btn-big" disabled={busy}>Post</button>
            <button type="button" className="btn btn-ghost btn-big" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      {!adding && <ErrorBox error={error} />}
      {items === null ? <Spinner /> : open.length === 0 ? <Empty>No open dates posted right now.</Empty> : (
        <div className="list">
          {open.map((i) => {
            const ours = team && i.school_id === team.id
            return (
              <div key={i.id} className="event-card static" style={{ '--team': i.school.primary_color }}>
                <DateBlock date={i.date} />
                <div className="ec-body">
                  <div className="ec-title"><TeamName school={i.school} size={24} /></div>
                  <div className="ec-meta">
                    <Badge tone={i.gender === 'girls' ? 'purple' : i.gender === 'both' ? 'teal' : 'blue'}>{genderLabel(i.gender)}</Badge>
                    <Badge tone="gray">{haLabel(i.home_away)}</Badge>
                  </div>
                  {i.notes && <div className="note-line">{i.notes}</div>}
                  <div className="muted small">
                    Contact: {i.poster?.full_name || 'Coach'}
                    {i.poster?.phone && <> · <a href={`tel:${i.poster.phone}`}>{i.poster.phone}</a></>}
                    {i.poster?.email && <> · <a href={`mailto:${i.poster.email}`}>{i.poster.email}</a></>}
                  </div>
                </div>
                <div className="ec-actions">
                  {ours || isAdmin ? (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => markFilled(i.id, true)}>Mark filled</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => remove(i.id)}>Remove</button>
                    </>
                  ) : team && i.home_away !== 'home' ? (
                    <Link className="btn btn-primary btn-sm" to={`/events/new?type=dual&date=${i.date}&gender=${i.gender}&invite=${i.school_id}`}>Host them</Link>
                  ) : null}
                  {!ours && i.home_away === 'home' && i.poster?.email && (
                    <a className="btn btn-ghost btn-sm" href={`mailto:${i.poster.email}?subject=${encodeURIComponent(`Dual on ${fmtDate(i.date)}?`)}`}>Email them</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filled.length > 0 && (
        <details>
          <summary className="muted">Your filled dates ({filled.length})</summary>
          <ul className="team-list">
            {filled.map((i) => <li key={i.id}>{fmtDate(i.date)} <button className="link-btn" onClick={() => markFilled(i.id, false)}>Reopen</button></li>)}
          </ul>
        </details>
      )}
    </div>
  )
}

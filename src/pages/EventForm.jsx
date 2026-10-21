import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { fetchEvent, uploadFile } from '../lib/api'
import { EVENT_TYPES, GENDERS, LEVELS, fmtDateRange, fmtMoney, fmtTimeRange, genderLabel, typeLabel } from '../lib/format'
import { ChoiceCards, ErrorBox, Field, Notice, Spinner, TeamName } from '../components/ui'

const STEPS = ['Type', 'Date', 'Location', 'Teams & Fees', 'Details', 'Review']

const blank = {
  title: '', event_type: '', gender: 'boys', levels: ['Varsity'],
  start_date: '', end_date: '', start_time: '', end_time: '',
  location_name: '', address: '',
  max_teams: '', team_fee: '', individual_fee: '', registration_deadline: '',
  weigh_in_info: '', format_info: '', payment_info: '', spectator_info: '',
  contact_name: '', contact_phone: '', contact_email: '', details: '',
  flyer_url: '', flyer_name: '',
}

export default function EventForm() {
  const { id } = useParams()
  const editing = !!id
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { team, profile, user } = useApp()
  const [form, setForm] = useState(null)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [inviteSchool, setInviteSchool] = useState(null)

  // Build the starting form: edit existing, copy an old one, or brand new
  useEffect(() => {
    (async () => {
      const defaults = {
        ...blank,
        location_name: team?.name || '',
        address: team?.address || '',
        contact_name: profile?.full_name || '',
        contact_phone: profile?.phone || '',
        contact_email: profile?.email || user?.email || '',
      }
      const sourceId = id || params.get('copy')
      if (sourceId) {
        const ev = await fetchEvent(sourceId)
        if (!ev) return setError('Event not found.')
        const f = { ...blank }
        for (const k of Object.keys(blank)) f[k] = ev[k] ?? ''
        f.start_time = (f.start_time || '').slice(0, 5)
        f.end_time = (f.end_time || '').slice(0, 5)
        if (!id) { // copying: clear the dates
          f.start_date = ''; f.end_date = ''; f.registration_deadline = ''
        }
        setForm(f)
        if (!id) setStep(1)
      } else {
        const f = { ...defaults }
        const t = params.get('type'); const d = params.get('date')
        if (t && EVENT_TYPES.some((x) => x.value === t)) { f.event_type = t; f.max_teams = EVENT_TYPES.find((x) => x.value === t).teams || '' }
        if (d) { f.start_date = d; f.end_date = d }
        if (params.get('gender')) f.gender = params.get('gender')
        setForm(f)
        const inv = params.get('invite')
        if (inv) {
          const { data } = await supabase.from('schools').select('*').eq('id', inv).maybeSingle()
          setInviteSchool(data)
        }
      }
    })().catch((e) => setError(friendlyError(e)))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!team) return <Notice>You need to be on a team to host events. <Link to="/join">Join your team</Link>.</Notice>
  if (!form) return error ? <ErrorBox error={error} /> : <Spinner />

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function pickType(v) {
    const t = EVENT_TYPES.find((x) => x.value === v)
    setForm((f) => ({
      ...f, event_type: v,
      max_teams: t.teams ?? (EVENT_TYPES.find((x) => x.value === f.event_type)?.teams ? '' : f.max_teams),
    }))
  }

  function suggestTitle() {
    const g = form.gender === 'girls' ? 'Girls ' : ''
    if (form.event_type === 'dual') return `${team.name} ${g}Dual`
    if (form.event_type === 'tri_dual') return `${team.name} ${g}Tri-Dual`
    return `${team.name} ${g}${typeLabel(form.event_type)}`
  }

  function validate(s) {
    if (s === 0 && !form.event_type) return 'Choose what kind of event this is.'
    if (s === 0 && !form.levels.length) return 'Choose Varsity, JV, or both.'
    if (s === 1) {
      if (!form.start_date) return 'Choose the date.'
      if (form.end_date && form.end_date < form.start_date) return 'The last day can\'t be before the first day.'
    }
    if (s === 3 && form.max_teams !== '' && Number(form.max_teams) < 2) return 'The team limit must be at least 2 (including your team).'
    return ''
  }

  function next() {
    const msg = validate(step)
    if (msg) return setError(msg)
    setError('')
    if (step === 1 && !form.title.trim()) set('title', suggestTitle())
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo(0, 0)
  }

  async function onFlyer(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return setError('That file is too big. Please use a file under 10 MB.')
    setUploading(true); setError('')
    try {
      const url = await uploadFile('flyers', file, user.id)
      setForm((f) => ({ ...f, flyer_url: url, flyer_name: file.name }))
    } catch (err) { setError(friendlyError(err)) }
    setUploading(false)
  }

  async function save() {
    for (let s = 0; s < STEPS.length; s++) {
      const msg = validate(s)
      if (msg) { setStep(s); return setError(msg) }
    }
    setBusy(true); setError('')
    const num = (v) => (v === '' || v === null ? null : Number(v))
    const row = {
      ...form,
      title: form.title.trim() || suggestTitle(),
      end_date: form.end_date || form.start_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      registration_deadline: form.registration_deadline || null,
      max_teams: num(form.max_teams),
      team_fee: num(form.team_fee),
      individual_fee: num(form.individual_fee),
      flyer_url: form.flyer_url || null,
      flyer_name: form.flyer_name || null,
    }
    try {
      let eventId = id
      if (editing) {
        const { error } = await supabase.from('events').update(row).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('events').insert({ ...row, host_school_id: team.id, created_by: user.id }).select().single()
        if (error) throw error
        eventId = data.id
        if (inviteSchool) {
          await supabase.rpc('invite_team', { eid: eventId, sid: inviteSchool.id, note_text: null })
        }
      }
      navigate(`/events/${eventId}${editing ? '' : '?new=1'}`)
    } catch (err) {
      setError(friendlyError(err)); setBusy(false)
    }
  }

  const fixedTeams = EVENT_TYPES.find((t) => t.value === form.event_type)?.teams
  const multiDay = ['individual_tournament', 'dual_tournament'].includes(form.event_type)

  return (
    <div className="card narrow stack">
      <div>
        <h1>{editing ? 'Edit event' : 'Host an event'}</h1>
        {inviteSchool && <p className="muted">After you post this, <strong>{inviteSchool.name}</strong> will get an invitation.</p>}
      </div>

      <ol className="steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <button type="button" onClick={() => (editing || i < step) && setStep(i)} disabled={!editing && i > step}>
              <span className="step-num">{i + 1}</span><span className="step-label">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="stack">
          <div className="field">
            <span className="field-label">What kind of event?</span>
            <ChoiceCards options={EVENT_TYPES} value={form.event_type} onChange={pickType} />
          </div>
          <div className="field">
            <span className="field-label">Boys, girls, or both?</span>
            <ChoiceCards options={GENDERS} value={form.gender} onChange={(v) => set('gender', v)} columns={3} />
          </div>
          <div className="field">
            <span className="field-label">Level</span>
            <div className="btn-row">
              {LEVELS.map((l) => (
                <label key={l} className="check big">
                  <input type="checkbox" checked={form.levels.includes(l)}
                    onChange={(e) => set('levels', e.target.checked ? [...form.levels, l] : form.levels.filter((x) => x !== l))} /> {l}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <div className="row-2">
            <Field label={multiDay ? 'First day' : 'Date'} required>
              <input type="date" value={form.start_date} onChange={(e) => {
                const v = e.target.value
                setForm((f) => ({ ...f, start_date: v, end_date: !f.end_date || f.end_date < v || !multiDay ? v : f.end_date }))
              }} />
            </Field>
            {multiDay && (
              <Field label="Last day" hint="Same as first day if it's a one-day event.">
                <input type="date" value={form.end_date} min={form.start_date} onChange={(e) => set('end_date', e.target.value)} />
              </Field>
            )}
          </div>
          <div className="row-2">
            <Field label="Start time"><input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} /></Field>
            <Field label="End time (about)"><input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} /></Field>
          </div>
          <Field label="Event name" hint="We'll fill this in for you if you leave it blank.">
            <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={form.event_type ? suggestTitle() : 'Event name'} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <Field label="Where is it?" hint="Usually your school gym.">
            <input value={form.location_name} onChange={(e) => set('location_name', e.target.value)} placeholder="Basic Academy Main Gym" />
          </Field>
          <Field label="Address" hint="Coaches will get a map link from this.">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St, Henderson, NV" autoComplete="street-address" />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <Field label="Most teams allowed (counting your team)"
            hint={fixedTeams ? `A ${typeLabel(form.event_type).toLowerCase()} has ${fixedTeams} teams.` : 'Leave blank for no limit. Teams that ask after it fills go on a waitlist.'}>
            <input type="number" min="2" inputMode="numeric" value={form.max_teams} onChange={(e) => set('max_teams', e.target.value)} placeholder="No limit" />
          </Field>
          <div className="row-2">
            <Field label="Team entry fee" hint="Leave blank if none.">
              <div className="money"><span>$</span><input type="number" min="0" step="0.01" inputMode="decimal" value={form.team_fee} onChange={(e) => set('team_fee', e.target.value)} /></div>
            </Field>
            <Field label="Fee per wrestler" hint="Leave blank if none.">
              <div className="money"><span>$</span><input type="number" min="0" step="0.01" inputMode="decimal" value={form.individual_fee} onChange={(e) => set('individual_fee', e.target.value)} /></div>
            </Field>
          </div>
          <Field label="Sign-up deadline" hint="Optional.">
            <input type="date" value={form.registration_deadline} max={form.start_date} onChange={(e) => set('registration_deadline', e.target.value)} />
          </Field>
          <Field label="How to pay" hint='e.g. "Checks payable to Basic Academy Wrestling, pay at the table."'>
            <input value={form.payment_info} onChange={(e) => set('payment_info', e.target.value)} />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <p className="muted">Everything on this page is optional. Fill in what you know — you can edit it later.</p>
          <Field label="Weigh-ins" hint='e.g. "7:00 AM in the wrestling room, 1 lb growth allowance."'>
            <input value={form.weigh_in_info} onChange={(e) => set('weigh_in_info', e.target.value)} />
          </Field>
          <Field label="Format" hint='e.g. "16-man brackets, true second" or "Round robin pools of 4."'>
            <input value={form.format_info} onChange={(e) => set('format_info', e.target.value)} />
          </Field>
          <Field label="Spectator admission" hint='e.g. "$5 adults, students free."'>
            <input value={form.spectator_info} onChange={(e) => set('spectator_info', e.target.value)} />
          </Field>
          <div className="subcard stack">
            <strong>Contact for this event</strong>
            <Field label="Name"><input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
            <div className="row-2">
              <Field label="Phone"><input type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} /></Field>
              <Field label="Email"><input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} /></Field>
            </div>
          </div>
          <Field label="Flyer" hint="A PDF or picture, up to 10 MB.">
            {form.flyer_url ? (
              <div className="row-between">
                <a href={form.flyer_url} target="_blank" rel="noreferrer">{form.flyer_name || 'View flyer'}</a>
                <button type="button" className="btn btn-ghost" onClick={() => setForm((f) => ({ ...f, flyer_url: '', flyer_name: '' }))}>Remove</button>
              </div>
            ) : (
              <input type="file" accept="application/pdf,image/*" onChange={onFlyer} disabled={uploading} />
            )}
            {uploading && <span className="muted small">Uploading…</span>}
          </Field>
          <Field label="Anything else teams should know">
            <textarea rows={4} value={form.details} onChange={(e) => set('details', e.target.value)} placeholder="Parking, concessions, mats, hotel info…" />
          </Field>
        </div>
      )}

      {step === 5 && (
        <div className="stack">
          <p className="muted">Check that everything looks right. Tap any step above to change it.</p>
          <dl className="review">
            <dt>Host</dt><dd><TeamName school={team} size={24} /></dd>
            <dt>Event</dt><dd>{form.title || suggestTitle()}</dd>
            <dt>Type</dt><dd>{typeLabel(form.event_type)} · {genderLabel(form.gender)} · {form.levels.join(' & ')}</dd>
            <dt>When</dt><dd>{fmtDateRange(form.start_date, form.end_date || form.start_date)} {fmtTimeRange(form.start_time, form.end_time)}</dd>
            <dt>Where</dt><dd>{[form.location_name, form.address].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Teams</dt><dd>{form.max_teams ? `Up to ${form.max_teams}` : 'No limit'}</dd>
            <dt>Fees</dt><dd>{[fmtMoney(form.team_fee) && `${fmtMoney(form.team_fee)} per team`, fmtMoney(form.individual_fee) && `${fmtMoney(form.individual_fee)} per wrestler`].filter(Boolean).join(' · ') || 'None listed'}</dd>
            {form.flyer_name && <><dt>Flyer</dt><dd>{form.flyer_name}</dd></>}
          </dl>
        </div>
      )}

      <ErrorBox error={error} />

      <div className="wizard-nav">
        {step > 0 ? <button type="button" className="btn btn-ghost btn-big" onClick={() => { setError(''); setStep(step - 1) }}>Back</button>
          : <button type="button" className="btn btn-ghost btn-big" onClick={() => navigate(-1)}>Cancel</button>}
        {editing && step < STEPS.length - 1 && (
          <button type="button" className="btn btn-ghost btn-big" onClick={save} disabled={busy || uploading}>Save now</button>
        )}
        {step < STEPS.length - 1
          ? <button type="button" className="btn btn-primary btn-big" onClick={next}>Next</button>
          : <button type="button" className="btn btn-primary btn-big" onClick={save} disabled={busy || uploading}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Post event'}
            </button>}
      </div>
    </div>
  )
}

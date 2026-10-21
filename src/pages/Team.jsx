import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { uploadFile } from '../lib/api'
import { roleLabel, textOn } from '../lib/format'
import { Badge, ErrorBox, Field, Notice, Spinner, TeamLogo } from '../components/ui'

const SWATCHES = ['#1B2A4A', '#F26B3A', '#002D62', '#0B5394', '#4FA3D9', '#00843D', '#0B6623', '#7A0019', '#C8102E', '#E35205', '#F2A900', '#FFD100', '#4B2E83', '#5C068C', '#000000', '#6D6E71', '#FFFFFF']

export default function Team() {
  const { team, isManager, user, refresh, membership } = useApp()
  const [form, setForm] = useState(null)
  const [staff, setStaff] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (team) setForm({
      name: team.name || '', short_name: team.short_name || '', mascot: team.mascot || '',
      city: team.city || '', state: team.state || '', address: team.address || '',
      primary_color: team.primary_color, secondary_color: team.secondary_color, logo_url: team.logo_url || '',
    })
  }, [team?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadStaff = useCallback(async () => {
    if (!team) return
    const { data } = await supabase.from('memberships')
      .select('*, person:profiles!memberships_user_id_fkey(full_name, email, phone)')
      .eq('school_id', team.id).neq('status', 'rejected').order('created_at')
    setStaff(data || [])
  }, [team?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadStaff() }, [loadStaff])

  if (!team) return <Notice>You're not on a team yet. <Link to="/join">Join your team</Link>.</Notice>
  if (!form) return <Spinner />
  const set = (k, v) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })) }
  const preview = { ...team, ...form }

  async function save(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.from('schools').update({
      ...form, short_name: form.short_name || null, mascot: form.mascot || null, logo_url: form.logo_url || null,
      state: form.state.toUpperCase(),
    }).eq('id', team.id)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setSaved(true); refresh()
  }

  async function onLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please choose a picture file (PNG or JPG).')
    if (file.size > 3 * 1024 * 1024) return setError('Please use a logo under 3 MB.')
    setBusy(true); setError('')
    try { set('logo_url', await uploadFile('logos', file, user.id)) } catch (err) { setError(friendlyError(err)) }
    setBusy(false)
  }

  async function decide(id, approve) {
    const { error } = await supabase.rpc('decide_membership', { mid: id, approve })
    if (error) setError(friendlyError(error)); else loadStaff()
  }
  async function removeStaff(m) {
    if (!window.confirm(`Remove ${m.person?.full_name || 'this person'} from ${team.name}?`)) return
    const { error } = await supabase.from('memberships').delete().eq('id', m.id)
    if (error) setError(friendlyError(error)); else loadStaff()
  }

  return (
    <div className="stack-lg">
      <section className="team-banner" style={{ background: preview.primary_color, color: textOn(preview.primary_color), borderColor: preview.secondary_color }}>
        <TeamLogo school={preview} size={72} />
        <div>
          <h1>{preview.name}</h1>
          <div>{[preview.mascot, [preview.city, preview.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
        </div>
      </section>

      <div className="btn-row wrap">
        <Link to="/team/schedule" className="btn btn-primary btn-big">🖨 Print our schedule</Link>
      </div>

      <ErrorBox error={error} />

      {isManager ? (
        <form className="card stack" onSubmit={save}>
          <h2>Team info & colors</h2>
          <p className="muted">Your colors and logo are used on your printable schedule and around MatSlate.</p>
          <div className="row-2">
            <Field label="School name"><input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Mascot"><input value={form.mascot} onChange={(e) => set('mascot', e.target.value)} placeholder="Wildcats" /></Field>
          </div>
          <div className="row-3">
            <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="State"><input value={form.state} maxLength={2} onChange={(e) => set('state', e.target.value)} /></Field>
            <Field label="Initials" hint="Shown when there's no logo."><input value={form.short_name} maxLength={4} onChange={(e) => set('short_name', e.target.value)} placeholder="BA" /></Field>
          </div>
          <Field label="Gym address" hint="Used as the default location when you host.">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>

          <div className="row-2">
            <ColorPicker label="Main color" value={form.primary_color} onChange={(v) => set('primary_color', v)} />
            <ColorPicker label="Second color" value={form.secondary_color} onChange={(v) => set('secondary_color', v)} />
          </div>

          <Field label="Logo" hint="Upload your school's logo (PNG or JPG). Only use a logo your school allows you to use.">
            <div className="row-between">
              <TeamLogo school={preview} size={56} />
              <input type="file" accept="image/*" onChange={onLogo} disabled={busy} />
              {form.logo_url && <button type="button" className="btn btn-ghost" onClick={() => set('logo_url', '')}>Remove logo</button>}
            </div>
          </Field>

          <div className="btn-row">
            <button className="btn btn-primary btn-big" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            {saved && <span className="saved">✓ Saved</span>}
          </div>
        </form>
      ) : (
        <Notice>Only your head coach or athletic director can change team info and colors.</Notice>
      )}

      <section className="card stack">
        <h2>Staff</h2>
        {staff === null ? <Spinner /> : (
          <ul className="team-list">
            {staff.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.person?.full_name || m.person?.email}</strong> <span className="muted">· {roleLabel(m.role)}</span>
                  <br /><span className="small muted">{[m.person?.email, m.person?.phone].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="btn-row">
                  {m.status === 'pending' && <Badge tone="yellow">Waiting</Badge>}
                  {isManager && m.status === 'pending' && m.role !== 'head_coach' && (
                    <>
                      <button className="btn btn-green btn-sm" onClick={() => decide(m.id, true)}>Approve</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => decide(m.id, false)}>Decline</button>
                    </>
                  )}
                  {isManager && m.status === 'approved' && m.user_id !== user.id && (
                    <button className="btn btn-ghost btn-sm" onClick={() => removeStaff(m)}>Remove</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          To add an assistant coach or AD, have them go to <strong>matslate.com</strong>, sign in with their email, and choose {team.name}.
          {membership?.role === 'head_coach' ? ' You\'ll see their request here and on your Home page.' : ''}
        </p>
      </section>
    </div>
  )
}

function ColorPicker({ label, value, onChange }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button type="button" key={c} className={'swatch' + (value?.toLowerCase() === c.toLowerCase() ? ' on' : '')}
            style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
        ))}
        <label className="swatch custom" title="Pick any color">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          <span>Other</span>
        </label>
      </div>
    </div>
  )
}

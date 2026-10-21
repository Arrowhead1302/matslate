import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { ROLES } from '../lib/format'
import { ChoiceCards, ErrorBox, Field, TeamName } from '../components/ui'
import Logo from '../components/Logo'

// First-time account setup. Also used inside the app ("inside") to join another team.
export default function Setup({ inside = false }) {
  const { user, profile, refresh, signOut, isAdmin } = useApp()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [role, setRole] = useState('head_coach')
  const [schools, setSchools] = useState([])
  const [regions, setRegions] = useState([])
  const [search, setSearch] = useState('')
  const [schoolId, setSchoolId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newSchool, setNewSchool] = useState({ name: '', city: '', state: 'NV', region_id: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const needsTeam = inside || !isAdmin

  useEffect(() => {
    supabase.from('schools').select('*').order('name').then(({ data }) => setSchools(data || []))
    supabase.from('regions').select('*').order('name').then(({ data }) => {
      setRegions(data || [])
      if (data?.length === 1) setNewSchool((s) => ({ ...s, region_id: data[0].id }))
    })
  }, [])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return schools.slice(0, 8)
    return schools.filter((s) => s.name.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q)).slice(0, 8)
  }, [schools, search])
  const chosen = schools.find((s) => s.id === schoolId)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) return setError('Please enter your name.')
    if (needsTeam && !schoolId && !(adding && newSchool.name.trim())) return setError('Please choose your school.')
    setBusy(true)
    try {
      const { error: pErr } = await supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone.trim() || null }).eq('id', user.id)
      if (pErr) throw pErr
      if (needsTeam) {
        let sid = schoolId
        if (!sid) {
          const { data, error: sErr } = await supabase.from('schools').insert({
            name: newSchool.name.trim(), city: newSchool.city.trim() || null,
            state: newSchool.state.trim().toUpperCase() || 'NV', region_id: newSchool.region_id || null,
          }).select().single()
          if (sErr) throw sErr
          sid = data.id
        }
        const { error: mErr } = await supabase.from('memberships').insert({ user_id: user.id, school_id: sid, role })
        if (mErr) {
          if (/duplicate/i.test(mErr.message)) throw new Error('You already have a request for that school.')
          throw mErr
        }
      }
      await refresh()
      if (inside) navigate('/account')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const form = (
    <form onSubmit={submit} className="stack">
      {!inside && (
        <>
          <h1>Set up your account</h1>
          <p className="lead">Just a few questions. You'll only do this once.</p>
          <Field label="Your full name" required>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Coach Jane Smith" />
          </Field>
          <Field label="Cell phone" hint="Optional. Shown to other coaches only on events you host.">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="702-555-1234" />
          </Field>
        </>
      )}
      {inside && <h1>Join another team</h1>}

      {needsTeam && (
        <>
          <div className="field">
            <span className="field-label">What's your job? <span className="req">*</span></span>
            <ChoiceCards options={ROLES} value={role} onChange={setRole} columns={3} />
          </div>

          <div className="field">
            <span className="field-label">Your school <span className="req">*</span></span>
            {chosen ? (
              <div className="chosen-row">
                <TeamName school={chosen} sub={[chosen.city, chosen.state].filter(Boolean).join(', ')} />
                <button type="button" className="btn btn-ghost" onClick={() => setSchoolId(null)}>Change</button>
              </div>
            ) : !adding ? (
              <>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Start typing your school's name…" />
                <div className="pick-list">
                  {matches.map((s) => (
                    <button type="button" key={s.id} className="pick-item" onClick={() => setSchoolId(s.id)}>
                      <TeamName school={s} size={28} sub={[s.city, s.state].filter(Boolean).join(', ')} />
                    </button>
                  ))}
                  {matches.length === 0 && <p className="muted small">No schools match “{search}”.</p>}
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => { setAdding(true); setNewSchool((n) => ({ ...n, name: search })) }}>
                  My school isn't listed
                </button>
              </>
            ) : (
              <div className="subcard stack">
                <Field label="School name" required>
                  <input value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} placeholder="Basic Academy" />
                </Field>
                <div className="row-2">
                  <Field label="City"><input value={newSchool.city} onChange={(e) => setNewSchool({ ...newSchool, city: e.target.value })} placeholder="Henderson" /></Field>
                  <Field label="State"><input value={newSchool.state} maxLength={2} onChange={(e) => setNewSchool({ ...newSchool, state: e.target.value })} /></Field>
                </div>
                {regions.length > 0 && (
                  <Field label="Region">
                    <select value={newSchool.region_id} onChange={(e) => setNewSchool({ ...newSchool, region_id: e.target.value })}>
                      <option value="">Not sure / other</option>
                      {regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.state})</option>)}
                    </select>
                  </Field>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Back to the school list</button>
              </div>
            )}
            <span className="field-hint">
              {role === 'head_coach'
                ? 'The MatSlate admin will confirm you are the head coach.'
                : 'Your head coach will get a request to approve you.'}
            </span>
          </div>
        </>
      )}

      <ErrorBox error={error} />
      <button className="btn btn-primary btn-big btn-block" disabled={busy}>{busy ? 'Saving…' : inside ? 'Send request' : 'Finish'}</button>
      {!inside && <button type="button" className="link-btn center" onClick={signOut}>Sign out</button>}
    </form>
  )

  if (inside) return <div className="card narrow">{form}</div>
  return (
    <div className="login">
      <div className="login-card wide">
        <div className="login-logo"><Logo /></div>
        {form}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { supabase, friendlyError } from '../lib/supabase'
import { roleLabel } from '../lib/format'
import { Badge, Empty, ErrorBox, Field, Spinner, TeamName } from '../components/ui'

export default function Admin() {
  const [requests, setRequests] = useState(null)
  const [schools, setSchools] = useState([])
  const [regions, setRegions] = useState([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [newSchool, setNewSchool] = useState({ name: '', city: '', state: 'NV', region_id: '' })
  const [newRegion, setNewRegion] = useState({ name: '', state: '' })

  const load = useCallback(async () => {
    const [r, s, g] = await Promise.all([
      supabase.from('memberships').select('*, school:schools(*), person:profiles!memberships_user_id_fkey(full_name, email, phone)')
        .eq('status', 'pending').order('created_at'),
      supabase.from('schools').select('*, region:regions(name, state)').order('name'),
      supabase.from('regions').select('*').order('state').order('name'),
    ])
    setRequests(r.data || []); setSchools(s.data || []); setRegions(g.data || [])
    if (r.error || s.error) setError(friendlyError(r.error || s.error))
  }, [])
  useEffect(() => { load() }, [load])

  async function decide(id, approve) {
    const { error } = await supabase.rpc('decide_membership', { mid: id, approve })
    if (error) setError(friendlyError(error)); else load()
  }
  async function verify(id, v) {
    const { error } = await supabase.rpc('admin_set_school_verified', { sid: id, v })
    if (error) setError(friendlyError(error)); else load()
  }
  async function addSchool(e) {
    e.preventDefault()
    if (!newSchool.name.trim()) return
    const { error } = await supabase.from('schools').insert({ ...newSchool, region_id: newSchool.region_id || null, verified: true })
    if (error) return setError(friendlyError(error))
    setNewSchool({ ...newSchool, name: '', city: '' }); load()
  }
  async function deleteSchool(s) {
    if (!window.confirm(`Delete ${s.name}? This also deletes its events and staff links.`)) return
    const { error } = await supabase.from('schools').delete().eq('id', s.id)
    if (error) setError(friendlyError(error)); else load()
  }
  async function addRegion(e) {
    e.preventDefault()
    if (!newRegion.name.trim() || !newRegion.state.trim()) return
    const { error } = await supabase.from('regions').insert({ name: newRegion.name.trim(), state: newRegion.state.trim().toUpperCase() })
    if (error) return setError(friendlyError(error))
    setNewRegion({ name: '', state: '' }); load()
  }

  const shown = schools.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="stack-lg">
      <h1>Admin</h1>
      <ErrorBox error={error} />

      <section className="card stack">
        <h2>Waiting for approval</h2>
        <p className="muted small">You approve head coaches. Head coaches approve their own assistants and ADs, but you can approve anyone here.</p>
        {requests === null ? <Spinner /> : requests.length === 0 ? <Empty>No one is waiting.</Empty> : requests.map((m) => (
          <div className="todo-row" key={m.id}>
            <span>
              <strong>{m.person?.full_name || '(no name)'}</strong> · {roleLabel(m.role)}<br />
              <span className="small muted">{[m.person?.email, m.person?.phone].filter(Boolean).join(' · ')}</span><br />
              <TeamName school={m.school} size={22} /> {!m.school.verified && <Badge tone="orange">New school</Badge>}
            </span>
            <span className="btn-row">
              <button className="btn btn-green" onClick={() => decide(m.id, true)}>Approve</button>
              <button className="btn btn-ghost" onClick={() => decide(m.id, false)}>Reject</button>
            </span>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Schools <span className="count">{schools.length}</span></h2>
        <form className="row-4" onSubmit={addSchool}>
          <Field label="Add a school"><input value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} placeholder="School name" /></Field>
          <Field label="City"><input value={newSchool.city} onChange={(e) => setNewSchool({ ...newSchool, city: e.target.value })} /></Field>
          <Field label="State"><input value={newSchool.state} maxLength={2} onChange={(e) => setNewSchool({ ...newSchool, state: e.target.value.toUpperCase() })} /></Field>
          <Field label="Region">
            <select value={newSchool.region_id} onChange={(e) => setNewSchool({ ...newSchool, region_id: e.target.value })}>
              <option value="">—</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.state})</option>)}
            </select>
          </Field>
          <button className="btn btn-primary">Add</button>
        </form>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools…" />
        <ul className="team-list">
          {shown.map((s) => (
            <li key={s.id}>
              <TeamName school={s} size={26} sub={[s.city, s.state, s.region?.name].filter(Boolean).join(' · ')} />
              <span className="btn-row">
                {s.verified ? <Badge tone="green">Verified</Badge> : <button className="btn btn-ghost btn-sm" onClick={() => verify(s.id, true)}>Verify</button>}
                <button className="btn btn-ghost btn-sm danger" onClick={() => deleteSchool(s)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2>Regions</h2>
        <ul className="team-list">{regions.map((r) => <li key={r.id}>{r.name} <Badge>{r.state}</Badge></li>)}</ul>
        <form className="row-4" onSubmit={addRegion}>
          <Field label="New region"><input value={newRegion.name} onChange={(e) => setNewRegion({ ...newRegion, name: e.target.value })} placeholder="Northern Nevada" /></Field>
          <Field label="State"><input value={newRegion.state} maxLength={2} onChange={(e) => setNewRegion({ ...newRegion, state: e.target.value })} placeholder="NV" /></Field>
          <button className="btn btn-primary">Add region</button>
        </form>
      </section>
    </div>
  )
}

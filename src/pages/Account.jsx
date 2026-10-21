import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { roleLabel } from '../lib/format'
import { Badge, ErrorBox, Field, TeamName } from '../components/ui'

export default function Account() {
  const { profile, user, memberships, refresh, signOut } = useApp()
  const [name, setName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', user.id)
    if (error) return setError(friendlyError(error))
    setSaved(true); refresh()
  }

  return (
    <div className="stack-lg narrow">
      <h1>Your account</h1>
      <form className="card stack" onSubmit={save}>
        <Field label="Email"><input value={user.email} disabled /></Field>
        <Field label="Full name"><input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} /></Field>
        <Field label="Cell phone"><input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false) }} /></Field>
        <ErrorBox error={error} />
        <div className="btn-row"><button className="btn btn-primary btn-big">Save</button>{saved && <span className="saved">✓ Saved</span>}</div>
      </form>

      <section className="card stack">
        <h2>Your teams</h2>
        <ul className="team-list">
          {memberships.map((m) => (
            <li key={m.id}>
              <TeamName school={m.school} size={28} sub={roleLabel(m.role)} />
              {m.status === 'approved' ? <Badge tone="green">Approved</Badge> : m.status === 'pending' ? <Badge tone="yellow">Waiting</Badge> : <Badge tone="red">Not approved</Badge>}
            </li>
          ))}
        </ul>
        <div><Link to="/join" className="btn btn-ghost">Join another team</Link></div>
      </section>

      <section className="card stack">
        <h2>Add MatSlate to your phone</h2>
        <p><strong>iPhone:</strong> open matslate.com in Safari, tap the Share button, then <em>Add to Home Screen</em>.</p>
        <p><strong>Android:</strong> open matslate.com in Chrome, tap the ⋮ menu, then <em>Add to Home screen</em>.</p>
      </section>

      <button className="btn btn-ghost btn-big" onClick={signOut}>Sign out</button>
    </div>
  )
}

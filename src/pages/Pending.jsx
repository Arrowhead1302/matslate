import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { roleLabel } from '../lib/format'
import { TeamName } from '../components/ui'
import Logo from '../components/Logo'

export default function Pending() {
  const { memberships, refresh, signOut } = useApp()
  const [checking, setChecking] = useState(false)
  const pending = memberships.filter((m) => m.status === 'pending')
  const rejected = memberships.filter((m) => m.status === 'rejected')

  async function check() { setChecking(true); await refresh(); setChecking(false) }
  async function cancel(id) {
    await supabase.from('memberships').delete().eq('id', id)
    await refresh()
  }

  return (
    <div className="login">
      <div className="login-card wide">
        <div className="login-logo"><Logo /></div>
        <h1>Almost there</h1>
        {pending.length > 0 && (
          <>
            <p className="lead">Your request is waiting for approval. You'll be able to use MatSlate as soon as it's approved.</p>
            {pending.map((m) => (
              <div key={m.id} className="subcard row-between">
                <TeamName school={m.school} sub={`${roleLabel(m.role)} · waiting for ${m.role === 'head_coach' ? 'the MatSlate admin' : 'your head coach'}`} />
                <button className="btn btn-ghost" onClick={() => cancel(m.id)}>Cancel</button>
              </div>
            ))}
          </>
        )}
        {rejected.length > 0 && pending.length === 0 && (
          <p className="lead">Your request to join {rejected.map((m) => m.school.name).join(', ')} was not approved. If you think this is a mistake, email <a href="mailto:support@matslate.com">support@matslate.com</a>.</p>
        )}
        <button className="btn btn-primary btn-big btn-block" onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check again'}</button>
        <button className="link-btn center" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const TEAM_KEY = 'matslate.teamId'

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [profile, setProfile] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [loadingUser, setLoadingUser] = useState(true)
  const [teamId, setTeamIdState] = useState(() => {
    try { return localStorage.getItem(TEAM_KEY) } catch { return null }
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadUser = useCallback(async () => {
    if (!session?.user) {
      setProfile(null); setMemberships([]); setLoadingUser(false)
      return
    }
    setLoadingUser(true)
    const uid = session.user.id
    const [{ data: prof }, { data: mems }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('memberships').select('*, school:schools(*)').eq('user_id', uid).order('created_at'),
    ])
    setProfile(prof || { id: uid, email: session.user.email })
    setMemberships(mems || [])
    setLoadingUser(false)
  }, [session?.user?.id])

  useEffect(() => { if (session !== undefined) loadUser() }, [session, loadUser])

  // Clean the login tokens out of the address bar after a link login
  useEffect(() => {
    if (session && window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [session])

  const approved = memberships.filter((m) => m.status === 'approved')
  const current = approved.find((m) => m.school_id === teamId) || approved[0] || null

  const setTeamId = (id) => {
    setTeamIdState(id)
    try { localStorage.setItem(TEAM_KEY, id) } catch { /* ignore */ }
  }

  const value = {
    session,
    user: session?.user || null,
    profile,
    memberships,
    approvedMemberships: approved,
    membership: current,                 // the team the coach is acting for
    team: current?.school || null,
    isAdmin: !!profile?.is_admin,
    isManager: !!profile?.is_admin || ['head_coach', 'athletic_director'].includes(current?.role),
    loading: session === undefined || (session && loadingUser),
    refresh: loadUser,
    setTeamId,
    signOut: () => supabase.auth.signOut(),
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

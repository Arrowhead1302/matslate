import { supabase } from './supabase'

const EVENT_SELECT = '*, host:schools!events_host_school_id_fkey(*), entries:event_entries(id, school_id, kind, status)'

// Events that touch the given date range (inclusive). Pass null for open-ended.
export async function fetchEvents({ from = null, to = null } = {}) {
  let q = supabase.from('events').select(EVENT_SELECT).order('start_date').order('start_time', { nullsFirst: true })
  if (from) q = q.gte('end_date', from)
  if (to) q = q.lte('start_date', to)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function fetchEvent(id) {
  const { data, error } = await supabase
    .from('events')
    .select('*, host:schools!events_host_school_id_fkey(*), entries:event_entries(*, school:schools(*)), updates:event_updates(*, author:profiles(full_name))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Events my team is hosting or approved to attend (optionally also pending ones)
export async function fetchTeamSchedule(teamId, { from = null, to = null, includePending = false } = {}) {
  const all = await fetchEvents({ from, to })
  const ok = includePending ? ['approved', 'pending', 'waitlisted'] : ['approved']
  return all.filter((e) => e.host_school_id === teamId || e.entries.some((x) => x.school_id === teamId && ok.includes(x.status)))
}

export function approvedCount(ev) {
  return 1 + (ev.entries || []).filter((x) => x.status === 'approved').length // +1 for the host
}
export function spotsLeft(ev) {
  if (!ev.max_teams) return null
  return Math.max(0, ev.max_teams - approvedCount(ev))
}
export function myEntry(ev, teamId) {
  return (ev.entries || []).find((x) => x.school_id === teamId) || null
}

// What should the badge say about my team and this event?
export function myStatus(ev, teamId) {
  if (!teamId) return null
  if (ev.host_school_id === teamId) return { label: 'Hosting', tone: 'navy' }
  const en = myEntry(ev, teamId)
  if (!en) return null
  if (en.status === 'approved') return { label: 'Attending', tone: 'green' }
  if (en.status === 'pending' && en.kind === 'invite') return { label: 'Invited – respond', tone: 'orange' }
  if (en.status === 'pending') return { label: 'Request sent', tone: 'yellow' }
  if (en.status === 'waitlisted') return { label: 'Waitlisted', tone: 'yellow' }
  if (en.status === 'declined') return { label: 'Not approved', tone: 'gray' }
  if (en.status === 'withdrawn') return { label: 'Withdrawn', tone: 'gray' }
  return null
}

export async function uploadFile(bucket, file, userId) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

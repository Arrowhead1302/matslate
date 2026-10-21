export const EVENT_TYPES = [
  { value: 'dual', label: 'Dual', help: 'Two teams, head to head', teams: 2 },
  { value: 'tri_dual', label: 'Tri-Dual', help: 'Three teams, each wrestles the others', teams: 3 },
  { value: 'individual_tournament', label: 'Individual Tournament', help: 'Brackets by weight class', teams: null },
  { value: 'dual_tournament', label: 'Dual Tournament', help: 'Many teams in dual-meet format', teams: null },
]
export const typeLabel = (v) => EVENT_TYPES.find((t) => t.value === v)?.label || v

export const GENDERS = [
  { value: 'boys', label: 'Boys' },
  { value: 'girls', label: 'Girls' },
  { value: 'both', label: 'Boys & Girls' },
]
export const genderLabel = (v) => GENDERS.find((g) => g.value === v)?.label || v

export const ROLES = [
  { value: 'head_coach', label: 'Head Coach' },
  { value: 'assistant_coach', label: 'Assistant Coach' },
  { value: 'athletic_director', label: 'Athletic Director' },
]
export const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || v

export const LEVELS = ['Varsity', 'JV']

// Dates are stored as "YYYY-MM-DD" with no time zone, so build them locally.
export function parseDate(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function toISODate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export const todayISO = () => toISODate(new Date())

export function fmtDate(s, opts = {}) {
  const d = parseDate(s)
  if (!d) return ''
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...opts })
}
export function fmtDateRange(start, end) {
  if (!end || end === start) return fmtDate(start, { year: 'numeric' })
  return `${fmtDate(start)} – ${fmtDate(end, { year: 'numeric' })}`
}
export function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}
export function fmtTimeRange(a, b) {
  if (!a && !b) return ''
  if (a && b) return `${fmtTime(a)} – ${fmtTime(b)}`
  return fmtTime(a || b)
}
export function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return null
  const v = Number(n)
  if (v === 0) return 'Free'
  return '$' + (Number.isInteger(v) ? v : v.toFixed(2))
}
export function monthKey(s) {
  const d = parseDate(s)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// A wrestling season runs roughly Aug–Jul. Returns e.g. { start:'2026-08-01', end:'2027-07-31', label:'2026–27' }
export function seasonFor(date = new Date()) {
  const y = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
  return { start: `${y}-08-01`, end: `${y + 1}-07-31`, label: `${y}–${String(y + 1).slice(2)}` }
}

export function datesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= (bEnd || bStart) && bStart <= (aEnd || aStart)
}

// Pick black or white text for a background color
export function textOn(hex) {
  if (!hex) return '#fff'
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#111' : '#fff'
}

export function initials(school) {
  if (!school) return '?'
  if (school.short_name) return school.short_name.slice(0, 4)
  return school.name.split(/\s+/).filter((w) => !/^(high|school|the|of|academy|hs)$/i.test(w)).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || school.name[0]
}

export function mapsLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

import { initials, textOn } from '../lib/format'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function TeamLogo({ school, size = 40 }) {
  if (!school) return null
  const style = { width: size, height: size, fontSize: size * 0.36 }
  if (school.logo_url) {
    return <img className="team-logo" src={school.logo_url} alt="" style={style} />
  }
  return (
    <span
      className="team-logo initials"
      style={{ ...style, background: school.primary_color, color: textOn(school.primary_color), borderColor: school.secondary_color }}
      aria-hidden="true"
    >
      {initials(school)}
    </span>
  )
}

export function TeamName({ school, size = 32, sub }) {
  if (!school) return null
  return (
    <span className="team-name">
      <TeamLogo school={school} size={size} />
      <span>
        <span className="team-name-text">{school.name}</span>
        {sub && <span className="team-sub">{sub}</span>}
      </span>
    </span>
  )
}

export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="alert alert-error" role="alert">{error}</div>
}

export function Notice({ children, tone = 'info' }) {
  return <div className={`alert alert-${tone}`}>{children}</div>
}

export function Field({ label, hint, children, required }) {
  return (
    <label className="field">
      <span className="field-label">{label}{required && <span className="req"> *</span>}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function ChoiceCards({ options, value, onChange, columns = 2 }) {
  return (
    <div className="choice-grid" style={{ '--cols': columns }}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={'choice' + (value === o.value ? ' selected' : '')}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          <span className="choice-label">{o.label}</span>
          {o.help && <span className="choice-help">{o.help}</span>}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

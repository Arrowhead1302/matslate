export default function Logo({ dark = false }) {
  return (
    <span className={'logo' + (dark ? ' logo-dark' : '')}>
      <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#1B2A4A" />
        <circle cx="32" cy="32" r="20" fill="none" stroke="#F26B3A" strokeWidth="5" />
        <circle cx="32" cy="32" r="6" fill="#F26B3A" />
      </svg>
      <span className="logo-text">Mat<span>Slate</span></span>
    </span>
  )
}

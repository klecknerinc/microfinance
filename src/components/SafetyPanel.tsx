import { CircleUserRound, ExternalLink, LockKeyhole, ShieldCheck } from 'lucide-react'

const AMEX_SETUP_URL =
  'https://www.americanexpress.com/en-us/banking/online-savings/link-account/'

const items = [
  {
    icon: ShieldCheck,
    title: 'AMEX controls the transfer',
    body: 'Only American Express schedules and executes the live bank transfer.',
  },
  {
    icon: LockKeyhole,
    title: 'No bank credentials stored',
    body: 'This app stores only account labels, last four digits, and plan records.',
  },
  {
    icon: CircleUserRound,
    title: 'Private audit history',
    body: 'InsForge authentication protects setup details and saved confirmations.',
  },
]

export function SafetyPanel() {
  return (
    <aside className="safety-panel" aria-labelledby="safety-title">
      <div className="safety-heading">
        <h2 id="safety-title">Production safety</h2>
        <span className="safe-label">Live recordkeeping only</span>
      </div>
      <div className="safety-list">
        {items.map(({ icon: Icon, title, body }) => (
          <div className="safety-item" key={title}>
            <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="safety-note">
        <strong>Business account ownership</strong>
        <p>
          Confirm that American Express accepts the business account’s legal
          ownership or title before saving it here.
        </p>
      </div>
      <a
        className="external-link"
        href={AMEX_SETUP_URL}
        target="_blank"
        rel="noreferrer"
      >
        Open official AMEX setup
        <ExternalLink size={15} aria-hidden="true" />
      </a>
    </aside>
  )
}

import { Building2, CheckCircle2 } from 'lucide-react'

interface AccountRowProps {
  title: string
  subtitle: string
  connected: boolean
  detail?: string
  actionLabel: string
  actionDisabled?: boolean
  onAction: () => void
}

export function AccountRow({
  title,
  subtitle,
  connected,
  detail,
  actionLabel,
  actionDisabled = false,
  onAction,
}: AccountRowProps) {
  return (
    <div className="account-row">
      <div className="account-icon" aria-hidden="true">
        <Building2 size={28} strokeWidth={1.7} />
      </div>
      <div className="account-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className={connected ? 'account-status connected' : 'account-status'}>
        {connected && <CheckCircle2 size={17} aria-hidden="true" />}
        {detail || (connected ? 'Connected' : 'Not connected')}
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={actionDisabled}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  )
}

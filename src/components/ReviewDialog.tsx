import { X } from 'lucide-react'
import type { BankSetup, TransferPlanDraft } from '../types'

function formatMoney(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const cadenceLabels = {
  one_time: 'One time',
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
}

interface ReviewDialogProps {
  setup: BankSetup
  draft: TransferPlanDraft
  busy: boolean
  onCancel: () => void
  onSave: () => void
}

export function ReviewDialog({
  setup,
  draft,
  busy,
  onCancel,
  onSave,
}: ReviewDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <div className="dialog-header">
          <h2 id="review-title">Review AMEX record</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close review"
            onClick={onCancel}
          >
            <X size={20} />
          </button>
        </div>

        <dl className="review-list">
          <div>
            <dt>Source</dt>
            <dd>AMEX Savings •••• {setup.sourceMask}</dd>
          </div>
          <div>
            <dt>Business destination</dt>
            <dd>{setup.destinationLabel} •••• {setup.destinationMask}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{formatMoney(draft.amount)}</dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>
              {cadenceLabels[draft.cadence]} · {formatDate(draft.scheduledFor)}
            </dd>
          </div>
          <div>
            <dt>AMEX reference</dt>
            <dd>{draft.amexConfirmationReference || 'Not provided'}</dd>
          </div>
        </dl>

        <div className="test-warning">
          <strong>This saves a production record; it does not move money.</strong>
          <span>
            The matching live transfer must already be created in the official
            American Express Savings portal.
          </span>
        </div>

        <div className="dialog-actions">
          <button
            className="secondary-button wide"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="primary-button wide"
            type="button"
            onClick={onSave}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Record live AMEX plan'}
          </button>
        </div>
      </section>
    </div>
  )
}

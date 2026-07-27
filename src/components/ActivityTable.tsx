import { Inbox } from 'lucide-react'
import type { TransferPlan } from '../types'

const statusLabels: Record<TransferPlan['status'], string> = {
  recorded_in_amex: 'Recorded in AMEX',
  cancelled: 'Cancelled',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatMoney(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value))
}

interface ActivityTableProps {
  plans: TransferPlan[]
}

export function ActivityTable({ plans }: ActivityTableProps) {
  return (
    <section className="activity-section" aria-labelledby="activity-title">
      <div className="section-heading-row">
        <h2 id="activity-title">Recorded AMEX plans</h2>
        {plans.length > 0 && (
          <span className="schedule-count">
            {plans.length} saved plan{plans.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="empty-state">
          <Inbox size={28} strokeWidth={1.5} aria-hidden="true" />
          <span>No AMEX transfer plans recorded yet</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>First date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>AMEX reference</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>{formatDate(plan.scheduledFor)}</td>
                  <td>{formatMoney(plan.amount)}</td>
                  <td>
                    <span className={`status-text status-${plan.status}`}>
                      {statusLabels[plan.status]}
                    </span>
                  </td>
                  <td>{plan.amexConfirmationReference || 'Not provided'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

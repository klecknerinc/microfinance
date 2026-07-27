import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  LogOut,
} from 'lucide-react'
import { AccountRow } from './components/AccountRow'
import { ActivityTable } from './components/ActivityTable'
import { AuthScreen } from './components/AuthScreen'
import { ReviewDialog } from './components/ReviewDialog'
import { SafetyPanel } from './components/SafetyPanel'
import { insforge, isConfigured } from './lib/insforge'
import {
  loadDashboard,
  saveBankSetup,
  saveTransferPlan,
  signOut,
} from './services/banking'
import type {
  AccountOwnership,
  BankSetupDraft,
  Cadence,
  DashboardData,
  TransferPlanDraft,
} from './types'

const AMEX_SETUP_URL =
  'https://www.americanexpress.com/en-us/banking/online-savings/link-account/'

function tomorrowAtNineLocal() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function toIso(localDateTime: string) {
  return new Date(localDateTime).toISOString()
}

const cadenceLabels: Record<Cadence, string> = {
  one_time: 'One time',
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(isConfigured)
  const [authenticated, setAuthenticated] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)

  const [sourceMask, setSourceMask] = useState('')
  const [destinationLabel, setDestinationLabel] = useState('Business checking')
  const [destinationMask, setDestinationMask] = useState('')
  const [sourceOwnership, setSourceOwnership] =
    useState<AccountOwnership>('business')
  const [legalName, setLegalName] = useState('')
  const [acceptedByAmex, setAcceptedByAmex] = useState(false)
  const [setupError, setSetupError] = useState('')

  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [scheduledLocal, setScheduledLocal] = useState(tomorrowAtNineLocal)
  const [amexReference, setAmexReference] = useState('')
  const [confirmedInAmex, setConfirmedInAmex] = useState(false)
  const [formError, setFormError] = useState('')

  const refreshDashboard = useCallback(async () => {
    setPageError('')
    const next = await loadDashboard()
    setDashboard(next)
    return next
  }, [])

  useEffect(() => {
    if (!isConfigured || !insforge) return
    let cancelled = false

    async function hydrateAuth() {
      const { data, error } = await insforge!.auth.getCurrentUser()
      if (cancelled) return
      setAuthenticated(!error && Boolean(data?.user))
      setAuthLoading(false)
    }

    void hydrateAuth()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authenticated) return
    setLoading(true)
    refreshDashboard()
      .catch((caught) => {
        setPageError(
          caught instanceof Error ? caught.message : 'Could not load the dashboard.',
        )
      })
      .finally(() => setLoading(false))
  }, [authenticated, refreshDashboard])

  useEffect(() => {
    const setup = dashboard?.bankSetup
    if (!setup) return
    setSourceMask(setup.sourceMask)
    setDestinationLabel(setup.destinationLabel)
    setDestinationMask(setup.destinationMask)
    setSourceOwnership(setup.sourceOwnership)
    setLegalName(setup.legalName)
    setAcceptedByAmex(true)
  }, [dashboard?.bankSetup])

  const confirmationText = useMemo(() => {
    const formattedAmount = Number(amount || 0).toFixed(2)
    const frequency =
      cadence === 'one_time'
        ? 'one-time'
        : `${cadenceLabels[cadence].toLowerCase()} recurring`
    return `I confirm that I created the matching ${frequency} transfer of $${formattedAmount} in the official American Express Savings portal. I understand this application records the plan but does not initiate, change, or cancel the bank transfer.`
  }, [amount, cadence])

  function openAmexSetup() {
    window.open(AMEX_SETUP_URL, '_blank', 'noopener,noreferrer')
  }

  async function handleSaveSetup(event: FormEvent) {
    event.preventDefault()
    setSetupError('')
    setNotice('')

    if (!/^\d{4}$/.test(sourceMask)) {
      setSetupError('Enter exactly four digits for the AMEX Savings account.')
      return
    }
    if (!/^\d{4}$/.test(destinationMask)) {
      setSetupError('Enter exactly four digits for the business account.')
      return
    }
    if (destinationLabel.trim().length < 2) {
      setSetupError('Enter a label for the business destination account.')
      return
    }
    if (legalName.trim().length < 2) {
      setSetupError('Enter the exact legal account-owner name.')
      return
    }
    if (!acceptedByAmex) {
      setSetupError('Confirm that American Express accepted the external account.')
      return
    }

    const setup: BankSetupDraft = {
      sourceMask,
      destinationLabel: destinationLabel.trim(),
      destinationMask,
      sourceOwnership,
      legalName: legalName.trim(),
      acceptedByAmex,
    }

    setLoading(true)
    try {
      setDashboard(await saveBankSetup(setup))
      setNotice('Verified AMEX bank setup saved.')
    } catch (caught) {
      setSetupError(
        caught instanceof Error ? caught.message : 'Could not save the bank setup.',
      )
    } finally {
      setLoading(false)
    }
  }

  function handleReview(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    const numericAmount = Number(amount)

    if (!dashboard?.bankSetup) {
      setFormError('Record the AMEX bank setup first.')
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Enter a transfer amount greater than zero.')
      return
    }
    if (numericAmount > 999_999.99) {
      setFormError('The amount exceeds the application maximum.')
      return
    }
    if (new Date(scheduledLocal).getTime() <= Date.now()) {
      setFormError('Choose a future first transfer date and time.')
      return
    }
    if (!confirmedInAmex) {
      setFormError('Confirm that the matching live transfer exists in AMEX.')
      return
    }

    setReviewOpen(true)
  }

  const draft: TransferPlanDraft = {
    amount,
    memo,
    cadence,
    scheduledFor: toIso(scheduledLocal),
    amexConfirmationReference: amexReference.trim(),
    confirmationText,
    confirmationVersion: '2026-07-25.2',
    confirmedInAmex,
  }

  async function handleSavePlan() {
    setLoading(true)
    setFormError('')
    try {
      const result = await saveTransferPlan(draft)
      setReviewOpen(false)
      setNotice(result.message)
      setAmount('')
      setMemo('')
      setAmexReference('')
      setConfirmedInAmex(false)
      await refreshDashboard()
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'The AMEX plan record failed.',
      )
      setReviewOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    setAuthenticated(false)
    setDashboard(null)
  }

  if (!isConfigured) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="auth-icon" aria-hidden="true">
            <AlertTriangle size={26} />
          </div>
          <h1>Production configuration required</h1>
          <p>
            Set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY in the live
            deployment. This app has no preview or sandbox bypass.
          </p>
        </section>
      </main>
    )
  }

  if (authLoading) {
    return (
      <div className="loading-page">
        <LoaderCircle className="spin" size={28} />
        <span>Checking secure session…</span>
      </div>
    )
  }

  if (!authenticated) {
    return <AuthScreen onSignedIn={() => setAuthenticated(true)} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>AMEX Savings Transfer</h1>
          <p>Production record for transfers configured inside American Express</p>
        </div>
        <div className="header-actions">
          <div className="mode-indicator production">
            <AlertTriangle size={16} aria-hidden="true" />
            Live production
          </div>
          <button
            className="sign-out-button"
            type="button"
            onClick={handleSignOut}
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      {loading && (
        <div className="loading-bar" role="status">
          <span />
        </div>
      )}

      <div className="app-grid">
        <main className="main-column">
          <section className="account-section" aria-labelledby="accounts-title">
            <h2 className="sr-only" id="accounts-title">
              AMEX bank setup
            </h2>
            <div className="step-rail" aria-hidden="true">
              <div className="step active">
                <span>1</span>
                Link in AMEX
              </div>
              <ChevronRight size={18} />
              <div className={dashboard?.bankSetup ? 'step active' : 'step'}>
                <span>2</span>
                Record confirmation
              </div>
            </div>

            <AccountRow
              title="American Express Savings"
              subtitle="Source account managed in AMEX"
              connected={Boolean(dashboard?.bankSetup)}
              detail={
                dashboard?.bankSetup
                  ? `Recorded •••• ${dashboard.bankSetup.sourceMask}`
                  : 'Complete setup in AMEX'
              }
              actionLabel="Open AMEX setup"
              onAction={openAmexSetup}
            />

            <AccountRow
              title={
                dashboard?.bankSetup?.destinationLabel || 'Business bank account'
              }
              subtitle="External destination accepted by AMEX"
              connected={Boolean(dashboard?.bankSetup)}
              detail={
                dashboard?.bankSetup
                  ? `Recorded •••• ${dashboard.bankSetup.destinationMask}`
                  : 'Not yet recorded'
              }
              actionLabel="Review in AMEX"
              onAction={openAmexSetup}
            />

            <div className="setup-card">
              <div className="section-title">
                <div>
                  <h2>Record verified bank setup</h2>
                  <p>Enter only labels and last four digits—never bank credentials.</p>
                </div>
                <a
                  className="text-link"
                  href={AMEX_SETUP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official instructions
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>

              <form onSubmit={handleSaveSetup}>
                <div className="form-grid two-columns">
                  <label>
                    AMEX Savings last four
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder="1234"
                      value={sourceMask}
                      onChange={(event) =>
                        setSourceMask(event.target.value.replace(/\D/g, ''))
                      }
                      required
                    />
                  </label>
                  <label>
                    Source ownership
                    <select
                      value={sourceOwnership}
                      onChange={(event) =>
                        setSourceOwnership(
                          event.target.value as AccountOwnership,
                        )
                      }
                    >
                      <option value="business">Business account</option>
                      <option value="consumer">Personal/consumer account</option>
                    </select>
                  </label>
                </div>
                <div className="form-grid two-columns">
                  <label>
                    Business destination label
                    <input
                      type="text"
                      maxLength={100}
                      value={destinationLabel}
                      onChange={(event) => setDestinationLabel(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Business account last four
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder="5678"
                      value={destinationMask}
                      onChange={(event) =>
                        setDestinationMask(event.target.value.replace(/\D/g, ''))
                      }
                      required
                    />
                  </label>
                </div>
                <label>
                  Exact legal account-owner name
                  <input
                    type="text"
                    autoComplete="organization"
                    maxLength={200}
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    required
                  />
                </label>
                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={acceptedByAmex}
                    onChange={(event) => setAcceptedByAmex(event.target.checked)}
                  />
                  <span>
                    I confirm American Express accepted this external business
                    account and its legal ownership or title.
                  </span>
                </label>
                {setupError && <p className="form-error">{setupError}</p>}
                <button className="secondary-button" type="submit" disabled={loading}>
                  {dashboard?.bankSetup ? 'Update bank record' : 'Save bank record'}
                </button>
              </form>
            </div>
          </section>

          <section className="transfer-section" aria-labelledby="transfer-title">
            <div className="section-title">
              <div>
                <h2 id="transfer-title">Record a live AMEX transfer</h2>
                <p>
                  Use this after creating the matching transfer in American Express.
                </p>
              </div>
              <CalendarClock size={25} strokeWidth={1.6} aria-hidden="true" />
            </div>

            <form onSubmit={handleReview}>
              <div className="form-grid two-columns">
                <label>
                  Transfer amount
                  <div className="currency-input">
                    <span>$</span>
                    <input
                      type="number"
                      min="0.01"
                      max="999999.99"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                    />
                  </div>
                </label>
                <label>
                  Frequency
                  <select
                    value={cadence}
                    onChange={(event) => setCadence(event.target.value as Cadence)}
                  >
                    {Object.entries(cadenceLabels).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-grid two-columns">
                <label>
                  {cadence === 'one_time' ? 'Transfer date' : 'First transfer date'}
                  <input
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(event) => setScheduledLocal(event.target.value)}
                    required
                  />
                </label>
                <label>
                  AMEX confirmation reference{' '}
                  <span className="optional">(optional)</span>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Reference shown by AMEX"
                    value={amexReference}
                    onChange={(event) => setAmexReference(event.target.value)}
                  />
                </label>
              </div>

              <label>
                Transfer memo <span className="optional">(optional)</span>
                <input
                  type="text"
                  maxLength={140}
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                />
              </label>

              <label className="consent-row">
                <input
                  type="checkbox"
                  checked={confirmedInAmex}
                  onChange={(event) => setConfirmedInAmex(event.target.checked)}
                />
                <span>{confirmationText}</span>
              </label>

              {formError && <p className="form-error">{formError}</p>}

              <button
                className="primary-button"
                type="submit"
                disabled={loading || !dashboard?.bankSetup}
              >
                Review AMEX record
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </form>
          </section>

          {(pageError || notice) && (
            <div
              className={pageError ? 'message error-message' : 'message notice-message'}
              role={pageError ? 'alert' : 'status'}
            >
              {pageError || notice}
            </div>
          )}

          <ActivityTable plans={dashboard?.plans || []} />
        </main>

        <SafetyPanel />
      </div>

      {reviewOpen && dashboard?.bankSetup && (
        <ReviewDialog
          setup={dashboard.bankSetup}
          draft={draft}
          busy={loading}
          onCancel={() => setReviewOpen(false)}
          onSave={handleSavePlan}
        />
      )}
    </div>
  )
}

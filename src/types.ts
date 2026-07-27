export type AccountOwnership = 'consumer' | 'business'
export type Cadence = 'one_time' | 'weekly' | 'biweekly' | 'monthly'
export type TransferPlanStatus = 'recorded_in_amex' | 'cancelled'

export interface BankSetup {
  id: string
  sourceMask: string
  destinationLabel: string
  destinationMask: string
  sourceOwnership: AccountOwnership
  legalName: string
  confirmedAt: string
  updatedAt: string
}

export interface TransferPlan {
  id: string
  amount: string
  memo: string | null
  cadence: Cadence
  scheduledFor: string
  status: TransferPlanStatus
  amexConfirmationReference: string | null
  createdAt: string
}

export interface DashboardData {
  mode: 'production'
  transferExecutor: 'american_express'
  bankSetup: BankSetup | null
  plans: TransferPlan[]
}

export interface BankSetupDraft {
  sourceMask: string
  destinationLabel: string
  destinationMask: string
  sourceOwnership: AccountOwnership
  legalName: string
  acceptedByAmex: boolean
}

export interface TransferPlanDraft {
  amount: string
  memo: string
  cadence: Cadence
  scheduledFor: string
  amexConfirmationReference: string
  confirmationText: string
  confirmationVersion: string
  confirmedInAmex: boolean
}

export interface SavePlanResult {
  planId: string
  status: TransferPlanStatus
  message: string
}

import type {
  BankSetupDraft,
  DashboardData,
  SavePlanResult,
  TransferPlanDraft,
} from '../types'
import { insforge } from '../lib/insforge'

async function invoke<T>(action: string, payload: Record<string, unknown> = {}) {
  if (!insforge) {
    throw new Error('This production app is missing its InsForge configuration.')
  }

  const { data, error } = await insforge.functions.invoke('bank-operations', {
    body: { action, ...payload },
  })

  if (error) {
    throw new Error(error.message || 'The secure recordkeeping service failed.')
  }

  return data as T
}

export function loadDashboard(): Promise<DashboardData> {
  return invoke<DashboardData>('dashboard')
}

export function saveBankSetup(setup: BankSetupDraft): Promise<DashboardData> {
  return invoke<DashboardData>('save_bank_setup', { setup })
}

export function saveTransferPlan(
  draft: TransferPlanDraft,
): Promise<SavePlanResult> {
  return invoke<SavePlanResult>('save_transfer_plan', { draft })
}

export async function signIn(email: string, password: string) {
  if (!insforge) throw new Error('InsForge is not configured.')
  const { data, error } = await insforge.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw new Error(error.message)
  if (!data?.user) throw new Error('InsForge did not return a signed-in user.')
  return data.user
}

export async function signOut() {
  if (!insforge) return
  const { error } = await insforge.auth.signOut()
  if (error) throw new Error(error.message)
}

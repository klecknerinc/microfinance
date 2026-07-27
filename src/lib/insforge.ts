import { createClient } from '@insforge/sdk'

const baseUrl = import.meta.env.VITE_INSFORGE_URL?.trim()
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY?.trim()
const functionsUrl = import.meta.env.VITE_INSFORGE_FUNCTIONS_URL?.trim()

export const isConfigured = Boolean(baseUrl && anonKey)

export const insforge = isConfigured
  ? createClient({
      baseUrl: baseUrl!,
      anonKey: anonKey!,
      ...(functionsUrl ? { functionsUrl } : {}),
    })
  : null

import type { ApiClient } from './api'

const mutationCounts = new WeakMap<ApiClient, number>()

export function isCareMutationInFlight(api: ApiClient): boolean {
  return (mutationCounts.get(api) ?? 0) > 0
}

export function trackCareMutation(api: ApiClient, delta: 1 | -1): void {
  const next = (mutationCounts.get(api) ?? 0) + delta
  if (next > 0) mutationCounts.set(api, next)
  else mutationCounts.delete(api)
}

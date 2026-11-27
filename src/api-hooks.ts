import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiClient, ApiError } from './api'
import { isCareMutationInFlight } from './api-resource-refresh'

export function useApiUser(client: ApiClient) {
  return useSyncExternalStore(client.subscribe, client.getUser, () => null)
}

const noSubscribe = () => () => undefined
const noUser = () => null

export function useApiResource<T>(
  client: ApiClient | undefined,
  path: string | null,
  {
    interval = 30_000,
    shouldSkipBackground,
  }: { interval?: number; shouldSkipBackground?: () => boolean } = {},
) {
  const user = useSyncExternalStore(
    client?.subscribe ?? noSubscribe,
    client?.getUser ?? noUser,
    noUser,
  )
  const actor = user ? client?.getSessionKey() : null
  const enabled = !!client && !!path && !!user
  const [state, setState] = useState<{
    client: ApiClient | undefined
    actor: number | null | undefined
    path: string | null
    data: T | null
    error: ApiError | null
    loading: boolean
  }>({ client, actor, path, data: null, error: null, loading: enabled })
  const activeRequest = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const mounted = useRef(false)
  const runRef = useRef<(background: boolean) => void>(() => {})

  runRef.current = (background) => {
    if (!enabled || !client || !path) return
    if (background && (
      navigator.onLine === false ||
      shouldSkipBackground?.() ||
      isCareMutationInFlight(client) ||
      activeRequest.current
    )) return

    const id = ++requestId.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller

    setState((current) => {
      const sameScope =
        current.client === client &&
        current.actor === actor &&
        current.path === path
      const data = sameScope ? current.data : null
      return {
        client,
        actor,
        path,
        data,
        error: sameScope ? current.error : null,
        loading: background ? sameScope && current.loading : true,
      }
    })

    const current = () =>
      mounted.current &&
      id === requestId.current &&
      !controller.signal.aborted &&
      client.getUser() !== null &&
      client.getSessionKey() === actor

    client
      .get<T>(path, controller.signal)
      .then((data) => {
        if (current()) setState({ client, actor, path, data, error: null, loading: false })
      })
      .catch((error) => {
        if (!current()) return
        const apiError = error instanceof ApiError ? error : new ApiError(0)
        if (
          background &&
          (apiError.status === 0 ||
            apiError.status === 408 ||
            apiError.status === 429 ||
            apiError.status >= 500)
        ) return
        setState((currentState) => {
          const sameScope =
            currentState.client === client &&
            currentState.actor === actor &&
            currentState.path === path
          return {
            client,
            actor,
            path,
            data: sameScope && !(apiError.status >= 400 && apiError.status < 500)
              ? currentState.data
              : null,
            error: apiError,
            loading: false,
          }
        })
      })
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null
      })
  }

  const reload = useCallback(() => runRef.current(false), [])

  useEffect(() => {
    if (!enabled || !client || !path) return
    let active = true
    mounted.current = true
    const onRefresh = () => {
      if (active && document.visibilityState === 'visible') runRef.current(true)
    }
    const onOnline = () => {
      if (active && document.visibilityState === 'visible') runRef.current(true)
    }
    window.addEventListener('focus', onRefresh)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onRefresh)
    const timer = interval > 0 ? window.setInterval(onRefresh, interval) : undefined
    runRef.current(false)

    return () => {
      active = false
      requestId.current += 1
      activeRequest.current?.abort()
      activeRequest.current = null
      mounted.current = false
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onRefresh)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [client, actor, enabled, path, interval])
  return {
    ...(state.path === path && state.client === client && state.actor === actor
      ? state
      : { data: null, error: null, loading: enabled }),
    reload,
  }
}

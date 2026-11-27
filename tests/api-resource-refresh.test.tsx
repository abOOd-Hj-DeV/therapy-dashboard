import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError, type ApiUser } from '../src/api'
import { useApiResource } from '../src/api-hooks'
import {
  useCareMutation,
  useCareResource,
} from '../src/api-sessions-and-clinical-support'

function makeApi(
  get: (path: string, signal?: AbortSignal) => Promise<unknown>,
  mutate: () => Promise<unknown> = () => Promise.resolve({}),
) {
  const listeners = new Set<() => void>()
  const user = { id: 'therapist-id' } as ApiUser
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getUser: () => user,
    getSessionKey: () => 1,
    get,
    mutate,
  } as unknown as ApiClient
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

afterEach(() => vi.useRealTimers())

describe('background resource refresh', () => {
  it('refreshes useApiResource on focus and the visible polling interval without dropping data', async () => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const focused = deferred<{ value: string }>()
    const polled = deferred<{ value: string }>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockReturnValueOnce(focused.promise)
      .mockReturnValueOnce(polled.promise)
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ value: string }>(api, '/resource'))

    await flush()
    expect(result.current.data).toEqual({ value: 'initial' })

    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current.data).toEqual({ value: 'initial' })
    expect(result.current.loading).toBe(false)
    await act(async () => {
      focused.resolve({ value: 'focused' })
      await focused.promise
    })
    expect(result.current.data).toEqual({ value: 'focused' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current.data).toEqual({ value: 'focused' })
    expect(result.current.loading).toBe(false)
    await act(async () => {
      polled.resolve({ value: 'polled' })
      await polled.promise
    })
    expect(result.current.data).toEqual({ value: 'polled' })
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('drops stale responses and preserves the last data on refresh errors', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const stale = deferred<{ value: string }>()
    const newest = deferred<{ value: string }>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(newest.promise)
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ value: string }>(api, '/resource'))

    act(() => result.current.reload())
    await act(async () => {
      newest.resolve({ value: 'newest' })
      await newest.promise
    })
    await act(async () => {
      stale.resolve({ value: 'stale' })
      await stale.promise
    })
    expect(result.current.data).toEqual({ value: 'newest' })

    get.mockRejectedValueOnce(new ApiError(503))
    act(() => window.dispatchEvent(new Event('focus')))
    await flush()
    expect(result.current.data).toEqual({ value: 'newest' })
    expect(result.current.error).toBeInstanceOf(ApiError)
  })

  it('keeps drafts during background updates and pauses polling during a care mutation', async () => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const updated = deferred<{ value: string }>()
    const write = deferred<unknown>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockReturnValueOnce(updated.promise)
      .mockResolvedValueOnce({ value: 'after-write' })
    const mutate = vi.fn(() => write.promise)
    const api = makeApi(get, mutate)

    function Probe() {
      const resource = useCareResource<{ value: string }>(api, '/resource', 'single', {
        interval: 1_000,
      })
      const mutation = useCareMutation(api, resource.reload)
    const [draft, setDraft] = useState('')
      return (
        <>
          <p>{resource.data?.value}</p>
          <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button onClick={() => void mutation.run('/write')}>Save</button>
        </>
      )
    }

    render(<Probe />)
    await flush()
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unsaved note' } })
    act(() => window.dispatchEvent(new Event('focus')))
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved note')
    await act(async () => {
      updated.resolve({ value: 'background-update' })
      await updated.promise
    })
    expect(screen.getByText('background-update')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved note')

    fireEvent.click(screen.getByText('Save'))
    expect(mutate).toHaveBeenCalledTimes(1)
    const readsDuringMutation = get.mock.calls.length
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(get).toHaveBeenCalledTimes(readsDuringMutation)

    await act(async () => {
      write.resolve({})
      await write.promise
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('after-write')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved note')
  })
})

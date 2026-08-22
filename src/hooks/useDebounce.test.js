import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useDebounce from './useDebounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 350))

    expect(result.current).toBe('a')
  })

  it('does not update before the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 350), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(349))

    expect(result.current).toBe('a')
  })

  it('updates once the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 350), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(350))

    expect(result.current).toBe('ab')
  })

  it('emits only the final value of a typing burst', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 350), {
      initialProps: { value: '' },
    })

    for (const value of ['d', 'du', 'dun', 'dune']) {
      rerender({ value })
      act(() => vi.advanceTimersByTime(100))
    }

    // 400ms of elapsed time but never a 350ms pause, so nothing has landed.
    expect(result.current).toBe('')

    act(() => vi.advanceTimersByTime(350))
    expect(result.current).toBe('dune')
  })

  it('cancels the pending timer on unmount, so no state update lands after it', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 350),
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'ab' })
    unmount()

    expect(clearSpy).toHaveBeenCalled()
    // Advancing past the delay must not throw a "state update on unmounted
    // component" warning or fire anything at all.
    expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow()
  })

  it('restarts the timer when the delay itself changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 350 } },
    )

    rerender({ value: 'ab', delay: 350 })
    act(() => vi.advanceTimersByTime(300))
    rerender({ value: 'ab', delay: 1000 })
    act(() => vi.advanceTimersByTime(300))

    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(700))
    expect(result.current).toBe('ab')
  })

  it('handles an empty string as a real value, not a falsy skip', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 350), {
      initialProps: { value: 'dune' },
    })

    rerender({ value: '' })
    act(() => vi.advanceTimersByTime(350))

    expect(result.current).toBe('')
  })
})

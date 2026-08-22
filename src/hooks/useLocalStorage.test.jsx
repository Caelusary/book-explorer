import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import useLocalStorage from './useLocalStorage'

const KEY = 'test:key'

describe('useLocalStorage - reading', () => {
  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, ['fallback']))

    expect(result.current[0]).toEqual(['fallback'])
  })

  it('returns the stored value on mount', () => {
    window.localStorage.setItem(KEY, JSON.stringify([{ key: 'a' }]))

    const { result } = renderHook(() => useLocalStorage(KEY, []))

    expect(result.current[0]).toEqual([{ key: 'a' }])
  })

  it('falls back to the initial value on unparseable JSON', () => {
    window.localStorage.setItem(KEY, '{not json at all')

    const { result } = renderHook(() => useLocalStorage(KEY, []))

    expect(result.current[0]).toEqual([])
  })

  it('falls back to the initial value on a stored literal null', () => {
    // JSON.parse('null') is null, not a parse error, so a naive read hands
    // null straight to consumers that expect an array.
    window.localStorage.setItem(KEY, 'null')

    const { result } = renderHook(() => useLocalStorage(KEY, []))

    expect(result.current[0]).toEqual([])
  })

  it('rejects a stored value that fails the shape check', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ not: 'an array' }))

    const { result } = renderHook(() =>
      useLocalStorage(KEY, [], Array.isArray),
    )

    expect(result.current[0]).toEqual([])
  })

  it('rejects a stored primitive that fails the shape check', () => {
    window.localStorage.setItem(KEY, JSON.stringify('a bare string'))

    const { result } = renderHook(() =>
      useLocalStorage(KEY, [], Array.isArray),
    )

    expect(result.current[0]).toEqual([])
  })

  it('keeps a stored value that passes the shape check', () => {
    window.localStorage.setItem(KEY, JSON.stringify([1, 2]))

    const { result } = renderHook(() =>
      useLocalStorage(KEY, [], Array.isArray),
    )

    expect(result.current[0]).toEqual([1, 2])
  })

  it('keeps falsy-but-valid stored values like 0 and empty string', () => {
    window.localStorage.setItem(KEY, JSON.stringify(0))

    const { result } = renderHook(() => useLocalStorage(KEY, 99))

    expect(result.current[0]).toBe(0)
  })

  it('survives localStorage.getItem throwing, as private modes can', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError')
      })

    const { result } = renderHook(() => useLocalStorage(KEY, ['safe']))

    expect(result.current[0]).toEqual(['safe'])
    spy.mockRestore()
  })
})

describe('useLocalStorage - writing', () => {
  it('persists an updated value', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, []))

    act(() => result.current[1](['written']))

    expect(result.current[0]).toEqual(['written'])
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(['written'])
  })

  it('supports the updater-function form', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, [1]))

    act(() => result.current[1]((current) => [...current, 2]))

    expect(result.current[0]).toEqual([1, 2])
  })

  it('does not crash when setItem throws, e.g. on a full quota', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    const { result } = renderHook(() => useLocalStorage(KEY, []))

    expect(() => act(() => result.current[1](['big']))).not.toThrow()
    // The write failed, but state still moved so the session keeps working.
    expect(result.current[0]).toEqual(['big'])
    spy.mockRestore()
  })

  it('round-trips through a remount', () => {
    const first = renderHook(() => useLocalStorage(KEY, []))
    act(() => first.result.current[1]([{ key: '/works/OL1W' }]))
    first.unmount()

    const second = renderHook(() => useLocalStorage(KEY, []))

    expect(second.result.current[0]).toEqual([{ key: '/works/OL1W' }])
  })
})

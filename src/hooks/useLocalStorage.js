import { useEffect, useState } from 'react'

/**
 * useState that survives a page reload by mirroring the value into
 * localStorage. Reads happen lazily (the function form of useState) so the
 * parse cost is paid once on mount rather than on every render.
 *
 * `isValid` is optional but matters: localStorage is user-writable and outlives
 * the code that wrote it, so a stored value left behind by an older build (or
 * edited by hand) can be valid JSON of entirely the wrong shape. Without a
 * shape check that value flows straight into state and every consumer that
 * assumes an array crashes the app on mount, with no way back except clearing
 * storage by hand.
 */
export default function useLocalStorage(key, initialValue, isValid) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored === null) return initialValue

      const parsed = JSON.parse(stored)
      if (parsed == null) return initialValue
      if (isValid && !isValid(parsed)) return initialValue
      return parsed
    } catch {
      // Unparseable JSON, or a private browsing mode that throws on access —
      // fall back to the initial value and keep going in memory.
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore quota or permission errors; the app still works in-memory.
    }
  }, [key, value])

  return [value, setValue]
}

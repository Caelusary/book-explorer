import { useEffect, useState } from 'react'

/**
 * useState that survives a page reload by mirroring the value into
 * localStorage. Reads happen lazily (the function form of useState) so the
 * parse cost is paid once on mount rather than on every render.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      // Private browsing modes can throw on access — fall back to memory only.
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

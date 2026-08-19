import { useEffect, useState } from 'react'

/**
 * Returns `value` only after it has stopped changing for `delay` ms.
 *
 * The cleanup function is the important part: every keystroke re-runs the
 * effect, which first clears the timer set by the previous keystroke. Only the
 * last one in a burst of typing ever fires, so the API is hit once per pause
 * rather than once per character.
 */
export default function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

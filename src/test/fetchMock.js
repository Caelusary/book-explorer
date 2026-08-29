import { vi } from 'vitest'

/**
 * Installs a stubbed global.fetch and records every URL it is asked for.
 *
 * The recorded URLs are the point: most of the wiring in this app is "a value
 * from state or the URL has to end up as a query parameter on a request", and
 * that is exactly the kind of thing that can look correct in a diff while
 * silently doing nothing. Asserting on the request URL is the only oracle that
 * actually proves the value travelled.
 *
 * `handler(url, index)` returns { ok, status, body, delayMs }. Abort is
 * honoured properly so cancellation and stale-response ordering can be tested
 * with real AbortControllers rather than a hand-waved mock.
 */
export function installFetchMock(handler) {
  const urls = []

  const fetchMock = vi.fn((input, options = {}) => {
    const url = String(input)
    const index = urls.length
    urls.push(url)

    const result = handler(url, index) ?? {}
    const { ok = true, status = 200, body = {}, delayMs = 0 } = result

    return new Promise((resolve, reject) => {
      const signal = options.signal

      const abortError = () => {
        const error = new Error('The operation was aborted.')
        error.name = 'AbortError'
        return error
      }

      if (signal?.aborted) {
        reject(abortError())
        return
      }

      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve({
          ok,
          status,
          json: async () => body,
        })
      }, delayMs)

      function onAbort() {
        clearTimeout(timer)
        reject(abortError())
      }

      signal?.addEventListener('abort', onAbort, { once: true })
    })
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    urls,
    fetchMock,
    /** The single URL matching a fragment — fails loudly if there is not exactly one. */
    urlsContaining: (fragment) => urls.filter((url) => url.includes(fragment)),
  }
}

/** Minimal search doc, overridable per field. */
export function doc(overrides = {}) {
  return {
    key: '/works/OL1W',
    title: 'Dune',
    author_name: ['An Author'],
    first_publish_year: 1999,
    cover_i: 111,
    edition_count: 3,
    ...overrides,
  }
}

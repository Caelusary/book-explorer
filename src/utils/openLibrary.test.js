import { describe, expect, it } from 'vitest'
import { doc, installFetchMock } from '../test/fetchMock'
import {
  coverUrl,
  fetchBookByKey,
  fetchSubject,
  fetchTrending,
  fetchWorkDetail,
  openLibraryUrl,
  searchBooks,
  sortOption,
  suggestBooks,
  workIdFromKey,
} from './openLibrary'

describe('searchBooks request URL', () => {
  // The bug this file exists for: `sort` was added to the signature and to the
  // effect dependency array, but the call site still passed two arguments.
  // Every visible signal - the URL bar, the select, the re-render - looked
  // right. The only thing that told the truth was the outgoing request.
  it('sends no sort parameter for relevance', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    await searchBooks('dune', undefined, 'relevance')

    expect(net.urls).toHaveLength(1)
    expect(net.urls[0]).not.toContain('sort=')
  })

  it('sends sort=new when asked for newest', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    await searchBooks('dune', undefined, 'new')

    expect(net.urls[0]).toContain('sort=new')
  })

  it('sends sort=rating when asked for rating', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    await searchBooks('dune', undefined, 'rating')

    expect(net.urls[0]).toContain('sort=rating')
  })

  it('falls back to relevance for an unknown sort value from the URL', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    // ?sort=banana is one hand-edit away and must not produce sort=banana.
    await searchBooks('dune', undefined, 'banana')

    expect(net.urls[0]).not.toContain('sort=')
  })

  it('defaults to relevance when no sort argument is passed at all', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    await searchBooks('dune')

    expect(net.urls[0]).not.toContain('sort=')
  })

  it('percent-encodes the query so ampersands cannot inject parameters', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    await searchBooks('cats & dogs', undefined, 'new')

    expect(net.urls[0]).toContain('q=cats%20%26%20dogs')
    // One sort parameter, from us, not from the query text.
    expect(net.urls[0].match(/sort=/g)).toHaveLength(1)
  })
})

describe('searchBooks response handling', () => {
  it('returns an empty array when the API finds nothing', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    await expect(searchBooks('asdkjfhasdkjfh')).resolves.toEqual([])
  })

  it('returns an empty array when docs is missing entirely', async () => {
    installFetchMock(() => ({ body: { numFound: 0 } }))

    await expect(searchBooks('anything')).resolves.toEqual([])
  })

  it('throws with the status code on a non-ok response', async () => {
    installFetchMock(() => ({ ok: false, status: 503, body: {} }))

    await expect(searchBooks('dune')).rejects.toThrow('503')
  })

  it('propagates an abort as an AbortError rather than an empty result', async () => {
    installFetchMock(() => ({ body: { docs: [doc()] }, delayMs: 50 }))
    const controller = new AbortController()

    const promise = searchBooks('dune', controller.signal)
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('withMissingLast ordering', () => {
  // NOTE: in practice Open Library only returns docs that carry the sorted
  // field, so this reordering is currently unreachable through the live API.
  // It is kept under test because a silent behaviour change here would be
  // invisible in the UI, and because the branch is cheap to hold onto.
  it('moves docs missing the sorted field to the end, preserving order', async () => {
    installFetchMock(() => ({
      body: {
        docs: [
          doc({ key: '/works/A', first_publish_year: undefined }),
          doc({ key: '/works/B', first_publish_year: 2001 }),
          doc({ key: '/works/C', first_publish_year: undefined }),
          doc({ key: '/works/D', first_publish_year: 1998 }),
        ],
      },
    }))

    const books = await searchBooks('x', undefined, 'new')

    expect(books.map((book) => book.key)).toEqual([
      '/works/B',
      '/works/D',
      '/works/A',
      '/works/C',
    ])
  })

  it('treats a rating of 0 as present, not missing', async () => {
    installFetchMock(() => ({
      body: {
        docs: [
          doc({ key: '/works/A', ratings_average: undefined }),
          doc({ key: '/works/B', ratings_average: 0 }),
        ],
      },
    }))

    const books = await searchBooks('x', undefined, 'rating')

    expect(books.map((book) => book.key)).toEqual(['/works/B', '/works/A'])
  })

  it('leaves order untouched for relevance', async () => {
    installFetchMock(() => ({
      body: {
        docs: [
          doc({ key: '/works/A', first_publish_year: undefined }),
          doc({ key: '/works/B', first_publish_year: 2001 }),
        ],
      },
    }))

    const books = await searchBooks('x', undefined, 'relevance')

    expect(books.map((book) => book.key)).toEqual(['/works/A', '/works/B'])
  })
})

describe('key and url helpers', () => {
  it('strips the /works/ prefix', () => {
    expect(workIdFromKey('/works/OL27448W')).toBe('OL27448W')
  })

  it('returns an empty string rather than throwing on a missing key', () => {
    expect(workIdFromKey(undefined)).toBe('')
    expect(workIdFromKey(null)).toBe('')
  })

  it('builds an external work url', () => {
    expect(openLibraryUrl('OL1W')).toBe('https://openlibrary.org/works/OL1W')
  })

  it('returns null for a book with no cover instead of a broken image url', () => {
    expect(coverUrl(null)).toBeNull()
    expect(coverUrl(undefined)).toBeNull()
    expect(coverUrl(0)).toBeNull()
  })

  it('builds a cover url at the requested size', () => {
    expect(coverUrl(42, 'L')).toBe('https://covers.openlibrary.org/b/id/42-L.jpg')
    expect(coverUrl(42)).toContain('-M.jpg')
  })

  it('falls back to relevance for an unknown sort option', () => {
    expect(sortOption('nonsense').value).toBe('relevance')
    expect(sortOption(undefined).value).toBe('relevance')
    expect(sortOption('rating').param).toBe('rating')
  })
})

describe('other endpoints', () => {
  it('suggestBooks returns [] when docs is absent', async () => {
    installFetchMock(() => ({ body: {} }))
    await expect(suggestBooks('ab')).resolves.toEqual([])
  })

  it('fetchTrending returns [] when works is absent', async () => {
    installFetchMock(() => ({ body: {} }))
    await expect(fetchTrending()).resolves.toEqual([])
  })

  it('fetchBookByKey returns null for an unknown work rather than undefined', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))
    await expect(fetchBookByKey('OLNOPEW')).resolves.toBeNull()
  })

  it('fetchSubject maps the subjects shape onto the search shape', async () => {
    installFetchMock(() => ({
      body: {
        works: [
          {
            key: '/works/OL1W',
            title: 'Subject Book',
            authors: [{ name: 'First' }, { name: 'Second' }],
            first_publish_year: 1980,
            cover_id: 999,
            edition_count: 2,
          },
        ],
      },
    }))

    const [book] = await fetchSubject('fantasy')

    // BookCard only ever sees the search shape; this mapping is the only thing
    // keeping that true.
    expect(book).toEqual({
      key: '/works/OL1W',
      title: 'Subject Book',
      author_name: ['First', 'Second'],
      first_publish_year: 1980,
      cover_i: 999,
      edition_count: 2,
    })
  })

  it('fetchSubject tolerates a work with no authors', async () => {
    installFetchMock(() => ({
      body: { works: [{ key: '/works/OL2W', title: 'Anon' }] },
    }))

    const [book] = await fetchSubject('fantasy')

    expect(book.author_name).toEqual([])
    expect(book.cover_i).toBeUndefined()
  })

  it('fetchWorkDetail reads a plain string description', async () => {
    installFetchMock(() => ({ body: { title: 'T', description: 'plain' } }))
    await expect(fetchWorkDetail('OL1W')).resolves.toMatchObject({
      description: 'plain',
    })
  })

  it('fetchWorkDetail reads the { value } description shape', async () => {
    installFetchMock(() => ({
      body: { title: 'T', description: { type: '/type/text', value: 'rich' } },
    }))
    await expect(fetchWorkDetail('OL1W')).resolves.toMatchObject({
      description: 'rich',
    })
  })

  it('fetchWorkDetail returns nulls and [] for a bare work', async () => {
    installFetchMock(() => ({ body: {} }))
    await expect(fetchWorkDetail('OL1W')).resolves.toEqual({
      title: null,
      description: null,
      subjects: [],
    })
  })
})

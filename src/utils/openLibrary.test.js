import { describe, expect, it } from 'vitest'
import { doc, installFetchMock } from '../test/fetchMock'
import {
  coverUrl,
  fetchBookByKey,
  fetchWorkDetail,
  partitionByMatch,
  openLibraryUrl,
  searchBooks,
  searchRoute,
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
    // A response that matches, so the wildcard retry stays out of the way and
    // this asserts on the one request it means to.
    const net = installFetchMock(() => ({ body: { docs: [doc({ title: 'Dune' })] } }))

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

  it('throws a readable message and keeps the status on a non-ok response', async () => {
    installFetchMock(() => ({ ok: false, status: 503, body: {} }))

    await expect(searchBooks('dune')).rejects.toThrow(
      'Open Library is having trouble right now',
    )
    await expect(searchBooks('dune')).rejects.toMatchObject({ status: 503 })
  })

  it('propagates an abort as an AbortError rather than an empty result', async () => {
    installFetchMock(() => ({ body: { docs: [doc()] }, delayMs: 50 }))
    const controller = new AbortController()

    const promise = searchBooks('dune', controller.signal)
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
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

  it('fetchBookByKey returns null for an unknown work rather than undefined', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))
    await expect(fetchBookByKey('OLNOPEW')).resolves.toBeNull()
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

describe('the wildcard retry', () => {
  const matching = { body: { docs: [{ key: '/works/OL1W', title: 'Dune' }] } }
  const notMatching = { body: { docs: [{ key: '/works/OL2W', title: 'Prayer Book' }] } }

  it('sends the query plainly first', async () => {
    const net = installFetchMock(() => matching)

    await searchBooks('dune')

    // Plain, not wildcarded. Solr does not analyse a wildcard term, so
    // "dune*" ranks Jane Eyre above Dune and "noli me tangere*" finds one
    // book instead of 137.
    expect(net.urls[0]).toContain('q=dune&')
    expect(net.urls[0]).not.toContain('*')
  })

  it('does not retry when the plain response already matches', async () => {
    const net = installFetchMock(() => matching)

    await searchBooks('dune')

    expect(net.urls).toHaveLength(1)
  })

  it('retries with a wildcard when nothing in the response matches', async () => {
    const net = installFetchMock((url) =>
      url.includes('*')
        ? { body: { docs: [{ key: '/works/OL3W', title: 'The Lord of the Rings' }] } }
        : notMatching,
    )

    const docs = await searchBooks('lord of the ri')

    expect(net.urls).toHaveLength(2)
    expect(net.urls[1]).toContain('q=lord%20of%20the%20ri*')
    expect(docs.map((d) => d.title)).toEqual(['The Lord of the Rings'])
  })

  it('keeps the first response when the retry finds nothing', async () => {
    installFetchMock((url) =>
      url.includes('*') ? { body: { docs: [] } } : notMatching,
    )

    const docs = await searchBooks('zzqwxplt')

    // The near-miss row is built from whatever came back, so throwing the
    // first response away for an empty retry would empty that too.
    expect(docs.map((d) => d.title)).toEqual(['Prayer Book'])
  })

  it('does not retry a query ending in punctuation', async () => {
    const net = installFetchMock(() => notMatching)

    await searchBooks('who goes there?')

    expect(net.urls).toHaveLength(1)
    expect(net.urls[0]).not.toContain('*')
  })

  it('never wildcards an autocomplete request', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    await suggestBooks('dun')

    expect(net.urls).toHaveLength(1)
    expect(net.urls[0]).not.toContain('*')
  })
})

describe('partitionByMatch', () => {
  const book = (title, authors) => ({
    key: `/works/${title}`,
    title,
    author_name: authors,
  })

  it('keeps a book whose title contains the query', () => {
    const { matched, others } = partitionByMatch([book('Dune Messiah')], 'dune')

    expect(matched.map((b) => b.title)).toEqual(['Dune Messiah'])
    expect(others).toEqual([])
  })

  it('keeps a book matched on its author rather than its title', () => {
    const docs = [book('Children of the Mind', ['Orson Scott Card'])]

    const { matched } = partitionByMatch(docs, 'orson')

    // Title-only matching would answer every author search with nothing, which
    // is half of what the search box claims to do.
    expect(matched).toHaveLength(1)
  })

  it('demotes a book that matches neither title nor author', () => {
    const { matched, others } = partitionByMatch(
      [book('Something Else', ['Nobody'])],
      'asd',
    )

    expect(matched).toEqual([])
    expect(others.map((b) => b.title)).toEqual(['Something Else'])
  })

  it('ignores case on both sides', () => {
    const { matched } = partitionByMatch([book('DUNE')], 'DuNe')
    expect(matched).toHaveLength(1)
  })

  it('requires every word, so a partly typed title is still a near miss', () => {
    // "dune" is in the title but "messiah" is not, so this is a near miss.
    const { matched, others } = partitionByMatch([book('Dune')], 'dune messiah')

    expect(matched).toEqual([])
    expect(others).toHaveLength(1)
  })

  it('matches a title and an author typed together', () => {
    const docs = [book('Noli Me Tangere', ['José Rizal'])]

    const { matched } = partitionByMatch(docs, 'noli me tangere by jose rizal')

    // Reported as returning nothing. The words are split across the title and
    // the author, so no single field contains the phrase, and "by" appears in
    // neither.
    expect(matched).toHaveLength(1)
  })

  it('ignores accents so a name can be typed the ordinary way', () => {
    const docs = [book('El filibusterismo', ['José Rizal'])]

    expect(partitionByMatch(docs, 'jose rizal').matched).toHaveLength(1)
    expect(partitionByMatch(docs, 'josé rizal').matched).toHaveLength(1)
  })

  it('matches a word by its start, not anywhere inside it', () => {
    const docs = [
      book('The Lord of the Rings', ['J.R.R. Tolkien']),
      book('Lord of the Flies', ['William Golding']),
    ]

    const { matched, others } = partitionByMatch(docs, 'lord of the ri')

    // "ri" opens "Rings". Matching anywhere inside a word instead would drag
    // in anything containing those two letters.
    expect(matched.map((b) => b.title)).toEqual(['The Lord of the Rings'])
    expect(others.map((b) => b.title)).toEqual(['Lord of the Flies'])
  })

  it('still rejects an unrelated book for a nonsense query', () => {
    const docs = [book('Something Else', ['Nobody'])]

    expect(partitionByMatch(docs, 'zzqwxplt').matched).toEqual([])
  })

  it('treats everything as a match when there is no query to match against', () => {
    const docs = [book('A'), book('B')]

    const { matched, others } = partitionByMatch(docs, '   ')

    expect(matched).toBe(docs)
    expect(others).toEqual([])
  })

  it('tolerates a doc with no title and no authors', () => {
    const { others } = partitionByMatch([{ key: '/works/OL1W' }], 'dune')
    expect(others).toHaveLength(1)
  })
})

describe('search scope', () => {
  it('sends the query as the parameter the scope names', async () => {
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    await searchBooks('rizal', undefined, 'relevance', 'author')

    // The distinction that matters: `author=` is matched against the author
    // field alone, where `q=` would still rank on title and everything else.
    expect(net.urls[0]).toContain('author=rizal')
    expect(net.urls[0]).not.toContain('q=rizal')
  })

  it('falls back to the plain query for an unknown scope', async () => {
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    await searchBooks('dune', undefined, 'relevance', 'nonsense')

    expect(net.urls[0]).toContain('q=dune')
  })

  it('carries the scope into the wildcard retry', async () => {
    // Nothing matches on the first pass, so the retry runs — and it has to
    // stay inside the same scope or it would answer a different question.
    const net = installFetchMock((url) =>
      url.includes('*')
        ? { body: { docs: [doc({ author_name: ['Rizal Jose'] })] } }
        : { body: { docs: [doc({ author_name: ['Someone Else'] })] } },
    )

    await searchBooks('riza', undefined, 'relevance', 'author')

    expect(net.urls).toHaveLength(2)
    expect(net.urls[1]).toContain('author=riza*')
  })

  it('scopes the suggestion request too', async () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    await suggestBooks('rizal', undefined, 'author')

    expect(net.urls[0]).toContain('author=rizal')
  })
})

describe('partitionByMatch across scopes', () => {
  const rizal = doc({ title: 'Noli Me Tangere', author_name: ['José Rizal'] })

  it('matches either field when the scope is everything', () => {
    expect(partitionByMatch([rizal], 'rizal', 'all').matched).toHaveLength(1)
    expect(partitionByMatch([rizal], 'tangere', 'all').matched).toHaveLength(1)
  })

  it('ignores the author when the scope is the title', () => {
    // The request asked Open Library for titles. Counting a book as an exact
    // match on its author would contradict the search that produced it.
    expect(partitionByMatch([rizal], 'rizal', 'title').matched).toHaveLength(0)
    expect(partitionByMatch([rizal], 'rizal', 'title').others).toHaveLength(1)
    expect(partitionByMatch([rizal], 'tangere', 'title').matched).toHaveLength(1)
  })

  it('ignores the title when the scope is the author', () => {
    expect(partitionByMatch([rizal], 'tangere', 'author').matched).toHaveLength(0)
    expect(partitionByMatch([rizal], 'rizal', 'author').matched).toHaveLength(1)
  })

  it('still folds accents inside a scoped field', () => {
    expect(partitionByMatch([rizal], 'jose', 'author').matched).toHaveLength(1)
  })

  it('treats a book with no authors as unmatched rather than crashing', () => {
    const anonymous = doc({ author_name: undefined })
    expect(partitionByMatch([anonymous], 'someone', 'author').matched).toEqual([])
  })
})

describe('searchRoute', () => {
  it('writes no scope parameter for the default', () => {
    expect(searchRoute('dune')).toBe('/search?q=dune')
    expect(searchRoute('dune', 'all')).toBe('/search?q=dune')
  })

  it('writes the scope when it is not the default', () => {
    expect(searchRoute('rizal', 'author')).toBe('/search?q=rizal&in=author')
  })

  it('encodes the query rather than form-encoding it', () => {
    expect(searchRoute('cats & dogs')).toBe('/search?q=cats%20%26%20dogs')
  })
})

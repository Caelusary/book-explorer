/**
 * Open Library, answered from fixtures. Every request to openlibrary.org and
 * covers.openlibrary.org is intercepted, and anything else leaving the page is
 * aborted, so the suite never reaches a live API whatever the app asks for.
 *
 * Search terms pick the scenario: `dune` returns matches plus a near miss,
 * `zzzz` returns nothing, `fail` answers 500, and `offline` drops the
 * connection. Work ids do the same for the book page.
 */

export const BOOKS = [
  {
    key: '/works/OL893415W',
    title: 'Dune',
    author_name: ['Frank Herbert'],
    first_publish_year: 1965,
    cover_i: 1001,
    edition_count: 312,
    language: ['eng', 'spa', 'fre'],
    ratings_average: 4.24,
  },
  {
    key: '/works/OL893526W',
    title: 'Dune Messiah',
    author_name: ['Frank Herbert'],
    first_publish_year: 1969,
    cover_i: 1002,
    edition_count: 140,
    language: ['eng'],
    ratings_average: 3.98,
  },
  {
    key: '/works/OL893527W',
    title: 'Children of Dune',
    author_name: ['Frank Herbert'],
    first_publish_year: 1976,
    edition_count: 98,
    language: ['eng'],
  },
  {
    // Contains none of the words typed: lands in "Others also searched for".
    key: '/works/OL100001W',
    title: 'The Desert Planet Companion',
    author_name: ['A. Reader'],
    first_publish_year: 1984,
    cover_i: 1003,
    edition_count: 2,
  },
]

const WORKS = {
  OL893415W: {
    title: 'Dune',
    description: {
      type: '/type/text',
      value:
        'Set on the desert planet Arrakis, Dune is the story of Paul Atreides and the spice that the whole universe depends on.',
    },
    subjects: ['Science fiction', 'Deserts', 'Ecology', 'Politics'],
  },
}

// Three spine colours, so covers in screenshots read as distinct books.
const COVER_COLOURS = ['#2d5a7b', '#8a3b2e', '#4f6b3a']

function coverSvg(id) {
  const fill = COVER_COLOURS[Number(id) % COVER_COLOURS.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="270" viewBox="0 0 180 270"><rect width="180" height="270" fill="${fill}"/><rect x="18" y="40" width="144" height="4" fill="#f3efe8" opacity=".7"/><rect x="18" y="200" width="90" height="3" fill="#f3efe8" opacity=".5"/></svg>`
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

function searchTerm(url) {
  return (
    url.searchParams.get('q') ??
    url.searchParams.get('title') ??
    url.searchParams.get('author') ??
    ''
  ).toLowerCase()
}

/** Installs the Open Library mock on a page. Call before the first goto. */
export async function mockOpenLibrary(page) {
  await page.route(
    (url) => url.origin !== 'http://localhost:4173',
    (route) => route.abort('blockedbyclient'),
  )

  await page.route('https://covers.openlibrary.org/**', (route) => {
    const id = new URL(route.request().url()).pathname.match(/(\d+)/)?.[1] ?? '0'
    return route.fulfill({ contentType: 'image/svg+xml', body: coverSvg(id) })
  })

  await page.route('https://openlibrary.org/**', (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/search.json') {
      const term = searchTerm(url)
      const byKey = (url.searchParams.get('q') ?? '').match(/^key:\/works\/(\w+)/)
      if (byKey) {
        const id = byKey[1]
        if (id === 'OLFAILW') return json(route, { error: 'boom' }, 500)
        const doc = BOOKS.find((book) => book.key === `/works/${id}`)
        return json(route, { numFound: doc ? 1 : 0, docs: doc ? [doc] : [] })
      }
      if (term.startsWith('fail')) return json(route, { error: 'boom' }, 500)
      if (term.startsWith('offline')) return route.abort('internetdisconnected')
      if (term.startsWith('zzzz')) return json(route, { numFound: 0, docs: [] })
      if (term.startsWith('dun')) return json(route, { numFound: BOOKS.length, docs: BOOKS })
      return json(route, { numFound: 0, docs: [] })
    }

    const work = url.pathname.match(/^\/works\/(\w+)\.json$/)
    if (work) {
      if (work[1] === 'OLFAILW') return json(route, { error: 'boom' }, 500)
      const book = BOOKS.find((b) => b.key === `/works/${work[1]}`)
      return json(route, WORKS[work[1]] ?? { title: book?.title ?? 'Unknown' })
    }

    return json(route, { error: 'not found' }, 404)
  })
}

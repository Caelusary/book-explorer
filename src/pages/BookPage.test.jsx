import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installFetchMock } from '../test/fetchMock'
import { renderRoute } from '../test/renderWithProviders'
import BookPage from './BookPage'

function renderBook(workId = 'OL1W') {
  return renderRoute(<BookPage />, {
    route: `/book/${workId}`,
    path: '/book/:workId',
  })
}

/** Search-endpoint doc plus works-endpoint detail, keyed by which URL is asked for. */
function twoEndpoints({ searchDoc, work }) {
  return installFetchMock((url) => {
    if (url.includes('/search.json')) {
      return { body: { docs: searchDoc ? [searchDoc] : [] } }
    }
    return { body: work ?? {} }
  })
}

describe('BookPage - merging two endpoints', () => {
  it('requests both endpoints for the work id in the route', async () => {
    const net = twoEndpoints({
      searchDoc: { key: '/works/OL27448W', title: 'Dune' },
      work: { title: 'Dune', description: 'Desert planet.' },
    })

    renderBook('OL27448W')
    await screen.findByRole('heading', { level: 1, name: 'Dune' })

    expect(net.urlsContaining('/search.json')).toHaveLength(1)
    expect(net.urls.find((url) => url.includes('/search.json'))).toContain(
      'OL27448W',
    )
    expect(net.urls).toContain('https://openlibrary.org/works/OL27448W.json')
  })

  it('renders fields from both responses on one page', async () => {
    twoEndpoints({
      searchDoc: {
        key: '/works/OL1W',
        title: 'Dune',
        author_name: ['Frank Herbert'],
        first_publish_year: 1965,
        edition_count: 42,
        ratings_average: 4.2361,
        cover_i: 7,
      },
      work: {
        title: 'Dune',
        description: 'Desert planet.',
        subjects: ['Science fiction', 'Politics'],
      },
    })

    renderBook()
    await screen.findByRole('heading', { level: 1, name: 'Dune' })

    // Author and edition count come only from search; description and subjects
    // come only from the works endpoint. Both halves have to land.
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Desert planet.')).toBeInTheDocument()
    expect(screen.getByText('Science fiction')).toBeInTheDocument()
    expect(screen.getByText('4.24 / 5')).toBeInTheDocument()
  })

  it('shows a loading state before either response lands', async () => {
    installFetchMock(() => ({ body: { docs: [] }, delayMs: 40 }))

    renderBook()

    expect(screen.getByText(/loading book/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText(/loading book/i)).not.toBeInTheDocument(),
    )
  })
})

describe('BookPage - missing and partial data', () => {
  it('falls back to the works title when the search endpoint has no doc', async () => {
    twoEndpoints({ searchDoc: null, work: { title: 'Only In Works' } })

    renderBook()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Only In Works' }),
    ).toBeInTheDocument()
  })

  it('renders placeholders instead of blanks for every missing fact', async () => {
    twoEndpoints({ searchDoc: null, work: {} })

    renderBook()
    await screen.findByRole('heading', { level: 1, name: 'Unknown title' })

    expect(screen.getByText('Unknown author')).toBeInTheDocument()
    expect(screen.getByText('Not rated')).toBeInTheDocument()
    expect(screen.getAllByText('Unknown')).toHaveLength(2)
    expect(screen.getByText('No cover')).toBeInTheDocument()
  })

  it('still renders a title when only the works endpoint has the book', async () => {
    twoEndpoints({ searchDoc: null, work: { title: 'Only In Works' } })

    renderBook()

    // Every card-level fact comes from the search doc, so a null one has to
    // degrade to placeholders rather than blank the page out.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Only In Works' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Unknown author')).toBeInTheDocument()
  })

  it('omits the description and subjects sections when the work has neither', async () => {
    twoEndpoints({ searchDoc: { key: '/works/OL1W', title: 'Bare' }, work: {} })

    renderBook()
    await screen.findByRole('heading', { level: 1, name: 'Bare' })

    expect(screen.queryByText('Description')).not.toBeInTheDocument()
    expect(screen.queryByText('Subjects')).not.toBeInTheDocument()
  })

  it('caps the subject list rather than rendering hundreds of tags', async () => {
    twoEndpoints({
      searchDoc: { key: '/works/OL1W', title: 'Tagged' },
      work: {
        title: 'Tagged',
        subjects: Array.from({ length: 40 }, (_, i) => `Subject ${i}`),
      },
    })

    renderBook()
    await screen.findByText('Subjects')

    expect(screen.getAllByRole('listitem')).toHaveLength(12)
  })
})

describe('BookPage - failures', () => {
  it('shows an error with a way out when either endpoint fails', async () => {
    installFetchMock((url) =>
      url.includes('/search.json')
        ? { body: { docs: [] } }
        : { ok: false, status: 404, body: {} },
    )

    renderBook('OLBOGUSW')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/nothing at that address/i)
    // A dead end with no navigation would trap the user on a blank page.
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('aborts both requests on unmount', async () => {
    const net = installFetchMock(() => ({ body: {}, delayMs: 200 }))

    const { unmount } = renderBook()
    await waitFor(() => expect(net.fetchMock).toHaveBeenCalledTimes(2))

    unmount()

    for (const call of net.fetchMock.mock.calls) {
      expect(call[1].signal.aborted).toBe(true)
    }
  })

  it('does not show an error banner for an aborted load', async () => {
    const net = installFetchMock(() => ({ body: {}, delayMs: 200 }))
    const { unmount } = renderBook()
    await waitFor(() => expect(net.fetchMock).toHaveBeenCalled())
    unmount()

    twoEndpoints({ searchDoc: { key: '/works/OL1W', title: 'Fine' }, work: {} })
    renderBook()

    await screen.findByRole('heading', { level: 1, name: 'Fine' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BookPage - going back', () => {
  const loaded = {
    searchDoc: { key: '/works/OL1W', title: 'Dune' },
    work: { title: 'Dune' },
  }

  function renderFrom(state) {
    twoEndpoints(loaded)
    return renderRoute(<BookPage />, {
      route: '/book/OL1W',
      path: '/book/:workId',
      state,
    })
  }

  it('returns to the search the book was opened from', async () => {
    renderFrom({ from: '/search?q=noli%20me%20tangere&in=author&sort=new' })
    await screen.findByRole('heading', { level: 1, name: 'Dune' })

    const back = screen.getByRole('link', { name: /back to/i })

    // The whole query string, not just the query: coming back to the results
    // with the scope or the sort dropped is coming back to a different page.
    expect(back).toHaveAttribute(
      'href',
      '/search?q=noli%20me%20tangere&in=author&sort=new',
    )
  })

  it('names the search it goes back to', async () => {
    renderFrom({ from: '/search?q=dune' })
    await screen.findByRole('heading', { level: 1, name: 'Dune' })

    expect(screen.getByRole('link', { name: 'Back to “dune”' })).toBeInTheDocument()
  })

  it('falls back to home for a link opened cold', async () => {
    // A pasted or bookmarked link arrives with no origin, and there is no
    // result set behind it to invent.
    renderFrom(undefined)
    await screen.findByRole('heading', { level: 1, name: 'Dune' })

    const back = screen.getByRole('link', { name: 'Back to home' })
    expect(back).toHaveAttribute('href', '/')
  })

  it('offers the same way back when the book fails to load', async () => {
    installFetchMock(() => ({ ok: false, status: 500 }))
    renderRoute(<BookPage />, {
      route: '/book/OL1W',
      path: '/book/:workId',
      state: { from: '/search?q=dune' },
    })

    await screen.findByRole('alert')
    expect(screen.getByRole('link', { name: 'Back to “dune”' })).toHaveAttribute(
      'href',
      '/search?q=dune',
    )
  })
})

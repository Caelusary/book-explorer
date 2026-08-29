import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { doc, installFetchMock } from '../test/fetchMock'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderRoute } from '../test/renderWithProviders'
import SearchPage from './SearchPage'

function renderSearch(route) {
  return renderRoute(<SearchPage />, { route, path: '/search' })
}

/** The one search request the page should have made, most recent last. */
function searchUrls(net) {
  return net.urls.filter((url) => url.includes('/search.json'))
}

describe('SearchPage - query to results', () => {
  it('reads the query from the URL, requests it, and renders the results', async () => {
    const net = installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL1W', title: 'Dune' })] },
    }))

    renderSearch('/search?q=dune')

    expect(await screen.findByText('Dune')).toBeInTheDocument()
    expect(searchUrls(net)[0]).toContain('q=dune')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('dune')
  })

  it('reports the result count with correct singular/plural', async () => {
    installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune')

    expect(await screen.findByText('1 result')).toBeInTheDocument()
  })

  it('makes no request at all when there is no query', () => {
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    renderSearch('/search')

    expect(net.urls).toHaveLength(0)
    expect(screen.getByText(/type something into the search box/i)).toBeInTheDocument()
  })
})

describe('SearchPage - sort reaches the request', () => {
  // This is the regression that shipped: the select rendered the right value
  // and the URL carried ?sort=, so review and a glance at the running app both
  // passed. The request never changed. Asserting on rendered state alone would
  // not have caught it, so every assertion here is on the outgoing URL.
  it('sends sort=new when the URL already carries it', async () => {
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune&sort=new')

    await screen.findByText('Dune')
    expect(searchUrls(net)[0]).toContain('sort=new')
  })

  it('sends no sort parameter for a plain relevance search', async () => {
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune')

    await screen.findByText('Dune')
    expect(searchUrls(net)[0]).not.toContain('sort=')
  })

  it('re-requests with the new sort when the select changes, and re-renders', async () => {
    const user = userEvent.setup()
    const net = installFetchMock((url) => ({
      body: {
        docs: url.includes('sort=rating')
          ? [doc({ key: '/works/OL2W', title: 'Dune Top Rated' })]
          : [doc({ key: '/works/OL1W', title: 'Dune Most Relevant' })],
      },
    }))

    renderSearch('/search?q=dune')
    await screen.findByText('Dune Most Relevant')

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'rating')

    // Both halves matter. The request proves the value travelled; the render
    // proves the response was actually adopted. The shipped bug passed the
    // second check and failed the first.
    await waitFor(() => expect(searchUrls(net)).toHaveLength(2))
    expect(searchUrls(net)[1]).toContain('sort=rating')
    expect(await screen.findByText('Dune Top Rated')).toBeInTheDocument()
    expect(screen.queryByText('Dune Most Relevant')).not.toBeInTheDocument()
  })

  it('drops the sort parameter when switching back to relevance', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune&sort=rating')
    await screen.findByText('Dune')

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'relevance')

    // Relevance writes no parameter, so this is the branch where "the control
    // changed but the request did not" is easiest to miss.
    await waitFor(() => expect(searchUrls(net)).toHaveLength(2))
    expect(searchUrls(net)[1]).not.toContain('sort=')
    expect(screen.getByLabelText(/sort by/i)).toHaveValue('relevance')
  })

  it('does not re-request when the sort is set to the value already in use', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune&sort=new')
    await screen.findByText('Dune')

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'new')

    // A no-op change must not spend a request; the effect keys on the value.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(searchUrls(net)).toHaveLength(1)
  })

  it('hides the sort control while there is nothing to sort', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    renderSearch('/search?q=nothingmatchesthis')

    await screen.findByText(/no books found/i)
    expect(screen.queryByLabelText(/sort by/i)).not.toBeInTheDocument()
  })
})

describe('SearchPage - empty and error states are distinct', () => {
  it('renders an empty state, not an error, when the API returns docs: []', async () => {
    installFetchMock(() => ({ body: { docs: [], numFound: 0 } }))

    renderSearch('/search?q=zzzzznotabook')

    expect(await screen.findByText(/no books found/i)).toBeInTheDocument()
    // A miss is a normal outcome. Showing an alert here would tell the user
    // the app is broken when it is working exactly as intended.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders an error alert, not an empty state, when the API fails', async () => {
    installFetchMock(() => ({ ok: false, status: 500, body: {} }))

    renderSearch('/search?q=dune')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/having trouble right now/i)
    expect(screen.queryByText(/no books found/i)).not.toBeInTheDocument()
  })

  it('clears stale results when a later search fails', async () => {
    let call = 0
    installFetchMock(() => {
      call += 1
      return call === 1
        ? { body: { docs: [doc({ title: 'Dune First Result' })] } }
        : { ok: false, status: 500, body: {} }
    })

    const { rerender } = renderSearch('/search?q=dune')
    await screen.findByText('Dune First Result')

    // Re-mounting at a new query is what the router does on a fresh search.
    rerender(<div />)
    renderSearch('/search?q=other')

    await screen.findByRole('alert')
    expect(screen.queryByText('Dune First Result')).not.toBeInTheDocument()
  })

  it('shows loading skeletons before the response lands', async () => {
    installFetchMock(() => ({ body: { docs: [doc()] }, delayMs: 30 }))

    renderSearch('/search?q=dune')

    expect(screen.getByText(/searching/i)).toBeInTheDocument()
    expect(await screen.findByText('Dune')).toBeInTheDocument()
    expect(screen.queryByText(/searching/i)).not.toBeInTheDocument()
  })
})

describe('SearchPage - stale responses cannot win', () => {
  it('aborts the in-flight request when the sort changes mid-flight', async () => {
    const user = userEvent.setup()
    const net = installFetchMock((url) => ({
      // The first (relevance) response is deliberately the slow one.
      body: {
        docs: url.includes('sort=new')
          ? [doc({ key: '/works/NEW', title: 'Dune Newer Response' })]
          : [doc({ key: '/works/OLD', title: 'Dune Stale Response' })],
      },
      delayMs: url.includes('sort=new') ? 0 : 120,
    }))

    renderSearch('/search?q=dune')

    // The select is disabled while loading, so let the first search settle,
    // then start a second one and check the first one's signal was cut.
    await screen.findByText('Dune Stale Response')
    await user.selectOptions(screen.getByLabelText(/sort by/i), 'new')

    expect(await screen.findByText('Dune Newer Response')).toBeInTheDocument()

    // The first request's controller must have been aborted by the effect
    // cleanup, not merely ignored on arrival.
    const firstSignal = net.fetchMock.mock.calls[0][1].signal
    expect(firstSignal.aborted).toBe(true)
  })

  it('aborts the in-flight request on unmount', async () => {
    const net = installFetchMock(() => ({ body: { docs: [doc()] }, delayMs: 200 }))

    const { unmount } = renderSearch('/search?q=dune')
    await waitFor(() => expect(net.fetchMock).toHaveBeenCalled())

    unmount()

    expect(net.fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('does not surface an aborted request as an error to the user', async () => {
    const net = installFetchMock(() => ({ body: { docs: [doc()] }, delayMs: 60 }))

    const { unmount } = renderSearch('/search?q=dune')
    await waitFor(() => expect(net.fetchMock).toHaveBeenCalled())
    unmount()

    // Re-render fresh; an AbortError must never reach the error branch.
    installFetchMock(() => ({ body: { docs: [doc()] } }))
    renderSearch('/search?q=dune')

    await screen.findByText('Dune')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('SearchPage - results grid', () => {
  it('renders one card per doc and links each to its work page', async () => {
    installFetchMock(() => ({
      body: {
        docs: [
          doc({ key: '/works/OL1W', title: 'Dune One' }),
          doc({ key: '/works/OL2W', title: 'Dune Two' }),
        ],
      },
    }))

    renderSearch('/search?q=dune')

    await screen.findByText('Dune One')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Dune One').closest('a')).toHaveAttribute(
      'href',
      '/book/OL1W',
    )
    expect(screen.getByText('Dune Two').closest('a')).toHaveAttribute(
      'href',
      '/book/OL2W',
    )
  })

  it('renders a book with no author, year or cover without throwing', async () => {
    installFetchMock(() => ({
      body: {
        docs: [
          {
            key: '/works/OL9W',
            title: 'Dune Bare Minimum',
          },
        ],
      },
    }))

    renderSearch('/search?q=dune')

    const card = (await screen.findByText('Dune Bare Minimum')).closest('li')
    expect(within(card).getByText('Unknown author')).toBeInTheDocument()
    expect(within(card).getByText('Publication year unknown')).toBeInTheDocument()
    expect(within(card).getByText('No cover')).toBeInTheDocument()
  })
})

describe('SearchPage - the search field holds the query', () => {
  it('seeds the field from the URL instead of showing an empty box', async () => {
    installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune')
    await screen.findByText('Dune')

    expect(screen.getByRole('combobox', { name: /search books/i })).toHaveValue(
      'dune',
    )
  })

  it('requests suggestions only once the field is actually used', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune')
    await screen.findByText('Dune')

    // One request: the search itself. Seeding the field must not also trigger
    // the autocomplete for text the visitor never typed.
    expect(searchUrls(net)).toHaveLength(1)

    await user.click(screen.getByRole('combobox', { name: /search books/i }))
    await waitFor(() => expect(searchUrls(net).length).toBeGreaterThan(1))
  })

  it('returns to the lobby when the field is cleared', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [doc()] } }))

    render(
      <MemoryRouter initialEntries={['/search?q=dune']}>
        <Routes>
          <Route path="/" element={<p>Lobby</p>} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Dune')

    await user.clear(screen.getByRole('combobox', { name: /search books/i }))

    expect(await screen.findByText('Lobby')).toBeInTheDocument()
  })
})

describe('SearchPage - exact matches versus near misses', () => {
  const mixed = () =>
    installFetchMock(() => ({
      body: {
        docs: [
          doc({ key: '/works/OL1W', title: 'Dune Messiah' }),
          doc({ key: '/works/OL2W', title: 'Something Unrelated' }),
        ],
      },
    }))

  it('puts only the real matches in the results grid', async () => {
    mixed()

    renderSearch('/search?q=dune')
    await screen.findByText('Dune Messiah')

    // Cards render their title as a heading; the demoted row renders spans.
    // Asserting on the role is what separates the two lists.
    expect(
      screen.getByRole('heading', { name: 'Dune Messiah' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Something Unrelated' }),
    ).not.toBeInTheDocument()
  })

  it('counts only the real matches', async () => {
    mixed()

    renderSearch('/search?q=dune')

    // Two docs came back; one of them is a guess, so the page says one result.
    expect(await screen.findByText('1 result')).toBeInTheDocument()
  })

  it('offers the near misses under their own heading', async () => {
    mixed()

    renderSearch('/search?q=dune')
    await screen.findByText('Dune Messiah')

    const also = screen.getByRole('region', { name: /others also searched for/i })
    expect(within(also).getByText('Something Unrelated')).toBeInTheDocument()
  })

  it('promotes the near misses into the grid when nothing matches exactly', async () => {
    installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL3W', title: 'Not It' })] },
    }))

    renderSearch('/search?q=asd')

    // The API answered, so the page must not claim it found nothing. The brief
    // reserves that message for an empty response, and a real book reported as
    // no results reads as a broken search rather than a strict filter.
    expect(await screen.findByRole('heading', { name: 'Not It' })).toBeInTheDocument()
    expect(screen.queryByText('No books found.')).not.toBeInTheDocument()
    expect(screen.getByText(/closest/i)).toBeInTheDocument()
    expect(screen.getByText('1 close result')).toBeInTheDocument()

    // They are the results now, so there is no separate row of them.
    expect(
      screen.queryByRole('region', { name: /others also searched for/i }),
    ).not.toBeInTheDocument()
  })

  it('says No books found. only when the API returned nothing at all', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    renderSearch('/search?q=zzqwxplt')

    expect(await screen.findByText('No books found.')).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: /others also searched for/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps the near-miss row separate while there are real matches', async () => {
    mixed()

    renderSearch('/search?q=dune')
    await screen.findByText('Dune Messiah')

    // Unchanged behaviour for the ordinary case: exact matches lead the grid
    // and the near misses stay demoted below them.
    expect(screen.getByText('1 result')).toBeInTheDocument()
    expect(screen.queryByText(/closest/i)).not.toBeInTheDocument()
    const also = screen.getByRole('region', { name: /others also searched for/i })
    expect(within(also).getByText('Something Unrelated')).toBeInTheDocument()
  })

  it('omits the section entirely when every doc was a real match', async () => {
    installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL1W', title: 'Dune' })] },
    }))

    renderSearch('/search?q=dune')
    await screen.findByText('Dune')

    expect(
      screen.queryByRole('region', { name: /others also searched for/i }),
    ).not.toBeInTheDocument()
  })

  it('over-fetches so the filter cannot leave the grid half empty', async () => {
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))

    renderSearch('/search?q=dune')
    await screen.findByText('Dune')

    expect(searchUrls(net)[0]).toContain('limit=48')
  })
})

describe('SearchPage - queries below the API floor', () => {
  it('does not request a query Open Library would reject', async () => {
    // "ad" came back 422 "Query too short", which the page rendered as
    // "Open Library could not handle that request" — a broken-sounding
    // message for a rule the app already enforced in its own dropdown.
    const net = installFetchMock(() => ({ body: { docs: [] } }))

    renderSearch('/search?q=ad')

    expect(
      await screen.findByText(/at least 3 characters/i),
    ).toBeInTheDocument()
    expect(searchUrls(net)).toHaveLength(0)
  })

  it('does not claim there are no books for a query it never ran', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    renderSearch('/search?q=ad')

    await screen.findByText(/at least 3 characters/i)
    expect(screen.queryByText('No books found.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('searches as soon as the query is long enough', async () => {
    const net = installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL1W', title: 'Adventures' })] },
    }))

    renderSearch('/search?q=adv')

    expect(await screen.findByText('Adventures')).toBeInTheDocument()
    expect(searchUrls(net)).toHaveLength(1)
    expect(screen.queryByText(/at least 3 characters/i)).not.toBeInTheDocument()
  })

  it('reads a short query as too short rather than as no query at all', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    renderSearch('/search?q=ad')

    await screen.findByText(/at least 3 characters/i)
    // The empty-query prompt belongs to an untouched search box, not to one
    // holding two characters.
    expect(
      screen.queryByText(/type something into the search box/i),
    ).not.toBeInTheDocument()
  })
})

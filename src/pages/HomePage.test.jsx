import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installFetchMock } from '../test/fetchMock'
import { renderRoute } from '../test/renderWithProviders'
import HomePage from './HomePage'

function work(overrides = {}) {
  return {
    key: '/works/OL1W',
    title: 'A Work',
    authors: [{ name: 'An Author' }],
    first_publish_year: 1999,
    cover_id: 5,
    edition_count: 1,
    ...overrides,
  }
}

/** Trending and subject responses are separate endpoints and fail separately. */
function homeFetch({ trending, subject, trendingFails, subjectFails } = {}) {
  return installFetchMock((url) => {
    if (url.includes('/trending/')) {
      if (trendingFails) return { ok: false, status: 500, body: {} }
      return { body: { works: trending ?? [work({ key: '/works/TREND' , title: 'Trending Book' })] } }
    }
    if (subjectFails) return { ok: false, status: 502, body: {} }
    return { body: { works: subject ?? [work({ key: '/works/SUBJ', title: 'Subject Book' })] } }
  })
}

describe('HomePage - loading the lobby', () => {
  it('requests trending and the default subject on mount', async () => {
    const net = homeFetch()

    renderRoute(<HomePage />, { route: '/' })
    await screen.findByText('Trending Book')

    expect(net.urlsContaining('/trending/daily.json')).toHaveLength(1)
    // science_fiction is SUBJECTS[0]; the default chip has to actually fetch.
    expect(net.urlsContaining('/subjects/science_fiction.json')).toHaveLength(1)
  })

  it('renders books from both sections once loaded', async () => {
    homeFetch()

    renderRoute(<HomePage />, { route: '/' })

    expect(await screen.findByText('Trending Book')).toBeInTheDocument()
    expect(await screen.findByText('Subject Book')).toBeInTheDocument()
  })
})

describe('HomePage - subject chips', () => {
  it('fetches the newly selected subject and swaps the results', async () => {
    const user = userEvent.setup()
    const net = installFetchMock((url) => {
      if (url.includes('/trending/')) return { body: { works: [] } }
      const slug = url.includes('fantasy') ? 'Fantasy Book' : 'SciFi Book'
      return { body: { works: [work({ key: `/works/${slug}`, title: slug })] } }
    })

    renderRoute(<HomePage />, { route: '/' })
    await screen.findByText('SciFi Book')

    await user.click(screen.getByRole('button', { name: 'Fantasy' }))

    // Same failure mode as the sort bug: the chip can look selected while the
    // request never changed, so assert the URL as well as the render.
    await waitFor(() =>
      expect(net.urlsContaining('/subjects/fantasy.json')).toHaveLength(1),
    )
    expect(await screen.findByText('Fantasy Book')).toBeInTheDocument()
    expect(screen.queryByText('SciFi Book')).not.toBeInTheDocument()
  })

  it('marks the active chip with aria-pressed', async () => {
    const user = userEvent.setup()
    homeFetch()

    renderRoute(<HomePage />, { route: '/' })
    await screen.findByText('Subject Book')

    expect(screen.getByRole('button', { name: 'Science Fiction' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Mystery' }))

    expect(screen.getByRole('button', { name: 'Mystery' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Science Fiction' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('aborts an in-flight subject request when a different chip is picked', async () => {
    const user = userEvent.setup()
    const net = installFetchMock((url) => ({
      body: { works: [] },
      delayMs: url.includes('/subjects/') ? 200 : 0,
    }))

    renderRoute(<HomePage />, { route: '/' })
    await waitFor(() => expect(net.urlsContaining('/subjects/')).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: 'Horror' }))
    await waitFor(() => expect(net.urlsContaining('/subjects/')).toHaveLength(2))

    const firstSubjectCall = net.fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/subjects/'),
    )
    expect(firstSubjectCall[1].signal.aborted).toBe(true)
  })
})

describe('HomePage - independent failures', () => {
  it('keeps the subject shelf working when trending fails', async () => {
    homeFetch({ trendingFails: true })

    renderRoute(<HomePage />, { route: '/' })

    expect(
      await screen.findByText(/could not load trending books/i),
    ).toBeInTheDocument()
    // One dead endpoint must not take the whole lobby down.
    expect(await screen.findByText('Subject Book')).toBeInTheDocument()
  })

  it('keeps trending working when the subject shelf fails', async () => {
    homeFetch({ subjectFails: true })

    renderRoute(<HomePage />, { route: '/' })

    expect(await screen.findByText(/could not load this subject/i)).toBeInTheDocument()
    expect(await screen.findByText('Trending Book')).toBeInTheDocument()
  })

  it('leaves the section heading in place when a section comes back empty', async () => {
    homeFetch({ trending: [], subject: [] })

    renderRoute(<HomePage />, { route: '/' })

    await waitFor(() =>
      expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Trending today')).toBeInTheDocument()
    expect(screen.getByText('Browse by subject')).toBeInTheDocument()

    // OPEN: an empty, non-failing section renders a heading and then nothing
    // at all - no message, no explanation. See the empty-state finding.
  })
})

describe('HomePage - shelf preview', () => {
  it('is hidden while nothing is saved', async () => {
    homeFetch()

    renderRoute(<HomePage />, { route: '/' })
    await screen.findByText('Trending Book')

    expect(screen.queryByText('On your shelf')).not.toBeInTheDocument()
  })

  it('shows at most six saved books with a link to the full shelf', async () => {
    const saved = Array.from({ length: 8 }, (_, index) => ({
      key: `/works/SAVED${index}`,
      title: `Saved ${index}`,
      author_name: ['Someone'],
      first_publish_year: 2000,
      cover_i: null,
    }))
    window.localStorage.setItem(
      'book-explorer:favorites',
      JSON.stringify(saved),
    )
    homeFetch({ trending: [], subject: [] })

    renderRoute(<HomePage />, { route: '/' })

    expect(await screen.findByText('On your shelf')).toBeInTheDocument()
    expect(screen.getByText('Saved 5')).toBeInTheDocument()
    expect(screen.queryByText('Saved 6')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view all 8/i })).toHaveAttribute(
      'href',
      '/shelf',
    )
  })
})

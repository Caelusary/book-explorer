import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AlsoSearched from '../components/AlsoSearched'
import BookList from '../components/BookList'
import SearchBar from '../components/SearchBar'
import LabeledSelect from '../components/LabeledSelect'
import { SORT_OPTIONS } from '../utils/openLibrary'
import HomePage from '../pages/HomePage'
import NotFoundPage from '../pages/NotFoundPage'
import SearchPage from '../pages/SearchPage'
import { doc, installFetchMock } from './fetchMock'

/**
 * Automated axe checks catch roughly a third of real accessibility defects.
 * They are a floor, not a certificate: keyboard reachability and focus order
 * are covered by the interaction tests in SearchBar.test.jsx instead.
 */
function renderPage(ui, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * `knownIssues` is a baseline, not an exemption. Each id listed at a call site
 * corresponds to an open finding below; delete the entry when the markup is
 * fixed. Anything not on the list still fails, so this cannot quietly absorb a
 * new violation.
 */
async function expectNoViolations(container, { knownIssues = [] } = {}) {
  const results = await axe(container)
  const unexpected = results.violations
    .filter((violation) => !knownIssues.includes(violation.id))
    .map((violation) => `${violation.id}: ${violation.help}`)

  expect(unexpected).toEqual([])
}

describe('accessibility', () => {
  it('search results have no axe violations', async () => {
    installFetchMock(() => ({
      body: {
        docs: [
          doc({ key: '/works/OL1W', title: 'One' }),
          doc({ key: '/works/OL2W', title: 'Two', cover_i: undefined }),
        ],
      },
    }))

    const { container } = renderPage(<SearchPage />, '/search?q=dune')
    await screen.findByText('One')

    // The results count carries level 2, so h1 -> h2 -> h3 is unbroken.
    await expectNoViolations(container)
  })

  it('the search empty state has no axe violations', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    const { container } = renderPage(<SearchPage />, '/search?q=zzz')
    await screen.findByText(/no books found/i)

    await expectNoViolations(container)
  })

  it('the search error state has no axe violations', async () => {
    installFetchMock(() => ({ ok: false, status: 500, body: {} }))

    const { container } = renderPage(<SearchPage />, '/search?q=dune')
    await screen.findByRole('alert')

    await expectNoViolations(container)
  })

  it('the lobby has no axe violations', async () => {
    const { container } = renderPage(<HomePage />, '/')
    await expectNoViolations(container)
  })

  it('the near-miss row has no axe violations and is a named region', async () => {
    const { container } = renderPage(
      <AlsoSearched
        books={[
          doc({ key: '/works/OL1W', title: 'Close Enough' }),
          doc({ key: '/works/OL2W', title: 'No Cover Here', cover_i: undefined }),
        ]}
      />,
    )

    // Covers here are decorative: the link is already named by the title next
    // to it, so alt text would just make screen readers say it twice.
    expect(
      screen.getByRole('region', { name: /others also searched for/i }),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('img')).toHaveLength(0)

    await expectNoViolations(container)
  })

  it('the not-found page has no axe violations', async () => {
    const { container } = renderPage(<NotFoundPage />, '/nope')
    await expectNoViolations(container)
  })

  it('the sort control has no axe violations and is labelled', async () => {
    const { container } = render(
      <LabeledSelect
        id="sort-select"
        label="Sort by"
        value="relevance"
        options={SORT_OPTIONS}
        onChange={() => {}}
      />,
    )

    expect(screen.getByLabelText(/sort by/i)).toHaveRole('combobox')
    await expectNoViolations(container)
  })

  it('a book grid has no axe violations, including covers that are missing', async () => {
    const { container } = render(
      <MemoryRouter>
        <BookList
          books={[
            doc({ key: '/works/OL1W', title: 'With Cover' }),
            doc({ key: '/works/OL2W', title: 'No Cover', cover_i: undefined }),
          ]}
        />
      </MemoryRouter>,
    )

    await expectNoViolations(container)
  })

  it('the closed search bar has no axe violations', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    const { container } = render(
      <MemoryRouter>
        <SearchBar variant="hero" initialQuery="dune" />
      </MemoryRouter>,
    )

    // Previously carried a known aria-allowed-attr violation: aria-expanded
    // on an input with no combobox role, and buttons standing in for options.
    // Both are fixed, so this now asserts a clean pass with no exemptions.
    await expectNoViolations(container)
  })

  it('every book cover image carries alt text naming the book', async () => {
    render(
      <MemoryRouter>
        <BookList books={[doc({ key: '/works/OL1W', title: 'Dune' })]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Cover of Dune' })).toBeInTheDocument()
  })
})

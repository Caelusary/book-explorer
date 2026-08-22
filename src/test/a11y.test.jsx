import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import BookList from '../components/BookList'
import SearchBar from '../components/SearchBar'
import SortSelect from '../components/SortSelect'
import { FavoritesProvider } from '../context/FavoritesContext'
import NotFoundPage from '../pages/NotFoundPage'
import SearchPage from '../pages/SearchPage'
import ShelfPage from '../pages/ShelfPage'
import { doc, installFetchMock } from './fetchMock'

/**
 * Automated axe checks catch roughly a third of real accessibility defects.
 * They are a floor, not a certificate: keyboard reachability and focus order
 * are covered by the interaction tests in SearchBar.test.jsx instead.
 */
function renderPage(ui, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FavoritesProvider>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </FavoritesProvider>
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

    // OPEN: heading-order. SearchPage renders an h1 and BookCard renders an h3
    // with no h2 between them. On HomePage the section h2 makes the h3 correct;
    // on the results page it skips a level. Fix by making the card title an h2
    // here or giving the results grid a heading.
    await expectNoViolations(container, { knownIssues: ['heading-order'] })
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

  it('the empty shelf has no axe violations', async () => {
    const { container } = renderPage(<ShelfPage />, '/shelf')
    await expectNoViolations(container)
  })

  it('the not-found page has no axe violations', async () => {
    const { container } = renderPage(<NotFoundPage />, '/nope')
    await expectNoViolations(container)
  })

  it('the sort control has no axe violations and is labelled', async () => {
    const { container } = render(
      <SortSelect value="relevance" onChange={() => {}} />,
    )

    expect(screen.getByLabelText(/sort by/i)).toHaveRole('combobox')
    await expectNoViolations(container)
  })

  it('a book grid has no axe violations, including covers that are missing', async () => {
    const { container } = render(
      <MemoryRouter>
        <FavoritesProvider>
          <BookList
            books={[
              doc({ key: '/works/OL1W', title: 'With Cover' }),
              doc({ key: '/works/OL2W', title: 'No Cover', cover_i: undefined }),
            ]}
          />
        </FavoritesProvider>
      </MemoryRouter>,
    )

    await expectNoViolations(container)
  })

  it('the closed search bar has no axe violations', async () => {
    installFetchMock(() => ({ body: { docs: [] } }))

    const { container } = render(
      <MemoryRouter>
        <SearchBar variant="hero" />
      </MemoryRouter>,
    )

    // OPEN: aria-allowed-attr. The input carries aria-expanded and
    // aria-controls without role="combobox", which is invalid ARIA, and the
    // dropdown rows are buttons inside role="listbox" rather than role="option".
    // Fix both together: role="combobox" + aria-autocomplete="list" on the
    // input, role="option" + aria-selected on each row.
    await expectNoViolations(container, { knownIssues: ['aria-allowed-attr'] })
  })

  it('every book cover image carries alt text naming the book', async () => {
    render(
      <MemoryRouter>
        <FavoritesProvider>
          <BookList books={[doc({ key: '/works/OL1W', title: 'Dune' })]} />
        </FavoritesProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Cover of Dune' })).toBeInTheDocument()
  })

  it('the favourite control exposes its state to assistive tech', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FavoritesProvider>
          <BookList books={[doc({ key: '/works/OL1W', title: 'Dune' })]} />
        </FavoritesProvider>
      </MemoryRouter>,
    )

    const heart = screen.getByRole('button', { name: /save dune to shelf/i })
    await user.click(heart)

    // The glyph alone (heart outline vs filled) carries no meaning without
    // aria-pressed and an accessible name that changes with it.
    expect(
      screen.getByRole('button', { name: /remove dune from shelf/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '../test/renderWithProviders'
import ShelfPage from './ShelfPage'

const STORAGE_KEY = 'book-explorer:favorites'

function saved(count) {
  return Array.from({ length: count }, (_, index) => ({
    key: `/works/OL${index}W`,
    title: `Saved ${index}`,
    author_name: ['Someone'],
    first_publish_year: 2000,
    cover_i: null,
  }))
}

function renderShelf() {
  return renderRoute(<ShelfPage />, { route: '/shelf', path: '/shelf' })
}

describe('ShelfPage', () => {
  it('shows the empty state with a route out when nothing is saved', () => {
    renderShelf()

    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find something to read/i })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('renders saved books from localStorage after a reload', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved(3)))

    renderShelf()

    expect(screen.getByText('3 saved books')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Saved 0')).toBeInTheDocument()
  })

  it('uses the singular for exactly one saved book', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved(1)))

    renderShelf()

    expect(screen.getByText('1 saved book')).toBeInTheDocument()
  })

  it('falls back to the empty state rather than crashing on corrupt storage', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"favorites": "oops"}')

    expect(() => renderShelf()).not.toThrow()
    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument()
  })

  it('returns to the empty state when the last book is un-saved', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved(1)))

    renderShelf()

    await user.click(screen.getByRole('button', { name: /remove saved 0/i }))

    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toEqual([])
  })
})

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderRoute } from '../test/renderWithProviders'
import HomePage from './HomePage'

describe('HomePage', () => {
  it('never touches the network on mount', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    renderRoute(<HomePage />, { route: '/' })

    // The point of the bare lobby: no trending, no shelves, no requests until
    // the visitor actually types something.
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('renders the heading, the tagline and one search input', () => {
    renderRoute(<HomePage />, { route: '/' })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Browse books' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/search millions of titles from the open library/i),
    ).toBeInTheDocument()
    // Still exactly one search field. The lobby now holds a second combobox
    // as well — the "Search by" scope dropdown — so this has to name the one
    // it means rather than counting every combobox on the page.
    expect(
      screen.getAllByRole('combobox', { name: 'Search books' }),
    ).toHaveLength(1)
    expect(
      screen.getByRole('combobox', { name: 'Search by' }),
    ).toBeInTheDocument()
  })

  it('shows no books before a search happens', () => {
    renderRoute(<HomePage />, { route: '/' })

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('focuses the search input so a visitor can type straight away', () => {
    renderRoute(<HomePage />, { route: '/' })

    expect(screen.getByRole('combobox', { name: 'Search books' })).toHaveFocus()
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { doc, installFetchMock } from '../test/fetchMock'
import SearchBar from './SearchBar'

/** Renders the bar next to a readout of the current URL, so navigation is observable. */
function renderBar(props = {}) {
  function LocationReadout() {
    const location = useLocation()
    return <div data-testid="url">{location.pathname + location.search}</div>
  }

  return render(
    <MemoryRouter initialEntries={['/']}>
      <SearchBar {...props} />
      <Routes>
        <Route path="*" element={<LocationReadout />} />
      </Routes>
    </MemoryRouter>,
  )
}

function url() {
  return screen.getByTestId('url').textContent
}

describe('SearchBar - submitting', () => {
  it('navigates to an encoded search URL on submit', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'cats & dogs')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    expect(url()).toBe('/search?q=cats%20%26%20dogs')
  })

  it('trims surrounding whitespace out of the query', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), '   dune   ')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    expect(url()).toBe('/search?q=dune')
  })

  it('disables the submit button for an empty or whitespace-only query', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar()

    const button = screen.getByRole('button', { name: /^search$/i })
    expect(button).toBeDisabled()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), '   ')
    expect(button).toBeDisabled()
  })

  it('does not navigate when a whitespace-only query is submitted by keyboard', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar()

    // The disabled button does not protect the Enter-key path.
    await user.type(screen.getByRole('combobox', { name: 'Search books' }), '   {Enter}')

    expect(url()).toBe('/')
  })
})

describe('SearchBar - suggestions', () => {
  it('does not request suggestions below three characters', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({ body: { docs: [] } }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'du')
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(net.urls).toHaveLength(0)
  })

  it('requests once for a typing burst, not once per keystroke', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL1W', title: 'Dune' })] },
    }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'dune')
    await waitFor(() => expect(net.urls.length).toBeGreaterThan(0))
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Four keystrokes, one request. The debounce is the whole point.
    expect(net.urls).toHaveLength(1)
    expect(net.urls[0]).toContain('q=dune')
    expect(net.urls[0]).toContain('limit=5')
  })

  it('serves a repeated prefix from cache without a second request', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL1W', title: 'Dune' })] },
    }))
    renderBar()

    const input = screen.getByRole('combobox', { name: 'Search books' })
    await user.type(input, 'dune')
    expect(await screen.findByText('Dune')).toBeInTheDocument()

    await user.type(input, 'x')
    await waitFor(() => expect(net.urls).toHaveLength(2))
    await user.keyboard('{Backspace}')
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Backspacing to 'dune' must reuse the cached result.
    expect(net.urls).toHaveLength(2)
  })

  it('opens the highlighted suggestion on Enter instead of running a search', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL42W', title: 'Dune' })] },
    }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'dune')
    await screen.findByText('Dune')

    await user.keyboard('{ArrowDown}{Enter}')

    expect(url()).toBe('/book/OL42W')
  })

  it('dismisses the dropdown on Escape', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL1W', title: 'Dune' })] },
    }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'dune')
    await screen.findByText('Dune')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps the app usable when the suggestion request fails', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ ok: false, status: 500, body: {} }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'dune')
    await new Promise((resolve) => setTimeout(resolve, 500))

    // A failed suggestion is not worth an error state; the dropdown just stays
    // shut and the submit path still works.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^search$/i }))
    expect(url()).toBe('/search?q=dune')
  })

  it('aborts an in-flight suggestion request when the query moves on', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({
      body: { docs: [doc()] },
      delayMs: 400,
    }))
    renderBar()

    const input = screen.getByRole('combobox', { name: 'Search books' })
    await user.type(input, 'dune')
    await waitFor(() => expect(net.urls).toHaveLength(1))

    await user.type(input, ' messiah')
    await waitFor(() => expect(net.urls.length).toBeGreaterThan(1))

    expect(net.fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })
})

/**
 * The scope dropdown. Addressed by accessible name rather than by role alone:
 * the text input is itself a combobox, so `getByRole('combobox', { name: 'Search books' })` matches two
 * elements on this component.
 */
function scopeSelect() {
  return screen.getByRole('combobox', { name: 'Search by' })
}

describe('SearchBar - search scope', () => {
  it('carries the chosen scope into the search URL', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'rizal')
    await user.selectOptions(scopeSelect(), 'author')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    expect(url()).toBe('/search?q=rizal&in=author')
  })

  it('does not search from the lobby on a scope change alone', async () => {
    // Nothing has been submitted yet, so there are no results to re-filter.
    // Navigating here would search text the reader is still typing.
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar()

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'rizal')
    await user.selectOptions(scopeSelect(), 'author')

    expect(url()).toBe('/')
  })

  it('re-runs the search immediately when results are already showing', async () => {
    // `initialQuery` is what a results page passes down, so this is the bar
    // sitting above a set of results. There the control reads as a filter.
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar({ initialQuery: 'rizal' })

    await user.selectOptions(scopeSelect(), 'author')

    expect(url()).toBe('/search?q=rizal&in=author')
  })

  it('does not re-run a draft that was never submitted', async () => {
    // The field holds the search on screen until someone types over it. Once
    // it has diverged, changing the scope must not navigate: re-running the
    // draft searches something never submitted, and re-running the seeded
    // query would throw the draft away when the field resyncs.
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar({ initialQuery: 'rizal' })

    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'x')
    await user.selectOptions(scopeSelect(), 'author')

    expect(url()).toBe('/')
    expect(scopeSelect()).toHaveValue('author')
  })

  it('re-runs the search on screen, not the text in the box', async () => {
    const user = userEvent.setup()
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar({ initialQuery: 'rizal' })

    await user.selectOptions(scopeSelect(), 'author')

    expect(url()).toBe('/search?q=rizal&in=author')
  })

  it('seeds the scope from the page it is rendered on', () => {
    installFetchMock(() => ({ body: { docs: [] } }))
    renderBar({ initialQuery: 'rizal', initialMode: 'author' })

    expect(scopeSelect()).toHaveValue('author')
  })

  it('scopes the suggestion request to the chosen field', async () => {
    const user = userEvent.setup()
    const net = installFetchMock(() => ({
      body: { docs: [doc({ key: '/works/OL9W', title: 'Noli' })] },
    }))
    renderBar()

    await user.selectOptions(scopeSelect(), 'author')
    await user.type(screen.getByRole('combobox', { name: 'Search books' }), 'rizal')

    await waitFor(() => expect(net.urls.length).toBeGreaterThan(0))
    expect(net.urls.at(-1)).toContain('author=rizal')
  })

  it('does not serve a scoped suggestion from another scope cache', async () => {
    // Same text, different question. Reusing the cached rows would show title
    // matches under an author search.
    const user = userEvent.setup()
    const net = installFetchMock(() => ({ body: { docs: [doc()] } }))
    renderBar()

    const input = screen.getByRole('combobox', { name: 'Search books' })
    await user.type(input, 'rizal')
    await waitFor(() => expect(net.urls.length).toBe(1))

    await user.selectOptions(scopeSelect(), 'author')
    await waitFor(() => expect(net.urls.length).toBe(2))

    expect(net.urls[0]).toContain('q=rizal')
    expect(net.urls[1]).toContain('author=rizal')
  })
})

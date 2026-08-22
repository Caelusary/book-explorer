import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import BookCard from '../components/BookCard'
import { doc } from '../test/fetchMock'
import { FavoritesProvider, useFavorites } from './FavoritesContext'

const STORAGE_KEY = 'book-explorer:favorites'

function wrapper({ children }) {
  return <FavoritesProvider>{children}</FavoritesProvider>
}

function stored() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
}

describe('FavoritesProvider - toggling', () => {
  it('adds a book and persists it', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper })

    act(() => result.current.toggleFavorite(doc({ key: '/works/OL1W' })))

    expect(result.current.favorites).toHaveLength(1)
    expect(result.current.isFavorite('/works/OL1W')).toBe(true)
    expect(stored()).toEqual([
      expect.objectContaining({ key: '/works/OL1W', title: 'A Book' }),
    ])
  })

  it('stores only the fields a card needs, not the whole API doc', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper })

    act(() =>
      result.current.toggleFavorite(
        doc({ key: '/works/OL1W', ratings_average: 4.5, language: ['eng'] }),
      ),
    )

    expect(Object.keys(stored()[0]).sort()).toEqual([
      'author_name',
      'cover_i',
      'first_publish_year',
      'key',
      'title',
    ])
  })

  it('removes a book on a second toggle', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper })
    const book = doc({ key: '/works/OL1W' })

    act(() => result.current.toggleFavorite(book))
    act(() => result.current.toggleFavorite(book))

    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite('/works/OL1W')).toBe(false)
    expect(stored()).toEqual([])
  })

  it('puts the newest save first', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper })

    act(() => result.current.toggleFavorite(doc({ key: '/works/A' })))
    act(() => result.current.toggleFavorite(doc({ key: '/works/B' })))

    expect(result.current.favorites.map((book) => book.key)).toEqual([
      '/works/B',
      '/works/A',
    ])
  })

  it('never stores the same book twice, even on rapid repeated toggles', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper })
    const book = doc({ key: '/works/OL1W' })

    // Batched inside one act, so both updates see the same starting state
    // unless the updater form is used. This is the double-submit case.
    act(() => {
      result.current.toggleFavorite(book)
      result.current.toggleFavorite(book)
    })

    expect(result.current.favorites).toHaveLength(0)

    act(() => {
      result.current.toggleFavorite(book)
      result.current.toggleFavorite(doc({ key: '/works/OL2W' }))
    })

    const keys = result.current.favorites.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(2)
  })

  it('ignores a book with no key, which could never be un-saved', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper })

    act(() => result.current.toggleFavorite({ title: 'Keyless' }))
    act(() => result.current.toggleFavorite({ title: 'Keyless' }))

    expect(result.current.favorites).toEqual([])
  })
})

describe('FavoritesProvider - corrupt storage', () => {
  // localStorage outlives the code that wrote it. Anything here that reaches
  // state unvalidated is rendered by Layout on every single route, so a bad
  // value is not a bad shelf page - it is a blank app with no way back.
  it('recovers from unparseable JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '[[[not json')

    const { result } = renderHook(() => useFavorites(), { wrapper })

    expect(result.current.favorites).toEqual([])
  })

  it('recovers from a stored object instead of an array', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: 1 }))

    const { result } = renderHook(() => useFavorites(), { wrapper })

    expect(result.current.favorites).toEqual([])
    expect(() => result.current.isFavorite('/works/OL1W')).not.toThrow()
  })

  it('recovers from a stored null', () => {
    window.localStorage.setItem(STORAGE_KEY, 'null')

    const { result } = renderHook(() => useFavorites(), { wrapper })

    expect(result.current.favorites).toEqual([])
  })

  it('recovers from an array of items with no key', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ title: 'no key here' }, null]),
    )

    const { result } = renderHook(() => useFavorites(), { wrapper })

    expect(result.current.favorites).toEqual([])
  })

  it('still works after recovering, rather than silently going read-only', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify('garbage'))

    const { result } = renderHook(() => useFavorites(), { wrapper })
    act(() => result.current.toggleFavorite(doc({ key: '/works/OL1W' })))

    expect(result.current.favorites).toHaveLength(1)
    expect(stored()).toHaveLength(1)
  })
})

describe('useFavorites outside a provider', () => {
  it('throws a named error rather than a confusing null dereference', () => {
    expect(() => renderHook(() => useFavorites())).toThrow(
      /must be used inside a FavoritesProvider/i,
    )
  })
})

describe('FavoriteButton through a card', () => {
  function renderCard(book) {
    return render(
      <MemoryRouter>
        <FavoritesProvider>
          <ul>
            <BookCard book={book} />
          </ul>
        </FavoritesProvider>
      </MemoryRouter>,
    )
  }

  it('toggles aria-pressed and persists when the heart is clicked', async () => {
    const user = userEvent.setup()
    renderCard(doc({ key: '/works/OL1W', title: 'Dune' }))

    const heart = screen.getByRole('button', { name: /save dune to shelf/i })
    expect(heart).toHaveAttribute('aria-pressed', 'false')

    await user.click(heart)

    expect(
      screen.getByRole('button', { name: /remove dune from shelf/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(stored()).toHaveLength(1)
  })

  it('does not navigate when the heart inside the card link is clicked', async () => {
    const user = userEvent.setup()
    renderCard(doc({ key: '/works/OL1W', title: 'Dune' }))

    await user.click(screen.getByRole('button', { name: /save dune/i }))

    // The card is wrapped in a Link; a heart click that bubbled would leave
    // the page. Still on the card means the handler stopped it.
    expect(screen.getByText('Dune')).toBeInTheDocument()
  })
})

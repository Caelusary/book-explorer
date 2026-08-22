import { createContext, useCallback, useContext, useMemo } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'

const FavoritesContext = createContext(null)

const STORAGE_KEY = 'book-explorer:favorites'

/**
 * Guards against a stored value of the wrong shape. localStorage survives
 * deploys and is editable by hand, so `book-explorer:favorites` can hold valid
 * JSON that is not a list of books. Everything downstream calls .length, .some
 * and .filter on it, so an object or a bare string there would throw during
 * render of the layout itself — on every route, with no way to recover from
 * inside the app.
 */
function isFavoriteList(value) {
  return (
    Array.isArray(value) &&
    value.every((item) => item != null && typeof item.key === 'string')
  )
}

/**
 * Favourites are shared by pages that never render each other — a heart tapped
 * on the lobby has to show up on /shelf immediately. Passing that state down as
 * props would mean threading it through the router, so it lives in context
 * instead. Everything below a page still receives it as ordinary props.
 */
export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEY, [], isFavoriteList)

  const toggleFavorite = useCallback(
    (book) => {
      // A book with no key cannot be identified again, so it could never be
      // un-saved and would duplicate on every tap.
      if (!book?.key) return

      setFavorites((current) => {
        const exists = current.some((item) => item.key === book.key)
        if (exists) return current.filter((item) => item.key !== book.key)

        // Store only what a card needs to render, not the whole API response.
        const slim = {
          key: book.key,
          title: book.title,
          author_name: book.author_name,
          first_publish_year: book.first_publish_year,
          cover_i: book.cover_i,
        }
        return [slim, ...current]
      })
    },
    [setFavorites],
  )

  const isFavorite = useCallback(
    (key) => favorites.some((item) => item.key === key),
    [favorites],
  )

  const value = useMemo(
    () => ({ favorites, toggleFavorite, isFavorite }),
    [favorites, toggleFavorite, isFavorite],
  )

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used inside a FavoritesProvider')
  }
  return context
}

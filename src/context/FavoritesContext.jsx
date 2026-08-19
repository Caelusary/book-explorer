import { createContext, useCallback, useContext, useMemo } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'

const FavoritesContext = createContext(null)

/**
 * Favourites are shared by pages that never render each other — a heart tapped
 * on the lobby has to show up on /shelf immediately. Passing that state down as
 * props would mean threading it through the router, so it lives in context
 * instead. Everything below a page still receives it as ordinary props.
 */
export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useLocalStorage('book-explorer:favorites', [])

  const toggleFavorite = useCallback(
    (book) => {
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

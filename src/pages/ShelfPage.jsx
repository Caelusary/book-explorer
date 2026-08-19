import { Link } from 'react-router-dom'
import BookList from '../components/BookList'
import { useFavorites } from '../context/FavoritesContext'

export default function ShelfPage() {
  const { favorites } = useFavorites()

  return (
    <div className="page">
      <h1 className="page__title">Your shelf</h1>

      {favorites.length === 0 ? (
        <div className="status">
          <p>Nothing saved yet.</p>
          <p className="status__hint">
            Tap the ♡ on any book to keep it here. Your shelf stays in this
            browser between visits.
          </p>
          <Link className="button-link" to="/">
            Find something to read
          </Link>
        </div>
      ) : (
        <>
          <p className="results-count">
            {favorites.length} saved book{favorites.length === 1 ? '' : 's'}
          </p>
          <BookList books={favorites} />
        </>
      )}
    </div>
  )
}

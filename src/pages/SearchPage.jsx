import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BookList from '../components/BookList'
import SkeletonList from '../components/SkeletonList'
import { searchBooks } from '../utils/openLibrary'

export default function SearchPage() {
  // The query lives in the URL, so results are shareable and the back button
  // moves between searches instead of leaving the app.
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!query) return

    // Aborts the previous request if a new search starts before it resolves,
    // so a slow early response can never overwrite a newer one.
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    searchBooks(query, controller.signal)
      .then((docs) => {
        setBooks(docs)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Something went wrong. Please try again.')
        setBooks([])
        setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  return (
    <div className="page">
      <h1 className="page__title">
        {query ? `Results for “${query}”` : 'Search'}
      </h1>

      {loading && (
        <>
          <p className="results-count" role="status" aria-live="polite">
            Searching…
          </p>
          <SkeletonList count={12} />
        </>
      )}

      {!loading && error && (
        <div className="status status--error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && query && books.length === 0 && (
        <div className="status">
          <p>No books found.</p>
        </div>
      )}

      {!loading && !error && books.length > 0 && (
        <>
          <p className="results-count">
            {books.length} result{books.length === 1 ? '' : 's'}
          </p>
          <BookList books={books} />
        </>
      )}

      {!query && (
        <div className="status">
          <p>Type something into the search box above to get started.</p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BookList from '../components/BookList'
import SkeletonList from '../components/SkeletonList'
import SortSelect from '../components/SortSelect'
import { searchBooks } from '../utils/openLibrary'

export default function SearchPage() {
  // The query lives in the URL, so results are shareable and the back button
  // moves between searches instead of leaving the app.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''

  // Sort sits in the URL alongside the query for the same reason: a sorted
  // result page stays shareable and survives a refresh. Relevance is the
  // default and writes no parameter, so ordinary search URLs stay clean.
  const sort = searchParams.get('sort') ?? 'relevance'

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Clearing the query has to clear the results with it. Returning early
    // without doing so leaves the previous search's grid on screen underneath
    // the empty-state prompt, which reads as two pages at once.
    if (!query) {
      setBooks([])
      setError(null)
      return
    }

    // Aborts the previous request if a new search starts before it resolves,
    // so a slow early response can never overwrite a newer one.
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    searchBooks(query, controller.signal, sort)
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
  }, [query, sort])

  // `replace` keeps re-sorts out of history — the back button should return to
  // the previous search, not step back through every ordering of this one.
  function handleSortChange(nextSort) {
    const next = new URLSearchParams(searchParams)
    if (nextSort === 'relevance') next.delete('sort')
    else next.set('sort', nextSort)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="page">
      <h1 className="page__title">
        {query ? `Results for “${query}”` : 'Search'}
      </h1>

      {query && !error && (loading || books.length > 0) && (
        <div className="results-bar">
          <p className="results-count" role="status" aria-live="polite">
            {loading
              ? 'Searching…'
              : `${books.length} result${books.length === 1 ? '' : 's'}`}
          </p>
          <SortSelect value={sort} onChange={handleSortChange} disabled={loading} />
        </div>
      )}

      {loading && <SkeletonList count={12} />}

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

      {!loading && !error && query && books.length > 0 && (
        <BookList books={books} />
      )}

      {!query && (
        <div className="status">
          <p>Type something into the search box above to get started.</p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AlsoSearched from '../components/AlsoSearched'
import BookList from '../components/BookList'
import SearchBar from '../components/SearchBar'
import SkeletonList from '../components/SkeletonList'
import LabeledSelect from '../components/LabeledSelect'
import {
  MIN_QUERY_LENGTH,
  partitionByMatch,
  searchBooks,
  SORT_OPTIONS,
} from '../utils/openLibrary'

export default function SearchPage() {
  // The query lives in the URL, so results are shareable and the back button
  // moves between searches instead of leaving the app.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''

  // Sort sits in the URL alongside the query for the same reason: a sorted
  // result page stays shareable and survives a refresh. Relevance is the
  // default and writes no parameter, so ordinary search URLs stay clean.
  const sort = searchParams.get('sort') ?? 'relevance'

  // Which field the query is matched against. Same reasoning as sort: it
  // belongs to the result set, so it lives in the URL and travels with a
  // shared link. "All" is the default and writes nothing.
  const mode = searchParams.get('in') ?? 'all'

  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const navigate = useNavigate()

  // Open Library answers anything shorter than this with a 422, which the app
  // was rendering as "Open Library could not handle that request" — a broken
  // sounding message for a rule the app already knew about, since the
  // suggestion dropdown has always waited for the same three characters.
  // Answering it here costs no request and says the actual reason.
  const tooShort = query.length > 0 && query.trim().length < MIN_QUERY_LENGTH

  useEffect(() => {
    // Clearing the query has to clear the results with it. Returning early
    // without doing so leaves the previous search's grid on screen underneath
    // the empty-state prompt, which reads as two pages at once.
    if (!query || tooShort) {
      setDocs([])
      setError(null)
      return
    }

    // Aborts the previous request if a new search starts before it resolves,
    // so a slow early response can never overwrite a newer one.
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    searchBooks(query, controller.signal, sort, mode)
      .then((results) => {
        setDocs(results)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Something went wrong. Please try again.')
        setDocs([])
        setLoading(false)
      })

    return () => controller.abort()
  }, [query, sort, mode, tooShort])

  // Split at render rather than in the effect: the raw response is what the
  // request produced, and the split is a view of it. Keeping them separate
  // means a re-sort never has to re-derive state it already holds.
  const { matched, others } = partitionByMatch(docs, query, mode)

  // When nothing matched exactly the near misses are promoted into the grid
  // rather than left as a footnote under an empty state. "No books found." has
  // to mean the API found nothing, because that is the only thing it can mean
  // to someone reading the page: a real book reported as no results reads as a
  // broken search, not as a strict filter.
  const showingClosest = matched.length === 0 && others.length > 0
  const books = showingClosest ? others : matched

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
      {/* The search sits on the page rather than in the header so it stays the
          thing the page is about, holds the text it is showing results for,
          and is where the eye already is when it gets emptied. */}
      <div className="page__search">
        <SearchBar
          variant="page"
          initialQuery={query}
          initialMode={mode}
          onEmpty={() => navigate('/')}
        />
      </div>

      <h1 className="page__title">
        {query ? `Results for “${query}”` : 'Search'}
      </h1>

      {query && !error && !tooShort && (loading || books.length > 0) && (
        <div className="results-bar">
          {/* This doubles as the grid's heading. The page h1 names the query
              and the cards are h3s, so without a level 2 between them the
              document outline skips a rank. `aria-live` rather than
              role="status" on purpose: the status role would replace the
              heading role and put the gap straight back. */}
          <h2 className="results-count" aria-live="polite">
            {loading
              ? 'Searching…'
              : showingClosest
                ? `${books.length} close result${books.length === 1 ? '' : 's'}`
                : `${books.length} result${books.length === 1 ? '' : 's'}`}
          </h2>
          <LabeledSelect
            id="sort-select"
            label="Sort by"
            value={sort}
            options={SORT_OPTIONS}
            onChange={handleSortChange}
            disabled={loading}
          />
        </div>
      )}

      {loading && <SkeletonList count={12} />}

      {!loading && error && (
        <div className="status status--error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Reserved for a genuinely empty response, which is the condition the
          brief names. Anything the API did return is shown instead. */}
      {tooShort && (
        <div className="status">
          <p>Type at least {MIN_QUERY_LENGTH} characters to search.</p>
        </div>
      )}

      {!loading && !error && query && !tooShort && books.length === 0 && (
        <div className="status">
          <p>No books found.</p>
        </div>
      )}

      {!loading && !error && query && !tooShort && showingClosest && (
        <p className="status__hint results-hint">
          Nothing matched “{query}” exactly. These are the closest.
        </p>
      )}

      {!loading && !error && query && !tooShort && books.length > 0 && (
        <BookList books={books} />
      )}

      {/* Only meaningful while the grid holds real matches. When it doesn't,
          these are the grid. */}
      {!loading && !error && query && !tooShort && !showingClosest && (
        <AlsoSearched books={others} />
      )}

      {!query && (
        <div className="status">
          <p>Type something into the search box above to get started.</p>
        </div>
      )}
    </div>
  )
}

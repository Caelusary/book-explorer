import { useEffect, useState } from 'react'
import SearchBar from './components/SearchBar'
import BookList from './components/BookList'
import BookDetails from './components/BookDetails'
import './App.css'

const FIELDS = [
  'key',
  'title',
  'author_name',
  'first_publish_year',
  'cover_i',
  'edition_count',
  'subject',
  'language',
  'publisher',
  'ratings_average',
].join(',')

export default function App() {
  // Controlled input value — updates on every keystroke.
  const [query, setQuery] = useState('')
  // The query actually sent to the API. Only changes on submit, so typing
  // does not fire a request per character.
  const [submittedQuery, setSubmittedQuery] = useState('')

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)

  useEffect(() => {
    if (!submittedQuery) return

    // Aborts the previous request if a new search starts before it resolves,
    // so a slow early response can never overwrite a newer one.
    const controller = new AbortController()

    async function fetchBooks() {
      setLoading(true)
      setError(null)

      try {
        const url =
          'https://openlibrary.org/search.json?q=' +
          encodeURIComponent(submittedQuery) +
          '&limit=24&fields=' +
          FIELDS

        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Open Library responded with ${response.status}`)
        }

        const data = await response.json()
        setBooks(data.docs ?? [])
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message || 'Something went wrong. Please try again.')
        setBooks([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchBooks()
    return () => controller.abort()
  }, [submittedQuery])

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setSelectedBook(null)
    setSubmittedQuery(trimmed)
  }

  const hasSearched = submittedQuery !== ''

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Book Explorer</h1>
        <p className="app__tagline">
          Search millions of titles from the Open Library.
        </p>
        <SearchBar value={query} onChange={setQuery} onSubmit={handleSubmit} />
      </header>

      <main className="app__main">
        {loading && (
          <div className="status" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Searching for “{submittedQuery}”…</p>
          </div>
        )}

        {!loading && error && (
          <div className="status status--error" role="alert">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && hasSearched && books.length === 0 && (
          <div className="status">
            <p>No books found.</p>
          </div>
        )}

        {!loading && !error && books.length > 0 && (
          <>
            <p className="results-count">
              {books.length} result{books.length === 1 ? '' : 's'} for “
              {submittedQuery}”
            </p>
            <BookList books={books} onSelectBook={setSelectedBook} />
          </>
        )}

        {!loading && !error && !hasSearched && (
          <div className="status status--idle">
            <p>Try searching for “dune”, “tolkien”, or “the hobbit”.</p>
          </div>
        )}
      </main>

      {selectedBook && (
        <BookDetails book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  )
}

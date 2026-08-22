import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useDebounce from '../hooks/useDebounce'
import { suggestBooks, workIdFromKey } from '../utils/openLibrary'

/**
 * Controlled search input with an autocomplete dropdown.
 *
 * `variant` is either 'hero' (the large one on the lobby) or 'compact' (the
 * one in the header on every other page).
 */
export default function SearchBar({ variant = 'compact', autoFocus = false }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [suggesting, setSuggesting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)

  const navigate = useNavigate()
  const containerRef = useRef(null)

  // Open Library takes roughly a second to answer, so results for prefixes
  // already typed are kept and reused. Backspacing feels instant as a result.
  const cacheRef = useRef(new Map())

  const debouncedQuery = useDebounce(query, 350)

  useEffect(() => {
    const trimmed = debouncedQuery.trim()

    // Below three characters the suggestions are mostly noise.
    if (trimmed.length < 3) {
      setSuggestions([])
      setSuggesting(false)
      return
    }

    const cached = cacheRef.current.get(trimmed)
    if (cached) {
      setSuggestions(cached)
      setSuggesting(false)
      return
    }

    const controller = new AbortController()
    setSuggesting(true)

    suggestBooks(trimmed, controller.signal)
      .then((books) => {
        cacheRef.current.set(trimmed, books)
        setSuggestions(books)
        setSuggesting(false)
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        // A failed suggestion is not worth interrupting the user over — the
        // dropdown just stays empty and the normal search still works.
        setSuggestions([])
        setSuggesting(false)
      })

    return () => controller.abort()
  }, [debouncedQuery])

  // Clicking anywhere else on the page dismisses the dropdown.
  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function runSearch(term) {
    const trimmed = term.trim()
    if (!trimmed) return
    setIsOpen(false)
    setHighlighted(-1)
    // Deliberately omits `sort`, so a new query lands on relevance ranking.
    // Sort is a property of a set of results rather than a standing
    // preference — "Newest" carried over from an unrelated earlier search is
    // almost never what was meant.
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  function handleSubmit(event) {
    event.preventDefault()
    runSearch(query)
  }

  function openBook(book) {
    setIsOpen(false)
    setHighlighted(-1)
    navigate(`/book/${workIdFromKey(book.key)}`)
  }

  function handleKeyDown(event) {
    if (!isOpen || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      )
    } else if (event.key === 'Enter' && highlighted >= 0) {
      // Enter on a highlighted row opens that book instead of searching.
      event.preventDefault()
      openBook(suggestions[highlighted])
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setHighlighted(-1)
    }
  }

  const showDropdown =
    isOpen && query.trim().length >= 3 && (suggesting || suggestions.length > 0)

  return (
    <div className={`search search--${variant}`} ref={containerRef}>
      <form onSubmit={handleSubmit} role="search">
        <label className="search__label" htmlFor={`book-search-${variant}`}>
          Search books
        </label>
        <div className="search__row">
          <input
            id={`book-search-${variant}`}
            className="search__input"
            type="text"
            placeholder="Search by title or author…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
              setHighlighted(-1)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoFocus={autoFocus}
            /* The full combobox contract, not just aria-expanded: that
               attribute is only valid on a combobox role, and without it the
               listbox below has no owner. Focus stays on the input while
               aria-activedescendant names the highlighted row, which is what
               lets arrow keys move a selection without moving focus. */
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={`suggestions-${variant}`}
            aria-activedescendant={
              highlighted >= 0
                ? `suggestion-${variant}-${highlighted}`
                : undefined
            }
          />
          <button
            className="search__button"
            type="submit"
            disabled={!query.trim()}
          >
            Search
          </button>
        </div>
      </form>

      {showDropdown && (
        <ul
          className="suggestions"
          id={`suggestions-${variant}`}
          role="listbox"
          aria-label="Search suggestions"
        >
          {suggesting && suggestions.length === 0 && (
            <li className="suggestions__status" role="presentation">
              Searching…
            </li>
          )}

          {/* The rows are the options themselves. They were buttons nested
              inside the listbox, which is invalid — a listbox owns options,
              and a focusable control inside one fights the arrow-key model
              the input already implements. */}
          {suggestions.map((book, index) => (
            <li
              key={book.key}
              id={`suggestion-${variant}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              className={
                'suggestions__item' +
                (index === highlighted ? ' suggestions__item--active' : '')
              }
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => openBook(book)}
            >
              <span className="suggestions__title">{book.title}</span>
              <span className="suggestions__meta">
                {book.author_name?.[0] ?? 'Unknown author'}
                {book.first_publish_year ? ` · ${book.first_publish_year}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

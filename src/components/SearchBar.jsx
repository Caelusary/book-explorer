import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useDebounce from '../hooks/useDebounce'
import LabeledSelect from './LabeledSelect'
import {
  MIN_QUERY_LENGTH,
  SEARCH_MODES,
  searchRoute,
  suggestBooks,
  workIdFromKey,
} from '../utils/openLibrary'

/**
 * Controlled search input with an autocomplete dropdown.
 *
 * `variant` is 'hero' (the large one on the lobby) or 'page' (the one that
 * sits above the results).
 *
 * `initialQuery` and `initialMode` seed the field and the scope from the URL,
 * so a results page does not show an empty box or the wrong scope under the
 * search it is displaying. `onEmpty` fires the moment the field is cleared,
 * which is what lets the results page send you back to the lobby instead of
 * stranding you on an empty result set.
 */
export default function SearchBar({
  variant = 'page',
  autoFocus = false,
  initialQuery = '',
  initialMode = 'all',
  onEmpty,
}) {
  const [query, setQuery] = useState(initialQuery)
  const [mode, setMode] = useState(initialMode)

  // Adjusting state during render rather than in an effect: this is the
  // documented way to resync when a prop changes, and it matters for the back
  // button. Stepping back from ?q=dune+messiah to ?q=dune changes the URL
  // without remounting, so without this the field would keep the old text.
  const [lastInitial, setLastInitial] = useState(initialQuery)
  if (initialQuery !== lastInitial) {
    setLastInitial(initialQuery)
    setQuery(initialQuery)
  }

  const [lastMode, setLastMode] = useState(initialMode)
  if (initialMode !== lastMode) {
    setLastMode(initialMode)
    setMode(initialMode)
  }

  const [suggestions, setSuggestions] = useState([])
  const [suggesting, setSuggesting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)

  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef(null)

  // Open Library takes roughly a second to answer, so results for prefixes
  // already typed are kept and reused. Backspacing feels instant as a result.
  const cacheRef = useRef(new Map())

  const debouncedQuery = useDebounce(query, 350)

  useEffect(() => {
    const trimmed = debouncedQuery.trim()

    // Nothing to suggest into. This also stops the results page requesting
    // suggestions for the query it was seeded with: the field arrives holding
    // text nobody typed, and without this gate the debounce would fire a
    // second, pointless request on every results page load.
    if (!isOpen) {
      setSuggesting(false)
      return
    }

    // Below three characters the suggestions are mostly noise, and Open
    // Library rejects the request outright anyway.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setSuggesting(false)
      return
    }

    const cacheKey = `${mode}:${trimmed}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setSuggestions(cached)
      setSuggesting(false)
      return
    }

    const controller = new AbortController()
    setSuggesting(true)

    suggestBooks(trimmed, controller.signal, mode)
      .then((books) => {
        cacheRef.current.set(cacheKey, books)
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
  }, [debouncedQuery, isOpen, mode])

  // Clicking anywhere else on the page dismisses the dropdown.
  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function runSearch(term, nextMode = mode, options) {
    const trimmed = term.trim()
    if (!trimmed) return
    setIsOpen(false)
    setHighlighted(-1)
    // Deliberately omits `sort`, so a new query lands on relevance ranking.
    // Sort is a property of a set of results rather than a standing
    // preference — "Newest" carried over from an unrelated earlier search is
    // almost never what was meant.
    navigate(searchRoute(trimmed, nextMode), options)
  }

  function handleSubmit(event) {
    event.preventDefault()
    runSearch(query)
  }

  /**
   * Changing the scope re-runs the search rather than waiting for a second
   * press of the button, because on a results page the control reads as a
   * filter over what is already on screen. `replace` keeps those re-runs out
   * of history for the same reason re-sorting does: back should return to the
   * previous search, not walk back through every scope of this one.
   *
   * On the lobby there are no results to re-filter, so it only sets the scope
   * the next submit will use.
   */
  function handleModeChange(nextMode) {
    setMode(nextMode)

    // Only when the field still holds the search that is on screen. With a
    // draft typed over it neither option is right: re-running `query` searches
    // something never submitted, and re-running `initialQuery` throws away
    // what was being typed, because the resync above would refill the field.
    // So the scope is set and the next submit carries it.
    if (initialQuery && query.trim() === initialQuery) {
      runSearch(initialQuery, nextMode, { replace: true })
    }
  }

  function openBook(book) {
    setIsOpen(false)
    setHighlighted(-1)
    // Hands the book page the results to come back to. Anywhere else this
    // renders there is nothing to return to, and the page falls back to home.
    navigate(`/book/${workIdFromKey(book.key)}`, {
      state: { from: location.pathname + location.search },
    })
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
    isOpen &&
    query.trim().length >= MIN_QUERY_LENGTH &&
    (suggesting || suggestions.length > 0)

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
              const next = event.target.value
              setQuery(next)
              setIsOpen(true)
              setHighlighted(-1)
              if (next.trim() === '') onEmpty?.()
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

        <div className="search__by">
          <LabeledSelect
            id={`search-by-${variant}`}
            label="Search by"
            value={mode}
            options={SEARCH_MODES}
            onChange={handleModeChange}
          />
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

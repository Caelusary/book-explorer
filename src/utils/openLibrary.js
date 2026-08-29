const SEARCH_URL = 'https://openlibrary.org/search.json'
const WORKS_URL = 'https://openlibrary.org'
const COVER_BASE = 'https://covers.openlibrary.org/b/id'

// Fields requested from the search endpoint. Asking for a narrow set keeps the
// payload small — the search API is slow enough without shipping every field.
const SEARCH_FIELDS = [
  'key',
  'title',
  'author_name',
  'first_publish_year',
  'cover_i',
  'edition_count',
  'language',
  'ratings_average',
].join(',')

// Suggestions only need enough to render one dropdown row.
const SUGGEST_FIELDS = 'key,title,author_name,cover_i,first_publish_year'

/**
 * Open Library rejects a query shorter than this outright, with a 422 and
 * "Query too short, must be at least 3 characters" in the body. It is a
 * property of the API rather than a preference, so it lives here next to the
 * calls that would trip over it, and both the search page and the suggestion
 * dropdown gate on it rather than each carrying their own 3.
 */
export const MIN_QUERY_LENGTH = 3

/** size: 'S' | 'M' | 'L'. Returns null when the book has no cover on file. */
export function coverUrl(coverId, size = 'M') {
  if (!coverId) return null
  return `${COVER_BASE}/${coverId}-${size}.jpg`
}

/**
 * Open Library work keys look like "/works/OL27448W". The router only wants the
 * bare id, so these two helpers convert between the two forms.
 */
export function workIdFromKey(key) {
  return key?.replace('/works/', '') ?? ''
}

export function openLibraryUrl(workId) {
  return `${WORKS_URL}/works/${workId}`
}

/**
 * Open Library's failures are shown to the reader, so they have to read as
 * English rather than as a status code. The numeric status is kept on the
 * error for logging; `message` is what the interface renders.
 */
function messageForStatus(status) {
  if (status === 404) return 'Open Library has nothing at that address.'
  // The short-query rejection. Both callers gate on MIN_QUERY_LENGTH so this
  // should be unreachable, but the threshold belongs to Open Library and a
  // readable message beats "could not handle that request" if it ever moves.
  if (status === 422) {
    return `Search for at least ${MIN_QUERY_LENGTH} characters.`
  }
  if (status === 429) {
    return 'Open Library is limiting requests right now. Wait a moment and try again.'
  }
  if (status >= 500) {
    return 'Open Library is having trouble right now. Try again in a moment.'
  }
  return 'Open Library could not handle that request.'
}

async function getJson(url, signal) {
  let response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    // An aborted request is a normal part of superseding an in-flight search,
    // so it has to reach the caller unchanged for the AbortError check there.
    if (error.name === 'AbortError') throw error
    // fetch only rejects on a network-level failure; HTTP errors resolve.
    throw new Error(
      'Could not reach Open Library. Check your connection and try again.',
    )
  }

  if (!response.ok) {
    const error = new Error(messageForStatus(response.status))
    error.status = response.status
    throw error
  }

  return response.json()
}

/**
 * Sort orders offered on the results page. `param` is what the search endpoint
 * expects — relevance is its default and sends nothing.
 *
 * Sorting happens on Open Library's side rather than locally, because it sorts
 * the whole catalogue before returning 24. Sorting the 24 we already have would
 * make "Newest" mean "newest of the most relevant", which is a different and
 * much less useful thing.
 */
export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance', param: null },
  { value: 'new', label: 'Newest', param: 'new' },
  { value: 'rating', label: 'Rating', param: 'rating' },
]

export function sortOption(value) {
  return SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0]
}

/**
 * Which field the query is matched against.
 *
 * Open Library takes `title=` and `author=` as first-class parameters rather
 * than needing `q=title:...`, and they search better: the dedicated parameters
 * are matched against that field alone, where a `q=` prefix still leaks the
 * other fields into the ranking. "All" is the plain `q=` search and stays the
 * default, because most people type a title and expect it to work.
 *
 * `field` is the doc property the local match filter reads, so a title search
 * and its filter disagree about nothing.
 */
export const SEARCH_MODES = [
  { value: 'all', label: 'All', param: 'q', fields: ['title', 'author_name'] },
  { value: 'title', label: 'Title', param: 'title', fields: ['title'] },
  { value: 'author', label: 'Author', param: 'author', fields: ['author_name'] },
]

function searchMode(value) {
  return SEARCH_MODES.find((mode) => mode.value === value) ?? SEARCH_MODES[0]
}

/**
 * The app's own results route, kept next to SEARCH_MODES because the two have to
 * agree on the `in` parameter and there is no second place worth checking when
 * they don't. "All" writes nothing, so an ordinary search URL stays clean and
 * an absent parameter and `in=all` are the same page rather than two.
 */
export function searchRoute(query, mode = 'all') {
  // encodeURIComponent rather than URLSearchParams, which would write a space
  // as `+`. Both decode back to the same query, but `+` is form encoding and
  // this is a link people are meant to read and share.
  const q = encodeURIComponent(query)
  return mode === 'all' ? `/search?q=${q}` : `/search?q=${q}&in=${mode}`
}

/**
 * A wildcard on the final token, used only as a retry.
 *
 * It cannot be the default. Solr does not analyse a wildcard term, so adding
 * one changes the whole query rather than just the last word: "noli me
 * tangere" finds 137 books and "noli me tangere*" finds one, and it is the
 * wrong one. Single words fare no better, "dune*" ranks Jane Eyre above Dune.
 *
 * What it is good at is the one thing a plain query cannot do, matching a
 * half-typed final word, so it runs only after a plain search has come back
 * with nothing that matches.
 *
 * Skipped when the query ends in anything but a letter or digit, so a
 * trailing quote or colon is never handed a dangling `*`.
 */
function withPrefixMatch(query) {
  const trimmed = query.trim()
  return /[\p{L}\p{N}]$/u.test(trimmed) ? `${trimmed}*` : trimmed
}

/**
 * Full search used by the results page.
 *
 * 48 rather than a screenful: the page keeps only the docs that actually
 * contain the query and demotes the rest, so the request has to over-fetch or
 * a loose match from Open Library would leave the grid half empty.
 */
async function requestSearch(query, signal, sort, mode) {
  const option = sortOption(sort)
  const sortParam = option.param ? `&sort=${option.param}` : ''
  const q = encodeURIComponent(query)
  const key = searchMode(mode).param
  const url = `${SEARCH_URL}?${key}=${q}&limit=48&fields=${SEARCH_FIELDS}${sortParam}`
  const data = await getJson(url, signal)
  return data.docs ?? []
}

export async function searchBooks(
  query,
  signal,
  sort = 'relevance',
  mode = 'all',
) {
  const docs = await requestSearch(query.trim(), signal, sort, mode)

  // A plain query is the better search whenever the words are complete, so it
  // always goes first. It only fails in one way: a half-typed final word
  // matches no token, and "lord of the ri" comes back with prayer books. That
  // failure is visible from here, nothing in the response matches what was
  // typed, so it is also the only case worth spending a second request on.
  if (partitionByMatch(docs, query, mode).matched.length > 0) return docs

  const wildcard = withPrefixMatch(query)
  if (wildcard === query.trim()) return docs

  const retried = await requestSearch(wildcard, signal, sort, mode)

  // Keep the first response if the retry found nothing. The near-miss row is
  // built from whatever came back, and an empty retry would empty it too.
  return retried.length > 0 ? retried : docs
}

/**
 * Strips accents and lowercases, so "jose" matches "José".
 *
 * Without this the author half of the filter fails on every accented name in
 * the catalogue, and searching an author the way their name is usually typed
 * returns nothing.
 */
function fold(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * "by" is how people join a title to an author. It is the one connector worth
 * ignoring, because "noli me tangere by jose rizal" has to match a record
 * whose title and author never contain the word.
 */
const CONNECTORS = new Set(['by'])

/**
 * Splits a response into the books that really match what was typed and the
 * ones Open Library reached for.
 *
 * The search endpoint is deliberately fuzzy: "asd" comes back with a page of
 * unrelated titles, which reads as broken. Requiring every word that was typed
 * to appear in the title or the author names is what separates a result from
 * a guess.
 *
 * Word by word rather than as one literal phrase. Matching the whole string
 * only ever works when someone types a title exactly and nothing else, so
 * "noli me tangere by jose rizal" would find nothing: that phrase is in no
 * title and no author name, only spread across both.
 *
 * Each word matches on a word boundary rather than anywhere inside one, so a
 * half-typed "ri" finds "Rings" without also finding every title containing
 * those two letters.
 */
export function partitionByMatch(docs, query, mode = 'all') {
  const words = fold(query)
    .split(/\s+/)
    .filter((word) => word && !CONNECTORS.has(word))

  if (words.length === 0) return { matched: docs, others: [] }

  // Narrowed to whatever the request searched. An author search that still
  // accepted a title word would call a book an exact match on a field the
  // request never looked at, and the near-miss row underneath would be the
  // only place the difference showed.
  const { fields } = searchMode(mode)

  const matched = []
  const others = []

  for (const doc of docs) {
    const haystack = fold(
      fields
        .map((field) => {
          const value = doc[field]
          return Array.isArray(value) ? value.join(' ') : (value ?? '')
        })
        .join(' '),
    )
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)

    const matches = words.every((word) =>
      haystack.some((candidate) => candidate.startsWith(word)),
    )

    if (matches) matched.push(doc)
    else others.push(doc)
  }

  return { matched, others }
}

/**
 * Short search used by the autocomplete dropdown. Plain, never wildcarded:
 * five rows ranked well beat five rows found by a query that ranks badly, and
 * a fallback request on every keystroke is not worth it here.
 */
export async function suggestBooks(query, signal, mode = 'all') {
  const q = encodeURIComponent(query.trim())
  const key = searchMode(mode).param
  const url = `${SEARCH_URL}?${key}=${q}&limit=5&fields=${SUGGEST_FIELDS}`
  const data = await getJson(url, signal)
  return data.docs ?? []
}

/**
 * Card-level metadata for a single work, looked up by its key. This is what
 * lets a shared /book/:id link rebuild the whole page without relying on any
 * state handed over by the previous route.
 */
export async function fetchBookByKey(workId, signal) {
  const query = `key:/works/${workId}`
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=1&fields=${SEARCH_FIELDS}`
  const data = await getJson(url, signal)
  return data.docs?.[0] ?? null
}

/**
 * Description and subjects for one work. The search endpoint carries neither,
 * and trending entries carry no subjects at all, so this fills both gaps for
 * every book regardless of which list it was opened from.
 */
export async function fetchWorkDetail(workId, signal) {
  const work = await getJson(`${WORKS_URL}/works/${workId}.json`, signal)

  // `description` is sometimes a plain string and sometimes { type, value }.
  let description = null
  if (typeof work.description === 'string') {
    description = work.description
  } else if (work.description?.value) {
    description = work.description.value
  }

  return {
    title: work.title ?? null,
    description,
    subjects: work.subjects ?? [],
  }
}

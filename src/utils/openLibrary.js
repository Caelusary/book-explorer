const SEARCH_URL = 'https://openlibrary.org/search.json'
const TRENDING_URL = 'https://openlibrary.org/trending/daily.json'
const WORKS_URL = 'https://openlibrary.org'
const SUBJECTS_URL = 'https://openlibrary.org/subjects'
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

async function getJson(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Open Library responded with ${response.status}`)
  }
  return response.json()
}

/** Full search used by the results page. */
export async function searchBooks(query, signal) {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=24&fields=${SEARCH_FIELDS}`
  const data = await getJson(url, signal)
  return data.docs ?? []
}

/** Short search used by the autocomplete dropdown. */
export async function suggestBooks(query, signal) {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=5&fields=${SUGGEST_FIELDS}`
  const data = await getJson(url, signal)
  return data.docs ?? []
}

/**
 * Books trending on Open Library today. The response happens to use the same
 * field names as search, so the same BookCard renders both without changes.
 */
export async function fetchTrending(signal, limit = 12) {
  const data = await getJson(`${TRENDING_URL}?limit=${limit}`, signal)
  return data.works ?? []
}

/**
 * The subjects endpoint names its fields differently from search — authors are
 * objects rather than strings, and the cover is `cover_id` rather than
 * `cover_i`. Translating here means BookCard only ever deals with one shape.
 */
function normalizeSubjectWork(work) {
  return {
    key: work.key,
    title: work.title,
    author_name: work.authors?.map((author) => author.name) ?? [],
    first_publish_year: work.first_publish_year,
    cover_i: work.cover_id,
    edition_count: work.edition_count,
  }
}

/**
 * Books shelved under a subject.
 *
 * This deliberately uses /subjects/{slug}.json rather than a `subject:` query
 * on the search endpoint. The search endpoint matches the word loosely and
 * returns things like Harry Potter under "mystery"; the subjects endpoint is
 * curated and returns Conan Doyle and Christie. The cost is the field mapping
 * above.
 */
export async function fetchSubject(subjectSlug, signal, limit = 12) {
  const url = `${SUBJECTS_URL}/${subjectSlug}.json?limit=${limit}`
  const data = await getJson(url, signal)
  return (data.works ?? []).map(normalizeSubjectWork)
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

/**
 * Subject shelves offered on the lobby. These are all genre tags, which Open
 * Library applies consistently. Broader academic subjects like "history" or
 * "poetry" were tried and dropped — they return whatever classic happens to
 * carry the tag (Robinson Crusoe filed under poetry), which reads as broken.
 */
export const SUBJECTS = [
  { slug: 'science_fiction', label: 'Science Fiction' },
  { slug: 'fantasy', label: 'Fantasy' },
  { slug: 'mystery', label: 'Mystery' },
  { slug: 'romance', label: 'Romance' },
  { slug: 'horror', label: 'Horror' },
  { slug: 'thriller', label: 'Thriller' },
  { slug: 'adventure', label: 'Adventure' },
  { slug: 'historical_fiction', label: 'Historical Fiction' },
]

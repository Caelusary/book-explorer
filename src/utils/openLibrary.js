const COVER_BASE = 'https://covers.openlibrary.org/b/id'
const OPEN_LIBRARY_BASE = 'https://openlibrary.org'

// size: 'S' | 'M' | 'L'. Returns null when the book has no cover on file.
export function coverUrl(coverId, size = 'M') {
  if (!coverId) return null
  return `${COVER_BASE}/${coverId}-${size}.jpg`
}

export function openLibraryUrl(key) {
  return `${OPEN_LIBRARY_BASE}${key}`
}

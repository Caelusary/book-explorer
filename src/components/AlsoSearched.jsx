import { Link, useLocation } from 'react-router-dom'
import { coverUrl, workIdFromKey } from '../utils/openLibrary'

/**
 * The loose matches Open Library returned, shown under the real results.
 *
 * Deliberately not another BookList: rendering these as the same cards would
 * say they carry the same weight, and the whole point is that they don't.
 * A thumbnail-led row reads as a suggestion, which is what it is. Titles are
 * spans rather than headings for the same reason, and so the results grid
 * keeps the only h3s on the page.
 */
export default function AlsoSearched({ books, limit = 8 }) {
  // Same origin hand-off as the result cards, so a book opened from this row
  // comes back to the same place one opened from the grid does.
  const from = useLocation()

  if (books.length === 0) return null

  return (
    <section className="also" aria-labelledby="also-heading">
      <h2 className="also__heading" id="also-heading">
        Others also searched for
      </h2>

      <ul className="also__list">
        {books.slice(0, limit).map((book) => {
          const cover = coverUrl(book.cover_i, 'S')

          return (
            <li className="also__item" key={book.key}>
              <Link
                className="also__link"
                to={`/book/${workIdFromKey(book.key)}`}
                state={{ from: from.pathname + from.search }}
              >
                <span className="also__cover">
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" />
                  ) : (
                    <span className="also__no-cover" aria-hidden="true">
                      ◆
                    </span>
                  )}
                </span>

                <span className="also__text">
                  <span className="also__title">{book.title}</span>
                  <span className="also__author">
                    {book.author_name?.[0] ?? 'Unknown author'}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

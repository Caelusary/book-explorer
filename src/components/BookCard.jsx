import { Link, useLocation } from 'react-router-dom'
import { coverUrl, workIdFromKey } from '../utils/openLibrary'
import BlankCover from './BlankCover'

export default function BookCard({ book, index = 0 }) {
  const cover = coverUrl(book.cover_i, 'M')
  const authors = book.author_name?.join(', ') ?? 'Unknown author'

  // Hands the book page the results this card was clicked from, so its back
  // button returns to that search rather than to the lobby. Read from the
  // router instead of drilled down through BookList: the origin is this
  // link's own business, and threading it through a component that only
  // renders a grid would put it in an API that has no use for it.
  const from = useLocation()

  return (
    // The index staggers the arrival of the first row or two; capped in CSS so
    // a 48-book grid never waits on its last card.
    <li className="book-card" style={{ '--i': Math.min(index, 11) }}>
      <Link
        className="book-card__link"
        to={`/book/${workIdFromKey(book.key)}`}
        state={{ from: from.pathname + from.search }}
      >
        <div className="book-card__cover">
          {cover ? (
            <img src={cover} alt={`Cover of ${book.title}`} loading="lazy" />
          ) : (
            <BlankCover title={book.title} />
          )}
        </div>

        <div className="book-card__body">
          <h3 className="book-card__title">{book.title}</h3>
          <p className="book-card__author">{authors}</p>
          <p className="book-card__year">
            {book.first_publish_year
              ? `First published ${book.first_publish_year}`
              : 'Publication year unknown'}
          </p>
        </div>
      </Link>
    </li>
  )
}

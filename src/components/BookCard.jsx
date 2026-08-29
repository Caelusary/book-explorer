import { Link, useLocation } from 'react-router-dom'
import { coverUrl, workIdFromKey } from '../utils/openLibrary'

export default function BookCard({ book }) {
  const cover = coverUrl(book.cover_i, 'M')
  const authors = book.author_name?.join(', ') ?? 'Unknown author'

  // Hands the book page the results this card was clicked from, so its back
  // button returns to that search rather than to the lobby. Read from the
  // router instead of drilled down through BookList: the origin is this
  // link's own business, and threading it through a component that only
  // renders a grid would put it in an API that has no use for it.
  const from = useLocation()

  return (
    <li className="book-card">
      <Link
        className="book-card__link"
        to={`/book/${workIdFromKey(book.key)}`}
        state={{ from: from.pathname + from.search }}
      >
        <div className="book-card__cover">
          {cover ? (
            <img src={cover} alt={`Cover of ${book.title}`} loading="lazy" />
          ) : (
            <span className="book-card__no-cover">No cover</span>
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

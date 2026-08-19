import { Link } from 'react-router-dom'
import { coverUrl, workIdFromKey } from '../utils/openLibrary'
import FavoriteButton from './FavoriteButton'

export default function BookCard({ book }) {
  const cover = coverUrl(book.cover_i, 'M')
  const authors = book.author_name?.join(', ') ?? 'Unknown author'

  return (
    <li className="book-card">
      <Link className="book-card__link" to={`/book/${workIdFromKey(book.key)}`}>
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

      <FavoriteButton book={book} className="book-card__favorite" />
    </li>
  )
}

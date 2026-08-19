import { coverUrl } from '../utils/openLibrary'

export default function BookCard({ book, onSelect }) {
  const cover = coverUrl(book.cover_i, 'M')
  const authors = book.author_name?.join(', ') ?? 'Unknown author'

  return (
    <li className="book-card">
      <button
        className="book-card__button"
        type="button"
        onClick={() => onSelect(book)}
      >
        <div className="book-card__cover">
          {cover ? (
            <img src={cover} alt={`Cover of ${book.title}`} loading="lazy" />
          ) : (
            <span className="book-card__no-cover">No cover</span>
          )}
        </div>

        <div className="book-card__body">
          <h2 className="book-card__title">{book.title}</h2>
          <p className="book-card__author">{authors}</p>
          <p className="book-card__year">
            {book.first_publish_year
              ? `First published ${book.first_publish_year}`
              : 'Publication year unknown'}
          </p>
        </div>
      </button>
    </li>
  )
}

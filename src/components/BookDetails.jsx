import { useEffect } from 'react'
import { coverUrl, openLibraryUrl } from '../utils/openLibrary'

export default function BookDetails({ book, onClose }) {
  // Close the modal on Escape, and restore the listener when it unmounts.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const cover = coverUrl(book.cover_i, 'L')
  const subjects = book.subject?.slice(0, 12) ?? []

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal__close" type="button" onClick={onClose}>
          Close
        </button>

        <div className="modal__content">
          <div className="modal__cover">
            {cover ? (
              <img src={cover} alt={`Cover of ${book.title}`} />
            ) : (
              <span className="book-card__no-cover">No cover</span>
            )}
          </div>

          <div className="modal__info">
            <h2 className="modal__title">{book.title}</h2>
            <p className="modal__author">
              {book.author_name?.join(', ') ?? 'Unknown author'}
            </p>

            <dl className="modal__facts">
              <div>
                <dt>First published</dt>
                <dd>{book.first_publish_year ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt>Editions</dt>
                <dd>{book.edition_count ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>{book.language?.length ?? 0}</dd>
              </div>
              <div>
                <dt>Rating</dt>
                <dd>
                  {book.ratings_average
                    ? `${book.ratings_average.toFixed(2)} / 5`
                    : 'Not rated'}
                </dd>
              </div>
            </dl>

            {subjects.length > 0 && (
              <div className="modal__subjects">
                <h3>Subjects</h3>
                <ul className="tags">
                  {subjects.map((subject) => (
                    <li className="tag" key={subject}>
                      {subject}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {book.publisher?.length > 0 && (
              <p className="modal__publisher">
                <strong>Publishers:</strong> {book.publisher.slice(0, 3).join(', ')}
              </p>
            )}

            <a
              className="modal__link"
              href={openLibraryUrl(book.key)}
              target="_blank"
              rel="noreferrer"
            >
              View on Open Library →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

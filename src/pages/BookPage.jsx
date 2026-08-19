import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FavoriteButton from '../components/FavoriteButton'
import {
  coverUrl,
  fetchBookByKey,
  fetchWorkDetail,
  openLibraryUrl,
} from '../utils/openLibrary'

export default function BookPage() {
  // :workId comes from the route, so this page works from a pasted link with
  // no state handed over by whichever list the user clicked.
  const { workId } = useParams()

  const [book, setBook] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    // Two endpoints in parallel: one carries author, year and edition count,
    // the other carries the description and subjects. Neither has all of it.
    Promise.all([
      fetchBookByKey(workId, controller.signal),
      fetchWorkDetail(workId, controller.signal),
    ])
      .then(([searchDoc, workDetail]) => {
        setBook(searchDoc)
        setDetail(workDetail)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Could not load this book.')
        setLoading(false)
      })

    return () => controller.abort()
  }, [workId])

  if (loading) {
    return (
      <div className="page">
        <div className="status" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading book…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <div className="status status--error" role="alert">
          <p>{error}</p>
          <Link className="button-link" to="/">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  const title = book?.title ?? detail?.title ?? 'Unknown title'
  const cover = coverUrl(book?.cover_i, 'L')
  const subjects = detail?.subjects?.slice(0, 12) ?? []

  return (
    <article className="page book-page">
      <Link className="back-link" to="/">
        ← Back to home
      </Link>

      <div className="book-page__top">
        <div className="book-page__cover">
          {cover ? (
            <img src={cover} alt={`Cover of ${title}`} />
          ) : (
            <span className="book-card__no-cover">No cover</span>
          )}
        </div>

        <div className="book-page__info">
          <div className="book-page__heading">
            <h1 className="book-page__title">{title}</h1>
            {book && <FavoriteButton book={book} className="book-page__fav" />}
          </div>

          <p className="book-page__author">
            {book?.author_name?.join(', ') ?? 'Unknown author'}
          </p>

          <dl className="facts">
            <div>
              <dt>First published</dt>
              <dd>{book?.first_publish_year ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>Editions</dt>
              <dd>{book?.edition_count ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>{book?.language?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>
                {book?.ratings_average
                  ? `${book.ratings_average.toFixed(2)} / 5`
                  : 'Not rated'}
              </dd>
            </div>
          </dl>

          {detail?.description && (
            <div className="book-page__description">
              <h2>Description</h2>
              <p>{detail.description}</p>
            </div>
          )}

          {subjects.length > 0 && (
            <div className="book-page__subjects">
              <h2>Subjects</h2>
              <ul className="tags">
                {subjects.map((subject) => (
                  <li className="tag" key={subject}>
                    {subject}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            className="external-link"
            href={openLibraryUrl(workId)}
            target="_blank"
            rel="noreferrer"
          >
            View on Open Library →
          </a>
        </div>
      </div>
    </article>
  )
}

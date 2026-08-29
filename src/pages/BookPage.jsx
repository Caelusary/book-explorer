import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
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

  // Where to go back to. Every link into this page hands over the results it
  // was clicked from, so the button returns to that exact search — query,
  // scope, sort and all — instead of dropping the reader at the lobby with
  // their search gone. React Router keeps this in `history.state`, so it
  // survives a refresh too.
  //
  // A pasted or bookmarked link arrives with nothing, and there is genuinely
  // no result set behind it, so that case falls back to home rather than
  // inventing one. `navigate(-1)` would have covered both, but it steps
  // through browser history rather than the app, and on a link opened in a
  // new tab it leaves the site entirely.
  const location = useLocation()
  const backTo = location.state?.from ?? '/'
  const backQuery = new URLSearchParams(backTo.split('?')[1] ?? '').get('q')
  const backLabel = backQuery ? `Back to “${backQuery}”` : 'Back to home'

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
          <Link className="button-link" to={backTo}>
            {backLabel}
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
      {/* Icon only. The label was carrying the destination as visible text,
          which made the control as wide as whatever had been searched for and
          put a stray quoted string at the top of the page. It survives as the
          accessible name, so the button still announces where it goes. The
          arrow is drawn rather than typed: the ← glyph is hairline at this
          size and does not read as a control. */}
      <Link className="back-link" to={backTo} aria-label={backLabel}>
        <svg
          className="back-link__arrow"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
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
          <h1 className="book-page__title">{title}</h1>

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
            View on Open Library
          </a>
        </div>
      </div>
    </article>
  )
}

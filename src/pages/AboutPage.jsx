import { Link } from 'react-router-dom'

const CONCEPTS = [
  {
    name: 'State',
    where: 'SearchBar.jsx, SearchPage.jsx, HomePage.jsx, BookPage.jsx',
    detail:
      'useState holds the search text, the results, and every loading and error flag. HomePage tracks trending and the selected subject separately, so one can finish loading while the other is still in flight.',
  },
  {
    name: 'Props',
    where: 'BookList → BookCard → FavoriteButton',
    detail:
      'BookList receives a books array and passes one book down to each BookCard, which passes that same book to FavoriteButton. SubjectChips receives activeSubject and an onSelect callback, and SearchBar receives a variant that switches it between hero and compact.',
  },
  {
    name: 'useEffect',
    where: 'HomePage.jsx, SearchPage.jsx, BookPage.jsx, useDebounce.js',
    detail:
      'Trending loads once on mount with an empty dependency array. The subject shelf re-runs whenever the chip changes, and the search re-runs whenever the URL query changes. Every one of them returns a cleanup that aborts its request.',
  },
  {
    name: 'Conditional rendering',
    where: 'SearchPage.jsx, HomePage.jsx, ShelfPage.jsx',
    detail:
      'The results page switches between loading skeletons, an error message, the empty state, and the grid. The shelf swaps between an empty prompt and the saved grid, and the lobby only renders the shelf preview once something is saved.',
  },
]

export default function AboutPage() {
  return (
    <div className="page about">
      <h1 className="page__title">About this project</h1>

      <p className="about__intro">
        A book search app built with React and Vite on top of the{' '}
        <a href="https://openlibrary.org/dev/docs/api/search" target="_blank" rel="noreferrer">
          Open Library Search API
        </a>
        . No API key, no backend — every page is data fetched straight from a
        public endpoint.
      </p>

      <h2 className="about__heading">Where each concept lives</h2>
      <ul className="about__list">
        {CONCEPTS.map((concept) => (
          <li className="about__item" key={concept.name}>
            <h3>{concept.name}</h3>
            <code>{concept.where}</code>
            <p>{concept.detail}</p>
          </li>
        ))}
      </ul>

      <h2 className="about__heading">Notes on the build</h2>
      <ul className="about__notes">
        <li>
          Typing does not hit the API. The input updates state on every
          keystroke, but a <code>useDebounce</code> hook waits until typing
          pauses before requesting suggestions, and results are cached per
          prefix so backspacing is instant.
        </li>
        <li>
          Every fetch uses an <code>AbortController</code>, so a slow earlier
          request can never overwrite the results of a newer one.
        </li>
        <li>
          A book page loads from two endpoints at once — the search endpoint has
          the author and edition count, the works endpoint has the description
          and subjects, and neither has all of it.
        </li>
        <li>
          Saved books live in <code>localStorage</code> behind a context, since
          a heart tapped on the lobby has to appear on the shelf page straight
          away.
        </li>
      </ul>

      <Link className="button-link" to="/">
        Back to home
      </Link>
    </div>
  )
}

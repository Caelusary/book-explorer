import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import BookList from '../components/BookList'
import SkeletonList from '../components/SkeletonList'
import SubjectChips from '../components/SubjectChips'
import { fetchSubject, fetchTrending, SUBJECTS } from '../utils/openLibrary'
import { useFavorites } from '../context/FavoritesContext'

export default function HomePage() {
  const [trending, setTrending] = useState([])
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [trendingError, setTrendingError] = useState(null)

  const [subject, setSubject] = useState(SUBJECTS[0].slug)
  const [subjectBooks, setSubjectBooks] = useState([])
  const [subjectLoading, setSubjectLoading] = useState(true)
  const [subjectError, setSubjectError] = useState(null)

  const { favorites } = useFavorites()

  // Runs once on mount — the empty dependency array is what distinguishes this
  // from the subject effect below, which re-runs whenever the chip changes.
  useEffect(() => {
    const controller = new AbortController()

    fetchTrending(controller.signal)
      .then((works) => {
        setTrending(works)
        setTrendingLoading(false)
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setTrendingError(error.message)
        setTrendingLoading(false)
      })

    return () => controller.abort()
  }, [])

  // Re-runs every time a different subject chip is selected.
  useEffect(() => {
    const controller = new AbortController()
    setSubjectLoading(true)
    setSubjectError(null)

    fetchSubject(subject, controller.signal)
      .then((books) => {
        setSubjectBooks(books)
        setSubjectLoading(false)
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setSubjectError(error.message)
        setSubjectLoading(false)
      })

    return () => controller.abort()
  }, [subject])

  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero__title">Book Explorer</h1>
        <p className="hero__tagline">
          Search millions of titles from the Open Library.
        </p>
        <SearchBar variant="hero" autoFocus />
      </section>

      {favorites.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">On your shelf</h2>
            <Link className="section__more" to="/shelf">
              View all {favorites.length} →
            </Link>
          </div>
          <BookList books={favorites.slice(0, 6)} />
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Trending today</h2>
        </div>

        {trendingLoading && <SkeletonList count={6} />}

        {!trendingLoading && trendingError && (
          <p className="status status--error">
            Could not load trending books: {trendingError}
          </p>
        )}

        {!trendingLoading && !trendingError && trending.length > 0 && (
          <BookList books={trending} />
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Browse by subject</h2>
        </div>

        <SubjectChips activeSubject={subject} onSelect={setSubject} />

        {subjectLoading && <SkeletonList count={6} />}

        {!subjectLoading && subjectError && (
          <p className="status status--error">
            Could not load this subject: {subjectError}
          </p>
        )}

        {!subjectLoading && !subjectError && subjectBooks.length > 0 && (
          <BookList books={subjectBooks} />
        )}
      </section>
    </div>
  )
}

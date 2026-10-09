import SearchBar from '../components/SearchBar'
import Shelf from '../components/Shelf'

export default function HomePage() {
  return (
    <div className="home">
      {/* Nothing fetches on mount. The page is a single input until a query
          exists, and results live on /search so they stay shareable. */}
      <section className="hero">
        <p className="hero__kicker">Open Library catalogue</p>
        <h1 className="hero__title">Browse books</h1>
        <p className="hero__tagline">
          Search millions of titles from the Open Library.
        </p>
        <SearchBar variant="hero" autoFocus />
      </section>

      <Shelf />
    </div>
  )
}

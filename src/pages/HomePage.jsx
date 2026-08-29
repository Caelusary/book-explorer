import SearchBar from '../components/SearchBar'

export default function HomePage() {
  return (
    <div className="home">
      {/* Nothing fetches on mount. The page is a single input until a query
          exists, and results live on /search so they stay shareable. */}
      <section className="hero">
        <h1 className="hero__title">Browse books</h1>
        <p className="hero__tagline">
          Search millions of titles from the Open Library.
        </p>
        <SearchBar variant="hero" autoFocus />
      </section>
    </div>
  )
}

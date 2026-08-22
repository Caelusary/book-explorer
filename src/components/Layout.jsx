import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import SearchBar from './SearchBar'
import { useFavorites } from '../context/FavoritesContext'

export default function Layout() {
  const { pathname } = useLocation()
  const { favorites } = useFavorites()

  // The lobby carries its own hero-sized search, so the header omits it there.
  const showHeaderSearch = pathname !== '/'

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar__inner">
          <Link className="topbar__brand" to="/">
            <span className="topbar__mark" aria-hidden="true">◆</span>
            Book Explorer
          </Link>

          {showHeaderSearch && (
            <div className="topbar__search">
              <SearchBar variant="compact" />
            </div>
          )}

          <nav className="topbar__nav">
            <NavLink to="/" end className="topbar__link">
              Home
            </NavLink>
            <NavLink to="/shelf" className="topbar__link">
              Shelf
              {favorites.length > 0 && (
                <span className="topbar__badge">{favorites.length}</span>
              )}
            </NavLink>
            <NavLink to="/about" className="topbar__link">
              About
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="layout__main">
        {/* Keyed on pathname so each route mounts fresh and replays the enter
            transition. Query strings are deliberately excluded from the key:
            a new search or a re-sort should update the results in place, not
            flash the whole page. */}
        <div className="route" key={pathname}>
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        Data from the{' '}
        <a href="https://openlibrary.org" target="_blank" rel="noreferrer">
          Open Library
        </a>
        .
      </footer>
    </div>
  )
}

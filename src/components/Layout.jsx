import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar__inner">
          <Link className="topbar__brand" to="/">
            <span className="topbar__mark" aria-hidden="true">◆</span>
            Shelf Help
          </Link>
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

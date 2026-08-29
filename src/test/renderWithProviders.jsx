import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * Renders a route-aware component the way the app mounts it: inside a router
 * with a real URL, so links and useSearchParams behave as they do in the app.
 *
 * `state` seeds the entry's location state, which is how a link hands the next
 * page the results it was clicked from. Passing it here is the difference
 * between arriving on a page from inside the app and arriving on it from a
 * pasted link, and the two are meant to behave differently.
 */
export function renderRoute(ui, { route = '/', path = '*', state } = {}) {
  // Split rather than handed over whole: an entry object takes `pathname` and
  // `search` separately, and a query string left inside `pathname` is treated
  // as part of the path, so every `?q=` route would stop matching.
  const [pathname, search = ''] = route.split('?')

  return render(
    <MemoryRouter
      initialEntries={[{ pathname, search: search && `?${search}`, state }]}
    >
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>,
  )
}

import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FavoritesProvider } from '../context/FavoritesContext'

/**
 * Renders a route-aware component the way the app mounts it: inside a router
 * with a real URL, and inside the favourites provider that BookCard reaches
 * for through context.
 */
export function renderRoute(ui, { route = '/', path = '*' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FavoritesProvider>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </FavoritesProvider>
    </MemoryRouter>,
  )
}

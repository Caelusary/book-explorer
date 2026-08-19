# Book Explorer

A React book search app built on the [Open Library Search API](https://openlibrary.org/dev/docs/api/search).
Browse what's trending, dig through genre shelves, search by title or author with
live suggestions, and save books to a shelf that survives a reload.

**Live demo:** https://book-explorer-caelusary.vercel.app

## Features

- **Lobby** — trending books load on mount, plus eight genre shelves you can
  switch between without leaving the page.
- **Search input** — a controlled text input with a debounced autocomplete
  dropdown, navigable by arrow keys.
- **Fetch results** — queries `https://openlibrary.org/search.json` and renders
  each match as a card with cover, title, author, and first publish year.
- **Loading state** — skeleton cards hold the grid's shape while results load,
  so the layout doesn't jump when they arrive.
- **Empty state** — shows `No books found.` when the API returns zero matches.
- **Error state** — a readable message if a request fails.
- **Book details** — every book has its own page at `/book/:workId` with a
  description, subject tags, edition count, languages, and rating.
- **Your shelf** — save any book with the ♡ button; the shelf persists in
  `localStorage` between visits.

## Pages

| Route | Page |
| --- | --- |
| `/` | Lobby — trending, genre shelves, shelf preview |
| `/search?q=` | Search results |
| `/book/:workId` | Book details |
| `/shelf` | Saved books |
| `/about` | How the code maps to the requirements |

## React concepts used

| Concept | Where |
| --- | --- |
| State | `useState` in `SearchBar` (query, suggestions, dropdown), `SearchPage` (results, loading, error), `HomePage` (trending and subject shelves tracked separately), `BookPage` |
| Props | `BookList` → `BookCard` → `FavoriteButton`; `SubjectChips` takes `activeSubject` + `onSelect`; `SearchBar` takes a `variant` that switches it between hero and compact |
| useEffect | Trending loads once on mount (`[]`); the subject shelf re-runs on `[subject]`; search re-runs on `[query]` from the URL; `useDebounce` and the click-outside handler both return cleanups |
| Conditional rendering | Loading / error / empty / results switching in `SearchPage`, empty vs. populated shelf in `ShelfPage`, and the lobby's shelf preview only appearing once something is saved |

## Notes on the implementation

- **Typing doesn't hit the API.** The input updates state on every keystroke, but
  `useDebounce` waits until typing pauses before requesting suggestions.
  Responses are cached per prefix, so backspacing is instant.
- **Every fetch is abortable.** Each effect returns a cleanup that aborts its
  request, so a slow earlier response can never overwrite a newer one.
- **A book page reads two endpoints at once.** The search endpoint carries the
  author, year and edition count; the works endpoint carries the description and
  subjects. Neither has everything, so `BookPage` fetches both in parallel — which
  also means trending books get subject tags they don't ship with.
- **Subject shelves use `/subjects/{slug}.json`, not a `subject:` search.** The
  search endpoint matches the word loosely and files Harry Potter under
  "mystery"; the curated endpoint returns Conan Doyle and Christie. It names its
  fields differently, so `normalizeSubjectWork` maps them to the search shape and
  `BookCard` only ever deals with one.
- **Saved books live behind a context** rather than props, because a heart tapped
  on the lobby has to show up on the shelf page immediately.

## Project structure

```
src/
  App.jsx                  route table
  main.jsx                 router + favorites provider
  App.css / index.css      styles and theme tokens
  components/
    Layout.jsx             header, nav, footer
    SearchBar.jsx          controlled input + autocomplete
    BookList.jsx           grid of results
    BookCard.jsx           single result card
    SkeletonList.jsx       loading placeholders
    SubjectChips.jsx       genre switcher
    FavoriteButton.jsx     save toggle
  pages/
    HomePage.jsx           trending + subject shelves
    SearchPage.jsx         results, loading, empty, error
    BookPage.jsx           details for one work
    ShelfPage.jsx          saved books
    AboutPage.jsx          concept map
    NotFoundPage.jsx       unmatched routes
  hooks/
    useDebounce.js         delays a value until typing stops
    useLocalStorage.js     useState mirrored into localStorage
  context/
    FavoritesContext.jsx   shared saved-books state
  utils/
    openLibrary.js         all API calls and URL helpers
```

## Running locally

```bash
npm install
npm run dev
```

To build and preview the production bundle:

```bash
npm run build
npm run preview
```

## Tech stack

React 19, React Router 7, Vite, plain CSS. No API key required — Open Library is
public. `vercel.json` rewrites all routes to `index.html` so deep links like
`/book/OL27448W` work on a fresh load.

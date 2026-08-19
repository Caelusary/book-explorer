# Book Explorer

A React book search app built on the [Open Library Search API](https://openlibrary.org/dev/docs/api/search).
Search by title or author, browse results as cover cards, and click any card for
full details.

**Live demo:** https://book-explorer-caelusary.vercel.app

## Features

- **Search input** — a controlled text input driven entirely by React state.
- **Fetch results** — queries `https://openlibrary.org/search.json` and renders each
  match as a card with cover, title, author, and first publish year.
- **Loading state** — an animated spinner while the request is in flight.
- **Empty state** — shows `No books found.` when the API returns zero matches.
- **Error state** — a readable message if the network request fails.
- **Book details** — clicking a card opens a modal with subject tags, edition
  count, language count, average rating, publishers, and a link to Open Library.

## React concepts used

| Concept | Where |
| --- | --- |
| State | `App.jsx` holds `query`, `submittedQuery`, `books`, `loading`, `error`, `selectedBook` via `useState` |
| Props | `App` → `SearchBar` (`value`, `onChange`, `onSubmit`), `App` → `BookList` (`books`) → `BookCard` (`book`, `onSelect`), `App` → `BookDetails` (`book`, `onClose`) |
| useEffect | `App.jsx` fetches when `submittedQuery` changes; `BookDetails.jsx` binds the Escape key |
| Conditional rendering | `App.jsx` switches between idle, loading, error, empty, and results views |

Two extra details worth noting:

- The fetch effect uses an `AbortController` so a slow earlier request can never
  overwrite the results of a newer search, and the cleanup function cancels the
  request on unmount.
- Typing updates `query` but not `submittedQuery`, so the API is called on submit
  rather than on every keystroke.

## Project structure

```
src/
  App.jsx                  state owner, fetch effect, UI state switching
  App.css                  component styles
  index.css                theme tokens and resets
  main.jsx                 React entry point
  components/
    SearchBar.jsx          controlled input + submit button
    BookList.jsx           grid of results
    BookCard.jsx           single result card
    BookDetails.jsx        details modal
  utils/
    openLibrary.js         cover and permalink URL helpers
```

## Running locally

```bash
npm install
npm run dev
```

The dev server prints a local URL (default `http://localhost:5173`).

To build and preview the production bundle:

```bash
npm run build
npm run preview
```

## Tech stack

React 19, Vite, plain CSS. No API key required — Open Library is public.

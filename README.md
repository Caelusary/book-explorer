# Shelf Help

A React book search app built on the [Open Library Search API](https://openlibrary.org/dev/docs/api/search).
Named for the shelf it helps you find something on, and for the genre shelved
next to everything else.
The lobby is a single search field and nothing else — no requests are made until
someone types. Search by title or author with live suggestions, sort the
results, and open any book for its full details.

**Live demo:** https://book-explorer-caelusary.vercel.app

## Features

- **Lobby** — a heading, one line of copy, and the search field. Nothing loads
  on mount, so the first request only happens once there is something to search
  for.
- **Search input** — a controlled text input with a debounced autocomplete
  dropdown, navigable by arrow keys.
- **Fetch results** — queries `https://openlibrary.org/search.json` and renders
  each match as a card with cover, title, author, and first publish year.
- **Loading state** — skeleton cards hold the grid's shape while results load,
  so the layout doesn't jump when they arrive.
- **Search scope** — match the query against everything, titles only, or
  authors only. Open Library takes `title=` and `author=` as first-class
  parameters, which match that field alone where a `q=` search still ranks on
  the others, so "Author: rizal" returns his books rather than every book that
  mentions him. The local match filter narrows to the same field, so a scoped
  search and its own filter never disagree. On a results page the control
  re-runs the search immediately; on the lobby it just sets the scope the next
  search will use.
- **Back to your results** — every link into a book page hands over the search
  it was clicked from, so the book page's back button returns to that exact
  result set, scope and sort included, rather than dropping you at the lobby.
  React Router keeps it in `history.state`, so it survives a refresh. A pasted
  or bookmarked link arrives with no origin and falls back to home, because
  there is no result set behind it to return to.
- **Sorting** — reorder results by relevance, newest, or rating. The order is
  sent to Open Library rather than applied to the fetched page, so "Newest"
  means newest in the catalogue, not newest of the current results. The choice
  lives in the URL and is reset by a new search.
- **Exact matching** — the grid only holds books where every word typed
  appears in the title or the author names. Open Library's search is
  deliberately loose, so a page of unrelated titles is a normal response to a
  typo; the filter is what stops that reading as a working result set.
- **Others also searched for** — the books the search reached for that weren't
  real matches, kept as a thumbnail row below the results. Costs no extra
  request: they came back with the results and were sorted out of them. If
  nothing matched exactly they are promoted into the grid instead, under a
  line saying so, because a page that reports a real book as no results reads
  as a broken search rather than a strict filter.
- **Empty state** — shows `No books found.` when the API returns no matches,
  and only then.
- **Short queries** — Open Library answers anything under three characters
  with a 422, so `ad` used to surface as "Open Library could not handle that
  request". The page now recognises the floor it already enforced in its own
  suggestion dropdown and says so without spending a request.
- **Error state** — a readable message if a request fails.
- **Book details** — every book has its own page at `/book/:workId` with a
  description, subject tags, edition count, languages, and rating.

## Pages

| Route | Page |
| --- | --- |
| `/` | Lobby — search field only |
| `/search?q=&in=&sort=` | Search results |
| `/book/:workId` | Book details |
| `*` | Not found |

## React concepts used

| Concept | Where |
| --- | --- |
| State | `useState` in `SearchBar` (query, suggestions, dropdown), `SearchPage` (results, loading, error), `BookPage` (book, work detail, loading, error) |
| Props | `BookList` → `BookCard`; one `LabeledSelect` serves both “Search by” and “Sort by”, taking `label` + `options` + `value` + `onChange`; `SearchBar` takes a `variant` that switches it between hero and compact, plus `initialQuery` / `initialMode` seeded from the URL |
| useEffect | Search re-runs on `[query, sort, mode]` from the URL; `BookPage` re-runs on `[workId]`; `useDebounce` and the click-outside handler both return cleanups |
| Conditional rendering | Loading / error / empty / results switching in `SearchPage`; the near-miss row appears only when there are near misses, and moves under the empty state when there are no exact matches |

## Notes on the implementation

- **Typing doesn't hit the API.** The input updates state on every keystroke, but
  `useDebounce` waits until typing pauses before requesting suggestions.
  Responses are cached per prefix, so backspacing is instant.
- **Every fetch is abortable.** Each effect returns a cleanup that aborts its
  request, so a slow earlier response can never overwrite a newer one.
- **A book page reads two endpoints at once.** The search endpoint carries the
  author, year and edition count; the works endpoint carries the description and
  subjects. Neither has everything, so `BookPage` fetches both in parallel.
- **The search field lives on the page, not in the header.** It stays centred
  above the results, holds the query it is showing results for, and sends you
  back to the lobby the moment it is cleared. The header is the brand on every
  route, so it never changes shape between pages.
- **Matching is word by word, not phrase by phrase.** `noli me tangere by
  jose rizal` appears in no title and no author name, only spread across both,
  so a phrase test can never match it. Each word is matched at the start of a
  word so a half-typed `ri` finds `Rings`, accents are folded so `jose` finds
  `José`, and `by` is ignored because it is how people join a title to an
  author.
- **The wildcard is a retry, not the query.** Solr does not analyse a wildcard
  term, so adding one rewrites the whole search rather than just the last
  word: `noli me tangere` finds 137 books and `noli me tangere*` finds one,
  and it is the wrong one. `dune*` ranks Jane Eyre above Dune. So the plain
  query goes first and `*` is appended only after a response comes back with
  nothing matching in it, which is the one failure a plain query cannot fix.
- **The search over-fetches.** 48 rows rather than a screenful, because the
  page keeps only the docs that really match and demotes the rest. Requesting
  exactly one screen would leave the grid half empty after filtering.
- **Covers are contained, not cropped.** Every frame is the same 2:3 box, but
  the cover inside it keeps its own proportions and is centred, so a square
  reissue and a tall scan sit in identical frames without either being sliced.
  `min-height: 0` on the frame is what holds it: the frame is a flex item, and
  a flex item's default `min-height: auto` let a 500×900 scan overrule
  `aspect-ratio` and push its card's title below its neighbours'.
- **The lobby makes no requests.** It renders a heading and an input, so a cold
  visit costs one HTML document and nothing else. The first network call is the
  autocomplete request that fires once typing pauses.
- **Results live at `/search?q=`, not on the lobby.** Keeping them on their own
  route means a search is shareable, bookmarkable, and reachable with the back
  button, and it leaves the sort order somewhere to live in the URL.

## Project structure

```
src/
  App.jsx                  route table
  main.jsx                 router entry
  App.css / index.css      styles and theme tokens
  components/
    Layout.jsx             header and footer shell
    SearchBar.jsx          controlled input + autocomplete
    BookList.jsx           grid of results
    BookCard.jsx           single result card
    SkeletonList.jsx       loading placeholders
    LabeledSelect.jsx      the “Search by” / “Sort by” dropdown
    AlsoSearched.jsx       near-miss row under the results
  pages/
    HomePage.jsx           heading, tagline, search field
    SearchPage.jsx         results, loading, empty, error
    BookPage.jsx           details for one work
    NotFoundPage.jsx       unmatched routes
  hooks/
    useDebounce.js         delays a value until typing stops
  utils/
    openLibrary.js         all API calls and URL helpers
  test/
    setup.js               jest-dom matchers and cleanup
    fetchMock.js           fetch stub for API tests
    renderWithProviders.jsx  render helper with a router
    a11y.test.jsx          axe checks across the main pages
```

Tests sit next to what they cover as `*.test.js` / `*.test.jsx`, with shared
helpers in `src/test/`.

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

To run the tests:

```bash
npm test              # once
npm run test:watch    # on change
npm run test:coverage # with a coverage report
```

## Tech stack

React 19, React Router 7, Vite, plain CSS. Tested with Vitest and React Testing
Library, with jest-axe covering accessibility. Linted with oxlint. No API key
required — Open Library is public. `vercel.json` rewrites all routes to `index.html` so deep links like
`/book/OL27448W` work on a fresh load.

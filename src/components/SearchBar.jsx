export default function SearchBar({ value, onChange, onSubmit }) {
  return (
    <form className="search" onSubmit={onSubmit} role="search">
      <label className="search__label" htmlFor="book-search">
        Search books
      </label>
      <div className="search__row">
        <input
          id="book-search"
          className="search__input"
          type="text"
          placeholder="Try a title or an author…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
        <button className="search__button" type="submit" disabled={!value.trim()}>
          Search
        </button>
      </div>
    </form>
  )
}

/**
 * What a book with no scan on file looks like: a plain cloth binding with the
 * title set on it, the way a library rebinds a worn copy. It keeps the grid a
 * wall of books instead of a wall of books with grey holes in it.
 *
 * The typeset title repeats the heading next to it, so it is hidden from
 * assistive tech; "No cover" stays readable text.
 */
export default function BlankCover({ title, size = 'card' }) {
  return (
    <span className={`blank-cover blank-cover--${size}`}>
      <span className="blank-cover__title" aria-hidden="true">
        {title}
      </span>
      <span className="blank-cover__note">No cover</span>
    </span>
  )
}

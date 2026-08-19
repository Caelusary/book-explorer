/**
 * Placeholder cards shown while results load. Rendering the shape of the grid
 * up front keeps the layout from jumping when the real books arrive.
 */
export default function SkeletonList({ count = 12 }) {
  return (
    <ul className="book-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li className="skeleton" key={index}>
          <div className="skeleton__cover" />
          <div className="skeleton__body">
            <div className="skeleton__line skeleton__line--title" />
            <div className="skeleton__line skeleton__line--author" />
            <div className="skeleton__line skeleton__line--year" />
          </div>
        </li>
      ))}
    </ul>
  )
}

import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="page">
      <div className="status">
        <h1 className="page__title">Page not found</h1>
        <p>That page does not exist.</p>
        <Link className="button-link" to="/">
          Back to home
        </Link>
      </div>
    </div>
  )
}

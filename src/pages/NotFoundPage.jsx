import { Link } from 'react-router-dom'
import StatusPanel from '../components/StatusPanel'

export default function NotFoundPage() {
  return (
    <div className="page">
      <StatusPanel stamp="Not on file">
        <h1 className="status__title">Page not found</h1>
        <p className="status__text">That page does not exist.</p>
        <Link className="button-link" to="/">
          Back to home
        </Link>
      </StatusPanel>
    </div>
  )
}

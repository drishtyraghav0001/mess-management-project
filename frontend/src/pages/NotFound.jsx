import { Link } from 'react-router-dom'
import { Compass, ShieldAlert } from 'lucide-react'
import { EmptyState } from '../components/ui'

export default function NotFound({ forbidden }) {
  return (
    <div className="card">
      <EmptyState
        icon={forbidden ? ShieldAlert : Compass}
        title={forbidden ? 'You do not have access to this page' : 'Page not found'}
        message={forbidden ? 'Your role is not allowed to open this section. The server enforces the same rule (HTTP 403).' : 'The page you are looking for does not exist.'}
        action={<Link className="btn btn-primary btn-sm" to="/">Back to dashboard</Link>}
      />
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useConnectivity, useDatabase } from '../hooks/useServices'
import { db } from '../services/storage'
const pendingQuery = () => db.pendingUploads.count()
export function EmergencyBar() {
  const state = useConnectivity()
  const { data: pending, error } = useDatabase(pendingQuery, 0)
  return <><section className="emergency-bar" aria-label="Emergency actions"><Link className="button sos-button" to="/sos">SOS · Get help</Link><Link className="button" to="/report">Report hazard</Link><Link className="button" to="/contacts">Emergency contacts</Link><Link className="button" to="/settings">Settings</Link><span>{state.state} · {pending} pending upload{pending === 1 ? '' : 's'}</span></section>{error && <p role="alert" className="error-notice">{error}</p>}</>
}

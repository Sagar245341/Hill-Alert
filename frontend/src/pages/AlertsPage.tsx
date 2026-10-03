import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../services/storage'
import { useDatabase } from '../hooks/useServices'
const query = () => db.alerts.toArray().then(values => values.sort((a,b) => b.timestamp-a.timestamp))
export default function AlertsPage() {
  const { id } = useParams()
  const { data, error } = useDatabase(query, [])
  const [showExpired, setShowExpired] = useState(false)
  const alerts = data.filter(packet => id ? packet.id === id : showExpired || Date.parse(packet.expiresAt) > Date.now())
  return <><div className="page-heading"><div><div className="eyebrow">CHECK THE SOURCE BEFORE ACTING</div><h1>{id ? 'Alert details' : 'Live alerts & saved reports'}</h1><p>Community and device reports are unverified. No official feed is configured.</p></div></div><label className="check-row"><input type="checkbox" checked={showExpired} onChange={event => setShowExpired(event.target.checked)}/> Show expired reports</label>{error && <p role="alert">{error}</p>}{alerts.length === 0 && <section className="panel feature-empty"><h2>No active alerts cached</h2><p>This is not confirmation that conditions are safe. Check local official information when available.</p></section>}{alerts.map(packet => <article key={packet.id} className="panel alert-card"><span className="muted-pill" aria-label={`Severity ${packet.severity}`}>⚠ {packet.severity} · {Date.parse(packet.expiresAt) <= Date.now() ? 'EXPIRED' : 'ACTIVE'}</span><h2><Link to={`/alerts/${packet.id}`}>{packet.payload.category}</Link></h2><strong>{packet.source}{packet.source !== 'SIMULATION' && ' — UNVERIFIED'}</strong><p>{packet.payload.message}</p><p>Created: {new Date(packet.createdAt).toLocaleString()}</p><p>Expires: {new Date(packet.expiresAt).toLocaleString()}</p><p>Source device: {packet.senderId}</p>{packet.location && <p>Approximate location: {packet.location.latitude.toFixed(2)}, {packet.location.longitude.toFixed(2)}</p>}</article>)}</>
}

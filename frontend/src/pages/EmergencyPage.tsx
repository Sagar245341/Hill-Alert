import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPacket } from '../../../shared/protocol'
import { db, installationId, saveMessage } from '../services/storage'
import { bluetooth } from '../services/bluetooth'
import { requestLocation } from '../services/location'
import { syncEngine } from '../services/sync'
import { useDatabase } from '../hooks/useServices'
import type { Packet } from '../../../shared/protocol'
const messageQuery = () => db.messages.toArray().then(items => items.sort((a, b) => b.packet.timestamp - a.packet.timestamp))
const emergencies = ['Medical Emergency', 'Trapped', 'Landslide', 'Flash Flood', 'Fire', 'Earthquake', 'Avalanche', 'Lost / Stranded', 'Road Blocked', 'Other']
const hazards = ['Landslide', 'Flooded Road', 'Blocked Road', 'Collapsed Bridge', 'Forest Fire', 'Damaged Building', 'Rockfall', 'Other']
export default function EmergencyPage({ report = false }: { report?: boolean }) {
  const [category, setCategory] = useState(report ? hazards[0] : emergencies[0])
  const [message, setMessage] = useState('')
  const [location, setLocation] = useState<Packet['location']>()
  const [locationStatus, setLocationStatus] = useState('Not shared')
  const [shareBle, setShareBle] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const { data: messages, error } = useDatabase(messageQuery, [])
  const send = async () => {
    if (!confirmed || busy) return
    setBusy(true); setNotice('Saving on this device…')
    try {
      const safeLocation = report && location ? { latitude: Math.round(location.latitude * 100) / 100, longitude: Math.round(location.longitude * 100) / 100 } : location
      const packet = createPacket(report ? 'HAZARD_REPORT' : 'SOS', await installationId(), category, message.trim(), { ...(safeLocation ? { location: safeLocation } : {}) })
      await saveMessage(packet)
      setNotice('Saved locally. Server upload is queued. Emergency services have not been notified.')
      setConfirmed(false); setMessage('')
      void syncEngine.run().catch(() => setNotice('Saved locally. Synchronization could not start; retry from your delivery history.'))
      if (shareBle && bluetooth.getConnectedDevices().length) {
        try { await db.messages.update(packet.id, { bleMode: bluetooth.mode }); await bluetooth.sendPacket(packet); await db.messages.update(packet.id, { bleSent: true }); }
        catch (err) { setNotice(`Saved locally. ${err instanceof Error ? err.message : 'Bluetooth send failed.'} Server upload remains queued.`) }
      }
    } catch (err) { setNotice(`NOT SAVED: ${err instanceof Error ? err.message : 'Storage failed'}. No delivery is confirmed. Use another available communication method.`) }
    finally { setBusy(false) }
  }
  return <><div className="page-heading"><div><div className="eyebrow">{report ? 'COMMUNITY REPORT — UNVERIFIED' : 'LOCAL-FIRST EMERGENCY MESSAGE'}</div><h1>{report ? 'Report a hazard' : 'Send an SOS'}</h1><p>This prototype stores and shares messages. It does not dispatch emergency services.</p></div></div><section className="panel form-panel"><label>{report ? 'Hazard type' : 'Emergency type'}<select value={category} onChange={event => setCategory(event.target.value)}>{(report ? hazards : emergencies).map(value => <option key={value}>{value}</option>)}</select></label><label>Message (optional)<textarea maxLength={1000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Briefly describe what assistance is needed."/></label><p>Your location can be attached to this SOS to help responders understand where assistance may be needed. {report && 'Community report coordinates are rounded to approximately 1 km.'}</p><div className="action-row"><button className="button" disabled={locationStatus === 'Requesting…'} onClick={() => { setLocationStatus('Requesting…'); void requestLocation().then(value => { setLocation(value); setLocationStatus('Location attached') }).catch(err => setLocationStatus(err.message)) }}>Share location</button><button className="button" onClick={() => { setLocation(undefined); setLocationStatus('Not shared') }}>Don’t share location</button></div><p role="status">{locationStatus}</p><label className="check-row"><input type="checkbox" checked={shareBle} onChange={event => setShareBle(event.target.checked)}/> Also share this message{location ? ' and attached location' : ''} with connected nearby nodes ({bluetooth.mode}).</label><label className="check-row"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>{report ? 'I understand this report may be publicly visible and is unverified.' : 'I confirm I want to save and send this SOS.'}</label><button className={`button ${report ? 'primary' : 'sos-button'}`} disabled={!confirmed || busy} onClick={() => void send()}>{busy ? 'Saving…' : report ? 'Save hazard report' : 'Confirm SOS'}</button><p role="status" className="delivery-notice">{notice}</p>{error && <p role="alert">{error}</p>}</section><section className="panel history-panel"><div className="section-heading"><h2>Delivery history</h2><button className="button" onClick={() => void syncEngine.run(true).catch(() => setNotice('Retry could not access device storage.'))}>Retry uploads</button></div>{messages.length === 0 && <p className="empty-copy">No messages saved on this device.</p>}{messages.map(item => <article key={item.id} className="message-card"><h3>{item.packet.type} · {item.packet.payload.category}</h3><small>{new Date(item.packet.createdAt).toLocaleString()} · {item.id.slice(0, 8)}</small><p>Saved locally ✓</p>{item.bleSent && <p>Sent via {item.bleMode || 'BLE'} ✓</p>}{item.receivedBy.length > 0 && <p>Received by {item.receivedBy.length} nearby device(s) ({item.bleMode || 'unverified BLE acknowledgement'}) ✓</p>}<p>{item.status === 'acknowledged' ? 'Acknowledged by HillAlert server ✓' : `Server upload: ${item.status}`}</p>{item.error && <p>{item.error}</p>}<p>Emergency services not notified.</p></article>)}</section><Link className="text-link" to="/contacts">Other emergency contact options →</Link></>
}

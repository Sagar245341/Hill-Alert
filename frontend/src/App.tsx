import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Link, Route, Routes } from 'react-router-dom'
import { io } from 'socket.io-client'
import { ArrowDownToLine, ArrowRight, Bell, Bluetooth, Check, ChevronRight, CircleHelp, Compass, LayoutDashboard, Map, Mountain, Radio, RefreshCw, ShieldCheck, Signal, Wifi, WifiOff, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './App.css'

type Connection = 'connecting' | 'connected' | 'disconnected'
const navigation: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/alerts', label: 'Live alerts', icon: Bell },
  { to: '/map', label: 'Emergency map', icon: Map },
  { to: '/bluetooth', label: 'Nearby devices', icon: Bluetooth },
  { to: '/safety', label: 'Preparedness', icon: ShieldCheck },
]
const packingList = ['Drinking water', 'Torch & spare batteries', 'Power bank & cable', 'Personal medicines', 'Emergency contact list']

function Terrain() {
  return <svg className="terrain" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#adc4b4"/><stop offset="1" stopColor="#e1e7cb"/></linearGradient><linearGradient id="ridge" x2="0" y2="1"><stop stopColor="#416b5c"/><stop offset="1" stopColor="#214d40"/></linearGradient></defs>
    <path fill="url(#sky)" d="M0 0h800v400H0z"/><circle cx="612" cy="87" r="36" fill="#f3eed4"/>
    <path fill="#8ca799" d="m0 240 135-146 93 89L369 39l132 159 103-86 196 137v151H0z"/>
    <path fill="#dce2cc" d="m322 87 47-48 51 61-37-15-14 13-15-22-23 18z"/>
    <path fill="#6f9483" d="m0 284 131-122 118 108 167-140 169 149 124-140 91 106v155H0z"/>
    <path fill="url(#ridge)" d="m0 301 107-63 104 80 140-120 139 93 88-42 222 112v39H0z"/>
    <path fill="#173f34" d="m0 358 160-61 149 81 124-51 146 42 221-48v79H0z"/>
    <path d="M488 400q-75-27-15-38t-26-37q-63-22-15-39" stroke="#b9ceae" fill="none" strokeWidth="4" opacity=".5"/>
    {[590, 617, 650, 688, 735, 760].map((x, i) => <path key={x} fill="#123a30" d={`M${x} ${285 + i * 4}l-15 44h9l-13 28h15v22h8v-22h15l-13-28h9z`}/>)}
  </svg>
}

function App() {
  const [connection, setConnection] = useState<Connection>('connecting')
  const [latency, setLatency] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  useEffect(() => {
    const socket = io({ timeout: 5000, reconnectionDelay: 1000, reconnectionDelayMax: 5000 })
    const measure = () => {
      if (!socket.connected) return
      const start = performance.now()
      socket.timeout(5000).emit('connection:ping', (error: Error | null) => {
        if (!error) setLatency(Math.round(performance.now() - start))
        else setLatency(null)
      })
    }
    socket.on('connect', () => { setConnection('connected'); measure() })
    socket.on('disconnect', () => { setConnection('disconnected'); setLatency(null) })
    socket.on('connect_error', () => { setConnection('disconnected'); setLatency(null) })
    const timer = window.setInterval(measure, 15000)
    return () => { window.clearInterval(timer); socket.removeAllListeners(); socket.disconnect() }
  }, [attempt])
  const connected = connection === 'connected'
  const status = connected ? 'Connected' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'
  const checklist = <div className="checklist">{packingList.map(item => <label key={item}><input type="checkbox" checked={checked.includes(item)} onChange={() => setChecked(previous => previous.includes(item) ? previous.filter(value => value !== item) : [...previous, item])}/><span>{item}</span></label>)}</div>
  const overview = <>
    <div className="page-heading"><div><div className="eyebrow">YOUR EVERYDAY SAFETY COMPANION</div><h1>A little more prepared.<br/>A lot more peace of mind.</h1><p>Your connection to the people and places that matter.</p></div><span className="edition"><Mountain size={15}/> BUILT FOR THE HILLS</span></div>
    <section className="hero"><Terrain/><div className="hero-copy"><span className="hero-label"><Compass size={15}/> EXPLORE WITH CONFIDENCE</span><h2>Stay connected.<br/>Even off the beaten path.</h2><p>Know your connection. Keep your essentials close.<br className="desktop-break"/> Make preparedness part of the journey.</p><Link className="button light" to="/safety">Get prepared <ArrowRight size={17}/></Link></div><span className="hero-caption">HIGHER GROUND. STRONGER CONNECTIONS.</span></section>
    <div className="status-grid">
      <article className="status-card"><span className={`icon-tile ${connected ? 'green' : 'amber'}`}>{connected ? <Wifi/> : <WifiOff/>}</span><div><span className="small-label">Live connection</span><h3>{status}</h3><p>{connected ? 'Real-time channel is active' : 'Trying to reach your backend'}</p></div><span className={`status-dot ${connected ? 'online' : ''}`}/></article>
      <Link to="/bluetooth" className="status-card"><span className="icon-tile lavender"><Bluetooth/></span><div><span className="small-label">Nearby network</span><h3>No devices paired</h3><p>Bluetooth is separate from internet</p></div><ChevronRight size={17}/></Link>
      <Link to="/safety" className="status-card"><span className="icon-tile sand"><ShieldCheck/></span><div><span className="small-label">Your essentials</span><h3>{checked.length} of {packingList.length} packed</h3><p>A small step toward preparedness</p></div><ChevronRight size={17}/></Link>
    </div>
    <div className="content-grid"><section className="panel"><div className="section-heading"><h2>Alert center</h2><Link to="/alerts">View all <ArrowRight size={15}/></Link></div><div className="empty-alert"><span className="empty-icon"><Bell size={25}/></span><h3>Your alert feed starts here</h3><p>An official alert source hasn’t been configured yet.<br/>No alerts shown does not mean there are no hazards.</p><span className="muted-pill">Awaiting a data source</span></div><div className="panel-foot"><Radio size={15}/>{connected ? 'Live server connection established' : 'Live server connection unavailable'}<span className="tiny-dot"/>{connected ? 'Listening' : 'Retrying'}</div></section>
    <section className="panel essentials"><div className="section-heading"><h2>Before you head out</h2><span className="small-label">{checked.length}/{packingList.length}</span></div><p className="section-description">A few essentials for your next journey.</p>{checklist}<Link className="text-link" to="/safety">Open your preparedness kit <ArrowRight size={15}/></Link></section></div>
    <section className="connection-banner"><div className="banner-icon"><Signal size={23}/></div><div><h3>One connection. A clearer picture.</h3><p>Internet connects you to HillAlert. Bluetooth device pairing is a separate feature.</p></div><Link to="/bluetooth">About connections <ArrowRight size={16}/></Link></section>
  </>
  return <BrowserRouter><div className="app-shell"><aside className="sidebar"><Link to="/" className="brand"><span className="brand-mark"><Mountain size={25}/></span>HillAlert<span className="brand-dot">.</span></Link><div className="workspace-label">STAY A STEP AHEAD</div><nav aria-label="Main navigation">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon size={19}/><span>{label}</span>{to === '/' && <span className="nav-dot"/>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="network-note"><span className={`status-dot ${connected ? 'online' : ''}`}/><div><strong>{status}</strong><p>{connected ? 'HillAlert live network' : 'Automatic retry enabled'}</p></div></div><button className="help-link" onClick={() => setHelpOpen(true)}><CircleHelp size={18}/> About HillAlert <ArrowRight size={15}/></button><span className="sidebar-caption">A little closer. A little safer.</span></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Your safety hub <span>/</span> <strong>HillAlert</strong></div><div className="topbar-right"><span role="status" className={`connection-chip ${connected ? 'is-connected' : ''}`}><span className={`status-dot ${connected ? 'online' : ''}`}/>{status}{connected && latency !== null && <small>{latency} ms</small>}</span>{!connected && <button aria-label="Retry connection" className="icon-button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button>}<span className="profile" title="Local workspace">HA</span></div></header>
    <main><Routes><Route path="/" element={overview}/><Route path="/alerts" element={<><PageTitle eyebrow="STAY INFORMED" title="Your alert center" description="A dedicated space for updates from your region."/><section className="panel feature-empty"><Bell size={38}/><h2>No alert source configured</h2><p>The server connection is {connected ? 'active' : 'unavailable'}, but an official alert feed has not been integrated. This screen cannot confirm local safety conditions.</p><Link className="button primary" to="/">Back to overview <ArrowRight size={16}/></Link></section></>}/><Route path="/map" element={<><PageTitle eyebrow="KNOW YOUR SURROUNDINGS" title="Emergency map" description="Your future view of local resources and regional updates."/><section className="map-placeholder"><Terrain/><div><Map size={32}/><h2>A clearer view is on the way</h2><p>Verified shelters, hazards, and location services are not connected yet. This illustration is not a navigational map.</p></div></section></>}/><Route path="/bluetooth" element={<><PageTitle eyebrow="UNDERSTAND YOUR CONNECTION" title="Connected, in different ways." description="Your backend connection and Bluetooth pairing have separate jobs."/><div className="two-columns"><section className="panel detail-card"><Wifi className="detail-icon"/><span className="small-label">INTERNET CONNECTION</span><h2>{status}</h2><p>{connected ? 'Your browser has established a live Socket.IO session with the HillAlert backend.' : 'HillAlert is automatically trying to reconnect to the backend. Make sure both development servers are running.'}</p><span className="muted-pill">{connected ? 'Automatic reconnection enabled' : 'Retrying automatically'}</span></section><section className="panel detail-card"><Bluetooth className="detail-icon"/><span className="small-label">BLUETOOTH NETWORK</span><h2>Not implemented yet</h2><p>Nearby device discovery and offline mesh messaging are not available in this version. An online backend does not pair a Bluetooth device.</p><span className="muted-pill">No device paired</span></section></div></>}/><Route path="/safety" element={<><PageTitle eyebrow="SMALL STEPS, MORE CONFIDENCE" title="Your preparedness kit" description="Keep a simple packing list for your next trip."/><section className="panel preparedness"><div className="section-heading"><h2>Everyday essentials</h2><span className="muted-pill">{checked.length} / {packingList.length} ready</span></div>{checklist}<p className="section-description">Checklist selections last for this session.</p><button className="button primary" onClick={() => { const blob = new Blob([packingList.map(item => `${checked.includes(item) ? '[x]' : '[ ]'} ${item}`).join('\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hillalert-packing-list.txt'; anchor.click(); URL.revokeObjectURL(url) }}><ArrowDownToLine size={17}/> Download checklist</button></section></>}/><Route path="*" element={<><PageTitle eyebrow="LET’S GET YOU BACK" title="Page not found" description="This trail doesn’t lead anywhere yet."/><Link className="button primary" to="/">Back to overview</Link></>}/></Routes><footer><span><Mountain size={14}/> Made for life beyond the city.</span><span>HillAlert <span className="footer-dot">•</span> Development preview</span></footer></main></div>
    {helpOpen && <div className="modal-backdrop" onClick={() => setHelpOpen(false)}><section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={event => event.stopPropagation()}><button autoFocus className="icon-button modal-close" aria-label="Close" onClick={() => setHelpOpen(false)} onKeyDown={event => { if (event.key === 'Escape') setHelpOpen(false) }}><X/></button><span className="brand-mark"><Mountain/></span><h2 id="about-title">A little closer. A little safer.</h2><p>HillAlert is a work in progress for connected communities in the hills. The live backend connection is working; emergency dispatch, official alert feeds, and Bluetooth mesh are not available yet.</p><button className="button primary" onClick={() => setHelpOpen(false)}><Check size={16}/> Got it</button></section></div>}
  </div></BrowserRouter>
}
function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div> }
export default App

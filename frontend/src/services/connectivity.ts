import { io } from 'socket.io-client'
import { config } from '../config/app'
export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'SYNCING'
export interface ConnectivitySnapshot { state: ConnectivityState; reachable: boolean; live: boolean; internet: boolean; latency: number | null }
export class ConnectivityService {
  private snapshot: ConnectivitySnapshot = { state: 'RECONNECTING', reachable: false, live: false, internet: navigator.onLine, latency: null }
  private listeners = new Set<() => void>()
  private stopCallback?: () => void
  lowPower = false
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(values: Partial<ConnectivitySnapshot>) { this.snapshot = { ...this.snapshot, ...values }; this.listeners.forEach(fn => fn()) }
  setSyncing(value: boolean) { this.update({ state: value ? 'SYNCING' : this.snapshot.reachable ? 'ONLINE' : navigator.onLine ? 'RECONNECTING' : 'OFFLINE' }) }
  start() {
    if (this.stopCallback) return
    let active = true, checking = false
    const socket = io(config.apiUrl || undefined, { timeout: 5000, reconnectionDelayMax: 15000 })
    const check = async () => {
      if (checking || !active) return
      if (!navigator.onLine) { this.update({ state: 'OFFLINE', reachable: false, internet: false, latency: null }); return }
      checking = true
      const start = performance.now()
      try {
        const response = await fetch(`${config.apiUrl}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (!response.ok || (await response.json()).status !== 'ok') throw new Error('Unavailable')
        if (active) this.update({ state: this.snapshot.state === 'SYNCING' ? 'SYNCING' : 'ONLINE', reachable: true, internet: true, latency: Math.round(performance.now() - start) })
      } catch { if (active) this.update({ state: navigator.onLine ? 'RECONNECTING' : 'OFFLINE', reachable: false, internet: navigator.onLine, latency: null }) }
      finally { checking = false }
    }
    socket.on('connect', () => { this.update({ live: true }); void check() })
    socket.on('disconnect', () => { this.update({ live: false }); void check() })
    socket.on('connect_error', () => { this.update({ live: false }); void check() })
    const online = () => void check()
    window.addEventListener('online', online); window.addEventListener('offline', online)
    let ticks = 0
    const timer = setInterval(() => { if (!this.lowPower || ++ticks % 4 === 0) void check() }, 15000)
    void check()
    this.stopCallback = () => { active = false; clearInterval(timer); socket.disconnect(); window.removeEventListener('online', online); window.removeEventListener('offline', online); this.stopCallback = undefined }
  }
  stop() { this.stopCallback?.() }
}
export const connectivity = new ConnectivityService()

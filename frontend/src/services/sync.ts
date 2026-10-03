import { db } from './storage'
import { request, ApiError } from './api'
import { retryDelay } from '../../../shared/protocol'
import { connectivity } from './connectivity'
export class SyncEngine {
  private running = false
  async run(force = false) {
    if (this.running || !connectivity.getSnapshot().reachable) return
    this.running = true
    connectivity.setSyncing(true)
    try {
      const items = await db.pendingUploads.toArray()
      for (const item of items) {
        if (item.status === 'acknowledged' || (!force && (item.status === 'failed' || item.nextAttempt > Date.now()))) continue
        const message = await db.messages.get(item.id)
        if (!message) continue
        if (Date.parse(message.packet.expiresAt) <= Date.now()) { await db.pendingUploads.update(item.id, { status: 'failed' }); await db.messages.update(item.id, { status: 'failed', error: 'Message expired. Create a new SOS if assistance is still needed.' }); continue }
        await db.pendingUploads.update(item.id, { status: 'sending' })
        await db.messages.update(item.id, { status: 'sending', error: undefined })
        try {
          const result = await request<{ id: string; acknowledged: boolean; receivedAt: string }>(message.packet.type === 'SOS' ? '/api/sos' : '/api/reports', { method: 'POST', body: JSON.stringify(message.packet) })
          if (result.id !== item.id || result.acknowledged !== true) throw new Error('Invalid server acknowledgement')
          await db.transaction('rw', db.messages, db.pendingUploads, async () => {
            await db.messages.update(item.id, { status: 'acknowledged', acknowledgedAt: result.receivedAt })
            await db.pendingUploads.delete(item.id)
          })
        } catch (error) {
          const attempts = force ? 1 : item.attempts + 1
          const permanent = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429
          const status = permanent || attempts >= 6 ? 'failed' : 'pending'
          await db.pendingUploads.update(item.id, { attempts, status, nextAttempt: Date.now() + retryDelay(attempts) })
          await db.messages.update(item.id, { status, error: status === 'failed' ? 'Upload stopped after errors. Data is saved; retry when ready.' : 'Upload pending. Data remains saved on this device.' })
        }
      }
    } finally { this.running = false; connectivity.setSyncing(false) }
  }
}
export const syncEngine = new SyncEngine()

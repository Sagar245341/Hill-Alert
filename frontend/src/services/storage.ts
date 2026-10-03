import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Packet } from '../../../shared/protocol'
export type Delivery = 'pending' | 'sending' | 'sent' | 'failed' | 'acknowledged'
export interface Message { id: string; packet: Packet; status: Delivery; bleSent?: boolean; bleMode?: 'REAL BLE' | 'DEMO BLE'; receivedBy: string[]; error?: string; acknowledgedAt?: string }
export interface QueueItem { id: string; attempts: number; nextAttempt: number; status: Delivery }
export interface Resource { id: string; name: string; category: string; latitude?: number; longitude?: number; source: string }
export interface Contact { id: string; name: string; category: string; phone: string; region: string; availability: string; source: string; verifiedAt: string | null }
export class HillDatabase extends Dexie {
  messages!: Table<Message>; pendingUploads!: Table<QueueItem>; alerts!: Table<Packet>; reports!: Table<Packet>; receivedPackets!: Table<Packet>;
  seenIds!: Table<{ id: string; expiresAt: number }>; settings!: Table<{ key: string; value: unknown }>; guides!: Table<{ id: string; title: string; sections: Record<string, string>; source: string }>; resources!: Table<Resource>; contacts!: Table<Contact>
  constructor(name = 'HillAlert') {
    super(name)
    this.version(1).stores({ messages: 'id,status', pendingUploads: 'id,status,nextAttempt', alerts: 'id,expiresAt', reports: 'id', receivedPackets: 'id', seenIds: 'id,expiresAt', settings: 'key', guides: 'id', resources: 'id,category', contacts: 'id,region' })
  }
}
export const db = new HillDatabase()
export async function installationId() {
  return db.transaction('rw', db.settings, async () => {
    const old = await db.settings.get('identity')
    if (typeof old?.value === 'string') return old.value
    const value = `HA-${crypto.randomUUID()}`
    await db.settings.put({ key: 'identity', value }); return value
  })
}
export async function saveMessage(packet: Packet) {
  await db.transaction('rw', db.messages, db.pendingUploads, db.reports, async () => {
    await db.messages.add({ id: packet.id, packet, status: 'pending', receivedBy: [] })
    await db.pendingUploads.add({ id: packet.id, attempts: 0, nextAttempt: 0, status: 'pending' })
    if (packet.type === 'HAZARD_REPORT') await db.reports.put(packet)
  })
}
export async function seenOnce(packet: Packet) {
  return db.transaction('rw', db.seenIds, async () => {
    await db.seenIds.where('expiresAt').below(Date.now()).delete()
    if (await db.seenIds.get(packet.id)) return false
    if (await db.seenIds.count() >= 2000) throw new Error('Receive capacity reached; try again later')
    await db.seenIds.add({ id: packet.id, expiresAt: Date.parse(packet.expiresAt) }); return true
  })
}


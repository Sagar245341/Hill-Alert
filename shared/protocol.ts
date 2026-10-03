export const packetTypes = ['SOS', 'ALERT', 'ACK', 'SAFE_STATUS', 'HELP_REQUEST', 'HAZARD_REPORT', 'RESOURCE_INFO', 'DEVICE_STATUS'] as const
export const severities = ['INFO', 'CAUTION', 'WARNING', 'CRITICAL'] as const
export const sources = ['OFFICIAL', 'VERIFIED PARTNER', 'COMMUNITY REPORT', 'DEVICE RELAY', 'SIMULATION'] as const
export type PacketType = typeof packetTypes[number]
export type Severity = typeof severities[number]
export type Source = typeof sources[number]
export interface Packet {
  version: 1; id: string; type: PacketType; senderId: string; timestamp: number; createdAt: string; expiresAt: string; ttl: number;
  severity: Severity; source: Source; location?: { latitude: number; longitude: number; accuracy?: number };
  payload: { category: string; message: string; ackId?: string }
}
export const MAX_PACKET_BYTES = 4096
export function validatePacket(value: unknown, now = Date.now(), allowExpired = false): Packet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Packet must be an object')
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_PACKET_BYTES) throw new Error('Packet too large')
  const p = value as Packet
  if (p.version !== 1 || !/^[a-zA-Z0-9-]{8,80}$/.test(p.id) || !/^HA-[a-zA-Z0-9-]{6,60}$/.test(p.senderId)) throw new Error('Invalid packet identity or version')
  if (!packetTypes.includes(p.type) || !severities.includes(p.severity) || !sources.includes(p.source)) throw new Error('Invalid packet type, severity, or source')
  if (!Number.isInteger(p.ttl) || p.ttl < 0 || p.ttl > 8) throw new Error('Invalid TTL')
  const created = Date.parse(p.createdAt), expires = Date.parse(p.expiresAt)
  if (!Number.isFinite(created) || !Number.isFinite(expires) || p.timestamp !== created || created > now + 300000 || expires <= created || expires - created > 86400000) throw new Error('Invalid packet times; check device clock')
  if (!allowExpired && expires <= now) throw new Error('Packet expired')
  if (!p.payload || typeof p.payload.category !== 'string' || p.payload.category.length < 1 || p.payload.category.length > 80 || typeof p.payload.message !== 'string' || p.payload.message.length > 1000) throw new Error('Invalid payload')
  if (p.type === 'ACK' && (typeof p.payload.ackId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(p.payload.ackId))) throw new Error('Invalid ACK')
  if (p.location && (!Number.isFinite(p.location.latitude) || Math.abs(p.location.latitude) > 90 || !Number.isFinite(p.location.longitude) || Math.abs(p.location.longitude) > 180 || (p.location.accuracy !== undefined && (!Number.isFinite(p.location.accuracy) || p.location.accuracy < 0)))) throw new Error('Invalid location')
  return { version: 1, id: p.id, type: p.type, senderId: p.senderId, timestamp: p.timestamp, createdAt: p.createdAt, expiresAt: p.expiresAt, ttl: p.ttl, severity: p.severity, source: p.source, payload: { category: p.payload.category, message: p.payload.message, ...(p.type === 'ACK' ? { ackId: p.payload.ackId } : {}) }, ...(p.location ? { location: { latitude: p.location.latitude, longitude: p.location.longitude, ...(p.location.accuracy !== undefined ? { accuracy: p.location.accuracy } : {}) } } : {}) }
}
export function createPacket(type: PacketType, senderId: string, category: string, message = '', options: Partial<Pick<Packet, 'location' | 'source' | 'severity' | 'ttl'>> = {}): Packet {
  const now = Date.now()
  return validatePacket({ version: 1, id: crypto.randomUUID(), type, senderId, timestamp: now, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(), ttl: 4, severity: type === 'SOS' ? 'CRITICAL' : 'CAUTION', source: 'COMMUNITY REPORT', payload: { category, message }, ...options })
}
export function serializePacket(packet: Packet) { return JSON.stringify(validatePacket(packet)) }
export function parsePacket(raw: string) { if (new TextEncoder().encode(raw).byteLength > MAX_PACKET_BYTES) throw new Error('Packet too large'); return validatePacket(JSON.parse(raw)) }
export function relayPacket(packet: Packet, now = Date.now()): Packet | null { if (Date.parse(packet.expiresAt) <= now || packet.ttl <= 1 || packet.type === 'ACK') return null; return { ...validatePacket(packet, now), ttl: packet.ttl - 1 } }
export function retryDelay(attempt: number) { return Math.min(1000 * 2 ** Math.max(0, attempt - 1), 60000) }

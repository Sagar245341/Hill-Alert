/// <reference types="web-bluetooth" />
import { config } from '../config/app'
import { createPacket, parsePacket, serializePacket, validatePacket, relayPacket } from '../../../shared/protocol'
import type { Packet } from '../../../shared/protocol'
import { db, seenOnce } from './storage'
export interface NearbyDevice { id: string; name: string; connected: boolean; signal?: number }
export interface BluetoothService {
  mode: 'REAL BLE' | 'DEMO BLE'; isSupported(): boolean; scan(): Promise<NearbyDevice[]>; connect(id: string): Promise<void>; disconnect(id: string): void;
  sendPacket(packet: Packet): Promise<void>; subscribeToPackets(listener: (packet: unknown) => void): () => void; getConnectedDevices(): NearbyDevice[]; getConnectionState(): string
}
class PacketEvents {
  protected listeners = new Set<(packet: unknown) => void>()
  subscribeToPackets(listener: (packet: unknown) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  protected emit(packet: unknown) { this.listeners.forEach(listener => listener(packet)) }
}
export class MockBluetoothService extends PacketEvents implements BluetoothService {
  mode = 'DEMO BLE' as const
  delay = 300; loss = 0
  devices: NearbyDevice[] = ['HillAlert-A12', 'HillAlert-B07', 'RescueNode-C21', 'HillRelay-D08'].map((name, i) => ({ id: `HA-DEMO-${i}`, name, connected: false, signal: -45 - i * 9 }))
  trace: string[] = []
  isSupported() { return true }
  async scan() { return this.devices }
  async connect(id: string) { const device = this.devices.find(value => value.id === id); if (!device) throw new Error('Demo device not found'); device.connected = true }
  disconnect(id: string) { const device = this.devices.find(value => value.id === id); if (device) device.connected = false }
  getConnectedDevices() { return this.devices.filter(value => value.connected) }
  getConnectionState() { return this.getConnectedDevices().length ? 'Connected' : 'Disconnected' }
  async sendPacket(packet: Packet) {
    validatePacket(packet)
    const peers = this.getConnectedDevices()
    if (!peers.length) throw new Error('No demo device connected')
    this.trace = [`SIMULATION ${packet.type} ${packet.id.slice(0, 8)}: Phone → ${peers[0].name} (TTL ${packet.ttl})`]
    let current = packet
    for (const device of peers) {
      if (Math.random() < this.loss) { this.trace.push(`Packet lost before ${device.name}`); break }
      await new Promise(resolve => setTimeout(resolve, Math.min(this.delay, 5000)))
      if (!device.connected) { this.trace.push(`${device.name} disconnected before receipt`); continue }
      this.trace.push(`${device.name} received TTL ${current.ttl}; ACK → Phone`)
      const ack: Packet = { ...createPacket('DEVICE_STATUS', device.id, 'ACK', '', { source: 'SIMULATION', ttl: 0 }), type: 'ACK', payload: { category: 'ACK', message: '', ackId: packet.id } }
      this.emit(ack)
      const relay = relayPacket(current)
      if (!relay) break
      current = relay
    }
  }
  inject(packet: unknown) { this.emit(packet) }
}
export class WebBluetoothService extends PacketEvents implements BluetoothService {
  mode = 'REAL BLE' as const
  private devices = new Map<string, BluetoothDevice>()
  private channels = new Map<string, BluetoothRemoteGATTCharacteristic>()
  isSupported() { return typeof navigator !== 'undefined' && 'bluetooth' in navigator && window.isSecureContext }
  async scan() {
    if (!this.isSupported()) throw new Error("Bluetooth emergency communication isn't supported by this browser/device. Demo Bluetooth Mode is available.")
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [config.serviceUUID] }] })
    this.devices.set(device.id, device)
    device.addEventListener('gattserverdisconnected', () => this.channels.delete(device.id))
    return [{ id: device.id, name: device.name || 'Compatible BLE node', connected: false }]
  }
  async connect(id: string) {
    if (this.channels.size >= 3) throw new Error('Maximum of 3 BLE connections')
    const device = this.devices.get(id)
    if (!device?.gatt) throw new Error('Select a compatible BLE device first')
    try {
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService(config.serviceUUID)
      const tx = await service.getCharacteristic(config.txUUID)
      const rx = await service.getCharacteristic(config.rxUUID)
      await rx.startNotifications()
      rx.addEventListener('characteristicvaluechanged', () => { try { if (rx.value) this.emit(parsePacket(new TextDecoder().decode(rx.value))) } catch { /* Malformed frames are discarded before business logic. */ } })
      this.channels.set(id, tx)
    } catch (error) { device.gatt.disconnect(); throw error }
  }
  disconnect(id: string) { this.devices.get(id)?.gatt?.disconnect(); this.channels.delete(id) }
  getConnectedDevices() { return [...this.devices.values()].filter(device => device.gatt?.connected).map(device => ({ id: device.id, name: device.name || 'Compatible BLE node', connected: true })) }
  getConnectionState() { return this.getConnectedDevices().length ? 'Connected' : 'Disconnected' }
  async sendPacket(packet: Packet) {
    const bytes = new TextEncoder().encode(serializePacket(packet))
    if (bytes.byteLength > 512) throw new Error('Packet exceeds current 512-byte GATT transport limit. Saved locally; server upload remains available.')
    if (!this.channels.size) throw new Error('No compatible BLE node connected')
    const results = await Promise.allSettled([...this.channels.values()].map(channel => channel.writeValueWithResponse(bytes)))
    if (results.every(result => result.status === 'rejected')) throw new Error('BLE transmission failed. Your message remains saved.')
  }
}
export const demoBluetooth = new MockBluetoothService()
export const realBluetooth = new WebBluetoothService()
export let bluetooth: BluetoothService = realBluetooth
let unsubscribe: (() => void) | undefined
let receiveCount = 0, receiveWindow = Date.now()
export async function processReceived(value: unknown) {
  if (Date.now() - receiveWindow > 60000) { receiveWindow = Date.now(); receiveCount = 0 }
  if (++receiveCount > 60) throw new Error('BLE receive rate limit reached')
  const packet = validatePacket(value)
  if (!await seenOnce(packet)) return 'duplicate'
  if (packet.type === 'ACK') {
    const message = await db.messages.get(packet.payload.ackId!)
    if (message && !message.receivedBy.includes(packet.senderId)) await db.messages.update(message.id, { receivedBy: [...message.receivedBy, packet.senderId] })
    return 'acknowledged'
  }
  // BLE has no signed authority verification. Never trust an incoming OFFICIAL label.
  const received = { ...packet, source: bluetooth.mode === 'DEMO BLE' ? 'SIMULATION' as const : 'DEVICE RELAY' as const }
  await db.receivedPackets.put(received)
  if (packet.type === 'ALERT' || packet.type === 'HAZARD_REPORT') await db.alerts.put(received)
  const relay = relayPacket(received)
  // Never automatically redistribute precise SOS locations or private help messages.
  if (relay && !relay.location && relay.type === 'ALERT' && bluetooth.getConnectedDevices().length) await bluetooth.sendPacket(relay)
  return 'received'
}
export function selectBluetooth(demo: boolean) {
  unsubscribe?.()
  bluetooth.getConnectedDevices().forEach(device => bluetooth.disconnect(device.id))
  bluetooth = demo ? demoBluetooth : realBluetooth
  unsubscribe = bluetooth.subscribeToPackets(value => { void processReceived(value).catch(() => { /* Reject invalid, duplicate, expired, or over-limit input without interrupting SOS. */ }) })
}
selectBluetooth(false)

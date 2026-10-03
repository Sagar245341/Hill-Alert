import type { Packet } from '../../../shared/protocol'
export function requestLocation(): Promise<NonNullable<Packet['location']>> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable. You can send without it.')); return }
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }), () => reject(new Error('Location was denied or unavailable. Send without it, or try again.')), { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false })
  })
}

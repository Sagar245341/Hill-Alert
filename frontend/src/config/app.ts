export const config = {
  apiUrl: (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''),
  demoEnabled: import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false',
  serviceUUID: 'f3641400-00b0-4240-ba50-05ca45bf8abc',
  txUUID: 'f3641401-00b0-4240-ba50-05ca45bf8abc',
  rxUUID: 'f3641402-00b0-4240-ba50-05ca45bf8abc',
}
if (config.apiUrl && !/^https?:\/\//.test(config.apiUrl)) throw new Error('VITE_API_URL must be an HTTP(S) URL')

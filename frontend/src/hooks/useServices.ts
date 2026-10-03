import { useEffect, useState, useSyncExternalStore } from 'react'
import { liveQuery } from 'dexie'
import { connectivity } from '../services/connectivity'
export function useConnectivity() { return useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot) }
export function useDatabase<T>(query: () => Promise<T>, initial: T) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState('')
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({ next: value => { setData(value); setError('') }, error: () => setError('Device storage is unavailable. Saved delivery cannot be guaranteed. Check browser storage permissions.') })
    return () => subscription.unsubscribe()
  }, [query])
  return { data, error }
}

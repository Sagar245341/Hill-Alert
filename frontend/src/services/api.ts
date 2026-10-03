import { config } from '../config/app'
export class ApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } }
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${config.apiUrl}${path}`, { ...init, signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', ...init.headers } })
  if (!response.ok) throw new ApiError(`Server request failed (${response.status}). Your saved data is retained.`, response.status)
  return response.json()
}

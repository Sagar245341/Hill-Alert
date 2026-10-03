import { Component } from 'react'
import type { ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <main><h1>HillAlert could not display this screen</h1><p>Your saved data has not been removed. Reload to try again.</p><button onClick={() => window.location.reload()}>Reload HillAlert</button></main> : this.props.children }
}

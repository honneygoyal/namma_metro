import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render failed', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-screen">
          <div>
            <p>MetroMate Bengaluru</p>
            <h1>Something went wrong while starting the app.</h1>
            <span>Please update Android System WebView or reinstall the latest app build.</span>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}

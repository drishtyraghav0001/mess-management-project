import { Component } from 'react'
import { ErrorState } from './ui'

// Stops a bug in one page from blanking the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    if (this.state.error) return <div className="card"><ErrorState error={{ message: `Something went wrong on this page: ${this.state.error.message}` }} onRetry={() => this.setState({ error: null })} /></div>
    return this.props.children
  }
}

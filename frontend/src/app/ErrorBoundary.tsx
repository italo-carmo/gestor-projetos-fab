import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null; errorInfo: ErrorInfo | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 720,
            margin: '40px auto',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: '0 0 12px', color: '#856404' }}>Erro ao carregar a aplicação</h2>
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: '#fff',
              borderRadius: 4,
              overflow: 'auto',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.toString()}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Stack do componente</summary>
              <pre style={{ fontSize: 11, overflow: 'auto', marginTop: 8 }}>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

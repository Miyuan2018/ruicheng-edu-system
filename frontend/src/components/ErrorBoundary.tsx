import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, Button } from 'antd';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error.message);
    console.error('[ErrorBoundary] componentStack:', info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Card style={{ margin: 24, textAlign: 'center' }}>
          <div style={{ color: '#ff4d4f', fontSize: 16, marginBottom: 12 }}>页面渲染异常</div>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message || '未知错误'}
          </div>
          <Button onClick={this.handleReset}>重试</Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">რაღაც შეცდომა მოხდა</div>
          <div className="empty-state-description">
            გვერდი მოულოდნელად გაითიშა. სცადეთ განახლება.
          </div>
          <button
            type="button"
            className="empty-state-action"
            onClick={this.handleReload}
          >
            გვერდის განახლება
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

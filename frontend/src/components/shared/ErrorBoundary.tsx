import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-medium text-red-400 mb-2">Something went wrong</h3>
            <p className="text-sm text-[var(--text-muted)]">{this.state.error?.message}</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

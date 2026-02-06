import { Component, type ErrorInfo, type ReactNode } from "react";

export interface WhiteboardErrorBoundaryProps {
  children: ReactNode;
  /** Called before clearing error state so the app can reset (e.g. cancel resize). */
  onRecover?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in the whiteboard so the app does not crash.
 * Shows a recover UI and allows resetting state (e.g. cancel resize) then retry.
 */
export class WhiteboardErrorBoundary extends Component<
  WhiteboardErrorBoundaryProps,
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[WhiteboardErrorBoundary]", error, errorInfo.componentStack);
  }

  handleRecover = (): void => {
    this.props.onRecover?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground"
          role="alert"
        >
          <p>Something went wrong. You can try to recover.</p>
          <button
            type="button"
            onClick={this.handleRecover}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground hover:bg-muted"
          >
            Recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

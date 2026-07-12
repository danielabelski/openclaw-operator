import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class OperatorRouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Operator route render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="console-panel p-6" role="alert">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-status-error mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-mono font-bold text-foreground">This operator page could not be rendered.</h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              The route returned an unexpected interface value. The error remains in the browser console for diagnosis.
            </p>
            <p className="text-[10px] font-mono text-status-error mt-3 break-words">
              {this.state.error.message}
            </p>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

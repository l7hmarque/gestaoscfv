import React from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}>
              Voltar ao Início
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

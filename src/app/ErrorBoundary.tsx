import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Uncaught error in React tree:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
            <div className="bg-red-50 p-6 border-b border-red-100 flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-red-900">Something went wrong</h2>
              <p className="text-sm text-red-700 mt-2">
                An unexpected error occurred. Your data is safe. Please reload the page to continue.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {this.state.error && (
                <div className="bg-neutral-50 rounded-md p-3 border border-neutral-200">
                  <p className="text-xs font-mono text-neutral-600 break-words">{this.state.error.message}</p>
                </div>
              )}
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

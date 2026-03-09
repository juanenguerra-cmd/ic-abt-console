import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Clipboard, Trash2 } from "lucide-react";
import { clearFirestoreCache } from "../services/firebase"; // Import the new function
import { classifyError, ERROR_KIND_LABEL } from "../debug/errorClassifier";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo,
    });

    const kind = classifyError(error);
    const label = ERROR_KIND_LABEL[kind];

    if (kind === "extension") {
      // Extension errors cannot be fixed in app code; log at warn level so
      // they remain visible but don't pollute error monitoring dashboards.
      console.warn(
        `[ErrorBoundary] ${label} — this error originated in a browser extension, not the app.\n` +
          "Open in Incognito / InPrivate or disable extensions to confirm. " +
          "See docs/debugging-console-errors.md for details.",
        error,
        errorInfo
      );
    } else {
      console.error(
        `[ErrorBoundary] ${label} — Uncaught error in React tree:`,
        error,
        errorInfo
      );
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = async () => {
    try {
      await clearFirestoreCache();
      // Also clear regular browser cache for good measure
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
    } catch (e) {
      console.error("Cache clearing failed:", e);
      // Even if clearing fails, a reload is the best next step.
    } finally {
      window.location.reload();
    }
  };

  handleCopyError = () => {
    const kind = classifyError(this.state.error);
    const errorDetails = `
Error kind: ${ERROR_KIND_LABEL[kind]}
Error: ${this.state.error?.toString()}
Component Stack: ${this.state.errorInfo?.componentStack}
    `;
    navigator.clipboard.writeText(errorDetails.trim());
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      const kind = classifyError(this.state.error);
      const isExtensionError = kind === "extension";

      return (
        <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-4 font-sans">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-red-200 overflow-hidden">
            <div className="bg-red-100 p-6 border-b border-red-200 flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-red-200 rounded-full flex items-center justify-center mb-4 ring-4 ring-red-50">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-red-900">An Unexpected Error Occurred</h1>
              <p className="text-md text-red-700 mt-2 max-w-md">
                We're sorry for the inconvenience. The application encountered a problem. Your data is likely safe.
              </p>
            </div>
            <div className="p-6 bg-white space-y-4">
              {this.state.error && (
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-800">Error Details:</h3>
                  <p className="text-xs font-mono text-neutral-600 break-words leading-relaxed">
                    {this.state.error.message}
                  </p>
                  <p className="text-xs font-semibold text-neutral-500">
                    Source: {ERROR_KIND_LABEL[kind]}
                  </p>
                  {isExtensionError && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      This error appears to originate from a browser extension, not the app.
                      Try opening in an Incognito window or disabling browser extensions.
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150 ease-in-out"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Application
                </button>
                <button
                  onClick={this.handleCopyError}
                  className="w-full flex items-center justify-center px-4 py-2.5 border border-neutral-300 rounded-lg shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400 transition-all duration-150 ease-in-out"
                >
                  <Clipboard className="h-4 w-4 mr-2" />
                  {this.state.copied ? "Copied!" : "Copy Details"}
                </button>
              </div>
               <div className="mt-3">
                 <button
                    onClick={this.handleClearCacheAndReload}
                    className="w-full flex items-center justify-center px-4 py-2.5 border border-amber-300 rounded-lg shadow-sm text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 transition-all duration-150 ease-in-out"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cache and Reload
                  </button>
               </div>
            </div>
             <div className="bg-neutral-50 px-6 py-3 text-xs text-neutral-500 text-center border-t">
              If the problem persists, please contact support and provide the copied error details.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

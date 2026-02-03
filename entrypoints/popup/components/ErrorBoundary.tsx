import { Component, ErrorInfo, ReactNode } from 'react';
import { translations } from '@/shared/i18n';

// ErrorBoundary is a class component and renders outside of I18nProvider,
// so it uses English translations directly for error messages
const t = translations.en;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <h1 className="text-xl font-semibold mb-2">{t.errors.somethingWentWrong}</h1>
          <p className="text-sm text-muted-foreground mb-4">{t.errors.unexpectedError}</p>
          <details className="text-xs text-muted-foreground max-w-full">
            <summary className="cursor-pointer mb-2">{t.errors.errorDetails}</summary>
            <pre className="text-left overflow-auto p-2 bg-muted rounded">
              {this.state.error?.stack || this.state.error?.message}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            {t.actions.reload}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

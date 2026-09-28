import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { translations } from '@/shared/i18n/index';

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
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <h1 className="mb-2 text-[19px] leading-6 font-semibold tracking-[-0.015em] text-primary">
            {t.errors.somethingWentWrong}
          </h1>
          <p className="mb-4 text-[13px] text-secondary">{t.errors.unexpectedError}</p>
          <details className="max-w-full text-xs text-secondary">
            <summary className="cursor-pointer mb-2">{t.errors.errorDetails}</summary>
            <pre className="text-left overflow-auto p-2 bg-secondary rounded-md">
              {this.state.error?.stack || this.state.error?.message}
            </pre>
          </details>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-9 rounded-lg bg-accent px-4 text-xs font-medium text-on-accent hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t.actions.reload}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import type { ReactNode } from 'react';
import { Component } from 'react';
import { translations } from '@/i18n';
import { reportApplicationError } from '@/infrastructure/application-errors';

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

  public override componentDidCatch(error: Error) {
    reportApplicationError('popupRender', error);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <h1 className="text-xl font-semibold mb-2">{t.errors.somethingWentWrong}</h1>
          <p className="text-sm text-muted-foreground mb-4">{t.errors.unexpectedError}</p>
          <button
            type="button"
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

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';

// Render-error boundary (B-265). A class is not a style choice: `componentDidCatch` /
// `getDerivedStateFromError` have no hook equivalent.
//
// Mounted twice (see main.tsx and AppShell.tsx): once at the root, outside the router, so a
// router crash still shows something; once around the route content, so a single screen can fail
// while the nav stays usable. The route-level one is keyed on the pathname — React never resets a
// boundary by itself, so without that key a crashed screen would keep showing the card after you
// navigate away.
interface Props {
  children: ReactNode;
}

interface State {
  detail: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { detail: null };

  static getDerivedStateFromError(error: unknown): State {
    return { detail: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is the only sink: there is no client-side error reporting in this app, and the
    // component stack is what makes a user-reported crash diagnosable.
    console.error('Uncaught render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.detail !== null) return <ErrorScreen detail={this.state.detail} />;
    return this.props.children;
  }
}

import React from 'react';

// Top-level crash guard: a render error anywhere shows a recoverable screen
// instead of a white page. Errors are logged to the console (hook a reporting
// service here if one is configured later).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='flex flex-col items-center justify-center min-h-dvh gap-3 bg-black text-center px-4'>
          <p className='text-lg font-semibold text-gray-100'>Something went wrong.</p>
          <p className='text-sm text-zinc-400'>Try reloading the page.</p>
          <button
            onClick={() => window.location.reload()}
            className='mt-2 rounded-lg bg-blue-500 hover:bg-blue-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer'
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

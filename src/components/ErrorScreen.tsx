import type { FallbackProps } from "react-error-boundary";

// Shown if a slide fails. It says so plainly and offers a way forward.
export function ErrorScreen({ error, resetErrorBoundary }: FallbackProps) {
  const detail = (error instanceof Error ? error.message : String(error)).slice(
    0,
    160
  );
  return (
    <div className="wp-page tone-tomato">
      <main className="wp-stage" role="alert">
        <div className="wp-slide wp-single">
          <header className="wp-head">
            <h1 className="wp-title">Something went wrong</h1>
            {detail && <p className="wp-sub">{detail}</p>}
          </header>
          <div className="wp-controls">
            <button
              type="button"
              className="wp-btn"
              onClick={resetErrorBoundary}
            >
              Try again
            </button>
            <button
              type="button"
              className="wp-btn"
              onClick={() => window.location.assign(import.meta.env.BASE_URL)}
            >
              Start over
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

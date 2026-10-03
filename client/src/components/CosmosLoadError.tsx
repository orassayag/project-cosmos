const README_URL = 'https://github.com/orassayag/project-cosmos#readme';

interface CosmosLoadErrorProps {
  errorCode: string;
  onRetry: () => void;
}

/** Full-screen state shown when `/api/cosmos` fails or times out. */
export function CosmosLoadError({ errorCode, onRetry }: CosmosLoadErrorProps) {
  return (
    <main className="lc-load-error" role="alert" aria-labelledby="lc-load-error-title">
      <div className="lc-load-error-inner">
        <span className="lc-load-error-eyebrow">SIGNAL LOST</span>
        <h1 id="lc-load-error-title" className="lc-load-error-title">The map didn't load</h1>
        <p className="lc-load-error-text">
          The architecture data could not be fetched. Check your connection and try again.
        </p>
        <div className="lc-load-error-actions">
          <button type="button" className="lc-intro-cta lc-load-error-retry" onClick={onRetry} autoFocus>
            Retry
          </button>
          <a className="lc-load-error-link" href={README_URL} target="_blank" rel="noreferrer">
            Read the README
          </a>
        </div>
        <code className="lc-load-error-code">{errorCode}</code>
      </div>
    </main>
  );
}

import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { OVERLAY, useOverlay } from '../overlays/OverlayManager';
import { AI_PROVIDER_LABELS } from '../hooks/useAiConnection';
import type { AiProvider, ConnectErrorCode, ConnectResult } from '../hooks/useAiConnection';
import type { DemoTarget } from '../demo/types';

interface ConnectAgentModalProps {
  currentProvider: AiProvider | null;
  onConnect: (provider: AiProvider, apiKey: string, gatewayApiKey?: string) => Promise<ConnectResult>;
}

const PROVIDERS: AiProvider[] = ['anthropic', 'openai'];

const KEY_PAGE_URLS: Record<AiProvider, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
};

const ERROR_MESSAGES: Record<ConnectErrorCode, string> = {
  INVALID_KEY: "That key didn't work — check it and try again",
  AI_NOT_CONFIGURED: "AI answers aren't available on this site right now.",
  NETWORK_ERROR: "Couldn't reach the server — check your connection and try again.",
  UNEXPECTED_RESPONSE: 'Something went wrong while connecting — please try again.',
};

/** Visibility and every open/close go through the overlay manager, so on phones it
 *  stacks over the answer panel and closing it brings that panel back intact. */
export function ConnectAgentModal({ currentProvider, onConnect }: ConnectAgentModalProps) {
  const overlay = useOverlay();
  if (!overlay.isOpen(OVERLAY.connect)) return null;
  return createPortal(
    <ConnectAgentDialog
      currentProvider={currentProvider}
      onConnect={onConnect}
      onClose={() => overlay.close(OVERLAY.connect)}
    />,
    document.body,
  );
}

interface ConnectAgentDialogProps extends ConnectAgentModalProps {
  onClose: () => void;
}

function ConnectAgentDialog({ currentProvider, onConnect, onClose }: ConnectAgentDialogProps) {
  const titleId = useId();
  const [provider, setProvider] = useState<AiProvider>(currentProvider ?? 'anthropic');
  const [apiKey, setApiKey] = useState('');
  const [jevKey, setJevKey] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<ConnectErrorCode | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isBusy, onClose]);

  const pickProvider = (nextProvider: AiProvider) => {
    setProvider(nextProvider);
    setErrorCode(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey || isBusy) return;
    setIsBusy(true);
    setErrorCode(null);
    const trimmedGatewayKey = jevKey.trim();
    const result = await (trimmedGatewayKey ? onConnect(provider, trimmedKey, trimmedGatewayKey) : onConnect(provider, trimmedKey));
    if (result.ok) {
      onClose();
      return;
    }
    setErrorCode(result.errorCode);
    setIsBusy(false);
  };

  const isReplacing = currentProvider !== null;

  return (
    <div className="lc-help-overlay lc-connect-overlay" onClick={() => { if (!isBusy) onClose(); }}>
      <div
        className="lc-help-modal lc-connect-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="lc-help-close" onClick={onClose} disabled={isBusy} aria-label="Close">
          <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
          </svg>
        </button>

        <div className="lc-help-eyebrow">Ask the agent</div>
        <h2 id={titleId} className="lc-help-title">Connect an AI agent</h2>
        <p className="lc-connect-lede">
          Use your own key for real answers. It stays in a secure cookie on this site and is never shown again.
        </p>
        {isReplacing && (
          <p className="lc-connect-note">
            You're connected to {AI_PROVIDER_LABELS[currentProvider]}. Connecting a new key replaces it — one
            provider at a time.
          </p>
        )}

        <form className="lc-connect-form" onSubmit={handleSubmit}>
          <div className="lc-connect-providers" role="radiogroup" aria-label="AI provider">
            {PROVIDERS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={provider === option}
                className="lc-connect-provider"
                data-demo-target={`connect-provider-${option}` satisfies DemoTarget}
                onClick={() => pickProvider(option)}
                disabled={isBusy}
              >
                {AI_PROVIDER_LABELS[option]}
              </button>
            ))}
          </div>

          <label className="lc-connect-field">
            <span className="lc-connect-label">{AI_PROVIDER_LABELS[provider]} API key</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="lc-connect-input"
              data-demo-target="connect-provider-key"
              value={apiKey}
              onChange={(event) => { setApiKey(event.target.value); setErrorCode(null); }}
              disabled={isBusy}
              aria-invalid={errorCode !== null}
            />
          </label>

          <label className="lc-connect-field">
            <span className="lc-connect-label">
              Vercel AI Gateway key (JEV) <span className="lc-connect-optional">optional</span>
            </span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="lc-connect-input"
              data-demo-target="connect-jev-key"
              value={jevKey}
              onChange={(event) => setJevKey(event.target.value)}
              disabled={isBusy}
            />
          </label>

          {errorCode && <p className="lc-connect-error" role="alert">{ERROR_MESSAGES[errorCode]}</p>}

          <div className="lc-connect-actions">
            <a className="lc-connect-link" href={KEY_PAGE_URLS[provider]} target="_blank" rel="noopener noreferrer">
              Get a key
            </a>
            <button type="submit" className="lc-connect-submit" data-demo-target="connect-submit" disabled={isBusy || !apiKey.trim()}>
              {isBusy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

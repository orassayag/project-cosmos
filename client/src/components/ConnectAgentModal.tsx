import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { OVERLAY, useOverlay } from '../overlays/OverlayManager';
import { AI_PROVIDER_LABELS } from '../hooks/useAiConnection';
import type { AiProvider, ConnectErrorCode, ConnectResult } from '../hooks/useAiConnection';
import type { DemoConnectState } from '../demo/types';

interface ConnectAgentModalProps {
  currentProvider: AiProvider | null;
  onConnect: (provider: AiProvider, apiKey: string) => Promise<ConnectResult>;
  /** When present the dialog is fully controlled by the demo runner and never calls `onConnect`. */
  demo?: DemoConnectState;
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
export function ConnectAgentModal({ currentProvider, onConnect, demo }: ConnectAgentModalProps) {
  const overlay = useOverlay();
  if (!overlay.isOpen(OVERLAY.connect)) return null;
  return createPortal(
    <ConnectAgentDialog
      currentProvider={currentProvider}
      onConnect={onConnect}
      demo={demo}
      onClose={() => overlay.close(OVERLAY.connect)}
    />,
    document.body,
  );
}

interface ConnectAgentDialogProps extends ConnectAgentModalProps {
  onClose: () => void;
}

function ConnectAgentDialog({ currentProvider, onConnect, demo, onClose }: ConnectAgentDialogProps) {
  const titleId = useId();
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(currentProvider ?? 'anthropic');
  const [typedKey, setTypedKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<ConnectErrorCode | null>(null);

  const isDemo = demo !== undefined;
  const provider = demo?.provider ?? selectedProvider;
  const apiKey = demo?.providerKey ?? typedKey;
  const isBusy = demo?.isBusy ?? isSubmitting;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isBusy, onClose]);

  const pickProvider = (nextProvider: AiProvider) => {
    if (isDemo) return;
    setSelectedProvider(nextProvider);
    setErrorCode(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    if (isDemo || !trimmedKey || isBusy) return;
    setIsSubmitting(true);
    setErrorCode(null);
    const result = await onConnect(provider, trimmedKey);
    if (result.ok) {
      onClose();
      return;
    }
    setErrorCode(result.errorCode);
    setIsSubmitting(false);
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
              value={apiKey}
              onChange={(event) => { setTypedKey(event.target.value); setErrorCode(null); }}
              readOnly={isDemo}
              disabled={isBusy}
              aria-invalid={errorCode !== null}
            />
          </label>

          {demo?.showJevField && (
            <label className="lc-connect-field">
              <span className="lc-connect-label">Vercel AI Gateway key (JEV, site owner)</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="lc-connect-input"
                value={demo.jevKey}
                readOnly
                disabled={isBusy}
              />
            </label>
          )}

          {errorCode && <p className="lc-connect-error" role="alert">{ERROR_MESSAGES[errorCode]}</p>}

          <div className="lc-connect-actions">
            <a className="lc-connect-link" href={KEY_PAGE_URLS[provider]} target="_blank" rel="noopener noreferrer">
              Get a key
            </a>
            <button type="submit" className="lc-connect-submit" disabled={isBusy || !apiKey.trim()}>
              {isBusy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

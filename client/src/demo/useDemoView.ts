import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AiProvider } from '../hooks/useAiConnection';
import { scaledDuration } from './runDemo';
import type { DemoConnectField } from './types';
import { DEMO_AI_PROVIDER } from './useDemoAiConnection';

/** One typed character every 55ms at speed 1, so the question looks typed by a person. */
export const DEMO_TYPING_CHARACTER_MS = 55;

/** What the demo shows in the Ask box and the Connect window while it plays. */
export interface DemoView {
  /** `undefined` until the first `type` step, so the Ask box stays in its normal mode before that. */
  question: string | undefined;
  isSearchPressed: boolean;
  provider: AiProvider;
  providerKey: string;
  jevKey: string;
  /** Set by the final `endCard` step; survives `reset` because the end card outlives the run. */
  isEndCardRequested: boolean;
}

export const INITIAL_DEMO_VIEW: DemoView = {
  question: undefined,
  isSearchPressed: false,
  provider: DEMO_AI_PROVIDER,
  providerKey: '',
  jevKey: '',
  isEndCardRequested: false,
};

export interface DemoViewControls {
  view: DemoView;
  typeQuestion: (text: string) => void;
  pickProvider: (provider: AiProvider) => void;
  setConnectField: (field: DemoConnectField, value: string) => void;
  setSearchPressed: (isPressed: boolean) => void;
  requestEndCard: () => void;
  reset: () => void;
}

export function useDemoView(speed: number): DemoViewControls {
  const [view, setView] = useState<DemoView>(INITIAL_DEMO_VIEW);
  // Wrapped in an object so typing the same text twice still restarts the effect.
  const [typing, setTyping] = useState<{ text: string } | null>(null);

  useEffect(() => {
    if (typing === null) return;
    const { text } = typing;
    let typedLength = 0;
    const intervalId = window.setInterval(() => {
      typedLength += 1;
      setView((current) => ({ ...current, question: text.slice(0, typedLength) }));
      if (typedLength >= text.length) window.clearInterval(intervalId);
    }, scaledDuration(DEMO_TYPING_CHARACTER_MS, speed));
    return () => window.clearInterval(intervalId);
  }, [typing, speed]);

  const typeQuestion = useCallback((text: string) => {
    setView((current) => ({ ...current, question: '' }));
    setTyping({ text });
  }, []);

  const pickProvider = useCallback((provider: AiProvider) => {
    setView((current) => ({ ...current, provider }));
  }, []);

  const setConnectField = useCallback((field: DemoConnectField, value: string) => {
    setView((current) => ({ ...current, [field]: value }));
  }, []);

  const setSearchPressed = useCallback((isPressed: boolean) => {
    setView((current) => ({ ...current, isSearchPressed: isPressed }));
  }, []);

  const requestEndCard = useCallback(() => {
    setView((current) => ({ ...current, isEndCardRequested: true }));
  }, []);

  const reset = useCallback(() => {
    setTyping(null);
    setView((current) => ({ ...INITIAL_DEMO_VIEW, isEndCardRequested: current.isEndCardRequested }));
  }, []);

  return useMemo(
    () => ({ view, typeQuestion, pickProvider, setConnectField, setSearchPressed, requestEndCard, reset }),
    [view, typeQuestion, pickProvider, setConnectField, setSearchPressed, requestEndCard, reset],
  );
}

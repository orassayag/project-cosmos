import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEMO_TYPING_CHARACTER_MS, INITIAL_DEMO_VIEW, useDemoView } from '../useDemoView';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDemoView', () => {
  it('starts with no question so the Ask box stays in its normal mode', () => {
    const { result } = renderHook(() => useDemoView(1));

    expect(result.current.view).toEqual(INITIAL_DEMO_VIEW);
  });

  it('types the question one character at a time from an empty string', () => {
    const { result } = renderHook(() => useDemoView(1));

    act(() => result.current.typeQuestion('Hi!'));
    expect(result.current.view.question).toBe('');

    act(() => vi.advanceTimersByTime(DEMO_TYPING_CHARACTER_MS));
    expect(result.current.view.question).toBe('H');

    act(() => vi.advanceTimersByTime(DEMO_TYPING_CHARACTER_MS * 2));
    expect(result.current.view.question).toBe('Hi!');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('types faster at a higher speed', () => {
    const { result } = renderHook(() => useDemoView(4));

    act(() => result.current.typeQuestion('abcd'));
    act(() => vi.advanceTimersByTime(DEMO_TYPING_CHARACTER_MS));

    expect(result.current.view.question).toBe('abcd');
  });

  it('records the Connect window fields and the pressed Search button', () => {
    const { result } = renderHook(() => useDemoView(1));

    act(() => {
      result.current.pickProvider('openai');
      result.current.setConnectField('providerKey', 'provider-key');
      result.current.setConnectField('jevKey', 'jev-key');
      result.current.setSearchPressed(true);
    });

    expect(result.current.view).toMatchObject({
      provider: 'openai',
      providerKey: 'provider-key',
      jevKey: 'jev-key',
      isSearchPressed: true,
    });
  });

  it('reset stops typing and clears everything except the end card request', () => {
    const { result } = renderHook(() => useDemoView(1));
    act(() => {
      result.current.typeQuestion('A long question');
      result.current.setSearchPressed(true);
      result.current.requestEndCard();
    });

    act(() => result.current.reset());

    expect(result.current.view).toEqual({ ...INITIAL_DEMO_VIEW, isEndCardRequested: true });
    expect(vi.getTimerCount()).toBe(0);
  });
});

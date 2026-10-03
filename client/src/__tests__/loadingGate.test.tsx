import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { CosmosResponse } from '../api/cosmos-api';
import { CosmosFetchError, startCosmosFetch } from '../api/cosmosClient';
import { INTRO_SEEN_STORAGE_KEY } from '../demo/demoMode';
import { App } from '../App';
import { COSMOS_FIXTURE } from './renderWithCosmos';

vi.mock('../api/cosmosClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/cosmosClient')>()),
  startCosmosFetch: vi.fn(),
}));

// The real warp and intro animate on a canvas / with framer-motion; these stand-ins expose their callbacks.
vi.mock('../components/WarpTransition', () => ({
  WarpTransition: ({ hold = false, onDone }: { hold?: boolean; onDone?: () => void }) => (
    <div data-testid="warp" data-hold={String(hold)}>
      {onDone && <button type="button" onClick={onDone}>finish warp</button>}
    </div>
  ),
}));

vi.mock('../components/IntroOverlay', () => ({
  IntroOverlay: ({ onStart, onExitComplete }: { onStart: () => void; onExitComplete: () => void }) => (
    <button type="button" onClick={() => { onStart(); onExitComplete(); }}>Enter the cosmos</button>
  ),
}));

const FAKE_RESPONSE = COSMOS_FIXTURE;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function queueLoads(...loads: Promise<CosmosResponse>[]) {
  const mockedStart = vi.mocked(startCosmosFetch);
  for (const load of loads) mockedStart.mockReturnValueOnce(load);
}

function isMapShown(): boolean {
  return document.querySelector('.lc-app') !== null;
}

describe('loading gate', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ connected: false })));
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.mocked(startCosmosFetch).mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('intro shown: the warp after the CTA holds until the data is ready, then the map renders', async () => {
    const load = deferred<CosmosResponse>();
    queueLoads(load.promise);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Enter the cosmos' }));
    expect(screen.getByTestId('warp').dataset.hold).toBe('true');

    await act(async () => load.resolve(FAKE_RESPONSE));
    expect(screen.getByTestId('warp').dataset.hold).toBe('false');
    expect(isMapShown()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'finish warp' }));
    expect(isMapShown()).toBe(true);
  });

  it('intro skipped: the warp is the loading screen until the data is ready', async () => {
    localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    const load = deferred<CosmosResponse>();
    queueLoads(load.promise);
    render(<App />);

    expect(screen.getByTestId('warp').dataset.hold).toBe('true');
    expect(screen.queryByRole('button', { name: 'Enter the cosmos' })).toBeNull();
    expect(isMapShown()).toBe(false);

    await act(async () => load.resolve(FAKE_RESPONSE));
    expect(screen.queryByTestId('warp')).toBeNull();
    expect(isMapShown()).toBe(true);
  });

  it('shows the error screen with Retry after a failed load, and Retry recovers', async () => {
    localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    const failedLoad = deferred<CosmosResponse>();
    const retriedLoad = deferred<CosmosResponse>();
    queueLoads(failedLoad.promise, retriedLoad.promise);
    render(<App />);

    await act(async () => failedLoad.reject(new CosmosFetchError('timed out', { errorCode: 'COSMOS_TIMEOUT' })));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('COSMOS_TIMEOUT')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Read the README' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByTestId('warp')).toBeTruthy();

    await act(async () => retriedLoad.resolve(FAKE_RESPONSE));
    expect(startCosmosFetch).toHaveBeenCalledTimes(2);
    expect(isMapShown()).toBe(true);
  });
});

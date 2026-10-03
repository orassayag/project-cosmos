import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { COSMOS_FIXTURE } from '../../__tests__/renderWithCosmos';
import type { CosmosResponse } from '../cosmos-api';
import { DEV_POLL_INTERVAL_MS, startCosmosFetch } from '../cosmosClient';
import { CosmosProvider, useCosmos } from '../CosmosProvider';
import { useCosmosLoad } from '../useCosmosLoad';

vi.mock('../cosmosClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cosmosClient')>()),
  startCosmosFetch: vi.fn(),
}));

const LOADED_VERSION = COSMOS_FIXTURE.version;
const EDITED_RESPONSE: CosmosResponse = {
  ...COSMOS_FIXTURE,
  version: 'edited0000000001',
  data: { ...COSMOS_FIXTURE.data, brand: { ...COSMOS_FIXTURE.data.brand, helpTitle: 'Edited while dev runs' } },
};

function ServedVersion() {
  const response = useCosmos();
  return createElement('output', { 'data-testid': 'served' }, `${response.version} ${response.data.brand.helpTitle}`);
}

function Harness() {
  const { state } = useCosmosLoad();
  if (state.status !== 'ready') return null;
  return createElement(CosmosProvider, { response: state.response, children: createElement(ServedVersion) });
}

async function renderLoaded(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(startCosmosFetch).mockResolvedValue(COSMOS_FIXTURE);
  render(createElement(Harness));
  await act(async () => {});
  expect(screen.getByTestId('served').textContent).toContain(LOADED_VERSION);
}

async function advancePollTick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEV_POLL_INTERVAL_MS);
  });
}

describe('dev live data polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.mocked(startCosmosFetch).mockReset();
  });

  it('asks with If-None-Match and swaps a 200 with a new version into the provider', async () => {
    const fetchMock = vi.fn(async () => Response.json(EDITED_RESPONSE));
    await renderLoaded(fetchMock);

    await advancePollTick();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/cosmos');
    expect((init.headers as Record<string, string>)['If-None-Match']).toBe(`"${LOADED_VERSION}"`);
    expect(screen.getByTestId('served').textContent).toBe('edited0000000001 Edited while dev runs');
  });

  it('keeps the loaded response on a 304', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 304 }));
    await renderLoaded(fetchMock);

    await advancePollTick();
    await advancePollTick();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('served').textContent).toContain(LOADED_VERSION);
  });

  it('does not poll outside dev', async () => {
    vi.stubEnv('DEV', false);
    const fetchMock = vi.fn(async () => Response.json(EDITED_RESPONSE));
    await renderLoaded(fetchMock);

    await advancePollTick();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

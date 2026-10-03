import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { CosmosResponse } from '../api/cosmos-api';
import { CosmosProvider } from '../api/CosmosProvider';
import cosmosResponseFixture from './fixtures/cosmos-response.json';

/** The real `/api/cosmos` body, written by `npm run fixture:cosmos` — never edited by hand. */
export const COSMOS_FIXTURE = cosmosResponseFixture as unknown as CosmosResponse;

export function renderWithCosmos(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & { response?: CosmosResponse } = {},
): RenderResult {
  const { response = COSMOS_FIXTURE, ...renderOptions } = options;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <CosmosProvider response={response}>{children}</CosmosProvider>
  );
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAskStreamLine, streamAskAnswer, type AskStreamEvent } from '../components/askStream';

const KNOWN_ACTIONS = [
  { type: 'action', kind: 'showBlastRadius', nodeId: 'payments' },
  { type: 'action', kind: 'openPassport', nodeId: 'payments' },
  { type: 'action', kind: 'showHealth' },
  { type: 'action', kind: 'showOwnership' },
  { type: 'action', kind: 'openChangelogEntry', entryId: 'd-2026-08-13-orders-payload' },
] as const;

// Unknown kinds and known kinds with a missing or mistyped id must never reach the action handler.
const UNHANDLED_ACTION_LINES = [
  { type: 'action', kind: 'somethingFromTheFuture', anything: true },
  { type: 'action', kind: 'showBlastRadius' },
  { type: 'action', kind: 'openPassport', nodeId: 42 },
  { type: 'action', kind: 'openChangelogEntry' },
].map((event) => JSON.stringify(event));

describe('Ask map actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(KNOWN_ACTIONS)('parses $kind', (action) => {
    expect(parseAskStreamLine(JSON.stringify(action))).toEqual(action);
  });

  it.each(UNHANDLED_ACTION_LINES)('parses %s to nothing', (line) => {
    expect(parseAskStreamLine(line)).toBeNull();
  });

  it('never reaches the action handler with an unknown action and leaves the rest of the answer intact', async () => {
    const body = [
      JSON.stringify({ type: 'token', text: 'Payments feeds ' }),
      ...UNHANDLED_ACTION_LINES,
      JSON.stringify({ type: 'action', kind: 'highlight', serviceIds: ['payments'] }),
      JSON.stringify({ type: 'token', text: 'orders.' }),
      JSON.stringify({ type: 'done' }),
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`${body}\n`)));
    const events: AskStreamEvent[] = [];

    await streamAskAnswer('What breaks if payments goes down?', new AbortController().signal, (event) =>
      events.push(event),
    );

    expect(events).toEqual([
      { type: 'token', text: 'Payments feeds ' },
      { type: 'action', kind: 'highlight', serviceIds: ['payments'] },
      { type: 'token', text: 'orders.' },
      { type: 'done' },
    ]);
  });
});

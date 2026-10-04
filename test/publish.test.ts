import { describe, it, expect, vi, afterEach } from 'vitest';
import { triggerRebuild } from '../src/lib/publish';

function fakeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
  } as unknown as KVNamespace;
}

afterEach(() => vi.unstubAllGlobals());

describe('triggerRebuild', () => {
  it('reports not_configured without a deploy hook', async () => {
    expect(await triggerRebuild({}, 60)).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('POSTs the hook, then throttles a second call inside the interval', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { DEPLOY_HOOK_URL: 'https://hook.example/x', RATE_LIMIT: fakeKV() };

    const first = await triggerRebuild(env, 600);
    expect(first.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://hook.example/x', { method: 'POST' });

    const second = await triggerRebuild(env, 600);
    expect(second).toMatchObject({ ok: false, reason: 'throttled' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports hook_failed when the hook errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    expect(await triggerRebuild({ DEPLOY_HOOK_URL: 'https://hook.example/x' }, 60))
      .toEqual({ ok: false, reason: 'hook_failed' });
  });
});

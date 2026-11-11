import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('window', {});
const { ApiError, friendlyError, request } = await import('./api');

afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('turns API error bodies into ApiError with the server code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'SEATS_FULL', message: 'full' }), { status: 409 })));

    const error = await request('/classes/x/holds', { method: 'POST' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'SEATS_FULL' });
    expect(friendlyError(error)).toBe('full'); // the server's own message
  });

  it('reports an unreachable server as offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const error = await request('/classes').catch((e) => e);

    expect(error).toMatchObject({ code: 'NETWORK' });
    expect(friendlyError(error)).toMatch(/Server offline/);
  });

  it('sends the student header and returns undefined for 204', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);

    await expect(request('/holds/1', { method: 'DELETE', studentId: '20152691234567890' })).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/holds\/1$/), expect.objectContaining({
      headers: expect.objectContaining({ 'X-Student-Id': '20152691234567890' }),
    }));
  });
});

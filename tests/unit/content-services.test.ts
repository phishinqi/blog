import { it, expect, vi, afterEach } from 'vitest';
import { handle, serve } from '../../src/server/content-services.mjs';
const site = 'https://example.com';
const env = {
  GITHUB_REPO: 'owner/repo',
  GITHUB_CLIENT_ID: 'demo',
  PUBLIC_MEDIA_URL: 'https://img.example.com',
};
afterEach(() => vi.unstubAllGlobals());
it('binds OAuth state to an HttpOnly callback cookie', async () => {
  const response = await handle(new Request('https://example.com/api/auth'), env);
  expect(response.status).toBe(302);
  expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
  const redirect = new URL(response.headers.get('Location')!);
  expect(redirect.origin).toBe('https://github.com');
  expect(redirect.searchParams.get('state')).toBeTruthy();
  expect(redirect.searchParams.get('redirect_uri')).toBe('https://example.com/api/callback');
  expect(response.headers.get('Set-Cookie')).toContain('Path=/api/callback');
  const denied = await handle(
    new Request('https://example.com/api/callback?state=wrong&code=test'),
    env,
  );
  expect(denied.status).toBe(400);
});
it('rejects unauthorized origins before contacting GitHub', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const response = await handle(
    new Request('https://example.com/api/media', {
      headers: { Origin: 'https://attacker.example' },
    }),
    env,
  );
  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('requires repository write access to list images', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ permissions: { push: false } })),
  );
  const response = await handle(
    new Request('https://example.com/api/media', {
      headers: { Origin: site, Authorization: 'Bearer test' },
    }),
    env,
  );
  expect(response.status).toBe(403);
});
it('rejects fake image bytes without writing R2 objects', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ permissions: { push: true } })));
  const put = vi.fn();
  const form = new FormData();
  form.append(
    'metadata',
    JSON.stringify({ sizes: [{ field: 'file-480', width: 480, height: 320 }] }),
  );
  form.append(
    'file-480',
    new Blob(['<script>alert(1)</script>'], { type: 'image/webp' }),
    'fake.webp',
  );
  const response = await handle(
    new Request('https://example.com/api/media', {
      method: 'POST',
      headers: { Origin: site, Authorization: 'Bearer test' },
      body: form,
    }),
    { ...env, MEDIA: { put } },
  );
  expect(response.status).toBe(400);
  expect(put).not.toHaveBeenCalled();
});
it('stores authorized image variants and publishes a responsive manifest', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ permissions: { push: true } })));
  const put = vi.fn().mockResolvedValue({});
  const form = new FormData();
  form.append(
    'metadata',
    JSON.stringify({ name: 'test.webp', sizes: [{ field: 'file-480', width: 480, height: 320 }] }),
  );
  form.append('file-480', new Blob(['RIFF0000WEBPdata'], { type: 'image/webp' }), 'test.webp');
  const response = await handle(
    new Request('https://example.com/api/media', {
      method: 'POST',
      headers: { Origin: site, Authorization: 'Bearer test' },
      body: form,
    }),
    { ...env, MEDIA: { put } },
  );
  expect(response.status).toBe(201);
  const result = await response.json();
  expect(result.src).toMatch(/^https:\/\/img.example.com\/images\/[^/]+\/480.webp$/);
  expect(result.srcset).toContain('480w');
  expect(put).toHaveBeenCalledTimes(2);
});
it('keeps the dominant colour only when it is a plain hex value', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ permissions: { push: true } })),
  );
  const upload = async (color: string) => {
    const form = new FormData();
    form.append(
      'metadata',
      JSON.stringify({
        name: 'a.webp',
        color,
        sizes: [{ field: 'file-480', width: 480, height: 320 }],
      }),
    );
    form.append('file-480', new Blob(['RIFF0000WEBPdata'], { type: 'image/webp' }), 'a.webp');
    const response = await handle(
      new Request('https://example.com/api/media', {
        method: 'POST',
        headers: { Origin: site, Authorization: 'Bearer test' },
        body: form,
      }),
      { ...env, MEDIA: { put: vi.fn().mockResolvedValue({}) } },
    );
    return response.json();
  };
  expect((await upload('#a0b1c2')).color).toBe('#a0b1c2');
  expect((await upload('red;background:url(x)')).color).toBeUndefined();
});
it('answers unknown routes with 404 and hides internal failures', async () => {
  expect((await handle(new Request('https://example.com/api/other'), env)).status).toBe(404);
  const broken = await serve(new Request('https://example.com/api/auth'), {} as typeof env);
  expect([302, 503]).toContain(broken.status);
});

it('hands the token to the opener without waiting to be asked', async () => {
  // The editor treats `authorizing:github` as "the window is alive, focus it" and never replies,
  // so a callback page that waited for a reply hung on "Returning to the editor…" forever.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'gho_TESTTOKEN' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ permissions: { push: true } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );

  const response = await handle(
    new Request('https://example.com/api/callback?code=abc&state=S1', {
      headers: { Cookie: 'v7-oauth-state=S1' },
    }),
    { ...env, GITHUB_CLIENT_SECRET: 'secret' },
  );
  expect(response.status).toBe(200);
  const html = await response.text();

  // Run the inline script the page ships, against a stand-in opener.
  const script = /<script nonce="[^"]*">([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(script, 'the callback page must carry its handshake script').toBeTruthy();
  const posted: Array<{ data: string; target: string }> = [];
  const fakeWindow = {
    opener: { postMessage: (data: string, target: string) => posted.push({ data, target }) },
    close: () => {},
  };
  new Function('window', 'setInterval', 'clearInterval', 'setTimeout', script!)(
    fakeWindow,
    (fn: () => void) => {
      fn();
      return 1;
    },
    () => {},
    () => {},
  );

  expect(posted.length).toBeGreaterThan(0);
  expect(posted[0]!.target).toBe(site);
  const prefix = 'authorization:github:success:';
  expect(posted[0]!.data.startsWith(prefix)).toBe(true);
  expect(JSON.parse(posted[0]!.data.slice(prefix.length))).toMatchObject({
    token: 'gho_TESTTOKEN',
    provider: 'github',
  });
});

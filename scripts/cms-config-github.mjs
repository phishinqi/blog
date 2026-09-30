// Generates cms.config.github.json from cms.config.json.
//
// The two files differ in exactly one key: `backend`. Keeping two hand-maintained copies of a
// 440-line config guarantees they drift, so the local file stays the single source and this script
// derives the hosted one. `pnpm build` runs it, and so does `pnpm cms:config`.
//
// The GitHub backend is what the deployed editor uses: the theme is static, so the only way to
// write to the repository from a phone or another machine is through GitHub's API.
import { readFile, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';

const SOURCE = 'cms.config.json';
const TARGET = 'cms.config.github.json';
/** Filled in by the deploy environment; the editor only needs it to find the OAuth relay. */
const AUTH_BASE = process.env.CMS_AUTH_BASE ?? 'https://v7.soyonagasaki.com';
/**
 * The relay's endpoint path. The theme serves its functions under `functions/api/`, so the relay
 * lives at `/api/auth`, not the `/auth` the editor asks for by default. Getting this wrong is a
 * 404 in the sign-in popup, so it is set explicitly rather than left to the default.
 */
const AUTH_ENDPOINT = process.env.CMS_AUTH_ENDPOINT ?? 'api/auth';
const REPO = process.env.CMS_REPO ?? 'phishinqi/astro-theme-v7';

const source = JSON.parse(await readFile(SOURCE, 'utf8'));

// Where the deployed editor previews from.
//
// `preview.devServerURL` points at the author's own machine, which is right for `pnpm dev` and
// wrong for a build: the browser would try to reach the *visitor's* localhost and show "connection
// refused". So it is replaced by the deployed site's own origin — same domain as the editor, so the
// frame is same-origin, the editor can inject the bridge into it, and the site tab shows the real
// published layout rather than nothing.
//
// `CMS_DEV_SERVER_URL` overrides it for anyone who would rather preview a local dev server.
const DEV_SERVER_URL = process.env.CMS_DEV_SERVER_URL;
const SITE_URL = process.env.CMS_SITE_URL ?? AUTH_BASE;
const preview = { ...(source.preview ?? {}) };
delete preview.devServerURL;
preview.devServerURL = DEV_SERVER_URL ?? SITE_URL;

const hosted = {
  ...source,
  backend: {
    name: 'github',
    repo: REPO,
    branch: process.env.CMS_BRANCH ?? 'main',
    authBase: AUTH_BASE,
    authEndpoint: AUTH_ENDPOINT,
  },
  ...(Object.keys(preview).length ? { preview } : {}),
};

// Validation happens in the editor, but a typo here would only surface after a deploy.
if (hosted.backend.repo !== REPO) throw new Error('repo was not applied');
if (!/^https?:\/\//.test(hosted.backend.authBase)) {
  throw new Error(`authBase must be an absolute URL, got "${hosted.backend.authBase}"`);
}
// A relative or localhost dev server in the deployed config is the bug this guard exists for: it
// A localhost preview source in the deployed config is the bug this guard exists for: it compiles,
// deploys, and only then fails, in a visitor's browser, with no clue in the build log.
if (!/^https?:\/\/(?!localhost|127\.0\.0\.1)/.test(hosted.preview?.devServerURL ?? '')) {
  throw new Error(
    `The deployed editor cannot preview "${hosted.preview?.devServerURL}". Set CMS_SITE_URL to ` +
      'the public origin of this site, or CMS_DEV_SERVER_URL to a publicly reachable dev server.',
  );
}

// Formatted with the project's prettier config, because `pnpm format:check` covers this file and a
// generator that emits something the formatter would rewrite fails the build it feeds. The config
// is resolved explicitly: `format()` alone does not pick up `prettier.config.mjs` from the cwd.
const options = (await resolveConfig(TARGET)) ?? {};
const text = await format(JSON.stringify(hosted), { ...options, filepath: TARGET });
await writeFile(TARGET, text);
console.log(`${TARGET} written (github backend → ${REPO}, relay ${AUTH_BASE}/${AUTH_ENDPOINT})`);

// Makes this theme yours.
//
// A clone starts out configured as the repository it came from: `siteURL` is the original author's
// domain, and the editor would sign in to their repository. That is invisible until it is
// published — your RSS, canonical URLs and sitemap would all point at somebody else's site — so
// this rewrites the places identity lives, and the build refuses to run unconfigured.
//
//   pnpm bootstrap -- url https://example.com --title "My blog" --repo me/my-blog --author me
//
// Every flag is optional; anything omitted keeps its current value or is derived.
import { glob, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';

/**
 * pnpm forwards its own `--` as a literal argument: `pnpm bootstrap -- --url x` arrives here as
 * `['--', '--url', 'x']`. `parseArgs` treats everything after a bare `--` as positional, so every
 * flag would be dropped and the script would report success while changing nothing — worse than an
 * error, because it looks like it worked.
 */
const argv = process.argv.slice(2);
const separator = argv.indexOf('--');
const flags = separator === -1 ? argv : [...argv.slice(0, separator), ...argv.slice(separator + 1)];

const args = parseArgs({
  args: flags,
  options: {
    url: { type: 'string' },
    title: { type: 'string' },
    repo: { type: 'string' },
    author: { type: 'string' },
    'author-name': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

if (args.values.help) {
  console.log(`Usage: pnpm bootstrap -- [options]

  --url <origin>        Public origin, e.g. https://example.com   (required to publish)
  --title <name>        Site title
  --repo <owner/repo>   GitHub repository the editor writes to
  --author <id>         Author id, lowercase, used in content frontmatter
  --author-name <name>  Author display name
`);
  process.exit(0);
}

/** Committed with every copy; the build refuses while it exists. Keep in step with src/site.config.ts. */
const MARKER = 'this-repository-is-a-template';

const read = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
const write = async (path, value) => {
  const filename = resolve(path);
  const options = (await resolveConfig(filename)) ?? {};
  const text = await format(JSON.stringify(value), { ...options, filepath: filename });
  await writeFile(filename, text);
};

const site = await read('site.config.json');
const authors = await read('data/authors.json');
const cms = await read('cms.config.github.json');

// ---- origin ---------------------------------------------------------------------------------
if (args.values.url) {
  let origin;
  try {
    const parsed = new URL(args.values.url);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('not an origin');
    }
    origin = parsed.origin;
  } catch {
    console.error(
      `--url must be an absolute http(s) origin such as https://example.com, got "${args.values.url}"`,
    );
    process.exit(1);
  }
  site.siteURL = origin;
}

// ---- title ----------------------------------------------------------------------------------
if (args.values.title) site.title = args.values.title;

// ---- repository the editor writes to ---------------------------------------------------------
if (args.values.repo) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(args.values.repo)) {
    console.error(`--repo must be owner/repo, got "${args.values.repo}"`);
    process.exit(1);
  }
  // The backend is derived by scripts/cms-config-github.mjs from these env vars, so the source of
  // truth is the generator's defaults rather than the generated file. Rewriting both keeps a
  // `pnpm bootstrap` and a later build consistent.
  const generator = resolve('scripts/cms-config-github.mjs');
  const source = await readFile(generator, 'utf8');
  const [owner, repo] = args.values.repo.split('/');
  await writeFile(
    generator,
    source
      .replace(
        /const REPO = process\.env\.CMS_REPO \?\? '[^']*'/,
        `const REPO = process.env.CMS_REPO ?? '${owner}/${repo}'`,
      )
      .replace(
        /const AUTH_BASE = process\.env\.CMS_AUTH_BASE \?\? '[^']*'/,
        `const AUTH_BASE = process.env.CMS_AUTH_BASE ?? '${site.siteURL}'`,
      ),
  );
  cms.backend = { ...cms.backend, repo: args.values.repo };
}

// ---- author ---------------------------------------------------------------------------------
let renamedAuthor;
if (args.values.author) {
  const previous = site.defaultAuthor;
  const id = args.values.author;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    console.error(`--author must be lowercase words separated by hyphens, got "${id}"`);
    process.exit(1);
  }
  site.defaultAuthor = id;
  renamedAuthor = { from: previous, to: id };
  const entry = authors.authors.find((a) => a.id === previous);
  if (entry) entry.id = id;
  else authors.authors.push({ id, name: id, bio: site.description, avatar: '', links: [] });
}
if (args.values['author-name']) {
  const entry = authors.authors.find((a) => a.id === site.defaultAuthor);
  if (entry) entry.name = args.values['author-name'];
}

/**
 * The sample author links to this template's repository, which would otherwise appear on every
 * copy's author page — a link back to the template presented as the site owner's own. Cleared
 * rather than guessed at; the author adds their own links.
 */
for (const entry of authors.authors) {
  entry.links = (entry.links ?? []).filter((link) => !String(link.href).includes('astro-theme-v7'));
}

// ---- deploy configuration -------------------------------------------------------------------
/**
 * `wrangler.toml` carries deploy settings, and the template's copy of it names the template's
 * repository and its OAuth client id. A copy that kept those would sign its authors in through
 * somebody else's OAuth app, and the relay would check write access to somebody else's repository.
 *
 * Rewritten rather than deleted: the file also holds the project name and build output, and
 * removing it would silently change how a deploy behaves.
 */
const wranglerPath = resolve('wrangler.toml');
const wrangler = await readFile(wranglerPath, 'utf8').catch(() => undefined);
if (wrangler) {
  const [owner, repo] = (cms.backend.repo ?? '').split('/');
  const rewritten = wrangler
    .replace(/^name = .*$/m, `name = ${JSON.stringify(repo ?? 'v7-blog')}`)
    .replace(/^GITHUB_REPO = .*$/m, `GITHUB_REPO = ${JSON.stringify(cms.backend.repo ?? '')}`)
    // Left as a placeholder on purpose: the value is account-specific, and a stale one that looks
    // real is worse than an obvious one that does not.
    .replace(/^GITHUB_CLIENT_ID = .*$/m, 'GITHUB_CLIENT_ID = "replace-with-oauth-client-id"');
  if (rewritten !== wrangler) await writeFile(wranglerPath, rewritten);
  void owner;
}

/**
 * Content names authors explicitly, and the schema rejects an unknown one, so renaming the author
 * without this leaves every post referencing an id that no longer exists — the build fails with
 * "Unknown author" and the message points at the data file rather than at the content.
 *
 * `guest` is a second sample author. A single-author site does not want a byline for somebody who
 * does not exist, so its references are dropped rather than repointed.
 */
if (renamedAuthor) {
  const { from, to } = renamedAuthor;
  // `fs.promises.glob` yields an async iterator, so it is collected before iterating twice.
  const posts = await Array.fromAsync(glob('content/**/*.{md,mdx}'));
  for (const path of posts) {
    const text = await readFile(resolve(path), 'utf8');
    const rewritten = text.replace(/^(authors:\s*)(.*)$/m, (_match, prefix, rest) => {
      const ids = rest
        .replace(/[[\]'"]/g, ' ')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id && id !== 'guest')
        .map((id) => (id === from ? to : id));
      return ids.length
        ? `${prefix}[${ids.map((id) => `'${id}'`).join(', ')}]`
        : `${prefix}[${to}]`;
    });
    if (rewritten !== text) await writeFile(resolve(path), rewritten);
  }
}

// The starter content is the original author's; leaving it makes a new site look like a copy.
site.socialLinks = [];

await write('site.config.json', site);
await write('data/authors.json', authors);
await write('cms.config.github.json', cms);

// Deleted last, so a run that fails part-way leaves the guard in place rather than a
// half-configured site that would publish under the wrong identity.
await rm(resolve(MARKER), { force: true });

console.log(`siteURL      ${site.siteURL}`);
console.log(`title        ${site.title}`);
console.log(`author       ${site.defaultAuthor}`);
console.log(`editor repo  ${cms.backend.repo}`);
console.log('');
console.log('Next: rewrite content/posts/ with your own writing, then run `pnpm build`.');

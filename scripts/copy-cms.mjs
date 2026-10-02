// Copies the editor into public/admin/ so the theme can serve it at /admin/.
//
// The editor lives in its own repository and is consumed here as a build artifact, which is what
// keeps this theme free of its toolchain.
//
// Three sources are tried in order, so a contributor with a local checkout, a build server, and a
// fresh clone all work: V7_CMS if set, a sibling checkout, then the published CDN artifact pinned
// below. Failing loudly matters — a silent skip produced a page pointing at files that were not
// there, and only the link checker noticed.
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The editor revision this theme ships against.
 *
 * Bump it to pick up editor changes. The version has a matching release in the v7-cms repository,
 * which is where the built bundle lives.
 */
const PINNED_VERSION = '0.3.0';
const RELEASE = `https://github.com/phishinqi/v7-cms/releases/download/v${PINNED_VERSION}`;

const destination = 'public/admin';
const REQUIRED = ['v7-cms.js', 'cms.css'];

/** A local checkout, if one is around. */
function localDist() {
  const candidates = [process.env['V7_CMS'], '../v7-cms/packages/cms/dist', '../v7-cms/dist'];
  for (const candidate of candidates.filter(Boolean)) {
    const path = resolve(candidate);
    if (existsSync(join(path, 'v7-cms.js'))) return path;
    const nested = join(path, 'packages/cms/dist');
    if (existsSync(join(nested, 'v7-cms.js'))) return nested;
  }
  return undefined;
}

async function fromRelease(target) {
  for (const name of REQUIRED) {
    const response = await fetch(`${RELEASE}/${name}`, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Could not fetch ${name} from ${RELEASE} (${response.status}).`);
    }
    await writeFile(join(target, name), Buffer.from(await response.arrayBuffer()));
  }
  return REQUIRED;
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const local = localDist();
let copied;

if (local) {
  copied = (await readdir(local)).filter((name) => /\.(js|css)$/.test(name));
  for (const required of REQUIRED) {
    if (!copied.includes(required)) {
      throw new Error(`${local} is missing ${required}. Build the editor first.`);
    }
  }
  for (const name of copied) await copyFile(join(local, name), join(destination, name));
} else {
  console.log(`No local editor build; fetching v${PINNED_VERSION} from the v7-cms release…`);
  copied = await fromRelease(destination);
}

console.log(`editor ready in ${destination}/ (${copied.join(', ')})`);

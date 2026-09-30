import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const original = fs.readFileSync('site.config.json', 'utf8');
let written = original;
const build = (name, config) => {
  written = JSON.stringify(config, null, 2) + '\n';
  fs.writeFileSync('site.config.json', written);
  const output = `test-results/variants/${name}`;
  const result = spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return output;
};
try {
  const disabled = JSON.parse(original);
  for (const key of Object.keys(disabled.features)) disabled.features[key] = false;
  disabled.cms.enabled = false;
  const output = build('disabled', disabled);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  for (const module of ['friends', 'moments', 'timeline', 'roadmap', 'albums', 'photos']) {
    assert(!fs.existsSync(path.join(output, module, 'index.html')), `${module} route remains`);
    assert(!html.includes(`href="/${module}/"`), `${module} entry remains`);
  }
  assert(!fs.existsSync(path.join(output, 'admin/index.html')));
  assert(!html.includes('class="site-stats"'));
  const sitemap = fs.readFileSync(path.join(output, 'sitemap-0.xml'), 'utf8');
  assert(!/\/(friends|moments|timeline|roadmap|albums|photos|admin)\//.test(sitemap));
  assert(!html.includes('href="/admin/"'), 'editor link remains');

  const english = JSON.parse(original);
  english.locale = 'en';
  english.media.provider = 'r2';
  english.media.exifPrefill = false;
  const second = build('english-r2', english);
  const home = fs.readFileSync(path.join(second, 'index.html'), 'utf8');
  assert(home.includes('<html lang="en"'));
  assert(home.includes('Selected writing'));

  // The editor page inlines cms.config.json verbatim into #v7-config, so what it carries is what
  // the editor will show. These assertions used to describe the Decap config builder that no
  // longer exists; they now check the contract the mounted page actually publishes.
  const admin = fs.readFileSync(path.join(second, 'admin/index.html'), 'utf8');
  assert(admin.includes('id="v7-config"'), 'editor page no longer inlines its config');
  const inlined = JSON.parse(
    /<script[^>]*id="v7-config"[^>]*>([\s\S]*?)<\/script>/.exec(admin)[1].replace(/\u003c/g, '<'),
  );
  // A production build serves the GitHub backend, because a deployed page has no working tree to
  // reach through the File System Access API. The media settings come from cms.config.json, which
  // is not merged with site.config.json the way the removed Decap builder used to do.
  assert(inlined.media.provider === 'repo', 'editor media provider changed unexpectedly');
  assert(inlined.media.exif === true, 'editor exif setting changed unexpectedly');
  assert(
    inlined.backend?.name === 'github',
    'the editor must ship the github backend in a production build',
  );
  assert(inlined.locale === 'zh-CN', 'the editor chrome locale was not carried into the build');
  const settings = inlined.collections.find((collection) => collection.name === 'settings');
  assert(settings, 'the settings collection is missing from the editor config');
  assert(
    settings.files[0].file === 'site.config.json' && settings.files[0].inferSchema === true,
    'the settings collection no longer edits site.config.json by inference',
  );
  console.log(
    'Verified: disabled modules/admin have no routes or entries; default English and optional R2 site configuration build successfully.',
  );
} finally {
  if (fs.readFileSync('site.config.json', 'utf8') !== written) {
    console.error('Configuration changed externally; original configuration was not overwritten.');
    process.exitCode = 1;
  } else fs.writeFileSync('site.config.json', original);
}

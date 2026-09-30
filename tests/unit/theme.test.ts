import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  validateCategoryTree,
  categoryAncestors,
  isInCategory,
  siteConfig,
} from '../../src/site.config';
import { postSchema } from '../../src/lib/post-schema';
import { moduleSchema } from '../../src/lib/module-schema';
const label = { 'zh-CN': '示例', en: 'Example' };
describe('theme content contract', () => {
  it('rejects category cycles and dangling parents', () => {
    const item = { title: label, description: label };
    expect(() =>
      validateCategoryTree({ a: { ...item, parent: 'b' }, b: { ...item, parent: 'a' } }),
    ).toThrow(/cycle/);
    expect(() => validateCategoryTree({ a: { ...item, parent: 'missing' } })).toThrow(
      /Unknown parent/,
    );
    expect(() => validateCategoryTree({ a: { ...item, parent: 'constructor' } })).toThrow(
      /Unknown parent/,
    );
    expect(() =>
      validateCategoryTree({ a: item, b: { ...item, parent: 'a' }, c: { ...item, parent: 'b' } }),
    ).not.toThrow();
  });
  it('preserves category identity independently of file directories', () => {
    expect(categoryAncestors('technology')).toEqual(['technology']);
    expect(isInCategory('technology', 'technology')).toBe(true);
    expect(isInCategory('journal', 'technology')).toBe(false);
  });
  it('validates authors and supports remote cover images', () => {
    const base = {
      title: 'Test',
      description: 'Test',
      slug: 'test',
      pubDate: '2026-01-01',
      category: 'technology',
    };
    expect(postSchema.parse(base).authors).toEqual([siteConfig.defaultAuthor]);
    expect(() => postSchema.parse({ ...base, authors: ['missing'] })).toThrow();
    expect(() => postSchema.parse({ ...base, authors: ['constructor'] })).toThrow();
    expect(() => postSchema.parse({ ...base, authors: ['v7', 'v7'] })).toThrow();
    expect(
      postSchema.parse({
        ...base,
        cover: {
          src: 'https://img.example.com/test.webp',
          alt: 'Example',
          width: 1200,
          height: 800,
        },
      }).cover?.focal,
    ).toBe('50% 50%');
    expect(() =>
      postSchema.parse({
        ...base,
        cover: { src: 'javascript:alert(1)', alt: 'Example', width: 1200, height: 800 },
      }),
    ).toThrow();
  });
  it('describes every content folder the theme has', () => {
    const cms = JSON.parse(readFileSync('cms.config.json', 'utf8')) as {
      collections: Array<{ name: string; kind: string; folder?: string }>;
    };
    const folders = cms.collections
      .filter((collection) => collection.kind === 'fields' && collection.folder)
      .map((collection) => collection.folder!);
    for (const folder of folders) {
      expect(existsSync(folder), `${folder} is named in cms.config.json but does not exist`).toBe(
        true,
      );
    }
    // The album collection is the reason this editor exists; losing it would be silent otherwise.
    expect(cms.collections.some((collection) => collection.name === 'albums')).toBe(true);
  });
  it('requires valid module dates, statuses and gallery descriptions', () => {
    expect(() =>
      moduleSchema.parse({ title: 'Example', slug: 'example', date: 'invalid' }),
    ).toThrow();
    expect(() =>
      moduleSchema.parse({
        title: 'Example',
        slug: 'example',
        date: '2026-01-01',
        status: 'unknown',
      }),
    ).toThrow();
    expect(() =>
      moduleSchema.parse({
        title: 'Example',
        slug: 'example',
        date: '2026-01-01',
        images: [{ src: '/image.png', alt: '', width: 1, height: 1 }],
      }),
    ).toThrow();
  });
});

describe('the template guard', () => {
  it('is present, because a copy that skips setup would publish under someone else', async () => {
    // The failure this prevents is invisible locally and permanent once deployed: a copy arrives
    // with the template author's siteURL, so its canonical URLs, RSS and sitemap would all name
    // that domain, and the editor would write to their repository.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(resolve('src/site.config.ts'), 'utf8');
    expect(source).toContain('has not been set up yet');
    // The override exists so the template itself can be built from an export with no remote.
    expect(source).toContain('V7_TEMPLATE_BUILD');
    // Two signals, and the reason for each is not obvious — the remote alone blocked a copy whose
    // owner had pointed it at their own repository, and the marker alone blocked this repository.
    expect(source).toContain('MARKER');
    expect(source).toContain('TEMPLATE_REMOTE');
    expect(source).toContain('remoteIsThisRepository');
  });

  it('ships the marker that makes the guard apply to copies', async () => {
    // Committed, so every copy has one; `pnpm bootstrap` deletes it. Without the file in the
    // repository, a copy would have nothing to trip the guard.
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    // `pnpm bootstrap` removes the marker from a configured copy. The source repository must ship
    // it, while a copy that has completed setup must be allowed to run this same contract suite.
    expect(
      existsSync(resolve('this-repository-is-a-template')) ||
        siteConfig.siteURL !== 'https://v7.soyonagasaki.com',
    ).toBe(true);
  });

  it('ships a setup script that rewrites identity and clears the guard', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const script = await readFile(resolve('scripts/bootstrap.mjs'), 'utf8');
    // Every field a copy inherits from the template.
    for (const field of ['siteURL', 'defaultAuthor', 'socialLinks']) {
      expect(script, `setup must rewrite ${field}`).toContain(field);
    }
    // Content names authors explicitly and the schema rejects an unknown one, so a rename without
    // this leaves posts pointing at an id that no longer exists.
    expect(script).toContain('authors:');
    // Deleting the marker is what lets the build run; without it a configured site stays blocked.
    expect(script).toContain('rm(resolve(MARKER)');
    // The sample author links to this template's repository, and that link reaches every copy's
    // author page — a link back to the template presented as the site owner's own.
    expect(script).toContain('astro-theme-v7');
    // `wrangler.toml` names the template's repository and its OAuth client id. A copy that kept
    // them would sign its authors in through somebody else's OAuth app, and the relay would check
    // write access to somebody else's repository.
    expect(script).toContain('wrangler.toml');
    expect(script).toContain('GITHUB_CLIENT_ID');
    // A site may have one author or several. Setup must rename the default author without deleting
    // valid coauthor references from sample or user content.
    expect(script).not.toContain("id !== 'guest'");
  });

  it('ships a placeholder rather than a real OAuth client id', async () => {
    // A real-looking client id in a template is worse than an obvious placeholder: a copy would
    // silently authenticate against an app it does not own.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const wrangler = await readFile(resolve('wrangler.toml'), 'utf8');
    const clientId = /^GITHUB_CLIENT_ID = "([^"]*)"/m.exec(wrangler)?.[1];
    expect(clientId).toBe('replace-with-oauth-client-id');
  });

  it('does not name a script that pnpm owns', async () => {
    // `pnpm setup` is a pnpm command — it installs pnpm itself — and it shadows a script of that
    // name, so `pnpm setup --url …` printed pnpm's usage instead of running this repository's
    // script. The documented command never worked.
    //
    // The check runs pnpm from a directory with no package.json, where nothing can shadow it, so
    // the answer is pnpm's own. Two details that made earlier attempts pass while checking
    // nothing: pnpm needs `shell: true` on Windows (a shim, not an executable), and running inside
    // the project means a script of the same name answers instead of pnpm.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const { spawnSync } = await import('node:child_process');
    const { tmpdir } = await import('node:os');
    const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    const pnpmSays = (name: string): string | undefined => {
      const result = spawnSync('pnpm', [`${name}`, '--help'], {
        cwd: tmpdir(),
        encoding: 'utf8',
        shell: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return result.status === 0 ? (result.stdout ?? '') : undefined;
    };

    // Sanity: the probe must find a command pnpm definitely owns, or it is measuring nothing.
    expect(pnpmSays('setup'), 'the probe cannot see pnpm builtins').toBeDefined();

    for (const name of Object.keys(packageJson.scripts)) {
      const help = pnpmSays(name);
      if (help === undefined) continue;
      // A command whose help says it runs the package's script is delegating, which is fine.
      const delegates = /runs (a package's|the) ["']?[\w:-]+["']? script/i.test(help);
      expect(
        delegates,
        `\`pnpm ${name}\` is a pnpm command that does not delegate to scripts, so it shadows ` +
          `scripts.${name}. Rename the script.`,
      ).toBe(true);
    }
  });

  it('documents how to obtain the theme', async () => {
    // The README used to start at `pnpm install`, which presumes you already have the repository.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const readme = await readFile(resolve('README.md'), 'utf8');
    expect(readme).toContain('Use this template');
    expect(readme).toContain('pnpm bootstrap');
  });
});

describe('the bootstrap command', () => {
  it('strips the separator pnpm forwards, so its flags survive parsing', async () => {
    // `pnpm bootstrap -- --url x` reaches the script as ['--', '--url', 'x'], and `parseArgs`
    // treats everything after a bare `--` as positional — so every flag was dropped and the script
    // reported success while changing nothing. That looks like it worked, and is worse than an
    // error. Reproduced here rather than by running the script, which writes to the repository.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const { parseArgs } = await import('node:util');

    const source = await readFile(resolve('scripts/bootstrap.mjs'), 'utf8');
    // The script must do this, or the flags never arrive.
    expect(source).toContain('indexOf');
    expect(source).toContain('separator');

    // And the fix has to actually work against the real parser.
    const argv = ['--', '--url', 'https://example.test', '--author', 'someone'];
    const separator = argv.indexOf('--');
    const flags = [...argv.slice(0, separator), ...argv.slice(separator + 1)];
    const parsed = parseArgs({
      args: flags,
      options: { url: { type: 'string' }, author: { type: 'string' } },
    });
    expect(parsed.values).toEqual({ url: 'https://example.test', author: 'someone' });
  });

  it('is not the pnpm builtin it used to be called after', async () => {
    // The command was `pnpm setup` until it turned out pnpm owns that name. Whichever name is
    // chosen, the documented one must be the one package.json defines.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const readme = await readFile(resolve('README.md'), 'utf8');
    const documented = /pnpm ([a-z:]+) -- --url/.exec(readme)?.[1];
    expect(documented, 'the README must show the command').toBeTruthy();
    expect(packageJson.scripts[documented!], `scripts.${documented} must exist`).toBeTruthy();
  });
});

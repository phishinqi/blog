import * as pagefind from 'pagefind';
import { mkdir, writeFile } from 'node:fs/promises';

function check(errors) {
  if (errors?.length) throw new Error(errors.join('\n'));
}
try {
  // One Chinese segmentation index covers mixed Chinese and English articles.
  // Keep article lang attributes intact for accessibility and screen readers.
  const { index, errors } = await pagefind.createIndex({ forceLanguage: 'zh', verbose: false });
  check(errors);
  if (!index) throw new Error('Pagefind did not create an index.');
  const added = await index.addDirectory({ path: 'dist', glob: 'posts/*/index.html' });
  check(added.errors);
  const written = await index.writeFiles({ outputPath: 'dist/pagefind' });
  check(written.errors);
  await mkdir('dist/pagefind', { recursive: true });
  await writeFile('dist/pagefind/status.json', JSON.stringify({ articles: added.page_count }));
  console.log(`Pagefind: indexed ${added.page_count} article pages.`);
} finally {
  await pagefind.close();
}

export interface SearchResult {
  url: string;
  title: string;
  excerpt: string;
  category?: string;
}
interface RawResult {
  url: string;
  meta: { title?: string; category?: string };
  excerpt: string;
}
interface PagefindHit {
  id: string;
  data(): Promise<RawResult>;
}
interface PagefindEngine {
  destroy(): Promise<void>;
  options(options: { baseUrl: string }): Promise<void>;
  search(query: string, options?: { language?: string }): Promise<{ results: PagefindHit[] }>;
}
let importAttempt = 0;
let enginePromise: Promise<PagefindEngine> | undefined;
export async function getSearchEngine(): Promise<PagefindEngine> {
  if (!enginePromise) {
    const bundle = `/pagefind/pagefind.js${importAttempt ? `?retry=${importAttempt}` : ''}`;
    enginePromise = import(/* @vite-ignore */ bundle)
      .then(async (module: PagefindEngine) => {
        await module.options({ baseUrl: '/' });
        return module;
      })
      .catch((error: unknown) => {
        enginePromise = undefined;
        importAttempt++;
        throw error;
      });
  }
  return enginePromise;
}
export function stripHighlight(html: string): string {
  // Pagefind excerpts are rendered as React text, never unsanitized HTML.
  const document = new DOMParser().parseFromString(html, 'text/html');
  return document.body.textContent || '';
}
export type { PagefindHit };

export async function resetSearchEngine() {
  const previous = enginePromise;
  enginePromise = undefined;
  if (previous) {
    try {
      await (await previous).destroy();
    } catch {
      /* The next query will initialize a fresh engine. */
    }
  }
}

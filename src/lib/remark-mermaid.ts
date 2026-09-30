import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

// Rendered in the browser, so Shiki must leave them alone. Add a language here to make it
// available as a fenced block (see src/scripts/article.ts for the renderers).
export const diagramLanguages = ['mermaid', 'abc'] as const;

// Preserve a real fenced code block for no-JS/failure fallback. HAST metadata
// survives Markdown and MDX compilation; exclude these languages from Shiki.
export default function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, 'code', (node) => {
      if (!diagramLanguages.includes(node.lang as (typeof diagramLanguages)[number])) return;
      node.data = {
        ...node.data,
        hProperties: { 'data-diagram-source': node.lang, 'data-diagram-lang': node.lang },
      };
    });
  };
}

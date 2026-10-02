import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

export default function rehypeHeadingInk() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (!/^h[1-4]$/.test(node.tagName)) return;
      node.children = [
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['heading-ink'] },
          children: node.children,
        },
      ];
    });
  };
}

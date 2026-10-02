import { currentUI } from '../i18n/client';
const ui = new Proxy({} as ReturnType<typeof currentUI>, {
  get: (_target, key) => currentUI()[key as keyof ReturnType<typeof currentUI>],
});

const article = document.querySelector<HTMLElement>('#article-body');
article?.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
  if (pre.querySelector('[data-diagram-lang]')) return;
  const code = pre.querySelector('code');
  if (!code) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block';
  pre.before(wrapper);
  wrapper.append(pre);
  const button = document.createElement('button');
  button.className = 'copy-button';
  button.type = 'button';
  button.textContent = ui.copy;
  button.setAttribute('aria-live', 'polite');
  button.setAttribute('data-pagefind-ignore', 'all');
  wrapper.append(button);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent || '');
      button.textContent = ui.copied;
    } catch {
      button.textContent = ui.copyError;
    }
    setTimeout(() => {
      button.textContent = ui.copy;
    }, 2200);
  });
});
document
  .querySelectorAll<HTMLElement>(
    '.article-heading h1[id], #article-body h1[id], #article-body h2[id], #article-body h3[id], #article-body h4[id]',
  )
  .forEach((heading) => {
    const ink = heading.querySelector<HTMLElement>(':scope > .heading-ink');
    if (!ink) return;
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${heading.id}`;
    anchor.setAttribute('data-pagefind-ignore', 'all');
    if (ink.querySelector('a')) {
      anchor.classList.add('sr-only');
      anchor.textContent = `${heading.textContent || 'Heading'} - link`;
      heading.prepend(anchor);
      return;
    }
    ink.replaceWith(anchor);
    anchor.append(ink);
  });

interface Diagram {
  lang: string;
  source: string;
  output: HTMLElement;
  fallback: HTMLDetailsElement;
  figure: HTMLElement;
  renderedTheme?: string;
  visible: boolean;
}

/**
 * One entry per fenced language. `draw` receives the visible width so a renderer can lay itself
 * out, and must return the element to insert. Adding a diagram language means adding an entry
 * here, plus its name in diagramLanguages (src/lib/remark-mermaid.ts) so Shiki skips it.
 */
const renderers: Record<
  string,
  (output: HTMLElement, source: string, theme: string) => Promise<void>
> = {
  async mermaid(output, source, theme) {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'sans-serif',
      suppressErrorRendering: true,
    });
    const { svg } = await mermaid.render(`v7-diagram-${counter++}`, source);
    output.innerHTML = svg; // Mermaid sanitizes SVG in strict security mode.
    const rendered = output.querySelector('svg');
    if (!rendered) return;
    rendered.removeAttribute('height');
    rendered.setAttribute('aria-label', ui.diagramLabel);
    const width = rendered.viewBox.baseVal.width;
    if (Number.isFinite(width) && width > 0) {
      // Preserve readable labels; the focusable container scrolls on narrow screens.
      rendered.style.width = `${width}px`;
      rendered.style.maxWidth = 'none';
    }
  },
  // ABC notation for music. Scores are vector SVG; abcjs sizes them to the container.
  async abc(output, source) {
    const { default: abcjs } = await import('abcjs');
    output.replaceChildren();
    abcjs.renderAbc(output, source, {
      responsive: 'resize',
      staffwidth: Math.max(240, Math.min(720, output.clientWidth || 640)),
      add_classes: true,
      ariaLabel: ui.diagramLabel,
    });
    if (!output.querySelector('svg')) throw new Error('abcjs produced no output');
  },
};
let counter = 0;

const diagrams: Diagram[] = [];
article?.querySelectorAll<HTMLElement>('code[data-diagram-lang]').forEach((code) => {
  const pre = code.closest('pre');
  const lang = code.dataset.diagramLang || '';
  if (!pre || !renderers[lang]) return;
  const figure = document.createElement('figure');
  figure.className = `diagram diagram-${lang}`;
  const output = document.createElement('div');
  output.className = 'diagram-output';
  output.tabIndex = 0;
  output.setAttribute('role', 'img');
  output.setAttribute('aria-label', ui.diagramLabel);
  output.setAttribute('data-pagefind-ignore', 'all');
  const fallback = document.createElement('details');
  fallback.className = 'diagram-source';
  fallback.open = true;
  const summary = document.createElement('summary');
  summary.textContent = ui.diagramSource;
  pre.before(figure);
  fallback.append(summary, pre);
  figure.append(output, fallback);
  diagrams.push({ lang, source: code.textContent || '', output, fallback, figure, visible: false });
});

let queue = Promise.resolve();
async function renderVisible() {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
  const pending = diagrams.filter((diagram) => diagram.visible && diagram.renderedTheme !== theme);
  if (!pending.length) return;
  for (const diagram of pending) {
    try {
      await renderers[diagram.lang]!(diagram.output, diagram.source, theme);
      diagram.fallback.open = false;
      diagram.renderedTheme = theme;
      diagram.figure.querySelector('.diagram-error')?.remove();
    } catch {
      showError(diagram);
    }
  }
}
function showError(diagram: Diagram) {
  diagram.output.replaceChildren();
  diagram.fallback.open = true;
  if (!diagram.figure.querySelector('.diagram-error')) {
    const message = document.createElement('p');
    message.className = 'diagram-error';
    message.textContent = ui.diagramError;
    diagram.figure.prepend(message);
  }
}
function enqueue() {
  queue = queue.then(renderVisible).catch(() => {
    /* Keep future theme changes retryable. */
  });
}
if (diagrams.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const diagram = diagrams.find((item) => item.figure === entry.target);
          if (diagram) diagram.visible = true;
          observer.unobserve(entry.target);
        }
      }
      enqueue();
    },
    { rootMargin: '200px' },
  );
  diagrams.forEach((diagram) => observer.observe(diagram.figure));
  window.addEventListener('v7:theme', enqueue);
}

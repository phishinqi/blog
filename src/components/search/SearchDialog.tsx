import { useEffect, useRef, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import type { UI } from '../../i18n/ui';
import SearchPanel from './SearchPanel';
import { useLabels } from './useLabels';

export default function SearchDialog({ labels: initialLabels }: { labels: UI }) {
  const labels = useLabels(initialLabels);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const open = (trigger?: HTMLElement) => {
      if (dialog.open) return;
      triggerRef.current = trigger || (document.activeElement as HTMLElement);
      setMounted(true);
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      // Wait for React to mount the shared search panel before moving focus.
      requestAnimationFrame(() => dialog.querySelector<HTMLInputElement>('input')?.focus());
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        void import('gsap').then(({ gsap }) => {
          if (dialog.open)
            gsap.fromTo(
              dialog,
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'all' },
            );
        });
    };
    const click = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
        return;
      const trigger = (event.target as Element).closest<HTMLElement>('[data-search-trigger]');
      if (!trigger) return;
      event.preventDefault();
      open(trigger);
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
      if (event.key === 'Tab' && dialog.open) {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]'),
        ).filter((el) => el.getClientRects().length);
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const closed = () => {
      document.body.style.overflow = '';
      triggerRef.current?.focus();
    };
    const backdrop = (event: MouseEvent) => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          dialog.close();
      }
    };
    document.addEventListener('click', click);
    document.addEventListener('keydown', keydown);
    dialog.addEventListener('close', closed);
    dialog.addEventListener('click', backdrop);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', keydown);
      dialog.removeEventListener('close', closed);
      dialog.removeEventListener('click', backdrop);
      document.body.style.overflow = '';
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      aria-labelledby="search-dialog-title"
      data-react-ui
    >
      <div className="search-dialog-top">
        <h2 id="search-dialog-title">{labels.search}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={labels.closeSearch}
          onClick={() => dialogRef.current?.close()}
        >
          <IconX size={18} stroke={1.5} aria-hidden="true" />
        </button>
      </div>
      {mounted && <SearchPanel labels={labels} />}
    </dialog>
  );
}

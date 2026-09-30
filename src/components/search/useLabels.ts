import { useSyncExternalStore } from 'react';
import { dictionaries, type UI } from '../../i18n/ui';
const subscribe = (notify: () => void) => {
  window.addEventListener('v7:locale', notify);
  return () => window.removeEventListener('v7:locale', notify);
};
export function useLabels(fallback: UI) {
  return useSyncExternalStore(
    subscribe,
    () => dictionaries[document.documentElement.lang === 'en' ? 'en' : 'zh-CN'],
    () => fallback,
  );
}

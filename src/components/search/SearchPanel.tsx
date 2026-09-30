import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { IconSearch, IconArrowUpRight } from '@tabler/icons-react';
import type { UI } from '../../i18n/ui';
import { useLabels } from './useLabels';
import {
  getSearchEngine,
  resetSearchEngine,
  stripHighlight,
  type SearchResult,
} from '../../lib/pagefind';

interface Props {
  labels: UI;
  standalone?: boolean;
}
function subscribeLocation(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener('v7:search-query', callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('v7:search-query', callback);
  };
}
const locationQuery = () => new URLSearchParams(location.search).get('q') || '';
const serverQuery = () => '';
interface SearchState {
  key: string;
  results: SearchResult[];
  total: number;
  status: 'ready' | 'error';
}
export default function SearchPanel({ labels: initialLabels, standalone = false }: Props) {
  const labels = useLabels(initialLabels);
  const inputId = useId();
  const urlQuery = useSyncExternalStore(subscribeLocation, locationQuery, serverQuery);
  const [localQuery, setLocalQuery] = useState('');
  const query = standalone ? urlQuery : localQuery;
  const [limit, setLimit] = useState(8);
  const [retry, setRetry] = useState(0);
  const [settled, setSettled] = useState<SearchState | null>(null);
  const trimmed = query.trim();
  const key = JSON.stringify([trimmed, limit, retry]);
  const status = !trimmed ? 'idle' : settled?.key === key ? settled.status : 'loading';
  const results = settled?.key === key ? settled.results : [];
  const total = settled?.key === key ? settled.total : 0;
  const setQuery = (value: string) => {
    if (!standalone) {
      setLocalQuery(value);
      return;
    }
    const url = new URL(location.href);
    if (value) url.searchParams.set('q', value);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
    window.dispatchEvent(new Event('v7:search-query'));
  };
  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const engine = await getSearchEngine();
        const response = await engine.search(trimmed);
        if (cancelled) return;
        const data = await Promise.all(response.results.slice(0, limit).map((hit) => hit.data()));
        if (cancelled) return;
        setSettled({
          key,
          results: data.map((item) => ({
            url: item.url,
            title: item.meta.title || item.url,
            excerpt: stripHighlight(item.excerpt),
            category: item.meta.category,
          })),
          total: response.results.length,
          status: 'ready',
        });
      } catch {
        if (!cancelled) setSettled({ key, results: [], total: 0, status: 'error' });
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, limit, key]);

  return (
    <section className="search-panel" aria-label={labels.search}>
      <div className="search-field">
        <IconSearch size={21} stroke={1.5} aria-hidden="true" />
        <label className="sr-only" htmlFor={inputId}>
          {labels.search}
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(8);
          }}
          placeholder={labels.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={160}
        />
      </div>
      <div aria-live="polite" aria-atomic="true">
        {status === 'idle' && <p className="search-status">{labels.searchPrompt}</p>}
        {status === 'loading' && <p className="search-status">{labels.searchLoading}</p>}
        {status === 'ready' && total === 0 && <p className="search-status">{labels.searchEmpty}</p>}
        {status === 'ready' && total > 0 && (
          <p className="search-count">
            {total} {labels.searchResults}
          </p>
        )}
        {status === 'error' && (
          <div className="search-status">
            <p>{import.meta.env.DEV ? labels.searchDev : labels.searchError}</p>
            <button
              className="text-link"
              onClick={async () => {
                await resetSearchEngine();
                setRetry((n) => n + 1);
              }}
              type="button"
            >
              {labels.retry} →
            </button>
          </div>
        )}
      </div>
      {status === 'ready' && results.length > 0 && (
        <ul className="search-results">
          {results.map((result) => (
            <li className="search-result" key={result.url}>
              <a href={result.url}>
                <h3>{result.title}</h3>
                <p>{result.excerpt}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
      {status === 'ready' && total > results.length && (
        <button className="text-link mt-5" type="button" onClick={() => setLimit((n) => n + 8)}>
          {labels.searchMore} ↓
        </button>
      )}
      {!standalone && (
        <div className="search-footer">
          <span>
            <kbd>Esc</kbd> {labels.close}
          </span>
          <a href={`/search/${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`}>
            {labels.searchOpenPage}{' '}
            <IconArrowUpRight className="inline-block" size={13} aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  );
}

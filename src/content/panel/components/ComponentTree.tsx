import { useEffect, useMemo } from 'react';
import { setFindMatches, setHovered, setSelected } from '../../highlighter';
import { useStore } from '../store';
import { SearchBar } from './SearchBar';

export function ComponentTree() {
  const components = useStore((s) => s.components);
  const selected = useStore((s) => s.selected);
  const search = useStore((s) => s.search);
  const setSelectedStore = useStore((s) => s.setSelected);
  const find = useStore((s) => s.find);
  const setFind = useStore((s) => s.setFind);

  const filtered = useMemo(() => {
    if (!search.trim()) return components;
    const needle = search.toLowerCase();
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.displayName.toLowerCase().includes(needle) ||
        c.uri.toLowerCase().includes(needle) ||
        (c.instance?.toLowerCase().includes(needle) ?? false)
    );
  }, [components, search]);

  // Sync find query with the search box and apply page-wide dim/match styling.
  useEffect(() => {
    if (find.query !== search) {
      setFind({ query: search, index: 0 });
    }
    const all = components.map((c) => c.element);
    setFindMatches(all, search.trim() ? new Set(filtered.map((c) => c.element)) : null);
    return () => setFindMatches(all, null);
  }, [search, find.query, components, filtered, setFind]);

  const jumpTo = (delta: 1 | -1) => {
    if (filtered.length === 0) return;
    const next = (find.index + delta + filtered.length) % filtered.length;
    setFind({ query: search, index: next });
    const target = filtered[next];
    if (!target) return;
    setSelected(selected?.element ?? null, target.element);
    setSelectedStore(target);
    target.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section className="cs-section">
      <SearchBar
        onEnter={() => jumpTo(1)}
        onShiftEnter={() => jumpTo(-1)}
        onEscape={() => useStore.getState().setSearch('')}
      />
      {search.trim() && (
        <div className="cs-find-status">
          {filtered.length === 0 ? (
            <span>0 matches</span>
          ) : (
            <>
              <span>
                {find.index + 1} / {filtered.length} matches
              </span>
              <div className="cs-find-actions">
                <button
                  className="cs-link"
                  onClick={() => jumpTo(-1)}
                  title="Previous (Shift+Enter)"
                >
                  ↑
                </button>
                <button className="cs-link" onClick={() => jumpTo(1)} title="Next (Enter)">
                  ↓
                </button>
                <button
                  className="cs-link"
                  onClick={() => useStore.getState().setSearch('')}
                  title="Clear (Esc)"
                >
                  ×
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <ul className="cs-tree" style={{ marginTop: 8 }}>
        {filtered.length === 0 && <li className="cs-empty">No matching components</li>}
        {filtered.map((info, idx) => {
          const isSelected = selected?.element === info.element;
          const isCurrentMatch = search.trim() && idx === find.index;
          return (
            <li
              key={info.uri + info.element.tagName}
              className={`cs-tree-item ${isSelected ? 'cs-selected' : ''} ${isCurrentMatch ? 'cs-current-match' : ''}`}
              style={{ paddingLeft: 6 + info.depth * 12 }}
              onClick={() => {
                setSelected(selected?.element ?? null, info.element);
                setSelectedStore(info);
                info.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              onMouseEnter={() => setHovered(null, info.element)}
              onMouseLeave={() => setHovered(info.element, null)}
            >
              <span>{info.displayName}</span>
              {info.instance && (
                <span className="cs-tree-instance">· {info.instance.slice(0, 8)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

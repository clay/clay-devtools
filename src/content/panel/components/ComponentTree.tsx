import { useMemo } from 'react';
import { setHovered, setSelected } from '../../highlighter';
import { useStore } from '../store';
import { SearchBar } from './SearchBar';

export function ComponentTree() {
  const components = useStore((s) => s.components);
  const selected = useStore((s) => s.selected);
  const search = useStore((s) => s.search);
  const setSelectedStore = useStore((s) => s.setSelected);

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

  return (
    <section className="cs-section">
      <SearchBar />
      <ul className="cs-tree" style={{ marginTop: 8 }}>
        {filtered.length === 0 && <li className="cs-empty">No matching components</li>}
        {filtered.map((info) => {
          const isSelected = selected?.element === info.element;
          return (
            <li
              key={info.uri + info.element.tagName}
              className={`cs-tree-item ${isSelected ? 'cs-selected' : ''}`}
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

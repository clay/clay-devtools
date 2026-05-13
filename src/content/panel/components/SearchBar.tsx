import { useStore } from '../store';

export function SearchBar() {
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);

  return (
    <input
      type="search"
      className="cs-search"
      placeholder="Filter components by name or instance…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  );
}

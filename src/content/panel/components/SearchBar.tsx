import type { KeyboardEvent } from 'react';
import { useStore } from '../store';

interface Props {
  onEnter?: () => void;
  onShiftEnter?: () => void;
  onEscape?: () => void;
}

export function SearchBar({ onEnter, onShiftEnter, onEscape }: Props = {}) {
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onShiftEnter?.();
      else onEnter?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscape?.();
    }
  };

  return (
    <input
      type="search"
      className="cs-search"
      placeholder="Filter components — Enter to jump, Esc to clear"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

import { useStore } from '../store';
import { savePreferences } from '@/lib/storage';
import type { Environment } from '@/lib/types';

const ENVIRONMENTS: Array<{ id: Environment; label: string }> = [
  { id: 'local', label: 'local' },
  { id: 'dev', label: 'dev' },
  { id: 'staging', label: 'staging' },
  { id: 'prod', label: 'prod' },
];

export function EnvironmentSwitcher() {
  const env = useStore((s) => s.preferences.defaultEnvironment);
  const setPrefs = useStore((s) => s.setPreferences);

  const cycle = () => {
    const idx = ENVIRONMENTS.findIndex((e) => e.id === env);
    const next = ENVIRONMENTS[(idx + 1) % ENVIRONMENTS.length]!;
    setPrefs({ defaultEnvironment: next.id });
    void savePreferences({ defaultEnvironment: next.id });
  };

  return (
    <button className="cs-env-pill" onClick={cycle} title="Cycle environment">
      env: {env}
    </button>
  );
}

import { useStore } from '../store';
import { savePreferences } from '@/lib/storage';
import { ENVIRONMENT_LABELS, ENVIRONMENT_ORDER } from '@/lib/types';

export function EnvironmentSwitcher() {
  const env = useStore((s) => s.preferences.defaultEnvironment);
  const host = useStore((s) => s.preferences.environments[env]);
  const setPrefs = useStore((s) => s.setPreferences);

  const cycle = () => {
    const idx = ENVIRONMENT_ORDER.indexOf(env);
    const next = ENVIRONMENT_ORDER[(idx + 1) % ENVIRONMENT_ORDER.length]!;
    setPrefs({ defaultEnvironment: next });
    void savePreferences({ defaultEnvironment: next });
  };

  const isConfigured = Boolean(host?.trim());

  return (
    <button
      className={`cs-env-pill ${isConfigured ? 'cs-env-pill-active' : ''}`}
      onClick={cycle}
      title={
        isConfigured
          ? `All links + fetches use ${host}. Click to cycle.`
          : `No host configured for ${ENVIRONMENT_LABELS[env]}. Open Settings to add one.`
      }
    >
      env: {env}
      {isConfigured ? '' : ' (unset)'}
    </button>
  );
}

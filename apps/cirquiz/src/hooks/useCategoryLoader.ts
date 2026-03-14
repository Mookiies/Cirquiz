import { useState } from 'react';
import { getProvider } from '../providers/providerFactory';
import { useSettingsStore } from '../state/settingsStore';

export function useCategoryLoader() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const source = useSettingsStore.getState().questionSource;
      setCategories(await getProvider(source).fetchCategories());
    } catch (e) {
      console.warn('Failed to load categories:', e);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, load };
}

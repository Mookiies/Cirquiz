import { useState } from 'react';
import { OpenTriviaDbProvider } from '../providers';

export function useCategoryLoader() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setCategories(await new OpenTriviaDbProvider().fetchCategories());
    } catch (e) {
      console.warn('Failed to load categories:', e);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, load };
}

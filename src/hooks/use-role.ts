import { ref, onValue } from 'firebase/database';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';

export function useRole(uid: string | undefined) {
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setRole(null);

    if (!uid) {
      setLoading(false);
      return;
    }

    const roleRef = ref(db, `users/${uid}/role`);
    const unsubscribe = onValue(roleRef, (snapshot) => {
      if (!active) return;
      setRole(snapshot.val() ?? 'user');
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid]);

  return { role, loading };
}

import { useState, useCallback } from 'react';
import {
  deviceContactsService,
  ContactMatch,
  ContactsSyncManager,
} from '../services/device-contacts.service';

interface SyncProgress {
  current: number;
  total: number;
  percentage: number;
}

export function useContactsSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [syncManager, setSyncManager] = useState<ContactsSyncManager | null>(null);

  const requestPermission = useCallback(async () => {
    const granted = await deviceContactsService.requestPermission();
    setHasPermission(granted);
    return granted;
  }, []);

  const checkPermission = useCallback(async () => {
    const granted = await deviceContactsService.hasPermission();
    setHasPermission(granted);
    return granted;
  }, []);

  const startSync = useCallback(async () => {
    setError(null);
    setMatches([]);
    setProgress(null);

    const granted = await requestPermission();
    if (!granted) {
      setError('Se requiere permiso para acceder a los contactos');
      return [];
    }

    setIsSyncing(true);
    try {
      const manager = deviceContactsService.createSyncManager();
      setSyncManager(manager);

      const results = await manager.syncAllContacts((p) => {
        setProgress({ current: p.current, total: p.total, percentage: Math.round((p.current / p.total) * 100) });
        setMatches((prev) => [...prev, ...p.matches]);
      });

      setMatches(results);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error syncing contacts');
      return [];
    } finally {
      setIsSyncing(false);
      setSyncManager(null);
    }
  }, [requestPermission]);

  const cancelSync = useCallback(() => {
    setIsSyncing(false);
    setSyncManager(null);
  }, []);

  return { isSyncing, progress, matches, error, hasPermission, requestPermission, checkPermission, startSync, cancelSync };
}

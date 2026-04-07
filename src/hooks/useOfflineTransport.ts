import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  cacheEleves,
  getCachedEleve,
  getCachedElevesCount,
  getLastSyncTime,
  addPendingScan,
  getPendingScans,
  markScanSynced,
  clearSyncedScans,
  getAllQueueScans,
  type CachedEleve,
  type PendingScan,
} from '@/lib/offlineStorage';

export function useOfflineTransport() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedCount, setCachedCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track online/offline
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Load cached stats
  const refreshStats = useCallback(async () => {
    try {
      const [count, sync, pending] = await Promise.all([
        getCachedElevesCount(),
        getLastSyncTime(),
        getPendingScans(),
      ]);
      setCachedCount(count);
      setLastSync(sync);
      setPendingCount(pending.length);
    } catch {
      // IndexedDB not available
    }
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  // Download all transport students to IndexedDB
  const downloadEleves = useCallback(async () => {
    if (!navigator.onLine) {
      toast({ title: 'Hors ligne', description: 'Connectez-vous pour télécharger les données', variant: 'destructive' });
      return;
    }
    setIsCaching(true);
    try {
      // Fetch all transport students
      const { data: eleves, error: eErr } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, zone_transport_id, photo_url, classes(nom), zones_transport:zone_transport_id(nom)')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .is('deleted_at', null);
      if (eErr) throw eErr;

      // Fetch active recharges
      const { data: recharges, error: rErr } = await supabase
        .from('recharges_transport')
        .select('id, eleve_id, actif, date_expiration')
        .eq('actif', true)
        .gte('date_expiration', new Date().toISOString());
      if (rErr) throw rErr;

      const rechargeMap = new Map<string, string>();
      for (const r of (recharges || [])) {
        rechargeMap.set(r.eleve_id, r.id);
      }

      const cached: CachedEleve[] = (eleves || [])
        .filter((e: any) => e.matricule)
        .map((e: any) => ({
          id: e.id,
          matricule: e.matricule!,
          nom: e.nom,
          prenom: e.prenom,
          zone_transport_id: e.zone_transport_id,
          classe_nom: (e.classes as any)?.nom || null,
          zone_nom: (e.zones_transport as any)?.nom || null,
          photo_url: e.photo_url,
          has_active_recharge: rechargeMap.has(e.id),
          recharge_id: rechargeMap.get(e.id) || null,
        }));

      await cacheEleves(cached);
      await refreshStats();
      toast({ title: '✅ Cache mis à jour', description: `${cached.length} élèves téléchargés pour le mode hors ligne` });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setIsCaching(false);
    }
  }, [toast, refreshStats]);

  // Validate scan offline
  const validateOffline = useCallback(async (matricule: string): Promise<{ success: boolean; eleve?: CachedEleve; message: string; status: 'valid' | 'invalid' | 'not_found' | 'already' }> => {
    const eleve = await getCachedEleve(matricule);
    if (!eleve) {
      return { success: false, message: `Matricule "${matricule}" non trouvé dans le cache local`, status: 'not_found' };
    }

    // Check today's scans in local queue
    const today = new Date().toISOString().slice(0, 10);
    const allScans = await getAllQueueScans();
    const todayScans = allScans.filter(s => s.eleve_id === eleve.id && s.scanned_at.startsWith(today));

    if (todayScans.length >= 2) {
      return { success: false, eleve, message: 'Aller-retour déjà validé (hors ligne)', status: 'already' };
    }

    const trajet = todayScans.length === 0 ? 'aller' : 'retour';
    const isValid = eleve.has_active_recharge;

    await addPendingScan({
      eleve_id: eleve.id,
      matricule: eleve.matricule,
      nom: eleve.nom,
      prenom: eleve.prenom,
      zone_transport_id: eleve.zone_transport_id,
      recharge_id: eleve.recharge_id,
      valide: isValid,
      motif_rejet: isValid ? null : 'Carte expirée ou non rechargée',
      scanned_at: new Date().toISOString(),
      synced: false,
    });

    await refreshStats();

    return {
      success: true,
      eleve,
      status: isValid ? 'valid' : 'invalid',
      message: isValid
        ? `${trajet === 'aller' ? '🚌 Aller' : '🏠 Retour'} — ${eleve.prenom} ${eleve.nom} (hors ligne)`
        : `❌ Carte expirée — ${eleve.prenom} ${eleve.nom}`,
    };
  }, [refreshStats]);

  // Sync pending scans to server
  const syncPendingScans = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const pending = await getPendingScans();
    if (pending.length === 0) return;

    setIsSyncing(true);
    let synced = 0;
    try {
      for (const scan of pending) {
        try {
          const { error } = await supabase.from('validations_transport').insert({
            eleve_id: scan.eleve_id,
            recharge_id: scan.recharge_id,
            zone_transport_id: scan.zone_transport_id,
            valide: scan.valide,
            motif_rejet: scan.motif_rejet,
            validated_at: scan.scanned_at,
          } as any);
          if (!error && scan.id) {
            await markScanSynced(scan.id);
            synced++;
          }
        } catch {
          // Skip this scan, retry later
        }
      }
      await clearSyncedScans();
      await refreshStats();
      if (synced > 0) {
        toast({ title: '🔄 Synchronisation', description: `${synced} scan(s) synchronisé(s)` });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, toast, refreshStats]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncPendingScans();
    }
  }, [isOnline, syncPendingScans]);

  // Periodic sync attempt
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      if (navigator.onLine) syncPendingScans();
    }, 30_000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [syncPendingScans]);

  return {
    isOnline,
    cachedCount,
    lastSync,
    pendingCount,
    isSyncing,
    isCaching,
    downloadEleves,
    validateOffline,
    syncPendingScans,
    refreshStats,
  };
}

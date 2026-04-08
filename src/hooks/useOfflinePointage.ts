import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  cachePointageEleves, getCachedPointageEleve, getCachedPointageElevesCount,
  getLastPointageSyncTime, addPendingPointage, getPendingPointages,
  markPointageSynced, clearSyncedPointages, getTodayOfflinePointages,
  type CachedPointageEleve, type PendingPointage,
} from '@/lib/offlineStorage';
import { format } from 'date-fns';

export function useOfflinePointage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedCount, setCachedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const syncInterval = useRef<ReturnType<typeof setInterval>>();

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

  // Load counts on mount
  useEffect(() => {
    getCachedPointageElevesCount().then(setCachedCount).catch(() => {});
    getPendingPointages().then(p => setPendingCount(p.length)).catch(() => {});
    getLastPointageSyncTime().then(setLastSync).catch(() => {});
  }, []);

  // Download all students for offline use
  const downloadEleves = useCallback(async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, matricule, qr_code, nom, prenom, classe_id, famille_id, classes:classe_id(nom)')
        .eq('statut', 'inscrit')
        .is('deleted_at', null);
      if (error) throw error;

      const mapped: CachedPointageEleve[] = (data || []).map((e: any) => ({
        id: e.id,
        matricule: e.matricule || '',
        qr_code: e.qr_code || null,
        nom: e.nom,
        prenom: e.prenom,
        classe_id: e.classe_id,
        classe_nom: e.classes?.nom || null,
        famille_id: e.famille_id,
      }));

      await cachePointageEleves(mapped);
      setCachedCount(mapped.length);
      const now = new Date().toISOString();
      setLastSync(now);
      toast.success(`${mapped.length} élèves mis en cache pour le pointage hors ligne`);
    } catch (err: any) {
      toast.error('Erreur de téléchargement', { description: err.message });
    } finally {
      setIsDownloading(false);
    }
  }, []);

  // Process a scan offline
  const processOfflineScan = useCallback(async (matricule: string, today: string): Promise<{
    success: boolean;
    eleve?: CachedPointageEleve;
    action?: 'arrivee' | 'depart' | 'complet';
    en_retard?: boolean;
    heure?: string;
  }> => {
    const eleve = await getCachedPointageEleve(matricule);
    if (!eleve) return { success: false };

    const existing = await getTodayOfflinePointages(eleve.id, today);
    const now = new Date().toISOString();
    const heureArrivee = format(new Date(now), 'HH:mm');
    const HEURE_LIMITE = '08:10';
    const enRetard = heureArrivee > HEURE_LIMITE;

    const hasArrivee = existing.some(p => p.action === 'arrivee');
    const hasDepart = existing.some(p => p.action === 'depart');

    if (!hasArrivee) {
      await addPendingPointage({
        eleve_id: eleve.id,
        matricule: eleve.matricule,
        nom: eleve.nom,
        prenom: eleve.prenom,
        classe_nom: eleve.classe_nom,
        famille_id: eleve.famille_id,
        date_pointage: today,
        action: 'arrivee',
        heure: now,
        en_retard: enRetard,
        synced: false,
      });
      const pending = await getPendingPointages();
      setPendingCount(pending.length);
      return { success: true, eleve, action: 'arrivee', en_retard: enRetard, heure: now };
    } else if (!hasDepart) {
      await addPendingPointage({
        eleve_id: eleve.id,
        matricule: eleve.matricule,
        nom: eleve.nom,
        prenom: eleve.prenom,
        classe_nom: eleve.classe_nom,
        famille_id: eleve.famille_id,
        date_pointage: today,
        action: 'depart',
        heure: now,
        en_retard: false,
        synced: false,
      });
      const pending = await getPendingPointages();
      setPendingCount(pending.length);
      return { success: true, eleve, action: 'depart', heure: now };
    } else {
      return { success: true, eleve, action: 'complet' };
    }
  }, []);

  // Sync pending pointages to Supabase
  const syncPending = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const pending = await getPendingPointages();
    if (pending.length === 0) return;

    setIsSyncing(true);
    let synced = 0;
    for (const p of pending) {
      try {
        if (p.action === 'arrivee') {
          // Check if already exists online
          const { data: existing } = await supabase
            .from('pointages_eleves')
            .select('id')
            .eq('eleve_id', p.eleve_id)
            .eq('date_pointage', p.date_pointage)
            .maybeSingle();

          if (!existing) {
            const { error } = await supabase
              .from('pointages_eleves')
              .insert({
                eleve_id: p.eleve_id,
                date_pointage: p.date_pointage,
                heure_arrivee: p.heure,
                en_retard: p.en_retard,
              });
            if (error) { console.error('Sync error:', error); continue; }

            // Send parent notification
            if (p.famille_id) {
              const heureStr = format(new Date(p.heure), 'HH:mm');
              await supabase.from('parent_notifications').insert({
                famille_id: p.famille_id,
                titre: p.en_retard ? '⚠️ Arrivée en retard' : '🏫 Arrivée à l\'école',
                message: `${p.prenom} ${p.nom} est arrivé(e) à ${heureStr}.${p.en_retard ? ' (En retard)' : ''}`,
                type: p.en_retard ? 'alerte' : 'info',
              });
            }
          }
        } else if (p.action === 'depart') {
          const { data: existing } = await supabase
            .from('pointages_eleves')
            .select('id, heure_depart')
            .eq('eleve_id', p.eleve_id)
            .eq('date_pointage', p.date_pointage)
            .maybeSingle();

          if (existing && !existing.heure_depart) {
            const { error } = await supabase
              .from('pointages_eleves')
              .update({ heure_depart: p.heure })
              .eq('id', existing.id);
            if (error) { console.error('Sync error:', error); continue; }

            if (p.famille_id) {
              const heureStr = format(new Date(p.heure), 'HH:mm');
              await supabase.from('parent_notifications').insert({
                famille_id: p.famille_id,
                titre: '🚪 Départ de l\'école',
                message: `${p.prenom} ${p.nom} a quitté l'école à ${heureStr}.`,
                type: 'info',
              });
            }
          }
        }

        if (p.id != null) await markPointageSynced(p.id);
        synced++;
      } catch (err) {
        console.error('Sync pointage error:', err);
      }
    }

    if (synced > 0) {
      toast.success(`${synced} pointage(s) synchronisé(s)`);
      await clearSyncedPointages();
    }
    const remaining = await getPendingPointages();
    setPendingCount(remaining.length);
    setIsSyncing(false);
  }, [isSyncing]);

  // Auto-sync every 30s when online
  useEffect(() => {
    if (isOnline) {
      syncPending();
      syncInterval.current = setInterval(syncPending, 30_000);
    }
    return () => { if (syncInterval.current) clearInterval(syncInterval.current); };
  }, [isOnline, syncPending]);

  return {
    isOnline,
    cachedCount,
    pendingCount,
    isSyncing,
    isDownloading,
    lastSync,
    downloadEleves,
    processOfflineScan,
    syncPending,
  };
}

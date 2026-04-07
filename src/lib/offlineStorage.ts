/**
 * IndexedDB wrapper for offline scanning (transport + pointage).
 * Stores: cached students, pending scan queue, pointage cache, pointage queue.
 */

const DB_NAME = 'edugestion-offline';
const DB_VERSION = 2;
const STORE_ELEVES = 'eleves';
const STORE_QUEUE = 'scan_queue';
const STORE_META = 'meta';
const STORE_POINTAGE_ELEVES = 'pointage_eleves';
const STORE_POINTAGE_QUEUE = 'pointage_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_ELEVES)) {
          const store = db.createObjectStore(STORE_ELEVES, { keyPath: 'matricule' });
          store.createIndex('zone_transport_id', 'zone_transport_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_POINTAGE_ELEVES)) {
          const store = db.createObjectStore(STORE_POINTAGE_ELEVES, { keyPath: 'matricule' });
          store.createIndex('classe_id', 'classe_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_POINTAGE_QUEUE)) {
          db.createObjectStore(STORE_POINTAGE_QUEUE, { keyPath: 'id', autoIncrement: true });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- Eleves cache ----

export interface CachedEleve {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  zone_transport_id: string | null;
  classe_nom: string | null;
  zone_nom: string | null;
  photo_url: string | null;
  has_active_recharge: boolean;
  recharge_id: string | null;
}

export async function cacheEleves(eleves: CachedEleve[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_ELEVES, STORE_META], 'readwrite');
  const store = tx.objectStore(STORE_ELEVES);
  // Clear old data
  store.clear();
  for (const e of eleves) {
    store.put(e);
  }
  // Save timestamp
  tx.objectStore(STORE_META).put({ key: 'lastSync', value: new Date().toISOString() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedEleve(matricule: string): Promise<CachedEleve | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_ELEVES, 'readonly');
  const store = tx.objectStore(STORE_ELEVES);
  return new Promise((resolve, reject) => {
    const req = store.get(matricule);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedElevesCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_ELEVES, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_ELEVES).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getLastSyncTime(): Promise<string | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_META).get('lastSync');
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ---- Scan queue ----

export interface PendingScan {
  id?: number;
  eleve_id: string;
  matricule: string;
  nom: string;
  prenom: string;
  zone_transport_id: string | null;
  recharge_id: string | null;
  valide: boolean;
  motif_rejet: string | null;
  scanned_at: string; // ISO timestamp
  synced: boolean;
}

export async function addPendingScan(scan: Omit<PendingScan, 'id'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).add(scan);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingScans(): Promise<PendingScan[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => resolve((req.result || []).filter((s: PendingScan) => !s.synced));
    req.onerror = () => reject(req.error);
  });
}

export async function getAllQueueScans(): Promise<PendingScan[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function markScanSynced(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const scan = req.result;
      if (scan) {
        scan.synced = true;
        store.put(scan);
      }
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncedScans(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      for (const scan of req.result || []) {
        if (scan.synced) store.delete(scan.id);
      }
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ---- Pointage Eleves cache ----

export interface CachedPointageEleve {
  id: string;
  matricule: string;
  qr_code: string | null;
  nom: string;
  prenom: string;
  classe_id: string | null;
  classe_nom: string | null;
  famille_id: string | null;
}

export async function cachePointageEleves(eleves: CachedPointageEleve[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_POINTAGE_ELEVES, STORE_META], 'readwrite');
  const store = tx.objectStore(STORE_POINTAGE_ELEVES);
  store.clear();
  for (const e of eleves) store.put(e);
  tx.objectStore(STORE_META).put({ key: 'lastPointageSync', value: new Date().toISOString() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedPointageEleve(matricule: string): Promise<CachedPointageEleve | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGE_ELEVES, 'readonly');
  const store = tx.objectStore(STORE_POINTAGE_ELEVES);
  // Try by matricule first, then scan all for qr_code match
  return new Promise((resolve, reject) => {
    const req = store.get(matricule);
    req.onsuccess = () => {
      if (req.result) { resolve(req.result); return; }
      // Search by qr_code
      const allReq = store.getAll();
      allReq.onsuccess = () => {
        const match = (allReq.result || []).find((e: CachedPointageEleve) => e.qr_code === matricule);
        resolve(match);
      };
      allReq.onerror = () => reject(allReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedPointageElevesCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGE_ELEVES, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_POINTAGE_ELEVES).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getLastPointageSyncTime(): Promise<string | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_META).get('lastPointageSync');
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ---- Pointage queue ----

export interface PendingPointage {
  id?: number;
  eleve_id: string;
  matricule: string;
  nom: string;
  prenom: string;
  classe_nom: string | null;
  famille_id: string | null;
  date_pointage: string;
  action: 'arrivee' | 'depart';
  heure: string; // ISO
  en_retard: boolean;
  synced: boolean;
}

export async function addPendingPointage(p: Omit<PendingPointage, 'id'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGE_QUEUE, 'readwrite');
  tx.objectStore(STORE_POINTAGE_QUEUE).add(p);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingPointages(): Promise<PendingPointage[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGE_QUEUE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_POINTAGE_QUEUE).getAll();
    req.onsuccess = () => resolve((req.result || []).filter((p: PendingPointage) => !p.synced));
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPointageQueue(): Promise<PendingPointage[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGE_QUEUE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_POINTAGE_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function markPointageSynced(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_POINTAGE_QUEUE);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) { item.synced = true; store.put(item); }
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncedPointages(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_POINTAGE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_POINTAGE_QUEUE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      for (const p of req.result || []) {
        if (p.synced) store.delete(p.id);
      }
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// Get today's offline pointages for a specific student (to check if already pointed)
export async function getTodayOfflinePointages(eleveId: string, datePointage: string): Promise<PendingPointage[]> {
  const all = await getAllPointageQueue();
  return all.filter(p => p.eleve_id === eleveId && p.date_pointage === datePointage);
}

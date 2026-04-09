import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScanLine, Search, Clock, LogIn, LogOut, Users, Camera, Wifi, WifiOff, Download, RefreshCw, Loader2, AlertTriangle, CheckCircle2, ArrowRightLeft, GraduationCap, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import QRScannerDialog from '@/components/QRScannerDialog';
import { useOfflinePointage } from '@/hooks/useOfflinePointage';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PointeurPointage() {
  const [searchMatricule, setSearchMatricule] = useState('');
  const [todayPointages, setTodayPointages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedClasse, setSelectedClasse] = useState<string>('all');
  const offline = useOfflinePointage();
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerActiveRef = useRef(false);

  // Structure data
  const [classes, setClasses] = useState<any[]>([]);
  const [totalElevesParClasse, setTotalElevesParClasse] = useState<Record<string, number>>({});

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchTodayPointages = useCallback(async () => {
    const { data } = await supabase
      .from('pointages_eleves')
      .select('*, eleves:eleve_id(nom, prenom, matricule, classe_id, classes:classe_id(nom, niveau_id))')
      .eq('date_pointage', today)
      .order('created_at', { ascending: false });
    setTodayPointages(data || []);
  }, [today]);

  const fetchStructure = useCallback(async () => {
    const [{ data: cData }, { data: eData }] = await Promise.all([
      supabase.from('classes').select('id, nom, niveau_id, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))').order('nom'),
      supabase.from('eleves').select('id, classe_id').eq('statut', 'inscrit').is('deleted_at', null),
    ]);
    setClasses(cData || []);
    if (eData) {
      const map: Record<string, number> = {};
      eData.forEach((e: any) => { if (e.classe_id) map[e.classe_id] = (map[e.classe_id] || 0) + 1; });
      setTotalElevesParClasse(map);
    }
  }, []);

  useEffect(() => {
    fetchTodayPointages();
    fetchStructure();
    const channel = supabase
      .channel('pointeur-pointages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages_eleves' }, () => {
        fetchTodayPointages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTodayPointages, fetchStructure]);

  const handleScan = useCallback(async (code: string) => {
    scannerActiveRef.current = true;
    setSearchMatricule('');
    if (inputRef.current) inputRef.current.blur();
    let matricule = code;
    try { const parsed = JSON.parse(code); if (parsed.matricule) matricule = parsed.matricule; } catch {}
    await processPointage(matricule.trim());
    setTimeout(() => { scannerActiveRef.current = false; setSearchMatricule(''); }, 300);
  }, [today]);

  useBarcodeScanner({ onScan: handleScan });

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (scannerActiveRef.current) { e.preventDefault(); return; }
    setSearchMatricule(e.target.value);
  }, []);

  const processPointage = async (matricule: string) => {
    if (!matricule) return;
    setLoading(true);
    try {
      if (!offline.isOnline) {
        const result = await offline.processOfflineScan(matricule, today);
        if (!result.success) {
          toast.error('Élève non trouvé en cache', { description: `Matricule: ${matricule}` });
        } else if (result.action === 'arrivee') {
          const heureStr = format(new Date(result.heure!), 'HH:mm');
          setLastScanned({ prenom: result.eleve!.prenom, nom: result.eleve!.nom, matricule: result.eleve!.matricule, classes: { nom: result.eleve!.classe_nom }, action: 'arrivee', heure: result.heure, en_retard: result.en_retard });
          toast[result.en_retard ? 'warning' : 'success'](`${result.en_retard ? '⚠️ RETARD' : '✅ Arrivée'} (hors ligne)`, { description: `${result.eleve!.prenom} ${result.eleve!.nom} — ${heureStr}` });
        } else if (result.action === 'depart') {
          setLastScanned({ prenom: result.eleve!.prenom, nom: result.eleve!.nom, matricule: result.eleve!.matricule, classes: { nom: result.eleve!.classe_nom }, action: 'depart', heure: result.heure });
          toast.success(`🚪 Départ (hors ligne)`, { description: `${result.eleve!.prenom} ${result.eleve!.nom}` });
        } else {
          setLastScanned({ prenom: result.eleve!.prenom, nom: result.eleve!.nom, matricule: result.eleve!.matricule, classes: { nom: result.eleve!.classe_nom }, action: 'complet' });
          toast.info('Pointage déjà complet');
        }
        setLoading(false);
        setSearchMatricule('');
        return;
      }

      const { data: eleve } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes:classe_id(nom), famille_id')
        .or(`matricule.eq.${matricule},qr_code.eq.${matricule}`)
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .maybeSingle();

      if (!eleve) { toast.error('Élève non trouvé', { description: `Matricule: ${matricule}` }); setLoading(false); return; }

      const { data: existing } = await supabase
        .from('pointages_eleves').select('*').eq('eleve_id', eleve.id).eq('date_pointage', today).maybeSingle();

      const now = new Date().toISOString();
      const HEURE_LIMITE = '08:10';
      const heureArrivee = format(new Date(now), 'HH:mm');
      const enRetard = heureArrivee > HEURE_LIMITE;

      if (!existing) {
        const { error } = await supabase.from('pointages_eleves').insert({ eleve_id: eleve.id, date_pointage: today, heure_arrivee: now, en_retard: enRetard });
        if (error) throw error;
        let lateCount = 0;
        if (enRetard) {
          const { count } = await supabase.from('pointages_eleves').select('id', { count: 'exact', head: true }).eq('eleve_id', eleve.id).eq('en_retard', true);
          lateCount = count || 0;
        }
        setLastScanned({ ...eleve, action: 'arrivee', heure: now, en_retard: enRetard, retard_count: lateCount });
        toast[enRetard ? 'warning' : 'success'](enRetard ? '⚠️ Arrivée en RETARD' : '✅ Arrivée enregistrée', {
          description: `${eleve.prenom} ${eleve.nom} — ${heureArrivee}${enRetard ? ` (${lateCount} retard${lateCount > 1 ? 's' : ''})` : ''}`,
        });
        if (eleve.famille_id) {
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id,
            titre: enRetard ? '⚠️ Arrivée en retard' : '🏫 Arrivée à l\'école',
            message: `${eleve.prenom} ${eleve.nom} est arrivé(e) à ${heureArrivee}.${enRetard ? ` Retard n°${lateCount}.` : ''}`,
            type: enRetard ? 'alerte' : 'info',
          });
        }
      } else if (!existing.heure_depart) {
        const { error } = await supabase.from('pointages_eleves').update({ heure_depart: now }).eq('id', existing.id);
        if (error) throw error;
        setLastScanned({ ...eleve, action: 'depart', heure: now });
        toast.success('🚪 Départ enregistré', { description: `${eleve.prenom} ${eleve.nom} — ${format(new Date(now), 'HH:mm')}` });
        if (eleve.famille_id) {
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id, titre: '🚪 Départ de l\'école',
            message: `${eleve.prenom} ${eleve.nom} a quitté l'école à ${format(new Date(now), 'HH:mm')}.`, type: 'info',
          });
        }
      } else {
        toast.info('Pointage déjà complet', { description: `${eleve.prenom} ${eleve.nom}` });
        setLastScanned({ ...eleve, action: 'complet' });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur', { description: err.message });
    } finally {
      setLoading(false);
      setSearchMatricule('');
    }
  };

  const handleManualSearch = () => { if (searchMatricule.trim()) processPointage(searchMatricule.trim()); };

  const arrivedCount = todayPointages.filter(p => p.heure_arrivee).length;
  const presentCount = todayPointages.filter(p => p.heure_arrivee && !p.heure_depart).length;
  const departedCount = todayPointages.filter(p => p.heure_depart).length;
  const lateCount = todayPointages.filter(p => p.en_retard).length;

  // Class-level stats
  const classeStats = useMemo(() => {
    return classes.map(c => {
      const total = totalElevesParClasse[c.id] || 0;
      const pointages = todayPointages.filter(p => (p.eleves as any)?.classe_id === c.id);
      const arrived = pointages.filter(p => p.heure_arrivee).length;
      const present = pointages.filter(p => p.heure_arrivee && !p.heure_depart).length;
      const absent = total - arrived;
      const cycleName = (c.niveaux as any)?.cycles?.nom || '';
      const niveauName = (c.niveaux as any)?.nom || '';
      return { id: c.id, nom: c.nom, total, arrived, present, absent, cycleName, niveauName };
    }).filter(c => c.total > 0).sort((a, b) => {
      const pctA = a.total > 0 ? a.arrived / a.total : 0;
      const pctB = b.total > 0 ? b.arrived / b.total : 0;
      return pctB - pctA;
    });
  }, [classes, todayPointages, totalElevesParClasse]);

  const filteredPointages = selectedClasse === 'all'
    ? todayPointages
    : todayPointages.filter(p => (p.eleves as any)?.classe_id === selectedClasse);

  const totalEleves = Object.values(totalElevesParClasse).reduce((s, v) => s + v, 0);
  const globalPct = totalEleves > 0 ? Math.round((arrivedCount / totalEleves) * 100) : 0;

  const stats = [
    { icon: LogIn, label: 'Arrivés', value: arrivedCount, gradient: 'from-emerald-500/15 to-teal-500/5', iconColor: 'text-emerald-500' },
    { icon: Users, label: 'Présents', value: presentCount, gradient: 'from-blue-500/15 to-indigo-500/5', iconColor: 'text-blue-500' },
    { icon: LogOut, label: 'Partis', value: departedCount, gradient: 'from-amber-500/15 to-orange-500/5', iconColor: 'text-amber-500' },
    { icon: AlertTriangle, label: 'Retards', value: lateCount, gradient: 'from-red-500/15 to-rose-500/5', iconColor: 'text-red-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Espace Pointeur</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {offline.isOnline ? (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-600 bg-emerald-500/5 text-[10px]">
              <Wifi className="h-3 w-3" /> En ligne
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 border-amber-500/40 text-amber-600 bg-amber-500/5 text-[10px] animate-pulse">
              <WifiOff className="h-3 w-3" /> Hors ligne
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Illustration + Scanner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 p-5">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Scanner illustration */}
          <div className="w-28 h-28 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center relative shrink-0">
            <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
              {/* Scanner body */}
              <rect x="15" y="10" width="50" height="35" rx="6" className="fill-primary/20 stroke-primary" strokeWidth="2"/>
              {/* Scanner window */}
              <rect x="22" y="16" width="36" height="18" rx="3" className="fill-primary/10 stroke-primary/60" strokeWidth="1.5"/>
              {/* Scan line */}
              <motion.line x1="24" y1="25" x2="56" y2="25" className="stroke-red-500" strokeWidth="2" strokeLinecap="round"
                animate={{ y1: [22, 30, 22], y2: [22, 30, 22] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
              {/* Handle */}
              <rect x="30" y="45" width="20" height="22" rx="4" className="fill-primary/15 stroke-primary" strokeWidth="2"/>
              {/* Trigger */}
              <rect x="25" y="38" width="8" height="10" rx="2" className="fill-primary/25 stroke-primary/70" strokeWidth="1.5"/>
              {/* Card being scanned */}
              <rect x="24" y="18" width="32" height="14" rx="2" className="fill-background/80 stroke-primary/40" strokeWidth="1"/>
              <line x1="28" y1="22" x2="40" y2="22" className="stroke-primary/40" strokeWidth="1.5"/>
              <line x1="28" y1="26" x2="36" y2="26" className="stroke-primary/30" strokeWidth="1"/>
              <rect x="44" y="20" width="8" height="8" rx="1" className="fill-primary/20 stroke-primary/40" strokeWidth="0.5"/>
            </svg>
            <motion.div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background"
              animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
          {/* Scanner input */}
          <div className="flex-1 w-full space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <ScanLine className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Scanner ou saisir un matricule</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input ref={inputRef} placeholder="Matricule de l'élève..." value={searchMatricule}
                  onChange={handleInputChange} onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                  className="pl-10 rounded-xl h-10 bg-background/80 border-border/50" autoFocus />
              </div>
              <Button onClick={handleManualSearch} disabled={loading || !searchMatricule.trim()} className="rounded-xl h-10 px-5">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />} Pointer
              </Button>
              <Button variant="outline" onClick={() => setScannerOpen(true)} className="rounded-xl h-10 px-5 border-border/50">
                <Camera className="h-4 w-4 mr-2" /> QR
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Offline controls */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
        className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm px-4 py-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">{offline.cachedCount} élèves en cache</span>
            {offline.pendingCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <RefreshCw className={`h-2.5 w-2.5 ${offline.isSyncing ? 'animate-spin' : ''}`} /> {offline.pendingCount} en attente
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2.5 rounded-xl" onClick={offline.downloadEleves} disabled={offline.isDownloading || !offline.isOnline}>
              {offline.isDownloading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />} Cache
            </Button>
            {offline.pendingCount > 0 && offline.isOnline && (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2.5 rounded-xl" onClick={offline.syncPending} disabled={offline.isSyncing}>
                <RefreshCw className={`h-3 w-3 mr-1 ${offline.isSyncing ? 'animate-spin' : ''}`} /> Sync
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Last scanned feedback */}
      <AnimatePresence mode="wait">
        {lastScanned && (
          <motion.div key={lastScanned.matricule + lastScanned.action}
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`rounded-2xl border-2 p-5 ${
              lastScanned.en_retard ? 'border-red-500/50 bg-gradient-to-r from-red-500/10 to-red-500/5' :
              lastScanned.action === 'arrivee' ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5' :
              lastScanned.action === 'depart' ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-amber-500/5' :
              'border-border/40 bg-card/50'
            }`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                lastScanned.en_retard ? 'bg-red-500/15' :
                lastScanned.action === 'arrivee' ? 'bg-emerald-500/15' :
                lastScanned.action === 'depart' ? 'bg-amber-500/15' : 'bg-muted/50'
              }`}>
                {lastScanned.en_retard ? <AlertTriangle className="h-7 w-7 text-red-500" /> :
                 lastScanned.action === 'arrivee' ? <CheckCircle2 className="h-7 w-7 text-emerald-500" /> :
                 lastScanned.action === 'depart' ? <LogOut className="h-7 w-7 text-amber-500" /> :
                 <ArrowRightLeft className="h-7 w-7 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground truncate">{lastScanned.prenom} {lastScanned.nom}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] font-mono border-border/40">{lastScanned.matricule}</Badge>
                  <span className="text-xs text-muted-foreground">{(lastScanned.classes as any)?.nom}</span>
                </div>
                {lastScanned.action !== 'complet' && (
                  <p className={`text-sm font-semibold mt-1.5 ${
                    lastScanned.en_retard ? 'text-red-600' : lastScanned.action === 'arrivee' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {lastScanned.action === 'arrivee' ? (lastScanned.en_retard ? '⚠️ Retard' : '✅ Arrivée') : '🚪 Départ'} — {format(new Date(lastScanned.heure), 'HH:mm')}
                  </p>
                )}
                {lastScanned.en_retard && lastScanned.retard_count > 0 && (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] mt-1.5">{lastScanned.retard_count} retard{lastScanned.retard_count > 1 ? 's' : ''}</Badge>
                )}
                {lastScanned.action === 'complet' && <p className="text-xs text-muted-foreground mt-1">Pointage déjà complet</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats cards */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`rounded-2xl bg-gradient-to-br ${s.gradient} border border-border/30 p-4 text-center transition-all hover:scale-[1.02]`}>
            <s.icon className={`h-5 w-5 mx-auto mb-1.5 ${s.iconColor}`} />
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Global progress */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl border border-border/40 bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Taux de présence global</span>
          </div>
          <span className="text-lg font-bold text-primary">{globalPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${globalPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${globalPct > 70 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : globalPct > 40 ? 'bg-gradient-to-r from-primary to-primary/70' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>{arrivedCount} arrivés sur {totalEleves} élèves</span>
          <span>{totalEleves - arrivedCount} absents</span>
        </div>
      </motion.div>

      {/* Dashboard par classe */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Tableau de bord par classe</h3>
          </div>
          <Select value={selectedClasse} onValueChange={setSelectedClasse}>
            <SelectTrigger className="w-[160px] h-8 text-xs rounded-xl"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classeStats.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nom} ({c.arrived}/{c.total})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="p-4">
          {selectedClasse === 'all' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto">
              {classeStats.map(c => {
                const pct = c.total > 0 ? Math.round((c.arrived / c.total) * 100) : 0;
                return (
                  <div key={c.id} className="rounded-xl border border-border/30 p-3 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedClasse(c.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-foreground">{c.nom}</span>
                      <Badge variant="outline" className="text-[9px]">{pct}%</Badge>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all duration-500 ${pct > 70 ? 'bg-emerald-500' : pct > 40 ? 'bg-primary' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-emerald-500" /> {c.arrived} venus</span>
                      <span className="flex items-center gap-1"><UserX className="h-3 w-3 text-red-400" /> {c.absent} absents</span>
                      <span>{c.total} total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Detail view for selected class
            (() => {
              const cs = classeStats.find(c => c.id === selectedClasse);
              const classPointages = filteredPointages;
              const pct = cs && cs.total > 0 ? Math.round((cs.arrived / cs.total) * 100) : 0;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-foreground">{cs?.nom}</h4>
                      <p className="text-xs text-muted-foreground">{cs?.niveauName} — {cs?.cycleName}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs rounded-xl" onClick={() => setSelectedClasse('all')}>← Toutes</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                      <UserCheck className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                      <div className="text-xl font-bold text-foreground">{cs?.arrived || 0}</div>
                      <p className="text-[10px] text-muted-foreground">Présents</p>
                    </div>
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                      <UserX className="h-5 w-5 text-red-400 mx-auto mb-1" />
                      <div className="text-xl font-bold text-foreground">{cs?.absent || 0}</div>
                      <p className="text-[10px] text-muted-foreground">Absents</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
                      <Users className="h-5 w-5 text-primary mx-auto mb-1" />
                      <div className="text-xl font-bold text-foreground">{cs?.total || 0}</div>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                      className={`h-full rounded-full ${pct > 70 ? 'bg-emerald-500' : pct > 40 ? 'bg-primary' : 'bg-amber-500'}`} />
                  </div>
                  <div className="max-h-[250px] overflow-y-auto divide-y divide-border/20">
                    {classPointages.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 px-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${p.en_retard ? 'bg-red-500' : p.heure_depart ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          <span className="text-sm font-medium text-foreground">{(p.eleves as any)?.prenom} {(p.eleves as any)?.nom}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {p.heure_arrivee && <span className={`font-mono ${p.en_retard ? 'text-red-500' : 'text-emerald-600'}`}>↓ {format(new Date(p.heure_arrivee), 'HH:mm')}</span>}
                          {p.heure_depart && <span className="font-mono text-amber-600">↑ {format(new Date(p.heure_depart), 'HH:mm')}</span>}
                          {p.en_retard && <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-semibold">Retard</span>}
                        </div>
                      </div>
                    ))}
                    {classPointages.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Aucun pointage</p>}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </motion.div>

      <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} title="Scanner le badge élève" />
    </div>
  );
}
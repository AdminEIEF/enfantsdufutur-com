import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScanLine, Search, Clock, LogIn, LogOut, Users, Camera, Wifi, WifiOff, Download, RefreshCw, Loader2, AlertTriangle, CheckCircle2, ArrowRightLeft, Printer, GraduationCap, TrendingUp } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import QRScannerDialog from '@/components/QRScannerDialog';
import PointageHistorique from '@/components/PointageHistorique';
import { useOfflinePointage } from '@/hooks/useOfflinePointage';
import { motion, AnimatePresence } from 'framer-motion';
import { generateRapportPointagePDF } from '@/lib/generateRapportPointagePDF';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';

export default function PointageEleves() {
  const [searchMatricule, setSearchMatricule] = useState('');
  const [todayPointages, setTodayPointages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const offline = useOfflinePointage();
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerActiveRef = useRef(false);
  const { data: schoolConfig } = useSchoolConfig();

  // Fetch niveaux + classes + total élèves for progress bars
  const [niveauxData, setNiveauxData] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('niveaux').select('id, nom, classes(id, nom)').order('nom').then(({ data }) => {
      if (data) setNiveauxData(data);
    });
  }, []);

  const mapPointages = (data: any[]) => data.map((p: any) => ({
    eleve_nom: p.eleves?.nom || '',
    eleve_prenom: p.eleves?.prenom || '',
    matricule: p.eleves?.matricule || '',
    classe: p.eleves?.classes?.nom || '',
    heure_arrivee: p.heure_arrivee,
    heure_depart: p.heure_depart,
    en_retard: p.en_retard,
    date_pointage: p.date_pointage,
  }));

  const fetchTodayPointages = useCallback(async () => {
    const { data } = await supabase
      .from('pointages_eleves')
      .select('*, eleves:eleve_id(nom, prenom, matricule, classes:classe_id(nom))')
      .eq('date_pointage', today)
      .order('created_at', { ascending: false });
    setTodayPointages(data || []);
  }, [today]);

  useEffect(() => {
    fetchTodayPointages();
    const channel = supabase
      .channel('pointages-eleves-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages_eleves' }, () => {
        fetchTodayPointages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTodayPointages]);

  const handleScan = useCallback(async (code: string) => {
    // Mark scanner as active to block input field
    scannerActiveRef.current = true;
    // Clear any characters that leaked into the input
    setSearchMatricule('');
    if (inputRef.current) inputRef.current.blur();

    let matricule = code;
    try {
      const parsed = JSON.parse(code);
      if (parsed.matricule) matricule = parsed.matricule;
    } catch { /* raw text */ }

    await processPointage(matricule.trim());
    
    // Reset after a short delay
    setTimeout(() => {
      scannerActiveRef.current = false;
      setSearchMatricule('');
    }, 300);
  }, [today]);

  useBarcodeScanner({ onScan: handleScan });

  // Block scanner characters from appearing in input
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (scannerActiveRef.current) {
      e.preventDefault();
      return;
    }
    setSearchMatricule(e.target.value);
  }, []);

  const processPointage = async (matricule: string) => {
    if (!matricule) return;
    setLoading(true);
    try {
      // OFFLINE MODE
      if (!offline.isOnline) {
        const result = await offline.processOfflineScan(matricule, today);
        if (!result.success) {
          toast.error('Élève non trouvé en cache', { description: `Matricule: ${matricule}` });
        } else if (result.action === 'arrivee') {
          const heureStr = format(new Date(result.heure!), 'HH:mm');
          setLastScanned({ prenom: result.eleve!.prenom, nom: result.eleve!.nom, matricule: result.eleve!.matricule, classes: { nom: result.eleve!.classe_nom }, action: 'arrivee', heure: result.heure, en_retard: result.en_retard });
          if (result.en_retard) {
            toast.warning(`⚠️ RETARD (hors ligne)`, { description: `${result.eleve!.prenom} ${result.eleve!.nom} — ${heureStr}` });
          } else {
            toast.success(`✅ Arrivée (hors ligne)`, { description: `${result.eleve!.prenom} ${result.eleve!.nom} — ${heureStr}` });
          }
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

      // ONLINE MODE
      const { data: eleve } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes:classe_id(nom), famille_id')
        .or(`matricule.eq.${matricule},qr_code.eq.${matricule}`)
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .maybeSingle();

      if (!eleve) {
        toast.error('Élève non trouvé', { description: `Matricule: ${matricule}` });
        setLoading(false);
        return;
      }

      const { data: existing } = await supabase
        .from('pointages_eleves')
        .select('*')
        .eq('eleve_id', eleve.id)
        .eq('date_pointage', today)
        .maybeSingle();

      const now = new Date().toISOString();
      const HEURE_LIMITE = '08:10';
      const heureArrivee = format(new Date(now), 'HH:mm');
      const enRetard = heureArrivee > HEURE_LIMITE;

      if (!existing) {
        const { error } = await supabase
          .from('pointages_eleves')
          .insert({ eleve_id: eleve.id, date_pointage: today, heure_arrivee: now, en_retard: enRetard });
        if (error) throw error;

        let lateCount = 0;
        if (enRetard) {
          const { count } = await supabase
            .from('pointages_eleves')
            .select('id', { count: 'exact', head: true })
            .eq('eleve_id', eleve.id)
            .eq('en_retard', true);
          lateCount = count || 0;
        }

        setLastScanned({ ...eleve, action: 'arrivee', heure: now, en_retard: enRetard, retard_count: lateCount });
        if (enRetard) {
          toast.warning(`⚠️ Arrivée en RETARD`, {
            description: `${eleve.prenom} ${eleve.nom} — ${heureArrivee} (${lateCount} retard${lateCount > 1 ? 's' : ''} au total)`,
          });
        } else {
          toast.success(`✅ Arrivée enregistrée`, {
            description: `${eleve.prenom} ${eleve.nom} — ${heureArrivee}`,
          });
        }

        if (eleve.famille_id) {
          const retardMsg = enRetard
            ? ` ⚠️ EN RETARD (${heureArrivee} au lieu de 08:10). Nombre total de retards : ${enRetard ? (await supabase.from('pointages_eleves').select('id', { count: 'exact', head: true }).eq('eleve_id', eleve.id).eq('en_retard', true)).count || 0 : 0}.`
            : '';
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id,
            titre: enRetard ? '⚠️ Arrivée en retard' : '🏫 Arrivée à l\'école',
            message: `${eleve.prenom} ${eleve.nom} est arrivé(e) à l'école à ${heureArrivee}.${retardMsg}`,
            type: enRetard ? 'alerte' : 'info',
          });
        }
      } else if (!existing.heure_depart) {
        const { error } = await supabase
          .from('pointages_eleves')
          .update({ heure_depart: now })
          .eq('id', existing.id);
        if (error) throw error;

        setLastScanned({ ...eleve, action: 'depart', heure: now });
        toast.success(`🚪 Départ enregistré`, {
          description: `${eleve.prenom} ${eleve.nom} — ${format(new Date(now), 'HH:mm')}`,
        });

        if (eleve.famille_id) {
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id,
            titre: '🚪 Départ de l\'école',
            message: `${eleve.prenom} ${eleve.nom} a quitté l'école à ${format(new Date(now), 'HH:mm')}.`,
            type: 'info',
          });
        }
      } else {
        toast.info('Pointage déjà complet', {
          description: `${eleve.prenom} ${eleve.nom} a déjà son arrivée et départ enregistrés aujourd'hui.`,
        });
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

  const handleManualSearch = () => {
    if (searchMatricule.trim()) processPointage(searchMatricule.trim());
  };

  const arrivedCount = todayPointages.filter(p => p.heure_arrivee).length;
  const departedCount = todayPointages.filter(p => p.heure_depart).length;
  const presentCount = todayPointages.filter(p => p.heure_arrivee && !p.heure_depart).length;
  const lateCount = todayPointages.filter(p => p.en_retard).length;

  const schoolObj = {
    nom: schoolConfig?.nom || 'École',
    soustitre: schoolConfig?.soustitre,
    logo_url: schoolConfig?.logo_url,
    ville: schoolConfig?.ville,
  };

  const printDailyReport = () => {
    generateRapportPointagePDF({
      type: 'jour',
      date: today,
      pointages: mapPointages(todayPointages),
      stats: { total: arrivedCount, presents: presentCount, retards: lateCount, departs: departedCount },
      school: schoolObj,
    });
  };

  const printWeeklyReport = async () => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('pointages_eleves')
      .select('*, eleves:eleve_id(nom, prenom, matricule, classes:classe_id(nom))')
      .gte('date_pointage', weekStart)
      .lte('date_pointage', weekEnd)
      .order('date_pointage', { ascending: true })
      .order('created_at', { ascending: true });
    const entries = mapPointages(data || []);
    generateRapportPointagePDF({
      type: 'semaine',
      date: today,
      dateDebut: weekStart,
      dateFin: weekEnd,
      pointages: entries,
      stats: {
        total: (data || []).length,
        presents: (data || []).filter((p: any) => p.heure_arrivee && !p.heure_depart).length,
        retards: (data || []).filter((p: any) => p.en_retard).length,
        departs: (data || []).filter((p: any) => p.heure_depart).length,
      },
      school: schoolObj,
    });
  };

  const stats = [
    { icon: LogIn, label: 'Arrivés', value: arrivedCount, gradient: 'from-emerald-500/15 to-teal-500/5', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
    { icon: Users, label: 'Présents', value: presentCount, gradient: 'from-blue-500/15 to-indigo-500/5', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500' },
    { icon: LogOut, label: 'Partis', value: departedCount, gradient: 'from-amber-500/15 to-orange-500/5', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
    { icon: AlertTriangle, label: 'Retards', value: lateCount, gradient: 'from-red-500/15 to-rose-500/5', iconBg: 'bg-red-500/10', iconColor: 'text-red-500' },
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
            <h1 className="text-xl font-bold text-foreground">Pointage Élèves</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[10px] rounded-xl gap-1.5 border-border/50" onClick={printDailyReport}>
            <Printer className="h-3 w-3" /> Jour
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px] rounded-xl gap-1.5 border-border/50" onClick={printWeeklyReport}>
            <Printer className="h-3 w-3" /> Semaine
          </Button>
          {offline.isOnline ? (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-600 bg-emerald-500/5 text-[10px] font-medium">
              <Wifi className="h-3 w-3" /> En ligne
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 border-amber-500/40 text-amber-600 bg-amber-500/5 text-[10px] font-medium animate-pulse">
              <WifiOff className="h-3 w-3" /> Hors ligne
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Offline controls */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">{offline.cachedCount} élèves en cache</span>
            {offline.pendingCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <RefreshCw className={`h-2.5 w-2.5 ${offline.isSyncing ? 'animate-spin' : ''}`} />
                {offline.pendingCount} en attente
              </Badge>
            )}
            {offline.lastSync && (
              <span className="hidden sm:inline">Dernier cache : {format(new Date(offline.lastSync), 'dd/MM HH:mm')}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2.5 rounded-xl" onClick={offline.downloadEleves} disabled={offline.isDownloading || !offline.isOnline}>
              {offline.isDownloading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
              Cache
            </Button>
            {offline.pendingCount > 0 && offline.isOnline && (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2.5 rounded-xl" onClick={offline.syncPending} disabled={offline.isSyncing}>
                <RefreshCw className={`h-3 w-3 mr-1 ${offline.isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Scanner section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <div className="flex items-center gap-2 mb-3">
          <ScanLine className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Scanner ou saisir un matricule</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Matricule de l'élève..."
              value={searchMatricule}
              onChange={handleInputChange}
              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
              className="pl-10 rounded-xl h-10 bg-background/80 border-border/50"
            />
          </div>
          <Button onClick={handleManualSearch} disabled={loading || !searchMatricule.trim()} className="rounded-xl h-10 px-5">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
            Pointer
          </Button>
          <Button variant="outline" onClick={() => setScannerOpen(true)} className="rounded-xl h-10 px-5 border-border/50">
            <Camera className="h-4 w-4 mr-2" /> QR
          </Button>
        </div>
      </motion.div>

      {/* Last scanned feedback */}
      <AnimatePresence mode="wait">
        {lastScanned && (
          <motion.div
            key={lastScanned.matricule + lastScanned.action}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`rounded-2xl border-2 p-5 ${
              lastScanned.en_retard
                ? 'border-red-500/50 bg-gradient-to-r from-red-500/10 to-red-500/5'
                : lastScanned.action === 'arrivee'
                ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5'
                : lastScanned.action === 'depart'
                ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-amber-500/5'
                : 'border-border/40 bg-card/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                lastScanned.en_retard ? 'bg-red-500/15' :
                lastScanned.action === 'arrivee' ? 'bg-emerald-500/15' :
                lastScanned.action === 'depart' ? 'bg-amber-500/15' : 'bg-muted/50'
              }`}>
                {lastScanned.en_retard ? (
                  <AlertTriangle className="h-7 w-7 text-red-500" />
                ) : lastScanned.action === 'arrivee' ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                ) : lastScanned.action === 'depart' ? (
                  <LogOut className="h-7 w-7 text-amber-500" />
                ) : (
                  <ArrowRightLeft className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground truncate">{lastScanned.prenom} {lastScanned.nom}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] font-mono border-border/40">{lastScanned.matricule}</Badge>
                  <span className="text-xs text-muted-foreground">{(lastScanned.classes as any)?.nom}</span>
                </div>
                {lastScanned.action !== 'complet' && (
                  <p className={`text-sm font-semibold mt-1.5 ${
                    lastScanned.en_retard ? 'text-red-600' :
                    lastScanned.action === 'arrivee' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {lastScanned.action === 'arrivee' ? (lastScanned.en_retard ? '⚠️ Retard' : '✅ Arrivée') : '🚪 Départ'} — {format(new Date(lastScanned.heure), 'HH:mm')}
                  </p>
                )}
                {lastScanned.en_retard && lastScanned.retard_count > 0 && (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] mt-1.5">
                    {lastScanned.retard_count} retard{lastScanned.retard_count > 1 ? 's' : ''} au total
                  </Badge>
                )}
                {lastScanned.action === 'complet' && (
                  <p className="text-xs text-muted-foreground mt-1">Pointage déjà complet pour aujourd'hui</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`rounded-2xl bg-gradient-to-br ${s.gradient} border border-border/30 p-4 text-center transition-all hover:scale-[1.02]`}>
            <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center mx-auto mb-2`}>
              <s.icon className={`h-4.5 w-4.5 ${s.iconColor}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Today's list */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Pointages du jour</h3>
          <Badge variant="secondary" className="text-[10px]">{todayPointages.length}</Badge>
        </div>
        {todayPointages.length === 0 ? (
          <div className="py-12 text-center">
            <ScanLine className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun pointage enregistré aujourd'hui</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
            {todayPointages.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    p.en_retard ? 'bg-red-500' : p.heure_depart ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className="font-medium text-sm text-foreground truncate">
                    {(p.eleves as any)?.prenom} {(p.eleves as any)?.nom}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                    {(p.eleves as any)?.matricule}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden md:inline">
                    {(p.eleves as any)?.classes?.nom}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs shrink-0">
                  {p.heure_arrivee && (
                    <span className={`font-mono ${p.en_retard ? 'text-red-500 font-semibold' : 'text-emerald-600'}`}>
                      ↓ {format(new Date(p.heure_arrivee), 'HH:mm')}
                    </span>
                  )}
                  {p.heure_depart && (
                    <span className="font-mono text-amber-600">
                      ↑ {format(new Date(p.heure_depart), 'HH:mm')}
                    </span>
                  )}
                  {p.en_retard && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-semibold">Retard</span>
                  )}
                  {!p.heure_depart && p.heure_arrivee && !p.en_retard && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-semibold">Présent</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Historique */}
      <PointageHistorique />

      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title="Scanner le badge élève"
      />
    </div>
  );
}

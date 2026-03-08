import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScanLine, Search, Clock, LogIn, LogOut, Users, Camera, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import QRScannerDialog from '@/components/QRScannerDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function SurveillantPointage() {
  const [searchMatricule, setSearchMatricule] = useState('');
  const [todayPointages, setTodayPointages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [niveaux, setNiveaux] = useState<any[]>([]);
  const [openNiveaux, setOpenNiveaux] = useState<Record<string, boolean>>({});

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchNiveaux = useCallback(async () => {
    const { data } = await supabase
      .from('niveaux')
      .select('id, nom, ordre, cycles:cycle_id(nom)')
      .order('ordre');
    setNiveaux(data || []);
  }, []);

  const fetchTodayPointages = useCallback(async () => {
    const { data } = await supabase
      .from('pointages_eleves')
      .select('*, eleves:eleve_id(nom, prenom, matricule, classe_id, classes:classe_id(nom, niveau_id))')
      .eq('date_pointage', today)
      .order('created_at', { ascending: false });
    setTodayPointages(data || []);
  }, [today]);

  useEffect(() => {
    fetchTodayPointages();
    fetchNiveaux();
    const channel = supabase
      .channel('surveillant-pointages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages_eleves' }, () => {
        fetchTodayPointages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTodayPointages, fetchNiveaux]);

  const handleScan = useCallback(async (code: string) => {
    let matricule = code;
    try {
      const parsed = JSON.parse(code);
      if (parsed.matricule) matricule = parsed.matricule;
    } catch { /* raw text */ }
    await processPointage(matricule.trim());
  }, [today]);

  useBarcodeScanner({ onScan: handleScan });

  const processPointage = async (matricule: string) => {
    if (!matricule) return;
    setLoading(true);
    try {
      const { data: eleve } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes:classe_id(nom, niveau_id), famille_id')
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

        // Auto-open the niveau group
        const niveauId = (eleve.classes as any)?.niveau_id;
        if (niveauId) setOpenNiveaux(prev => ({ ...prev, [niveauId]: true }));

        if (enRetard) {
          toast.warning(`⚠️ Arrivée en RETARD`, {
            description: `${eleve.prenom} ${eleve.nom} — ${heureArrivee} (${lateCount} retard${lateCount > 1 ? 's' : ''})`,
          });
        } else {
          toast.success(`✅ Arrivée enregistrée`, {
            description: `${eleve.prenom} ${eleve.nom} — ${heureArrivee}`,
          });
        }

        if (eleve.famille_id) {
          const retardMsg = enRetard
            ? ` ⚠️ EN RETARD (${heureArrivee}). Total retards : ${lateCount}.`
            : '';
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id,
            titre: enRetard ? '⚠️ Arrivée en retard' : '🏫 Arrivée à l\'école',
            message: `${eleve.prenom} ${eleve.nom} est arrivé(e) à ${heureArrivee}.${retardMsg}`,
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
          description: `${eleve.prenom} ${eleve.nom} — arrivée et départ déjà enregistrés.`,
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

  // Group pointages by niveau
  const pointagesByNiveau = useMemo(() => {
    const groups: Record<string, { niveau: any; pointages: any[] }> = {};
    const unclassified: any[] = [];

    for (const p of todayPointages) {
      const niveauId = (p.eleves as any)?.classes?.niveau_id;
      if (niveauId) {
        if (!groups[niveauId]) {
          const niv = niveaux.find(n => n.id === niveauId);
          groups[niveauId] = { niveau: niv || { id: niveauId, nom: 'Inconnu', ordre: 999 }, pointages: [] };
        }
        groups[niveauId].pointages.push(p);
      } else {
        unclassified.push(p);
      }
    }

    const sorted = Object.values(groups).sort((a, b) => (a.niveau.ordre || 0) - (b.niveau.ordre || 0));
    if (unclassified.length > 0) {
      sorted.push({ niveau: { id: 'other', nom: 'Non classé', ordre: 9999 }, pointages: unclassified });
    }
    return sorted;
  }, [todayPointages, niveaux]);

  const arrivedCount = todayPointages.filter(p => p.heure_arrivee).length;
  const departedCount = todayPointages.filter(p => p.heure_depart).length;
  const presentCount = todayPointages.filter(p => p.heure_arrivee && !p.heure_depart).length;
  const lateCount = todayPointages.filter(p => p.en_retard).length;

  const toggleNiveau = (id: string) => {
    setOpenNiveaux(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Pointage — Surveillant
        </h1>
        <Badge variant="outline" className="text-sm">
          {format(new Date(), 'EEE dd MMM yyyy', { locale: fr })}
        </Badge>
      </div>

      {/* Scanner section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Saisir ou scanner le matricule..."
                value={searchMatricule}
                onChange={e => setSearchMatricule(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                className="pl-10 h-12 text-lg"
                autoFocus
              />
            </div>
            <Button onClick={handleManualSearch} disabled={loading || !searchMatricule.trim()} size="lg">
              <Clock className="h-4 w-4 mr-2" /> Pointer
            </Button>
            <Button variant="outline" size="lg" onClick={() => setScannerOpen(true)}>
              <Camera className="h-4 w-4 mr-2" /> Scanner QR
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Last scanned feedback */}
      {lastScanned && (
        <Card className={`border-2 ${
          lastScanned.en_retard ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
          lastScanned.action === 'arrivee' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' :
          lastScanned.action === 'depart' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' :
          'border-muted'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                lastScanned.en_retard ? 'bg-red-100 dark:bg-red-900' :
                lastScanned.action === 'arrivee' ? 'bg-emerald-100 dark:bg-emerald-900' :
                lastScanned.action === 'depart' ? 'bg-orange-100 dark:bg-orange-900' : 'bg-muted'
              }`}>
                {lastScanned.en_retard ? <Clock className="h-7 w-7 text-red-600" /> :
                 lastScanned.action === 'arrivee' ? <LogIn className="h-7 w-7 text-emerald-600" /> :
                 lastScanned.action === 'depart' ? <LogOut className="h-7 w-7 text-orange-600" /> :
                 <Clock className="h-7 w-7 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-lg font-bold">{lastScanned.prenom} {lastScanned.nom}</p>
                <p className="text-sm text-muted-foreground">
                  {lastScanned.matricule} • {(lastScanned.classes as any)?.nom}
                </p>
                {lastScanned.action !== 'complet' && (
                  <p className="text-sm font-medium mt-1">
                    {lastScanned.action === 'arrivee' ? (lastScanned.en_retard ? '⚠️ RETARD' : '✅ Arrivée') : '🚪 Départ'} à {format(new Date(lastScanned.heure), 'HH:mm')}
                  </p>
                )}
                {lastScanned.en_retard && lastScanned.retard_count > 0 && (
                  <Badge className="bg-red-100 text-red-700 text-[10px] mt-1">
                    {lastScanned.retard_count} retard{lastScanned.retard_count > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <LogIn className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <div className="text-2xl font-bold">{arrivedCount}</div>
            <p className="text-xs text-muted-foreground">Arrivés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold">{presentCount}</div>
            <p className="text-xs text-muted-foreground">Présents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <LogOut className="h-5 w-5 mx-auto text-orange-600 mb-1" />
            <div className="text-2xl font-bold">{departedCount}</div>
            <p className="text-xs text-muted-foreground">Partis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-red-600 mb-1" />
            <div className="text-2xl font-bold">{lateCount}</div>
            <p className="text-xs text-muted-foreground">Retards</p>
          </CardContent>
        </Card>
      </div>

      {/* Pointages grouped by niveau */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ScanLine className="h-5 w-5" />
          Élèves scannés par niveau ({todayPointages.length})
        </h2>

        {pointagesByNiveau.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">Aucun pointage enregistré aujourd'hui</p>
            </CardContent>
          </Card>
        ) : (
          pointagesByNiveau.map(group => {
            const isOpen = openNiveaux[group.niveau.id] ?? true;
            const groupLate = group.pointages.filter((p: any) => p.en_retard).length;
            const groupPresent = group.pointages.filter((p: any) => p.heure_arrivee && !p.heure_depart).length;

            return (
              <Collapsible key={group.niveau.id} open={isOpen} onOpenChange={() => toggleNiveau(group.niveau.id)}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <CardTitle className="text-sm font-semibold">
                            {(group.niveau.cycles as any)?.nom ? `${(group.niveau.cycles as any).nom} — ` : ''}{group.niveau.nom}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {group.pointages.length} élève{group.pointages.length > 1 ? 's' : ''}
                          </Badge>
                          {groupPresent > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                              {groupPresent} présent{groupPresent > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {groupLate > 0 && (
                            <Badge className="bg-red-100 text-red-700 text-[10px]">
                              {groupLate} retard{groupLate > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-3 px-4">
                      <div className="space-y-1.5">
                        {group.pointages.map((p: any) => (
                          <div key={p.id} className={`flex items-center justify-between text-sm border rounded-lg px-3 py-2 ${
                            p.en_retard ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' : ''
                          }`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">
                                {(p.eleves as any)?.prenom} {(p.eleves as any)?.nom}
                              </span>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {(p.eleves as any)?.matricule}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {(p.eleves as any)?.classes?.nom}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs shrink-0">
                              {p.heure_arrivee && (
                                <span className={p.en_retard ? 'text-red-600 font-semibold' : 'text-emerald-600 font-medium'}>
                                  ↓ {format(new Date(p.heure_arrivee), 'HH:mm')}
                                </span>
                              )}
                              {p.heure_depart && (
                                <span className="text-orange-600 font-medium">
                                  ↑ {format(new Date(p.heure_depart), 'HH:mm')}
                                </span>
                              )}
                              {p.en_retard && <Badge className="bg-red-100 text-red-700 text-[10px]">Retard</Badge>}
                              {!p.heure_depart && p.heure_arrivee && !p.en_retard && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Présent</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>

      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title="Scanner le badge élève"
      />
    </div>
  );
}

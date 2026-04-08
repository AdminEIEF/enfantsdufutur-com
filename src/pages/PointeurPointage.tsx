import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScanLine, Search, Clock, LogIn, LogOut, Users, Camera, Wifi, WifiOff, Download, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import QRScannerDialog from '@/components/QRScannerDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useOfflinePointage } from '@/hooks/useOfflinePointage';

export default function PointeurPointage() {
  const [searchMatricule, setSearchMatricule] = useState('');
  const [todayPointages, setTodayPointages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [niveaux, setNiveaux] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const offline = useOfflinePointage();

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
    const [{ data: nData }, { data: cData }] = await Promise.all([
      supabase.from('niveaux').select('id, nom, ordre, cycle_id').order('ordre'),
      supabase.from('cycles').select('id, nom, ordre').order('ordre'),
    ]);
    setNiveaux(nData || []);
    setCycles(cData || []);
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
            description: `${eleve.prenom} ${eleve.nom} — ${heureArrivee} (${lateCount} retard${lateCount > 1 ? 's' : ''})`,
          });
        } else {
          toast.success(`✅ Arrivée enregistrée`, {
            description: `${eleve.prenom} ${eleve.nom} — ${heureArrivee}`,
          });
        }

        if (eleve.famille_id) {
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id,
            titre: enRetard ? '⚠️ Arrivée en retard' : '🏫 Arrivée à l\'école',
            message: `${eleve.prenom} ${eleve.nom} est arrivé(e) à ${heureArrivee}.${enRetard ? ` Retard n°${lateCount}.` : ''}`,
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

  const arrivedCount = todayPointages.filter(p => p.heure_arrivee).length;
  const presentCount = todayPointages.filter(p => p.heure_arrivee && !p.heure_depart).length;
  const departedCount = todayPointages.filter(p => p.heure_depart).length;
  const lateCount = todayPointages.filter(p => p.en_retard).length;

  // Group pointages by niveau
  const pointagesByNiveau = (() => {
    const niveauMap = new Map<string, { nom: string, cycleName: string, cycleOrdre: number, niveauOrdre: number, pointages: any[] }>();

    for (const p of todayPointages) {
      const classe = p.eleves?.classes;
      if (!classe?.niveau_id) continue;
      const niveauId = classe.niveau_id;

      if (!niveauMap.has(niveauId)) {
        const niveau = niveaux.find((n: any) => n.id === niveauId);
        const cycle = cycles.find((c: any) => c.id === niveau?.cycle_id);
        niveauMap.set(niveauId, {
          nom: niveau?.nom || 'Inconnu',
          cycleName: cycle?.nom || '',
          cycleOrdre: cycle?.ordre || 0,
          niveauOrdre: niveau?.ordre || 0,
          pointages: [],
        });
      }
      niveauMap.get(niveauId)!.pointages.push(p);
    }

    return Array.from(niveauMap.entries())
      .sort((a, b) => {
        if (a[1].cycleOrdre !== b[1].cycleOrdre) return a[1].cycleOrdre - b[1].cycleOrdre;
        return a[1].niveauOrdre - b[1].niveauOrdre;
      });
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" />
          Pointage Élèves
        </h1>
        <Badge variant="outline" className="text-sm">
          {format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}
        </Badge>
      </div>

      {/* Scanner */}
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
                className="pl-10"
                autoFocus
              />
            </div>
            <Button onClick={handleManualSearch} disabled={loading || !searchMatricule.trim()}>
              <Clock className="h-4 w-4 mr-2" /> Pointer
            </Button>
            <Button variant="outline" onClick={() => setScannerOpen(true)}>
              <Camera className="h-4 w-4 mr-2" /> Scanner QR
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Last scanned feedback */}
      {lastScanned && (
        <Card className={`border-2 ${
          lastScanned.en_retard ? 'border-destructive bg-destructive/5' :
          lastScanned.action === 'arrivee' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' :
          lastScanned.action === 'depart' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' :
          'border-muted'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                lastScanned.en_retard ? 'bg-destructive/10' :
                lastScanned.action === 'arrivee' ? 'bg-emerald-100 dark:bg-emerald-900' :
                lastScanned.action === 'depart' ? 'bg-orange-100 dark:bg-orange-900' : 'bg-muted'
              }`}>
                {lastScanned.en_retard ? <Clock className="h-7 w-7 text-destructive" /> :
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
                  <Badge variant="destructive" className="text-[10px] mt-1">
                    {lastScanned.retard_count} retard{lastScanned.retard_count > 1 ? 's' : ''} au total
                  </Badge>
                )}
                {lastScanned.action === 'complet' && (
                  <p className="text-sm text-muted-foreground mt-1">Pointage déjà complet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
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
            <Clock className="h-5 w-5 mx-auto text-destructive mb-1" />
            <div className="text-2xl font-bold">{lateCount}</div>
            <p className="text-xs text-muted-foreground">En retard</p>
          </CardContent>
        </Card>
      </div>

      {/* Pointages grouped by niveau */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Élèves pointés par niveau ({todayPointages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pointagesByNiveau.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun pointage enregistré aujourd'hui</p>
          ) : (
            <Accordion type="multiple" defaultValue={pointagesByNiveau.map(([id]) => id)}>
              {pointagesByNiveau.map(([niveauId, group]) => {
                const retards = group.pointages.filter((p: any) => p.en_retard).length;
                return (
                  <AccordionItem key={niveauId} value={niveauId}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{group.cycleName} — {group.nom}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {group.pointages.length} élève{group.pointages.length > 1 ? 's' : ''}
                        </Badge>
                        {retards > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            {retards} retard{retards > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1.5">
                        {group.pointages.map((p: any) => (
                          <div key={p.id} className={`flex items-center justify-between text-sm border rounded px-3 py-2 ${
                            p.en_retard ? 'border-destructive/30 bg-destructive/5' : ''
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {p.eleves?.prenom} {p.eleves?.nom}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {p.eleves?.matricule}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {p.eleves?.classes?.nom}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              {p.heure_arrivee && (
                                <span className={p.en_retard ? 'text-destructive font-semibold' : 'text-emerald-600 font-medium'}>
                                  ↓ {format(new Date(p.heure_arrivee), 'HH:mm')}
                                </span>
                              )}
                              {p.heure_depart && (
                                <span className="text-orange-600 font-medium">
                                  ↑ {format(new Date(p.heure_depart), 'HH:mm')}
                                </span>
                              )}
                              {p.en_retard && <Badge variant="destructive" className="text-[10px]">Retard</Badge>}
                              {!p.heure_depart && p.heure_arrivee && !p.en_retard && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Présent</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title="Scanner le badge élève"
      />
    </div>
  );
}
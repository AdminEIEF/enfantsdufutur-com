import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScanLine, Search, Clock, LogIn, LogOut, Users, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import QRScannerDialog from '@/components/QRScannerDialog';

export default function PointageEleves() {
  const [searchMatricule, setSearchMatricule] = useState('');
  const [todayPointages, setTodayPointages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

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
    // Realtime
    const channel = supabase
      .channel('pointages-eleves-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages_eleves' }, () => {
        fetchTodayPointages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTodayPointages]);

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
      // Find student
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

      // Check if already has a pointage today
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
        // First scan = arrival
        const { error } = await supabase
          .from('pointages_eleves')
          .insert({ eleve_id: eleve.id, date_pointage: today, heure_arrivee: now, en_retard: enRetard });
        if (error) throw error;

        // Count total late arrivals
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

        // Notify parent
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
        // Second scan = departure
        const { error } = await supabase
          .from('pointages_eleves')
          .update({ heure_depart: now })
          .eq('id', existing.id);
        if (error) throw error;

        setLastScanned({ ...eleve, action: 'depart', heure: now });
        toast.success(`🚪 Départ enregistré`, {
          description: `${eleve.prenom} ${eleve.nom} — ${format(new Date(now), 'HH:mm')}`,
        });

        // Notify parent
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
                {lastScanned.en_retard ? (
                  <Clock className="h-7 w-7 text-red-600" />
                ) : lastScanned.action === 'arrivee' ? (
                  <LogIn className="h-7 w-7 text-emerald-600" />
                ) : lastScanned.action === 'depart' ? (
                  <LogOut className="h-7 w-7 text-orange-600" />
                ) : (
                  <Clock className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-lg font-bold">{lastScanned.prenom} {lastScanned.nom}</p>
                <p className="text-sm text-muted-foreground">
                  {lastScanned.matricule} • {(lastScanned.classes as any)?.nom}
                </p>
                {lastScanned.action !== 'complet' && (
                  <p className="text-sm font-medium mt-1">
                    {lastScanned.action === 'arrivee' ? (lastScanned.en_retard ? '⚠️ Arrivée en RETARD' : '✅ Arrivée') : '🚪 Départ'} à {format(new Date(lastScanned.heure), 'HH:mm')}
                  </p>
                )}
                {lastScanned.en_retard && lastScanned.retard_count > 0 && (
                  <Badge className="bg-red-100 text-red-700 text-[10px] mt-1">
                    {lastScanned.retard_count} retard{lastScanned.retard_count > 1 ? 's' : ''} au total
                  </Badge>
                )}
                {lastScanned.action === 'complet' && (
                  <p className="text-sm text-muted-foreground mt-1">Pointage déjà complet pour aujourd'hui</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {/* Today's list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pointages du jour ({todayPointages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {todayPointages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun pointage enregistré aujourd'hui</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {todayPointages.map(p => (
                <div key={p.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {(p.eleves as any)?.prenom} {(p.eleves as any)?.nom}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {(p.eleves as any)?.matricule}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(p.eleves as any)?.classes?.nom}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {p.heure_arrivee && (
                      <span className="text-emerald-600 font-medium">
                        ↓ {format(new Date(p.heure_arrivee), 'HH:mm')}
                      </span>
                    )}
                    {p.heure_depart && (
                      <span className="text-orange-600 font-medium">
                        ↑ {format(new Date(p.heure_depart), 'HH:mm')}
                      </span>
                    )}
                    {!p.heure_depart && p.heure_arrivee && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Présent</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
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

import { useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ScanLine, User, Users, BookOpenText, GraduationCap, Utensils, BusFront, Wrench, Phone, Mail, MapPin, Award, TrendingUp, Calendar, Hash, Loader2, AlertCircle, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function parseScannedCode(raw: string): string | null {
  const trimmed = raw.trim();
  // Direct matricule
  if (/^EDU/i.test(trimmed)) return trimmed.toUpperCase();
  // JSON-like {type:transport;matricule:EDU...;id:EDU...}
  const mMatch = trimmed.match(/matricule[=:]\s*([A-Za-z0-9\-]+)/i);
  if (mMatch) return mMatch[1].toUpperCase();
  // Fallback
  return trimmed.toUpperCase();
}

function PhotoWithSkeleton({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-28 h-28 rounded-2xl border-4 border-background shadow-lg overflow-hidden">
      {!loaded && <Skeleton className="absolute inset-0 w-full h-full" />}
      <img
        src={src}
        alt=""
        loading="eager"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

export default function ScanEleveInfo() {
  const [matricule, setMatricule] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useBarcodeScanner({
    onScan: useCallback((code: string) => {
      const parsed = parseScannedCode(code);
      if (parsed) {
        setMatricule(parsed);
        setScanning(false);
        toast.success('Badge scanné : ' + parsed);
      }
    }, []),
  });

  const { data: eleve, isLoading, error } = useQuery({
    queryKey: ['scan-eleve-info', matricule],
    queryFn: async () => {
      if (!matricule) return null;
      console.log('[ScanEleve] Recherche matricule:', matricule);
      const { data, error } = await supabase
        .from('eleves')
        .select(`
          *, 
          classes!eleves_classe_id_fkey(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom, bareme))),
          familles!eleves_famille_id_fkey(nom_famille, telephone_pere, telephone_mere, email_parent, adresse, solde_famille),
          zones_transport!eleves_zone_transport_id_fkey(nom, prix_mensuel)
        `)
        .or(`matricule.eq.${matricule},qr_code.eq.${matricule}`)
        .is('deleted_at', null)
        .maybeSingle();
      console.log('[ScanEleve] Résultat:', data, 'Erreur:', error);
      if (error) throw error;
      return data;
    },
    enabled: !!matricule,
  });

  // Fetch notes/moyennes - bareme comes from cycles table
  const bareme = (eleve?.classes as any)?.niveaux?.cycles?.bareme || 20;
  const { data: notes } = useQuery({
    queryKey: ['scan-eleve-notes', eleve?.id],
    queryFn: async () => {
      if (!eleve?.id) return [];
      const { data } = await supabase
        .from('notes')
        .select('note, matieres!notes_matiere_id_fkey(nom, coefficient), periodes!notes_periode_id_fkey(nom)')
        .eq('eleve_id', eleve.id);
      return data || [];
    },
    enabled: !!eleve?.id,
  });

  // Compute averages per period
  const moyennesParPeriode = (() => {
    if (!notes?.length) return [];
    const grouped: Record<string, { total: number; count: number }> = {};
    notes.forEach((n: any) => {
      const periode = n.periodes?.nom || 'Inconnu';
      if (!grouped[periode]) grouped[periode] = { total: 0, count: 0 };
      if (n.note !== null) {
        grouped[periode].total += (n.note / bareme) * 20;
        grouped[periode].count += 1;
      }
    });
    return Object.entries(grouped).map(([nom, v]) => ({
      nom,
      moyenne: (v.total / v.count).toFixed(2),
    }));
  })();

  const resetScan = () => {
    setMatricule(null);
    setScanning(true);
  };

  const classe = eleve?.classes as any;
  const famille = eleve?.familles as any;
  const zone = eleve?.zones_transport as any;

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
          <ScanLine className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan Élève</h1>
          <p className="text-sm text-muted-foreground">Scannez un badge pour voir les informations</p>
        </div>
      </div>

      {/* Scan zone */}
      {scanning && !matricule && (
        <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/10">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" style={{ animationDuration: '2s' }} />
              <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <ScanLine className="h-16 w-16 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">En attente de scan…</p>
              <p className="text-sm text-muted-foreground">Placez le badge élève devant la douchette</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && matricule && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {/* Not found */}
      {!isLoading && matricule && !eleve && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="font-semibold text-lg">Aucun élève trouvé</p>
            <p className="text-sm text-muted-foreground">Matricule : {matricule}</p>
            <button onClick={resetScan} className="mt-3 px-6 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
              Nouveau scan
            </button>
          </CardContent>
        </Card>
      )}

      {/* Student Info Display */}
      {eleve && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Profile Hero Card */}
          <Card className="overflow-hidden border-0 shadow-xl">
            <div className="bg-gradient-to-r from-primary via-primary/80 to-accent h-28 relative">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMEwyMCA0MCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIvPjxwYXRoIGQ9Ik0wIDIwTDQwIDIwIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1Ii8+PC9zdmc+')] opacity-50" />
            </div>
            <CardContent className="relative pt-0 pb-6 px-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-14">
                {/* Avatar */}
                <div className="relative z-10">
                  {eleve.photo_thumbnail_url || eleve.photo_url ? (
                    <PhotoWithSkeleton src={eleve.photo_thumbnail_url || eleve.photo_url} />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-muted to-muted/50 border-4 border-background shadow-lg flex items-center justify-center">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap shadow-md" variant={eleve.statut === 'inscrit' ? 'default' : 'secondary'}>
                    {eleve.statut}
                  </Badge>
                </div>
                {/* Name & Class */}
                <div className="flex-1 text-center sm:text-left pb-1">
                  <h2 className="text-2xl font-bold">{eleve.prenom} {eleve.nom}</h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                    <Badge variant="outline" className="gap-1">
                      <Hash className="h-3 w-3" /> {eleve.matricule}
                    </Badge>
                    {classe && (
                      <Badge variant="outline" className="gap-1 bg-primary/5">
                        <GraduationCap className="h-3 w-3" /> {classe.nom}
                        {classe.niveaux && ` — ${classe.niveaux.nom}`}
                        {classe.niveaux?.cycles && ` (${classe.niveaux.cycles.nom})`}
                      </Badge>
                    )}
                  </div>
                  {eleve.date_naissance && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center sm:justify-start gap-1">
                      <Calendar className="h-3 w-3" /> Né(e) le {new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}
                      {eleve.sexe && ` • ${eleve.sexe === 'M' ? 'Garçon' : 'Fille'}`}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Family */}
            {famille && (
              <Card className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-xl bg-blue-500/10">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-lg">Famille</h3>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <p className="font-medium text-base">{famille.nom_famille}</p>
                    {eleve.nom_prenom_pere && <p className="text-muted-foreground">👨 Père : {eleve.nom_prenom_pere}</p>}
                    {eleve.nom_prenom_mere && <p className="text-muted-foreground">👩 Mère : {eleve.nom_prenom_mere}</p>}
                    {famille.telephone_pere && (
                      <a href={`tel:${famille.telephone_pere}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" /> 👨 {famille.telephone_pere}
                      </a>
                    )}
                    {famille.telephone_mere && (
                      <a href={`tel:${famille.telephone_mere}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" /> 👩 {famille.telephone_mere}
                      </a>
                    )}
                    {famille.email_parent && (
                      <a href={`mailto:${famille.email_parent}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Mail className="h-3.5 w-3.5" /> {famille.email_parent}
                      </a>
                    )}
                    {famille.adresse && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" /> {famille.adresse}
                      </p>
                    )}
                    {famille.solde_famille != null && (
                      <div className="mt-2 p-2 rounded-lg bg-muted/50">
                        <span className="text-xs text-muted-foreground">Solde famille</span>
                        <p className="font-bold text-lg">{Number(famille.solde_famille).toLocaleString('fr-FR')} GNF</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Options & Services */}
            <Card className="group hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <Wrench className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-lg">Options & Services</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OptionBadge active={eleve.option_cantine} icon={<Utensils className="h-3.5 w-3.5" />} label="Cantine" />
                  <OptionBadge active={!!zone} icon={<BusFront className="h-3.5 w-3.5" />} label={zone ? `Transport — ${zone.nom}` : 'Transport'} />
                  <OptionBadge active={eleve.option_fournitures} icon={<BookOpenText className="h-3.5 w-3.5" />} label="Fournitures" />
                  <OptionBadge active={eleve.option_robotique} icon={<Wrench className="h-3.5 w-3.5" />} label="Robotique" />
                  <OptionBadge active={eleve.uniforme_scolaire} icon={<User className="h-3.5 w-3.5" />} label="Uniforme Scolaire" />
                  <OptionBadge active={eleve.uniforme_sport} icon={<User className="h-3.5 w-3.5" />} label="Uniforme Sport" />
                </div>
                {eleve.solde_cantine != null && (
                  <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/10">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Utensils className="h-3 w-3" /> Solde Cantine</span>
                    <p className={`font-bold text-xl ${(eleve.solde_cantine || 0) < 5000 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {Number(eleve.solde_cantine).toLocaleString('fr-FR')} GNF
                    </p>
                  </div>
                )}
                {zone && (
                  <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/10">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><BusFront className="h-3 w-3" /> Zone Transport</span>
                    <p className="font-semibold">{zone.nom}</p>
                    <p className="text-xs text-muted-foreground">{eleve.type_trajet_transport || 'Aller-retour'} • {Number(zone.tarif_mensuel || 0).toLocaleString('fr-FR')} GNF/mois</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Moyennes */}
            <Card className="group hover:shadow-lg transition-shadow md:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-lg">Moyennes par Période</h3>
                </div>
                {moyennesParPeriode.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {moyennesParPeriode.map((m) => {
                      const val = parseFloat(m.moyenne);
                      const color = val >= 14 ? 'text-emerald-600 bg-emerald-500/10' : val >= 10 ? 'text-amber-600 bg-amber-500/10' : 'text-destructive bg-destructive/10';
                      return (
                        <div key={m.nom} className={`p-4 rounded-xl text-center ${color}`}>
                          <p className="text-xs font-medium opacity-70">{m.nom}</p>
                          <p className="text-2xl font-bold mt-1">{m.moyenne}</p>
                          <p className="text-xs opacity-60">/20</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucune note enregistrée</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* New scan button */}
          <div className="flex justify-center pt-2 pb-8">
            <button onClick={resetScan} className="px-8 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
              <ScanLine className="inline h-5 w-5 mr-2" />
              Nouveau scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionBadge({ active, icon, label }: { active: boolean | null | undefined; icon: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border border-transparent'}`}>
      {icon} {label} {active ? '✓' : '✗'}
    </span>
  );
}

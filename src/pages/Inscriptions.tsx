import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { UserPlus, Search, Plus, CheckCircle2, MapPin, Bell, Users, Download, Trash2, Pencil, Phone, Camera, EyeOff, Eye, GraduationCap } from 'lucide-react';
import QRScannerDialog from '@/components/QRScannerDialog';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { exportToExcel } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useZonesTransport } from './Configuration';
import InscriptionFamilleForm from '@/components/InscriptionFamilleForm';
import ImportElevesExcel from '@/components/ImportElevesExcel';

export default function Inscriptions() {
  const [inscriptionOpen, setInscriptionOpen] = useState(false);
  const [inscriptionMode, setInscriptionMode] = useState<'individuel' | 'famille'>('individuel');
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  const [selectedClasse, setSelectedClasse] = useState<string>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [editEleve, setEditEleve] = useState<any>(null);
  const [editNom, setEditNom] = useState('');
  const [editPrenom, setEditPrenom] = useState('');
  const [editSexe, setEditSexe] = useState('');
  const [editDateNaissance, setEditDateNaissance] = useState('');
  const [editClasseId, setEditClasseId] = useState('');
  const [editFamilleId, setEditFamilleId] = useState('');
  const [editZoneTransportId, setEditZoneTransportId] = useState('');
  const [editForfait, setEditForfait] = useState(false);
  const [editOptionCantine, setEditOptionCantine] = useState(false);
  const [editCheckLivret, setEditCheckLivret] = useState(false);
  const [editCheckRames, setEditCheckRames] = useState(false);
  const [editCheckMarqueurs, setEditCheckMarqueurs] = useState(false);
  const [editCheckPhoto, setEditCheckPhoto] = useState(false);
  const [editNomPrenomPere, setEditNomPrenomPere] = useState('');
  const [editNomPrenomMere, setEditNomPrenomMere] = useState('');
  const queryClient = useQueryClient();

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*, classes(nom, niveau_id, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))), familles(nom_famille, telephone_pere, telephone_mere)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-with-niveaux'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, niveaux:niveau_id(nom, ordre, cycle_id, frais_scolarite, frais_inscription, frais_reinscription, frais_dossier, frais_assurance, cycles:cycle_id(id, nom, ordre))')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: familles = [] } = useQuery({
    queryKey: ['familles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('familles').select('*').order('nom_famille');
      if (error) throw error;
      return data;
    },
  });

  const { data: tarifs = [] } = useQuery({
    queryKey: ['tarifs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tarifs').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: zones = [] } = useZonesTransport();

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: niveaux = [] } = useQuery({
    queryKey: ['niveaux'],
    queryFn: async () => {
      const { data, error } = await supabase.from('niveaux').select('*, cycles:cycle_id(nom)').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const sendRappel = useMutation({
    mutationFn: async (eleve: any) => {
      const manquants = [
        !eleve.checklist_livret && 'Livret scolaire',
        !eleve.checklist_rames && 'Paquet de Rames',
        !eleve.checklist_marqueurs && 'Marqueurs',
        !eleve.checklist_photo && "Photo d'identité",
      ].filter(Boolean);
      if (!manquants.length) throw new Error('Tous les documents sont fournis');
      const { error } = await supabase.from('notifications').insert({
        titre: 'Documents manquants',
        message: `L'élève ${eleve.prenom} ${eleve.nom} n'a pas encore fourni : ${manquants.join(', ')}.`,
        type: 'alerte',
        destinataire_type: 'famille',
        destinataire_ref: eleve.famille_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Rappel envoyé', description: 'La notification a été créée.' }),
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eleves').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      toast({ title: 'Élève supprimé' });
      setEditOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const handleExportExcel = () => {
    const data = filtered.map((e: any) => {
      const manquants = [
        !e.checklist_livret && 'Livret scolaire',
        !e.checklist_rames && 'Paquet de Rames',
        !e.checklist_marqueurs && 'Marqueurs',
        !e.checklist_photo && "Photo d'identité",
      ].filter(Boolean) as string[];
      return {
        Matricule: e.matricule || '',
        Nom: e.nom, Prénom: e.prenom, Sexe: e.sexe || '',
        Classe: e.classes?.nom || '', Famille: e.familles?.nom_famille || '',
        Statut: e.statut,
        'Père': (e as any).nom_prenom_pere || '', 'Mère': (e as any).nom_prenom_mere || '',
        'Tél. Père': e.familles?.telephone_pere || '', 'Tél. Mère': e.familles?.telephone_mere || '',
        'Documents manquants': manquants.length > 0 ? manquants.join(', ') : 'Complet',
      };
    });
    if (!data.length) { toast({ title: 'Aucune donnée', variant: 'destructive' }); return; }
    exportToExcel(data, 'liste-eleves-inscrits', 'Élèves');
    toast({ title: `${data.length} élève(s) exporté(s)` });
  };

  // Dossier completeness
  const isDossierComplete = (e: any) => !!e.checklist_livret && !!e.checklist_rames && !!e.checklist_marqueurs && !!e.checklist_photo;
  const normalizePhone = (phone: string) => phone.replace(/[\s\-\+\(\)]/g, '').replace(/^(224|00224)/, '');
  const isSearchActive = search.trim().length > 0;
  const searchLower = search.toLowerCase();
  const searchNorm = normalizePhone(search);
  const completeDossiers = eleves.filter(isDossierComplete).length;

  const filtered = eleves.filter((e: any) => {
    const basicMatch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(searchLower);
    const telPere = e.familles?.telephone_pere || '';
    const telMere = e.familles?.telephone_mere || '';
    const phoneMatch = searchNorm.length >= 3 && (
      normalizePhone(telPere).includes(searchNorm) || normalizePhone(telMere).includes(searchNorm)
    );
    const matchSearch = basicMatch || phoneMatch;
    if (isSearchActive) return matchSearch;
    if (!showComplete && isDossierComplete(e)) return false;
    // Filter by cycle
    if (selectedCycle !== 'all') {
      const cycleId = e.classes?.niveaux?.cycle_id;
      if (cycleId !== selectedCycle) return false;
    }
    // Filter by classe
    if (selectedClasse !== 'all') {
      if (e.classe_id !== selectedClasse) return false;
    }
    return true;
  });

  // Build grouped structure: niveaux containing classes for the selected cycle
  const classesForCycle = useMemo(() => {
    const filtered = selectedCycle === 'all' ? classes : classes.filter((c: any) => c.niveaux?.cycle_id === selectedCycle);
    return filtered.sort((a: any, b: any) => {
      const niveauOrdreA = a.niveaux?.ordre ?? 0;
      const niveauOrdreB = b.niveaux?.ordre ?? 0;
      if (niveauOrdreA !== niveauOrdreB) return niveauOrdreA - niveauOrdreB;
      return (a.nom || '').localeCompare(b.nom || '', 'fr');
    });
  }, [classes, selectedCycle]);

  const niveauxForCycle = useMemo(() => {
    if (selectedCycle === 'all') return niveaux;
    return niveaux.filter((n: any) => n.cycle_id === selectedCycle);
  }, [niveaux, selectedCycle]);

  const openEditDialog = (e: any) => {
    setEditEleve(e);
    setEditNom(e.nom); setEditPrenom(e.prenom);
    setEditSexe(e.sexe || ''); setEditDateNaissance(e.date_naissance || '');
    setEditClasseId(e.classe_id || ''); setEditFamilleId(e.famille_id || '');
    setEditZoneTransportId(e.zone_transport_id || '');
    setEditForfait(false); setEditOptionCantine(!!e.option_cantine);
    setEditCheckLivret(!!e.checklist_livret); setEditCheckRames(!!e.checklist_rames);
    setEditCheckMarqueurs(!!e.checklist_marqueurs); setEditCheckPhoto(!!e.checklist_photo);
    setEditNomPrenomPere(e.nom_prenom_pere || ''); setEditNomPrenomMere(e.nom_prenom_mere || '');
    setEditOpen(true);
  };

  const editSelectedZone = zones?.find((z: any) => z.id === editZoneTransportId);

  const updateEleve = useMutation({
    mutationFn: async () => {
      if (!editEleve) throw new Error('Aucun élève sélectionné');

      let finalFamilleId = editFamilleId || null;
      const pereNorm = editNomPrenomPere.trim().toLowerCase();
      const mereNorm = editNomPrenomMere.trim().toLowerCase();

      // Auto-regroupement familial par noms de parents identiques
      if (pereNorm || mereNorm) {
        // Chercher un élève existant avec les mêmes noms de parents et déjà dans une famille
        const { data: siblings } = await supabase
          .from('eleves')
          .select('id, famille_id, nom_prenom_pere, nom_prenom_mere')
          .is('deleted_at', null)
          .not('famille_id', 'is', null)
          .neq('id', editEleve.id);

        const matchingSibling = (siblings || []).find((s: any) => {
          const sPere = (s.nom_prenom_pere || '').trim().toLowerCase();
          const sMere = (s.nom_prenom_mere || '').trim().toLowerCase();
          const pereMatch = pereNorm && sPere && pereNorm === sPere;
          const mereMatch = mereNorm && sMere && mereNorm === sMere;
          return pereMatch || mereMatch;
        });

        if (matchingSibling && matchingSibling.famille_id) {
          finalFamilleId = matchingSibling.famille_id;
          toast({ title: '👨‍👩‍👧‍👦 Famille détectée', description: `Élève regroupé automatiquement dans la famille existante.` });
        } else if (!finalFamilleId && (pereNorm || mereNorm)) {
          // Pas de fratrie trouvée et pas de famille assignée → chercher aussi les élèves sans famille avec mêmes parents
          const { data: orphans } = await supabase
            .from('eleves')
            .select('id, nom_prenom_pere, nom_prenom_mere')
            .is('deleted_at', null)
            .is('famille_id', null)
            .neq('id', editEleve.id);

          const matchingOrphans = (orphans || []).filter((s: any) => {
            const sPere = (s.nom_prenom_pere || '').trim().toLowerCase();
            const sMere = (s.nom_prenom_mere || '').trim().toLowerCase();
            const pereMatch = pereNorm && sPere && pereNorm === sPere;
            const mereMatch = mereNorm && sMere && mereNorm === sMere;
            return pereMatch || mereMatch;
          });

          // Créer une nouvelle famille et y regrouper tous ces enfants
          const nomFamille = editNomPrenomPere.trim() ? editNom.trim().toUpperCase() : editNom.trim().toUpperCase();
          const codeAcces = `FAM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const { data: newFamille, error: famError } = await supabase
            .from('familles')
            .insert({
              nom_famille: nomFamille,
              code_acces: codeAcces,
              telephone_pere: null,
              telephone_mere: null,
            } as any)
            .select()
            .single();
          if (famError) throw famError;
          finalFamilleId = newFamille.id;

          // Regrouper les orphelins correspondants dans cette famille
          if (matchingOrphans.length > 0) {
            const orphanIds = matchingOrphans.map((o: any) => o.id);
            await supabase.from('eleves').update({ famille_id: newFamille.id } as any).in('id', orphanIds);
            toast({ title: '👨‍👩‍👧‍👦 Famille créée', description: `${matchingOrphans.length + 1} enfant(s) regroupés dans la famille "${nomFamille}" (Code: ${codeAcces}).` });
          } else {
            toast({ title: '👨‍👩‍👧‍👦 Famille créée', description: `Famille "${nomFamille}" créée (Code: ${codeAcces}).` });
          }
        }
      }

      const { error } = await supabase.from('eleves').update({
        nom: editNom.trim(), prenom: editPrenom.trim(),
        sexe: editSexe || null, date_naissance: editDateNaissance || null,
        classe_id: editClasseId || null, famille_id: finalFamilleId,
        zone_transport_id: editZoneTransportId || null,
        transport_zone: editSelectedZone?.nom || null,
        option_cantine: editOptionCantine,
        checklist_livret: editCheckLivret, checklist_rames: editCheckRames,
        checklist_marqueurs: editCheckMarqueurs, checklist_photo: editCheckPhoto,
        nom_prenom_pere: editNomPrenomPere || null, nom_prenom_mere: editNomPrenomMere || null,
      } as any).eq('id', editEleve.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      queryClient.invalidateQueries({ queryKey: ['familles'] });
      toast({ title: 'Élève modifié' });
      setEditOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const openInscription = (mode: 'individuel' | 'famille') => {
    setInscriptionMode(mode);
    setInscriptionOpen(true);
  };

  const renderStudentRow = (e: any, showClasse = false) => {
    const manquants = [
      !e.checklist_livret && 'Livret scolaire',
      !e.checklist_rames && 'Paquet de Rames',
      !e.checklist_marqueurs && 'Marqueurs',
      !e.checklist_photo && "Photo d'identité",
    ].filter(Boolean) as string[];
    const telPere = e.familles?.telephone_pere;
    const telMere = e.familles?.telephone_mere;
    return (
      <TableRow key={e.id}>
        <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
        <TableCell className="font-medium">{e.nom}</TableCell>
        <TableCell>{e.prenom}</TableCell>
        {showClasse && <TableCell>{e.classes?.nom || '—'}</TableCell>}
        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
          {e.nom_prenom_pere || e.nom_prenom_mere ? `${e.nom_prenom_pere || '—'} / ${e.nom_prenom_mere || '—'}` : '—'}
        </TableCell>
        <TableCell>
          {manquants.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="cursor-pointer">
                  <Badge variant="outline" className="text-warning border-warning/30 text-xs hover:bg-warning/10 transition-colors">{manquants.length} manquant(s)</Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3">
                <p className="font-semibold text-sm mb-2">Documents manquants :</p>
                <ul className="space-y-1">
                  {manquants.map((doc) => (
                    <li key={doc} className="text-sm flex items-center gap-1.5">
                      <span className="text-destructive">✗</span> {doc}
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          ) : (
            <Badge variant="default" className="text-xs">Complet</Badge>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={e.statut === 'inscrit' ? 'default' : 'secondary'}>{e.statut}</Badge>
        </TableCell>
        <TableCell className="flex gap-1">
          <Button variant="ghost" size="sm" title="Modifier" onClick={() => openEditDialog(e)}>
            <Pencil className="h-4 w-4 text-primary" />
          </Button>
          {manquants.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" title="Envoyer un rappel">
                  <Bell className="h-4 w-4 text-warning" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3">
                <p className="font-semibold text-sm mb-2">Notifier les parents de {e.prenom} {e.nom}</p>
                <p className="text-xs text-muted-foreground mb-2">Documents manquants : {manquants.join(', ')}</p>
                {(telPere || telMere) ? (
                  <div className="space-y-1.5 mb-3">
                    {telPere && <p className="text-sm">📱 Père : <a href={`tel:${telPere}`} className="text-primary underline">{telPere}</a></p>}
                    {telMere && <p className="text-sm">📱 Mère : <a href={`tel:${telMere}`} className="text-primary underline">{telMere}</a></p>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">Aucun numéro enregistré.</p>
                )}
                <Button size="sm" className="w-full" onClick={() => sendRappel.mutate(e)}>
                  <Bell className="h-3.5 w-3.5 mr-1" /> Envoyer le rappel
                </Button>
              </PopoverContent>
            </Popover>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserPlus className="h-7 w-7 text-primary" /> Inscriptions
        </h1>
        <div className="flex gap-2">
          <ImportElevesExcel classes={classes} />
          <Button variant="outline" onClick={handleExportExcel}><Download className="h-4 w-4 mr-2" /> Export Excel</Button>
          <Button onClick={() => openInscription('individuel')}><Plus className="h-4 w-4 mr-2" /> Nouvelle Inscription</Button>
          <Button variant="secondary" onClick={() => openInscription('famille')}><Users className="h-4 w-4 mr-2" /> Inscription Famille</Button>
        </div>
      </div>

      {/* ─── Unified Inscription Dialog ─── */}
      <Dialog open={inscriptionOpen} onOpenChange={setInscriptionOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {inscriptionMode === 'individuel' ? "Inscription d'un élève" : 'Inscription Famille — Multi-enfants'}
            </DialogTitle>
          </DialogHeader>
          <InscriptionFamilleForm
            classes={classes}
            familles={familles}
            tarifs={tarifs}
            existingEleves={eleves}
            onSuccess={() => setInscriptionOpen(false)}
            mode={inscriptionMode}
          />
        </DialogContent>
      </Dialog>

      {/* Gender stats */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="gap-1 text-sm py-1 px-3">
          <Users className="h-4 w-4" /> Total: {filtered.length}
        </Badge>
        <Badge variant="outline" className="gap-1 text-sm py-1 px-3 text-blue-600 border-blue-300">
          ♂ Garçons: {filtered.filter((e: any) => e.sexe === 'M').length}
        </Badge>
        <Badge variant="outline" className="gap-1 text-sm py-1 px-3 text-pink-600 border-pink-300">
          ♀ Filles: {filtered.filter((e: any) => e.sexe === 'F').length}
        </Badge>
      </div>

      {/* Search + Toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher nom, téléphone, matricule..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-10" />
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setScannerOpen(true)} title="Scanner par caméra">
            <Camera className="h-4 w-4 text-primary" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={showComplete} onCheckedChange={setShowComplete} id="toggle-complete" />
          <Label htmlFor="toggle-complete" className="text-sm cursor-pointer flex items-center gap-1.5">
            {showComplete ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showComplete ? 'Afficher tous' : 'Dossiers en cours'}
          </Label>
          {!showComplete && completeDossiers > 0 && (
            <Badge variant="secondary" className="text-xs">{completeDossiers} complet{completeDossiers > 1 ? 's' : ''} masqué{completeDossiers > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </div>
      <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={(matricule) => setSearch(matricule)} />

      {/* Cycle Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCycle === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setSelectedCycle('all'); setSelectedClasse('all'); }}
        >
          <GraduationCap className="h-4 w-4 mr-1" /> Tous
          <Badge variant="secondary" className="ml-1.5 text-xs">{eleves.length}</Badge>
        </Button>
        {cycles.map((cycle: any) => {
          const count = eleves.filter((e: any) => {
            const cId = e.classes?.niveaux?.cycle_id;
            return cId === cycle.id;
          }).length;
          return (
            <Button
              key={cycle.id}
              variant={selectedCycle === cycle.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSelectedCycle(cycle.id); setSelectedClasse('all'); }}
            >
              {cycle.nom}
              <Badge variant="secondary" className="ml-1.5 text-xs">{count}</Badge>
            </Button>
          );
        })}
      </div>

      {/* Classe filter within selected cycle */}
      {selectedCycle !== 'all' && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={selectedClasse === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedClasse('all')}
          >
            Toutes les classes
          </Button>
          {niveauxForCycle.map((niveau: any) => {
            const nClasses = classesForCycle.filter((c: any) => c.niveau_id === niveau.id);
            if (nClasses.length === 0) return null;
            return nClasses.map((c: any) => {
              const cCount = filtered.filter((e: any) => e.classe_id === c.id).length;
              return (
                <Button
                  key={c.id}
                  variant={selectedClasse === c.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedClasse(c.id)}
                >
                  {niveau.nom} — {c.nom}
                  <Badge variant="outline" className="ml-1 text-[10px] px-1">{cCount}</Badge>
                </Button>
              );
            });
          })}
        </div>
      )}

      {/* Student table */}
      <Card>
        <CardContent className="p-0">
          {selectedCycle !== 'all' && selectedClasse === 'all' ? (
            /* Grouped view by niveau > classe */
            <Accordion type="multiple" className="w-full" defaultValue={niveauxForCycle.map((n: any) => n.id)}>
              {niveauxForCycle.map((niveau: any) => {
                const nClasses = classesForCycle.filter((c: any) => c.niveau_id === niveau.id);
                const niveauEleves = filtered.filter((e: any) => nClasses.some((c: any) => c.id === e.classe_id));
                if (nClasses.length === 0) return null;
                return (
                  <AccordionItem key={niveau.id} value={niveau.id}>
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{niveau.nom}</span>
                        <Badge variant="secondary" className="text-xs">{niveauEleves.length} élève(s)</Badge>
                        <span className="text-xs text-muted-foreground">({nClasses.length} classe{nClasses.length > 1 ? 's' : ''})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      {nClasses.map((classe: any) => {
                        const classeEleves = filtered.filter((e: any) => e.classe_id === classe.id);
                        return (
                          <div key={classe.id}>
                            <div className="px-4 py-2 bg-muted/50 border-y flex items-center gap-2">
                              <span className="text-sm font-medium">{classe.nom}</span>
                              <Badge variant="outline" className="text-xs">{classeEleves.length}</Badge>
                            </div>
                            {classeEleves.length === 0 ? (
                              <p className="text-center text-muted-foreground text-sm py-4">Aucun élève dans cette classe</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Matricule</TableHead>
                                    <TableHead>Nom</TableHead>
                                    <TableHead>Prénom</TableHead>
                                    <TableHead>Filiation</TableHead>
                                    <TableHead>Documents</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {classeEleves.map((e: any) => renderStudentRow(e))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            /* Flat table view */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Filiation</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
                ) : filtered.map((e: any) => renderStudentRow(e, true))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      {/* ─── Edit Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Fiche de {editEleve?.prenom} {editEleve?.nom}</DialogTitle></DialogHeader>
          {editEleve && (
            <Tabs defaultValue="informations" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="informations">Informations</TabsTrigger>
                <TabsTrigger value="famille">Famille</TabsTrigger>
                <TabsTrigger value="options">Options</TabsTrigger>
              </TabsList>

              <TabsContent value="informations" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nom *</Label><Input value={editNom} onChange={e => setEditNom(e.target.value)} /></div>
                  <div><Label>Prénom *</Label><Input value={editPrenom} onChange={e => setEditPrenom(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Sexe</Label>
                    <Select value={editSexe} onValueChange={setEditSexe}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date de naissance</Label><Input type="date" value={editDateNaissance} onChange={e => setEditDateNaissance(e.target.value)} /></div>
                </div>
                <div>
                  <Label>Classe</Label>
                  <Select value={editClasseId} onValueChange={setEditClasseId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Matricule</Label>
                  <Input value={editEleve.matricule || '—'} disabled className="bg-muted" />
                </div>
              </TabsContent>

              <TabsContent value="famille" className="space-y-3 mt-4">
                <div>
                  <Label>Famille (fratrie)</Label>
                  <Select value={editFamilleId || '__none__'} onValueChange={(v) => setEditFamilleId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {familles.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nom_famille}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nom & Prénom du père</Label><Input value={editNomPrenomPere} onChange={e => setEditNomPrenomPere(e.target.value)} /></div>
                <div><Label>Nom & Prénom de la mère</Label><Input value={editNomPrenomMere} onChange={e => setEditNomPrenomMere(e.target.value)} /></div>
                {editEleve.familles && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 space-y-2">
                      <p className="text-sm font-medium">Contacts famille</p>
                      {editEleve.familles.telephone_pere && <p className="text-sm flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Père : <a href={`tel:${editEleve.familles.telephone_pere}`} className="text-primary underline">{editEleve.familles.telephone_pere}</a></p>}
                      {editEleve.familles.telephone_mere && <p className="text-sm flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Mère : <a href={`tel:${editEleve.familles.telephone_mere}`} className="text-primary underline">{editEleve.familles.telephone_mere}</a></p>}
                      {!editEleve.familles.telephone_pere && !editEleve.familles.telephone_mere && <p className="text-xs text-muted-foreground">Aucun numéro enregistré</p>}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="options" className="space-y-4 mt-4">
                <div>
                  <p className="text-sm font-medium mb-2">Check-list documents</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckLivret} onCheckedChange={(v) => setEditCheckLivret(!!v)} /><Label>Livret scolaire</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckRames} onCheckedChange={(v) => setEditCheckRames(!!v)} /><Label>Paquet de Rames</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckMarqueurs} onCheckedChange={(v) => setEditCheckMarqueurs(!!v)} /><Label>Marqueurs</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckPhoto} onCheckedChange={(v) => setEditCheckPhoto(!!v)} /><Label>Photo d'identité</Label></div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Transport</p>
                  <Select value={editZoneTransportId || '__none__'} onValueChange={(v) => setEditZoneTransportId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Pas de transport" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Pas de transport</SelectItem>
                      {zones?.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom} — {Number(z.prix_mensuel).toLocaleString()} GNF/mois</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {editSelectedZone && <p className="text-xs text-accent mt-1">💰 {Number(editSelectedZone.prix_mensuel).toLocaleString()} GNF/mois</p>}
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div><p className="text-sm font-medium">Cantine</p><p className="text-xs text-muted-foreground">Activer/désactiver</p></div>
                  <Switch checked={editOptionCantine} onCheckedChange={setEditOptionCantine} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div><p className="text-sm font-medium">Prix forfaitaire famille</p><p className="text-xs text-muted-foreground">Tarif forfaitaire (3+ enfants)</p></div>
                  <Switch checked={editForfait} onCheckedChange={setEditForfait} />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full"><Trash2 className="h-4 w-4 mr-2" /> Supprimer le dossier</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cet élève ?</AlertDialogTitle>
                      <AlertDialogDescription>{editEleve.prenom} {editEleve.nom} sera déplacé dans la corbeille.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => softDelete.mutate(editEleve.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>

              <Button onClick={() => updateEleve.mutate()} disabled={updateEleve.isPending} className="w-full mt-4">
                Enregistrer les modifications
              </Button>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { UserPlus, Search, Plus, CheckCircle2, MapPin, Bell, ShieldCheck, Users, Download, Trash2, Pencil, Phone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { exportToExcel } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useZonesTransport } from './Configuration';
import MandatairesForm, { Mandataire, createEmptyMandataires, uploadMandatairePhotos } from '@/components/MandatairesForm';

export default function Inscriptions() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  // Form state
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [sexe, setSexe] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [classeId, setClasseId] = useState('');
  const [familleId, setFamilleId] = useState('');
  const [zoneTransportId, setZoneTransportId] = useState('');
  const [adresse, setAdresse] = useState('');
  const [checkLivret, setCheckLivret] = useState(false);
  const [checkRames, setCheckRames] = useState(false);
  const [checkMarqueurs, setCheckMarqueurs] = useState(false);
  const [uniformeScolaire, setUniformeScolaire] = useState(false);
  const [uniformeSport, setUniformeSport] = useState(false);
  const [uniformePolo, setUniformePolo] = useState(false);
  const [uniformeKarate, setUniformeKarate] = useState(false);
  const [optionCantine, setOptionCantine] = useState(false);
  const [optionFournitures, setOptionFournitures] = useState(false);
  const [checkPhoto, setCheckPhoto] = useState(false);
  const [nomPrenomPere, setNomPrenomPere] = useState('');
  const [nomPrenomMere, setNomPrenomMere] = useState('');
  const [mandataires, setMandataires] = useState<Mandataire[]>(createEmptyMandataires());
  const [photoEleve, setPhotoEleve] = useState<File | null>(null);
  const [photoElevePreview, setPhotoElevePreview] = useState<string | null>(null);
  const [typeInscription, setTypeInscription] = useState<'inscription' | 'reinscription'>('inscription');

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
        .select('*, niveaux:niveau_id(nom, frais_scolarite, cycles:cycle_id(nom))');
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

  // Suggest zone based on address
  const suggestedZoneId = useMemo(() => {
    if (!adresse || !zones?.length) return null;
    const adresseLower = adresse.toLowerCase();
    for (const z of zones) {
      const quartiers = (z.quartiers ?? []) as string[];
      if (quartiers.some((q: string) => adresseLower.includes(q.toLowerCase()))) {
        return z.id;
      }
    }
    return null;
  }, [adresse, zones]);

  const selectedZone = zones?.find((z: any) => z.id === zoneTransportId);

  // Detect if selected class is Crèche or Maternelle
  const isCrecheMaternelle = useMemo(() => {
    if (!classeId || !classes.length) return false;
    const cl = classes.find((c: any) => c.id === classeId);
    const cycleName = cl?.niveaux?.cycles?.nom?.toLowerCase() || '';
    return cycleName.includes('crèche') || cycleName.includes('creche') || cycleName.includes('maternelle');
  }, [classeId, classes]);

  const generateMatricule = async () => {
    const now = new Date();
    const prefix = `EDU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await supabase
      .from('eleves')
      .select('*', { count: 'exact', head: true })
      .like('matricule', `${prefix}%`);
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  };

  const inscription = useMutation({
    mutationFn: async () => {
      if (!nom.trim() || !prenom.trim() || !classeId) {
        throw new Error('Nom, prénom et classe sont obligatoires');
      }
      const matricule = await generateMatricule();
      const qrCode = matricule;

      // Upload child photo if provided
      let photoUrl: string | null = null;
      if (photoEleve) {
        const ext = photoEleve.name.split('.').pop() || 'jpg';
        const path = `eleves/${matricule}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('photos').upload(path, photoEleve, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }

      const { data: insertedEleve, error } = await supabase.from('eleves').insert({
        nom: nom.trim(), prenom: prenom.trim(), sexe: sexe || null, date_naissance: dateNaissance || null,
        classe_id: classeId, famille_id: familleId || null,
        matricule, qr_code: qrCode,
        transport_zone: selectedZone?.nom || null,
        zone_transport_id: zoneTransportId || null,
        checklist_livret: checkLivret, checklist_rames: checkRames, checklist_marqueurs: checkMarqueurs,
        checklist_photo: checkPhoto,
        uniforme_scolaire: uniformeScolaire, uniforme_sport: uniformeSport,
        uniforme_polo_lacoste: uniformePolo, uniforme_karate: uniformeKarate,
        option_cantine: optionCantine, option_fournitures: optionFournitures,
        nom_prenom_pere: nomPrenomPere || null,
        nom_prenom_mere: nomPrenomMere || null,
        statut: 'inscrit',
        photo_url: photoUrl,
      } as any).select('id').single();
      if (error) throw error;

      // Save mandataires for Crèche/Maternelle
      if (isCrecheMaternelle && insertedEleve) {
        const uploaded = await uploadMandatairePhotos(mandataires, insertedEleve.id);
        const mandatairesData = uploaded.map((m, i) => ({
          eleve_id: insertedEleve.id,
          nom: m.nom.trim(),
          prenom: m.prenom.trim(),
          lien_parente: m.lien_parente,
          photo_url: m.photo_url,
          ordre: i + 1,
        }));
        const validMandataires = mandatairesData.filter(m => m.nom && m.prenom);
        if (validMandataires.length > 0) {
          const { error: mErr } = await supabase.from('mandataires').insert(validMandataires as any);
          if (mErr) console.error('Mandataires error:', mErr);
        }
      }

      // Auto-create only inscription/réinscription payment + uniformes + fournitures
      if (insertedEleve) {
        const paiements: any[] = [];

        // Frais d'inscription/réinscription
        paiements.push({
          eleve_id: insertedEleve.id,
          montant: typeInscription === 'inscription' ? 100000 : 150000,
          type_paiement: typeInscription,
          canal: 'especes',
          mois_concerne: null,
        });

        // Uniformes (one-time)
        if (fraisUniformes > 0) {
          paiements.push({
            eleve_id: insertedEleve.id,
            montant: fraisUniformes,
            type_paiement: 'boutique',
            canal: 'especes',
            mois_concerne: null,
          });
        }

        // Fournitures (one-time)
        if (fraisFournitures > 0) {
          paiements.push({
            eleve_id: insertedEleve.id,
            montant: fraisFournitures,
            type_paiement: 'boutique',
            canal: 'especes',
            mois_concerne: null,
          });
        }

        if (paiements.length > 0) {
          const { error: pErr } = await supabase.from('paiements').insert(paiements as any);
          if (pErr) console.error('Paiements error:', pErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      queryClient.invalidateQueries({ queryKey: ['eleves-full'] });
      toast({ title: 'Inscription réussie', description: `${prenom} ${nom} a été inscrit(e) avec succès.` });
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
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
    onSuccess: () => {
      toast({ title: 'Rappel envoyé', description: 'La notification a été créée avec succès.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eleves').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      toast({ title: 'Élève supprimé', description: 'L\'élève a été déplacé dans la corbeille.' });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
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
        Nom: e.nom,
        Prénom: e.prenom,
        Sexe: e.sexe || '',
        Classe: e.classes?.nom || '',
        Famille: e.familles?.nom_famille || '',
        Statut: e.statut,
        'Père': (e as any).nom_prenom_pere || '',
        'Mère': (e as any).nom_prenom_mere || '',
        'Tél. Père': e.familles?.telephone_pere || '',
        'Tél. Mère': e.familles?.telephone_mere || '',
        'Documents manquants': manquants.length > 0 ? manquants.join(', ') : 'Complet',
        'Nb manquants': manquants.length,
      };
    });
    if (data.length === 0) {
      toast({ title: 'Aucune donnée à exporter', variant: 'destructive' });
      return;
    }
    exportToExcel(data, 'liste-eleves-inscrits', 'Élèves');
    toast({ title: `${data.length} élève(s) exporté(s)` });
  };

  const resetForm = () => {
    setNom(''); setPrenom(''); setSexe(''); setDateNaissance(''); setClasseId('');
    setFamilleId(''); setZoneTransportId(''); setAdresse('');
    setCheckLivret(false); setCheckRames(false); setCheckMarqueurs(false); setCheckPhoto(false);
    setUniformeScolaire(false); setUniformeSport(false); setUniformePolo(false); setUniformeKarate(false);
    setOptionCantine(false); setOptionFournitures(false);
    setNomPrenomPere(''); setNomPrenomMere('');
    setMandataires(createEmptyMandataires());
    setPhotoEleve(null); setPhotoElevePreview(null);
    setTypeInscription('inscription');
  };

  // Calculate fees for selected class
  const selectedClass = classes.find((c: any) => c.id === classeId);
  const fraisScolarite = selectedClass?.niveaux?.frais_scolarite || 0;

  // Fratrie discount
  let nbEnfantsFamille = 0;
  if (familleId) {
    nbEnfantsFamille = eleves.filter((e: any) => e.famille_id === familleId).length;
  }
  const getReduction = (rang: number) => {
    if (rang === 2) return 0.10;
    if (rang >= 3) return 0.20;
    return 0;
  };
  const reduction = getReduction(nbEnfantsFamille + 1);
  const fraisApresReduction = fraisScolarite * (1 - reduction);

  // Transport fee from zone
  const fraisTransport = selectedZone ? Number(selectedZone.prix_mensuel) : 0;

  // Uniform fees
  const getUniformFee = (cat: string) => tarifs.find((t: any) => t.categorie === cat)?.montant || 0;
  const selectedCycleNom = selectedClass?.niveaux?.cycles?.nom || '';
  const isPrimaire = ['Crèche', 'Maternelle', 'Primaire'].includes(selectedCycleNom);
  const tenueScolaireEntries = tarifs.filter((t: any) => t.categorie === 'uniforme_scolaire');
  const prixTenueScolaire = tenueScolaireEntries.length > 1
    ? (tenueScolaireEntries.find((t: any) =>
        isPrimaire ? t.label.toLowerCase().includes('primaire') : (t.label.toLowerCase().includes('collège') || t.label.toLowerCase().includes('lycée'))
      )?.montant || tenueScolaireEntries[0]?.montant || 0)
    : (tenueScolaireEntries[0]?.montant || 0);
  const prixTenueSport = getUniformFee('uniforme_sport');
  const prixPoloLacoste = getUniformFee('uniforme_polo_lacoste');
  const prixKarate = getUniformFee('uniforme_karate');
  const fraisUniformes =
    (uniformeScolaire ? prixTenueScolaire : 0) +
    (uniformeSport ? prixTenueSport : 0) +
    (uniformePolo ? prixPoloLacoste : 0) +
    (uniformeKarate ? prixKarate : 0);

  // Inscription / Réinscription fee
  const fraisInscription = typeInscription === 'inscription' ? 100000 : 150000;

  const fraisFournitures = optionFournitures ? (tarifs.find((t: any) => t.categorie === 'fournitures')?.montant || 0) : 0;
  const totalFrais = fraisInscription + fraisUniformes + fraisFournitures;

  const filtered = eleves.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const openEditDialog = (e: any) => {
    setEditEleve(e);
    setEditNom(e.nom);
    setEditPrenom(e.prenom);
    setEditSexe(e.sexe || '');
    setEditDateNaissance(e.date_naissance || '');
    setEditClasseId(e.classe_id || '');
    setEditFamilleId(e.famille_id || '');
    setEditZoneTransportId(e.zone_transport_id || '');
    setEditForfait(false);
    setEditOptionCantine(!!e.option_cantine);
    setEditCheckLivret(!!e.checklist_livret);
    setEditCheckRames(!!e.checklist_rames);
    setEditCheckMarqueurs(!!e.checklist_marqueurs);
    setEditCheckPhoto(!!e.checklist_photo);
    setEditNomPrenomPere(e.nom_prenom_pere || '');
    setEditNomPrenomMere(e.nom_prenom_mere || '');
    setEditOpen(true);
  };

  const editSelectedZone = zones?.find((z: any) => z.id === editZoneTransportId);

  const updateEleve = useMutation({
    mutationFn: async () => {
      if (!editEleve) throw new Error('Aucun élève sélectionné');
      const { error } = await supabase.from('eleves').update({
        nom: editNom.trim(),
        prenom: editPrenom.trim(),
        sexe: editSexe || null,
        date_naissance: editDateNaissance || null,
        classe_id: editClasseId || null,
        famille_id: editFamilleId || null,
        zone_transport_id: editZoneTransportId || null,
        transport_zone: editSelectedZone?.nom || null,
        option_cantine: editOptionCantine,
        checklist_livret: editCheckLivret,
        checklist_rames: editCheckRames,
        checklist_marqueurs: editCheckMarqueurs,
        checklist_photo: editCheckPhoto,
        nom_prenom_pere: editNomPrenomPere || null,
        nom_prenom_mere: editNomPrenomMere || null,
      } as any).eq('id', editEleve.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      toast({ title: 'Élève modifié', description: `${editPrenom} ${editNom} mis à jour.` });
      setEditOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserPlus className="h-7 w-7 text-primary" /> Inscriptions
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}><Download className="h-4 w-4 mr-2" /> Export Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nouvelle Inscription</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Formulaire d'inscription</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              {/* Identité */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Identité de l'élève</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div><Label>Nom *</Label><Input value={nom} onChange={e => setNom(e.target.value)} /></div>
                  <div><Label>Prénom *</Label><Input value={prenom} onChange={e => setPrenom(e.target.value)} /></div>
                  <div>
                    <Label>Sexe</Label>
                    <Select value={sexe} onValueChange={setSexe}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date de naissance</Label><Input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} /></div>
                  <div className="col-span-2">
                    <Label>Photo de l'élève</Label>
                    <div className="flex items-center gap-3 mt-1">
                      {photoElevePreview ? (
                        <img src={photoElevePreview} alt="Photo élève" className="w-16 h-16 rounded-lg object-cover border" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/40 text-2xl">👤</div>
                      )}
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) { setPhotoEleve(f); setPhotoElevePreview(URL.createObjectURL(f)); }
                        }} />
                        <span className="text-xs text-primary hover:underline">{photoElevePreview ? 'Changer' : 'Télécharger'}</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Type d'inscription — sans choix de mois */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Type d'inscription</CardTitle></CardHeader>
                <CardContent>
                  <div>
                    <Label>Type *</Label>
                    <Select value={typeInscription} onValueChange={(v: 'inscription' | 'reinscription') => setTypeInscription(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inscription">Inscription — 100 000 GNF</SelectItem>
                        <SelectItem value="reinscription">Réinscription — 150 000 GNF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Classe & Famille */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Affectation</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Classe *</Label>
                    <Select value={classeId} onValueChange={setClasseId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Famille (fratrie)</Label>
                    <Select value={familleId || '__none__'} onValueChange={(v) => setFamilleId(v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {familles.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>{f.nom_famille}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nom & Prénom du père</Label>
                    <Input value={nomPrenomPere} onChange={e => setNomPrenomPere(e.target.value)} placeholder="Ex: Kouamé Jean-Pierre" />
                  </div>
                  <div>
                    <Label>Nom & Prénom de la mère</Label>
                    <Input value={nomPrenomMere} onChange={e => setNomPrenomMere(e.target.value)} placeholder="Ex: Bamba Fatou" />
                  </div>
                </CardContent>
              </Card>

              {/* Check-list */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Check-list documents</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2"><Checkbox checked={checkLivret} onCheckedChange={(v) => setCheckLivret(!!v)} /><Label>Livret scolaire</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={checkRames} onCheckedChange={(v) => setCheckRames(!!v)} /><Label>Paquet de Rames</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={checkMarqueurs} onCheckedChange={(v) => setCheckMarqueurs(!!v)} /><Label>Marqueurs</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={checkPhoto} onCheckedChange={(v) => setCheckPhoto(!!v)} /><Label>Photo d'identité</Label></div>
                  {(!checkLivret || !checkRames || !checkMarqueurs || !checkPhoto) && nom.trim() && (
                    <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/30 text-xs text-warning">
                      ⚠️ L'élève <strong>{prenom || '?'} {nom}</strong> n'a pas encore fourni :{' '}
                      {[!checkLivret && 'Livret scolaire', !checkRames && 'Paquet de Rames', !checkMarqueurs && 'Marqueurs', !checkPhoto && "Photo d'identité"].filter(Boolean).join(', ')}.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Options */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Options & Transport</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Adresse de l'élève</Label>
                    <Input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Ex: Quartier Riviera, Cocody" />
                    {suggestedZoneId && suggestedZoneId !== zoneTransportId && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-primary underline cursor-pointer"
                        onClick={() => setZoneTransportId(suggestedZoneId)}
                      >
                        💡 Zone suggérée : {zones.find((z: any) => z.id === suggestedZoneId)?.nom} — {Number(zones.find((z: any) => z.id === suggestedZoneId)?.prix_mensuel || 0).toLocaleString()} GNF/mois — Cliquer pour appliquer
                      </button>
                    )}
                  </div>
                  <div>
                    <Label>Zone de transport</Label>
                    <Select value={zoneTransportId || '__none__'} onValueChange={(v) => setZoneTransportId(v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Pas de transport" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Pas de transport</SelectItem>
                        {zones?.map((z: any) => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.nom} — {Number(z.prix_mensuel).toLocaleString()} GNF/mois
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedZone && (
                      <p className="text-xs text-accent mt-1 font-medium">
                        💰 Prix transport mensuel : {Number(selectedZone.prix_mensuel).toLocaleString()} GNF
                        {selectedZone.chauffeur_bus && ` — 🚌 ${selectedZone.chauffeur_bus}`}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeScolaire} onCheckedChange={(v) => setUniformeScolaire(!!v)} /><Label>Tenue scolaire {selectedCycleNom ? `(${isPrimaire ? 'Primaire' : 'Collège/Lycée'})` : ''} {prixTenueScolaire > 0 && <span className="text-muted-foreground font-normal">— {prixTenueScolaire.toLocaleString()} GNF</span>}</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeSport} onCheckedChange={(v) => setUniformeSport(!!v)} /><Label>Tenue sport {prixTenueSport > 0 && <span className="text-muted-foreground font-normal">— {prixTenueSport.toLocaleString()} GNF</span>}</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformePolo} onCheckedChange={(v) => setUniformePolo(!!v)} /><Label>Polo Lacoste {prixPoloLacoste > 0 && <span className="text-muted-foreground font-normal">— {prixPoloLacoste.toLocaleString()} GNF</span>}</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeKarate} onCheckedChange={(v) => setUniformeKarate(!!v)} /><Label>Tenue de Karaté {prixKarate > 0 && <span className="text-muted-foreground font-normal">— {prixKarate.toLocaleString()} GNF</span>}</Label></div>
                  </div>
                  <div className="flex items-center gap-2"><Checkbox checked={optionCantine} onCheckedChange={(v) => setOptionCantine(!!v)} /><Label>Cantine</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={optionFournitures} onCheckedChange={(v) => setOptionFournitures(!!v)} /><Label>Fournitures scolaires</Label></div>
                </CardContent>
              </Card>

              {/* Mandataires Crèche/Maternelle */}
              {isCrecheMaternelle && (
                <MandatairesForm mandataires={mandataires} onChange={setMandataires} />
              )}

              {/* Résumé frais — sans scolarité/transport mensuels */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3"><CardTitle className="text-base">Résumé des frais à l'inscription</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between font-medium"><span>{typeInscription === 'inscription' ? "Frais d'inscription" : 'Frais de réinscription'}</span><span>{fraisInscription.toLocaleString()} GNF</span></div>
                  {reduction > 0 && (
                    <div className="flex justify-between text-accent"><span>Réduction fratrie (-{reduction * 100}%)</span><span>applicable sur la scolarité</span></div>
                  )}
                  {fraisUniformes > 0 && <div className="flex justify-between"><span>Uniformes</span><span>{fraisUniformes.toLocaleString()} GNF</span></div>}
                  {fraisFournitures > 0 && <div className="flex justify-between"><span>Fournitures</span><span>{fraisFournitures.toLocaleString()} GNF</span></div>}
                  {fraisTransport > 0 && (
                    <div className="flex justify-between text-muted-foreground"><span>Transport (mensuel, payable dans Paiements)</span><span>{fraisTransport.toLocaleString()} GNF/mois</span></div>
                  )}
                  {fraisScolarite > 0 && (
                    <div className="flex justify-between text-muted-foreground"><span>Scolarité (mensuelle, payable dans Paiements)</span><span>{fraisApresReduction.toLocaleString()} GNF/mois</span></div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                    <span>TOTAL À PAYER MAINTENANT</span><span>{totalFrais.toLocaleString()} GNF</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    ℹ️ La scolarité et le transport sont à payer dans l'onglet <strong>Paiements</strong>.
                  </p>
                </CardContent>
              </Card>

              <Button onClick={() => inscription.mutate()} disabled={inscription.isPending} className="w-full">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Valider l'inscription
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
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
              ) : filtered.map((e: any) => {
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
                    <TableCell>{e.classes?.nom || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{(e as any).nom_prenom_pere || (e as any).nom_prenom_mere ? `${(e as any).nom_prenom_pere || '—'} / ${(e as any).nom_prenom_mere || '—'}` : '—'}</TableCell>
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
                            <Button variant="ghost" size="sm" title="Envoyer un rappel aux parents">
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
                              <p className="text-xs text-muted-foreground mb-3">Aucun numéro de téléphone enregistré.</p>
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
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog with 3 Tabs */}
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

              {/* Tab Informations */}
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

              {/* Tab Famille */}
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
                <div>
                  <Label>Nom & Prénom du père</Label>
                  <Input value={editNomPrenomPere} onChange={e => setEditNomPrenomPere(e.target.value)} placeholder="Ex: Kouamé Jean-Pierre" />
                </div>
                <div>
                  <Label>Nom & Prénom de la mère</Label>
                  <Input value={editNomPrenomMere} onChange={e => setEditNomPrenomMere(e.target.value)} placeholder="Ex: Bamba Fatou" />
                </div>
                {editEleve.familles && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 space-y-2">
                      <p className="text-sm font-medium">Contacts famille</p>
                      {editEleve.familles.telephone_pere && (
                        <p className="text-sm flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" /> Père : <a href={`tel:${editEleve.familles.telephone_pere}`} className="text-primary underline">{editEleve.familles.telephone_pere}</a>
                        </p>
                      )}
                      {editEleve.familles.telephone_mere && (
                        <p className="text-sm flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" /> Mère : <a href={`tel:${editEleve.familles.telephone_mere}`} className="text-primary underline">{editEleve.familles.telephone_mere}</a>
                        </p>
                      )}
                      {!editEleve.familles.telephone_pere && !editEleve.familles.telephone_mere && (
                        <p className="text-xs text-muted-foreground">Aucun numéro enregistré</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Options */}
              <TabsContent value="options" className="space-y-4 mt-4">
                {/* Check-list documents */}
                <div>
                  <p className="text-sm font-medium mb-2">Check-list documents</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckLivret} onCheckedChange={(v) => setEditCheckLivret(!!v)} /><Label>Livret scolaire</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckRames} onCheckedChange={(v) => setEditCheckRames(!!v)} /><Label>Paquet de Rames</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckMarqueurs} onCheckedChange={(v) => setEditCheckMarqueurs(!!v)} /><Label>Marqueurs</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={editCheckPhoto} onCheckedChange={(v) => setEditCheckPhoto(!!v)} /><Label>Photo d'identité</Label></div>
                  </div>
                </div>

                {/* Transport */}
                <div>
                  <p className="text-sm font-medium mb-2">Transport</p>
                  <Select value={editZoneTransportId || '__none__'} onValueChange={(v) => setEditZoneTransportId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Pas de transport" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Pas de transport</SelectItem>
                      {zones?.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom} — {Number(z.prix_mensuel).toLocaleString()} GNF/mois</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {editSelectedZone && (
                    <p className="text-xs text-accent mt-1">💰 {Number(editSelectedZone.prix_mensuel).toLocaleString()} GNF/mois</p>
                  )}
                </div>

                {/* Cantine */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Cantine</p>
                    <p className="text-xs text-muted-foreground">Activer/désactiver l'option cantine</p>
                  </div>
                  <Switch checked={editOptionCantine} onCheckedChange={setEditOptionCantine} />
                </div>

                {/* Forfait */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Prix forfaitaire famille</p>
                    <p className="text-xs text-muted-foreground">Tarif forfaitaire pour cette famille (3+ enfants)</p>
                  </div>
                  <Switch checked={editForfait} onCheckedChange={setEditForfait} />
                </div>

                {/* Supprimer */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" /> Supprimer le dossier
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cet élève ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {editEleve.prenom} {editEleve.nom} sera déplacé dans la corbeille. Vous pourrez le restaurer ultérieurement.
                      </AlertDialogDescription>
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

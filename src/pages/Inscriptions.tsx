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
import { UserPlus, Search, Plus, CheckCircle2, MapPin, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useZonesTransport } from './Configuration';

export default function Inscriptions() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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
  const [filiation, setFiliation] = useState('');

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*, classes(nom, niveau_id, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))), familles(nom_famille)')
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
      const { error } = await supabase.from('eleves').insert({
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
        filiation: filiation || null,
        statut: 'inscrit',
      } as any);
      if (error) throw error;
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

  const resetForm = () => {
    setNom(''); setPrenom(''); setSexe(''); setDateNaissance(''); setClasseId('');
    setFamilleId(''); setZoneTransportId(''); setAdresse('');
    setCheckLivret(false); setCheckRames(false); setCheckMarqueurs(false); setCheckPhoto(false);
    setUniformeScolaire(false); setUniformeSport(false); setUniformePolo(false); setUniformeKarate(false);
    setOptionCantine(false); setOptionFournitures(false);
    setFiliation('');
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
  const getUniformFee = (label: string) => tarifs.find((t: any) => t.categorie === 'uniforme' && t.label === label)?.montant || 0;
  const fraisUniformes =
    (uniformeScolaire ? getUniformFee('Tenue scolaire') : 0) +
    (uniformeSport ? getUniformFee('Sport') : 0) +
    (uniformePolo ? getUniformFee('Polo Lacoste') : 0) +
    (uniformeKarate ? getUniformFee('Karaté') : 0);

  const fraisFournitures = optionFournitures ? (tarifs.find((t: any) => t.categorie === 'fournitures')?.montant || 0) : 0;
  const totalFrais = fraisApresReduction + fraisTransport + fraisUniformes + fraisFournitures;

  const filtered = eleves.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserPlus className="h-7 w-7 text-primary" /> Inscriptions
        </h1>
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
                  <div className="col-span-2">
                    <Label>Filiation (lien de parenté)</Label>
                    <Input value={filiation} onChange={e => setFiliation(e.target.value)} placeholder="Ex: Fils de M. Kouamé et Mme Bamba" />
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
                  {/* Adresse pour suggestion de zone */}
                  <div>
                    <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Adresse de l'élève</Label>
                    <Input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Ex: Quartier Riviera, Cocody" />
                    {suggestedZoneId && suggestedZoneId !== zoneTransportId && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-primary underline cursor-pointer"
                        onClick={() => setZoneTransportId(suggestedZoneId)}
                      >
                        💡 Zone suggérée : {zones.find((z: any) => z.id === suggestedZoneId)?.nom} — Cliquer pour appliquer
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
                            {z.nom} — {Number(z.prix_mensuel).toLocaleString()} FCFA/mois
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedZone?.chauffeur_bus && (
                      <p className="text-xs text-muted-foreground mt-1">🚌 {selectedZone.chauffeur_bus}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeScolaire} onCheckedChange={(v) => setUniformeScolaire(!!v)} /><Label>Tenue scolaire</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeSport} onCheckedChange={(v) => setUniformeSport(!!v)} /><Label>Tenue sport</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformePolo} onCheckedChange={(v) => setUniformePolo(!!v)} /><Label>Polo Lacoste</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeKarate} onCheckedChange={(v) => setUniformeKarate(!!v)} /><Label>Tenue de Karaté</Label></div>
                  </div>
                  <div className="flex items-center gap-2"><Checkbox checked={optionCantine} onCheckedChange={(v) => setOptionCantine(!!v)} /><Label>Cantine</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={optionFournitures} onCheckedChange={(v) => setOptionFournitures(!!v)} /><Label>Fournitures scolaires</Label></div>
                </CardContent>
              </Card>

              {/* Résumé frais */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3"><CardTitle className="text-base">Résumé des frais</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Scolarité</span><span>{fraisScolarite.toLocaleString()} FCFA</span></div>
                  {reduction > 0 && (
                    <div className="flex justify-between text-success"><span>Réduction fratrie (-{reduction * 100}%)</span><span>-{(fraisScolarite * reduction).toLocaleString()} FCFA</span></div>
                  )}
                  {fraisTransport > 0 && <div className="flex justify-between"><span>Transport ({selectedZone?.nom})</span><span>{fraisTransport.toLocaleString()} FCFA/mois</span></div>}
                  {fraisUniformes > 0 && <div className="flex justify-between"><span>Uniformes</span><span>{fraisUniformes.toLocaleString()} FCFA</span></div>}
                  {fraisFournitures > 0 && <div className="flex justify-between"><span>Fournitures</span><span>{fraisFournitures.toLocaleString()} FCFA</span></div>}
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                    <span>TOTAL</span><span>{totalFrais.toLocaleString()} FCFA</span>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => inscription.mutate()} disabled={inscription.isPending} className="w-full">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Valider l'inscription
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & List */}
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
                  !e.checklist_livret && 'Livret',
                  !e.checklist_rames && 'Rames',
                  !e.checklist_marqueurs && 'Marqueurs',
                  !e.checklist_photo && 'Photo',
                ].filter(Boolean);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                    <TableCell className="font-medium">{e.nom}</TableCell>
                    <TableCell>{e.prenom}</TableCell>
                    <TableCell>{e.classes?.nom || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{(e as any).filiation || '—'}</TableCell>
                    <TableCell>
                      {manquants.length > 0 ? (
                        <Badge variant="outline" className="text-warning border-warning/30 text-xs">{manquants.length} manquant(s)</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Complet</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.statut === 'inscrit' ? 'default' : 'secondary'}>{e.statut}</Badge>
                    </TableCell>
                    <TableCell>
                      {manquants.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => sendRappel.mutate(e)} title="Envoyer un rappel">
                          <Bell className="h-4 w-4 text-warning" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

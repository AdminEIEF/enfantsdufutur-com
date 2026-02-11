import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Search, Plus, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

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
  const [transportZone, setTransportZone] = useState('');
  const [checkLivret, setCheckLivret] = useState(false);
  const [checkRames, setCheckRames] = useState(false);
  const [checkMarqueurs, setCheckMarqueurs] = useState(false);
  const [uniformeScolaire, setUniformeScolaire] = useState(false);
  const [uniformeSport, setUniformeSport] = useState(false);
  const [uniformePolo, setUniformePolo] = useState(false);
  const [uniformeKarate, setUniformeKarate] = useState(false);
  const [optionCantine, setOptionCantine] = useState(false);
  const [optionFournitures, setOptionFournitures] = useState(false);

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

  const inscription = useMutation({
    mutationFn: async () => {
      if (!nom || !prenom || !classeId) {
        throw new Error('Nom, prénom et classe sont obligatoires');
      }
      if (!checkLivret || !checkRames || !checkMarqueurs) {
        throw new Error('Tous les éléments de la check-list sont obligatoires');
      }
      const { error } = await supabase.from('eleves').insert({
        nom, prenom, sexe: sexe || null, date_naissance: dateNaissance || null,
        classe_id: classeId, famille_id: familleId || null,
        transport_zone: transportZone || null,
        checklist_livret: checkLivret, checklist_rames: checkRames, checklist_marqueurs: checkMarqueurs,
        uniforme_scolaire: uniformeScolaire, uniforme_sport: uniformeSport,
        uniforme_polo_lacoste: uniformePolo, uniforme_karate: uniformeKarate,
        option_cantine: optionCantine, option_fournitures: optionFournitures,
        statut: 'inscrit',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      toast({ title: 'Inscription réussie', description: `${prenom} ${nom} a été inscrit(e) avec succès.` });
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setNom(''); setPrenom(''); setSexe(''); setDateNaissance(''); setClasseId('');
    setFamilleId(''); setTransportZone('');
    setCheckLivret(false); setCheckRames(false); setCheckMarqueurs(false);
    setUniformeScolaire(false); setUniformeSport(false); setUniformePolo(false); setUniformeKarate(false);
    setOptionCantine(false); setOptionFournitures(false);
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

  // Transport fee
  const tarifTransport = tarifs.find((t: any) => t.categorie === 'transport' && t.zone_transport === transportZone);
  const fraisTransport = tarifTransport?.montant || 0;

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
                    <Select value={familleId} onValueChange={setFamilleId}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Aucune</SelectItem>
                        {familles.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>{f.nom_famille}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Check-list */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Check-list obligatoire</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2"><Checkbox checked={checkLivret} onCheckedChange={(v) => setCheckLivret(!!v)} /><Label>Livret scolaire</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={checkRames} onCheckedChange={(v) => setCheckRames(!!v)} /><Label>Paquet de Rames</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={checkMarqueurs} onCheckedChange={(v) => setCheckMarqueurs(!!v)} /><Label>Marqueurs</Label></div>
                </CardContent>
              </Card>

              {/* Options */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Options</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Zone de transport</Label>
                    <Select value={transportZone} onValueChange={setTransportZone}>
                      <SelectTrigger><SelectValue placeholder="Pas de transport" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Pas de transport</SelectItem>
                        <SelectItem value="zone_1">Zone 1</SelectItem>
                        <SelectItem value="zone_2">Zone 2</SelectItem>
                        <SelectItem value="zone_3">Zone 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeScolaire} onCheckedChange={(v) => setUniformeScolaire(!!v)} /><Label>Tenue scolaire</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeSport} onCheckedChange={(v) => setUniformeSport(!!v)} /><Label>Tenue sport</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformePolo} onCheckedChange={(v) => setUniformePolo(!!v)} /><Label>Polo Lacoste</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={uniformeKarate} onCheckedChange={(v) => setUniformeKarate(!!v)} /><Label>Karaté</Label></div>
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
                  {fraisTransport > 0 && <div className="flex justify-between"><span>Transport</span><span>{fraisTransport.toLocaleString()} FCFA</span></div>}
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
                <TableHead>Famille</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                  <TableCell className="font-medium">{e.nom}</TableCell>
                  <TableCell>{e.prenom}</TableCell>
                  <TableCell>{e.classes?.nom || '—'}</TableCell>
                  <TableCell>{e.familles?.nom_famille || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={e.statut === 'inscrit' ? 'default' : 'secondary'}>{e.statut}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

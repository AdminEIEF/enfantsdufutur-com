import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Search, FileText, Users, Clock, CheckCircle2, XCircle, CalendarDays, Phone, Mail, UserPlus, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PreInscriptionsAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('tous');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateRdv, setDateRdv] = useState('');
  const [notesAdmin, setNotesAdmin] = useState('');
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertClasseId, setConvertClasseId] = useState('');

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ['pre-inscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pre_inscriptions')
        .select('*, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-for-conversion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))');
      if (error) throw error;
      return data;
    },
  });

  const filtered = demandes.filter((d: any) => {
    const matchSearch = `${d.prenom_eleve} ${d.nom_eleve} ${d.nom_parent} ${d.telephone_parent}`.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'tous' || d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const enAttente = demandes.filter((d: any) => d.statut === 'en_attente').length;
  const rdvFixe = demandes.filter((d: any) => d.statut === 'rdv_fixe').length;
  const validees = demandes.filter((d: any) => d.statut === 'validee').length;
  const inscrites = demandes.filter((d: any) => d.statut === 'inscrite').length;

  const openDetail = (item: any) => {
    setSelectedItem(item);
    setDateRdv(item.date_rdv ? item.date_rdv.slice(0, 16) : '');
    setNotesAdmin(item.notes_admin || '');
    setDialogOpen(true);
  };

  const updateStatut = useMutation({
    mutationFn: async ({ id, statut, date_rdv, notes_admin }: any) => {
      const update: any = { statut, notes_admin, traite_at: new Date().toISOString() };
      if (date_rdv) update.date_rdv = date_rdv;
      const { error } = await supabase.from('pre_inscriptions').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pre-inscriptions'] });
      toast.success('Demande mise à jour');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAction = async (statut: string) => {
    if (!selectedItem) return;
    updateStatut.mutate({
      id: selectedItem.id,
      statut,
      date_rdv: dateRdv || null,
      notes_admin: notesAdmin,
    }, {
      onSuccess: async () => {
        // Send notification to parent when RDV is fixed
        if (statut === 'rdv_fixe' && dateRdv) {
          try {
            const { data } = await supabase.functions.invoke('notify-parent-rdv', {
              body: { pre_inscription_id: selectedItem.id, date_rdv: dateRdv },
            });
            const msgs: string[] = [];
            if (data?.sms_sent) msgs.push('SMS envoyé');
            if (data?.email_sent) msgs.push('Email envoyé');
            if (msgs.length > 0) {
              toast.success(`Parent notifié : ${msgs.join(' + ')}`);
            } else {
              toast.info(`RDV fixé. Le parent sera contacté au ${selectedItem.telephone_parent}.`);
            }
          } catch {
            // Notification in-app already created by trigger
          }
        }
      },
    });
  };

  // ── Conversion Logic ──
  const openConvertDialog = () => {
    if (!selectedItem) return;
    // Pre-select classes matching the requested niveau
    const matchingClasses = classes.filter((c: any) => c.niveau_id === selectedItem.niveau_id);
    setConvertClasseId(matchingClasses.length === 1 ? matchingClasses[0].id : '');
    setConvertDialogOpen(true);
  };

  const classesForNiveau = selectedItem?.niveau_id
    ? classes.filter((c: any) => c.niveau_id === selectedItem.niveau_id)
    : classes;

  const generateMatricule = async () => {
    const now = new Date();
    const prefix = `EDU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await supabase.from('eleves').select('*', { count: 'exact', head: true }).like('matricule', `${prefix}%`);
    return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error('Aucune demande sélectionnée');
      if (!convertClasseId) throw new Error('Veuillez sélectionner une classe');

      const d = selectedItem;

      // 1. Create family
      const familyCode = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const { data: newFamille, error: famErr } = await supabase.from('familles').insert({
        nom_famille: d.nom_eleve.trim().toUpperCase(),
        telephone_pere: d.telephone_parent.trim() || null,
        email_parent: d.email_parent?.trim() || null,
        code_acces: familyCode,
      } as any).select('id').single();
      if (famErr) throw famErr;

      // 2. Generate matricule & password
      const matricule = await generateMatricule();
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let pwd = '';
      for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)];

      // 3. Create student
      const { data: newEleve, error: eleveErr } = await supabase.from('eleves').insert({
        nom: d.nom_eleve.trim(),
        prenom: d.prenom_eleve.trim(),
        sexe: d.sexe || null,
        date_naissance: d.date_naissance || null,
        classe_id: convertClasseId,
        famille_id: newFamille.id,
        matricule,
        qr_code: matricule,
        option_cantine: !!d.option_cantine,
        statut: 'inscrit',
        mot_de_passe_eleve: pwd,
        nom_prenom_pere: d.nom_parent?.trim() || null,
      } as any).select('id').single();
      if (eleveErr) throw eleveErr;

      // 4. Update pre-inscription status
      const { error: updateErr } = await supabase.from('pre_inscriptions').update({
        statut: 'inscrite',
        converted_eleve_id: newEleve.id,
        converted_famille_id: newFamille.id,
        traite_at: new Date().toISOString(),
      } as any).eq('id', d.id);
      if (updateErr) throw updateErr;

      return { matricule, familyCode, eleveId: newEleve.id };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['pre-inscriptions'] });
      qc.invalidateQueries({ queryKey: ['eleves'] });
      qc.invalidateQueries({ queryKey: ['familles'] });
      toast.success(
        `Inscription créée ! Matricule : ${result.matricule} — Code famille : ${result.familyCode}`,
        { duration: 8000 }
      );
      setConvertDialogOpen(false);
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statutBadge = (statut: string) => {
    switch (statut) {
      case 'en_attente': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400">En attente</Badge>;
      case 'rdv_fixe': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">RDV fixé</Badge>;
      case 'validee': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">Validée</Badge>;
      case 'inscrite': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">Inscrite ✓</Badge>;
      case 'rejetee': return <Badge variant="destructive">Rejetée</Badge>;
      default: return <Badge variant="secondary">{statut}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <FileText className="h-7 w-7 text-primary" /> Pré-inscriptions
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-amber-500" /><div><p className="text-sm text-muted-foreground">En attente</p><p className="text-2xl font-bold">{enAttente}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CalendarDays className="h-8 w-8 text-blue-500" /><div><p className="text-sm text-muted-foreground">RDV fixé</p><p className="text-2xl font-bold">{rdvFixe}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-green-500" /><div><p className="text-sm text-muted-foreground">Validées</p><p className="text-2xl font-bold">{validees}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><UserPlus className="h-8 w-8 text-emerald-600" /><div><p className="text-sm text-muted-foreground">Inscrites</p><p className="text-2xl font-bold">{inscrites}</p></div></div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="rdv_fixe">RDV fixé</SelectItem>
            <SelectItem value="validee">Validées</SelectItem>
            <SelectItem value="inscrite">Inscrites</SelectItem>
            <SelectItem value="rejetee">Rejetées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Niveau souhaité</TableHead>
                <TableHead>Options</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell></TableRow>
              ) : filtered.map((d: any) => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(d)}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{d.prenom_eleve} {d.nom_eleve}</span>
                      {d.sexe && <span className="text-xs text-muted-foreground ml-1">({d.sexe})</span>}
                    </div>
                    {d.date_naissance && <span className="text-xs text-muted-foreground">{format(new Date(d.date_naissance), 'dd/MM/yyyy')}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{d.nom_parent}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{d.telephone_parent}</div>
                  </TableCell>
                  <TableCell>
                    {d.niveaux ? (
                      <span className="text-sm">{d.niveaux.cycles?.nom} — {d.niveaux.nom}</span>
                    ) : <span className="text-xs text-muted-foreground">Non précisé</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {d.option_cantine && <Badge variant="outline" className="text-[10px]">Cantine</Badge>}
                      {d.option_transport && <Badge variant="outline" className="text-[10px]">Transport</Badge>}
                      {d.option_uniformes && <Badge variant="outline" className="text-[10px]">Uniformes</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(d.created_at), 'dd MMM yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>{statutBadge(d.statut)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Voir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail de la pré-inscription</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Élève</p>
                  <p className="font-medium">{selectedItem.prenom_eleve} {selectedItem.nom_eleve}</p>
                  {selectedItem.date_naissance && <p className="text-sm text-muted-foreground">Né(e) le {format(new Date(selectedItem.date_naissance), 'dd/MM/yyyy')}</p>}
                  {selectedItem.sexe && <p className="text-sm text-muted-foreground">Sexe : {selectedItem.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Parent/Tuteur</p>
                  <p className="font-medium">{selectedItem.nom_parent}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{selectedItem.telephone_parent}</p>
                  {selectedItem.email_parent && <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{selectedItem.email_parent}</p>}
                </div>
              </div>

              {selectedItem.niveaux && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Niveau souhaité</p>
                  <p className="text-sm">{selectedItem.niveaux.cycles?.nom} — {selectedItem.niveaux.nom}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1">Options</p>
                <div className="flex gap-2">
                  {selectedItem.option_cantine && <Badge variant="secondary">Cantine</Badge>}
                  {selectedItem.option_transport && <Badge variant="secondary">Transport</Badge>}
                  {selectedItem.option_uniformes && <Badge variant="secondary">Uniformes</Badge>}
                  {!selectedItem.option_cantine && !selectedItem.option_transport && !selectedItem.option_uniformes && (
                    <span className="text-sm text-muted-foreground">Aucune</span>
                  )}
                </div>
              </div>

              {selectedItem.statut !== 'inscrite' && (
                <>
                  <div className="space-y-2">
                    <Label>Date de RDV</Label>
                    <Input type="datetime-local" value={dateRdv} onChange={e => setDateRdv(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes administratives</Label>
                    <Textarea value={notesAdmin} onChange={e => setNotesAdmin(e.target.value)} placeholder="Observations, instructions…" rows={3} />
                  </div>
                </>
              )}

              {selectedItem.statut === 'inscrite' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Convertie en inscription complète
                  </p>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Soumis le {format(new Date(selectedItem.created_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2 sm:justify-start">
            {selectedItem?.statut === 'inscrite' ? (
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Fermer</Button>
            ) : (
              <>
                <Button variant="destructive" size="sm" onClick={() => handleAction('rejetee')} disabled={updateStatut.isPending}>
                  <XCircle className="h-4 w-4 mr-1" /> Rejeter
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAction('rdv_fixe')} disabled={updateStatut.isPending || !dateRdv}>
                  <CalendarDays className="h-4 w-4 mr-1" /> Fixer RDV
                </Button>
                <Button size="sm" onClick={() => handleAction('validee')} disabled={updateStatut.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                </Button>
                {selectedItem?.statut === 'validee' && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={openConvertDialog}
                  >
                    <UserPlus className="h-4 w-4 mr-1" /> Convertir
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversion Confirmation Dialog */}
      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              Convertir en inscription
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p>
                  Cette action va créer automatiquement :
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>Une famille</strong> ({selectedItem?.nom_eleve?.toUpperCase()}) avec le téléphone et email du parent</li>
                  <li><strong>Un élève</strong> ({selectedItem?.prenom_eleve} {selectedItem?.nom_eleve}) avec matricule et mot de passe générés</li>
                </ul>

                <div className="space-y-2 pt-2">
                  <Label>Classe d'affectation *</Label>
                  <Select value={convertClasseId} onValueChange={setConvertClasseId}>
                    <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                    <SelectContent>
                      {classesForNiveau.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedItem?.niveau_id && classesForNiveau.length === 0 && (
                    <p className="text-xs text-destructive">Aucune classe trouvée pour ce niveau. Créez-en une d'abord.</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!convertClasseId || convertMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                convertMutation.mutate();
              }}
            >
              {convertMutation.isPending ? 'Création en cours…' : 'Confirmer l\'inscription'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

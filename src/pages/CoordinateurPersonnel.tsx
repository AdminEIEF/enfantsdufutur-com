import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Briefcase, Plus, Search, Loader2, Eye, Users, Phone, Mail, Upload, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportToExcel, readExcelFile } from '@/lib/excelUtils';

export default function CoordinateurPersonnel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCategorie, setImportCategorie] = useState('enseignant');

  const [form, setForm] = useState({
    nom: '', prenom: '', sexe: 'M', telephone: '', email: '',
    categorie: 'enseignant' as string, poste: '', salaire_base: '',
    date_embauche: new Date().toISOString().slice(0, 10),
    date_naissance: '',
  });

  // Fetch employes - RLS will filter to primary/maternelle only
  const { data: employes = [], isLoading } = useQuery({
    queryKey: ['coord-employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('*, enseignant_classes(id, classe_id, matiere_id, classes(nom, niveaux(nom, cycles(nom))))')
        .order('nom');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch primary/maternelle classes for assignment
  const { data: classes = [] } = useQuery({
    queryKey: ['coord-classes-primary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom, niveaux(nom, cycles(nom))')
        .order('nom');
      if (error) throw error;
      // Filter to primary/maternelle on client side
      return (data || []).filter((c: any) => {
        const cycleName = c.niveaux?.cycles?.nom?.toLowerCase() || '';
        return cycleName.includes('maternelle') || cycleName.includes('primaire');
      });
    },
  });

  const { data: matieres = [] } = useQuery({
    queryKey: ['coord-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('nom');
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const matricule = `EMP-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const { error } = await supabase.from('employes').insert({
        matricule,
        nom: form.nom,
        prenom: form.prenom,
        sexe: form.sexe,
        telephone: form.telephone || null,
        email: form.email || null,
        categorie: form.categorie as any,
        poste: form.poste || 'Enseignant',
        salaire_base: Number(form.salaire_base) || 0,
        date_embauche: form.date_embauche,
        date_naissance: form.date_naissance || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: '✅ Employé ajouté avec succès' });
      qc.invalidateQueries({ queryKey: ['coord-employes'] });
      setAddOpen(false);
      setForm({ nom: '', prenom: '', sexe: 'M', telephone: '', email: '', categorie: 'enseignant', poste: '', salaire_base: '', date_embauche: new Date().toISOString().slice(0, 10), date_naissance: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const filtered = employes.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule} ${e.poste}`.toLowerCase().includes(search.toLowerCase())
  );

  const categorieLabel: Record<string, string> = {
    enseignant: 'Enseignant', administration: 'Administration', administratif: 'Administratif', service: 'Service', direction: 'Direction',
  };

  const categorieBadge = (cat: string) => {
    const colors: Record<string, string> = {
      enseignant: 'bg-blue-100 text-blue-800',
      administratif: 'bg-purple-100 text-purple-800',
      service: 'bg-green-100 text-green-800',
      securite: 'bg-orange-100 text-orange-800',
    };
    return colors[cat] || 'bg-muted text-muted-foreground';
  };

  const handleExportExcel = async () => {
    const data = filtered.map((e: any) => ({
      'Matricule': e.matricule,
      'Nom': e.nom,
      'Prénom': e.prenom,
      'Catégorie': categorieLabel[e.categorie] || e.categorie,
      'Poste': e.poste || '',
      'Téléphone': e.telephone || '',
      'Statut': e.statut,
    }));
    await exportToExcel(data, 'personnel_primaire', 'Personnel');
    toast({ title: '✅ Export Excel réussi' });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const rows = await readExcelFile(file);
      if (rows.length === 0) { toast({ title: 'Fichier vide', variant: 'destructive' }); return; }

      // Préparer la prévisualisation
      const preview = rows.map((row, index) => ({
        id: index,
        nom: row['Nom'] || row['nom'] || '',
        prenom: row['Prénom'] || row['prenom'] || '',
        categorie: (row['Catégorie'] || row['categorie'] || 'enseignant').toString().toLowerCase().trim(),
        telephone: row['Téléphone'] || row['telephone'] || '',
      })).filter(r => r.nom && r.prenom);

      setImportPreview(preview);
      setImportDialogOpen(true);
    } catch (err: any) {
      toast({ title: 'Erreur import', description: err.message, variant: 'destructive' });
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const confirmImport = async () => {
    setImportLoading(true);
    let added = 0;
    try {
      for (const row of importPreview) {
        const categorie = importCategorie;

        const matricule = `EMP-${String(Math.floor(1000 + Math.random() * 9000))}`;
        const { error } = await supabase.from('employes').insert({
          matricule,
          nom: row.nom,
          prenom: row.prenom,
          categorie: categorie as any,
          poste: 'Enseignant',
          telephone: row.telephone || null,
          salaire_base: 0,
          date_embauche: new Date().toISOString().slice(0, 10),
        });
        if (!error) added++;
      }

      toast({ title: `✅ ${added} employé(s) importé(s)`, description: 'Cliquez sur chaque nom pour compléter.' });
      qc.invalidateQueries({ queryKey: ['coord-employes'] });
      setImportDialogOpen(false);
      setImportPreview([]);
    } catch (err: any) {
      toast({ title: 'Erreur import', description: err.message, variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Personnel Primaire & Maternelle
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion du personnel affecté aux cycles Maternelle et Primaire
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-1" /> Exporter Excel
          </Button>
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} disabled={importLoading} />
            <Button size="sm" variant="outline" asChild disabled={importLoading}>
              <span>{importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}Importer Excel</span>
            </Button>
          </label>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvel employé</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
                <div><Label>Prénom *</Label><Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sexe</Label>
                  <Select value={form.sexe} onValueChange={v => setForm(f => ({ ...f, sexe: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculin</SelectItem>
                      <SelectItem value="F">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Catégorie</Label>
                  <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enseignant">Enseignant</SelectItem>
                      <SelectItem value="administratif">Administratif</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Poste</Label><Input value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} placeholder="Ex: Instituteur" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date de naissance</Label><Input type="date" value={form.date_naissance} onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value }))} /></div>
                <div><Label>Date d'embauche</Label><Input type="date" value={form.date_embauche} onChange={e => setForm(f => ({ ...f, date_embauche: e.target.value }))} /></div>
              </div>
              <div><Label>Salaire de base (FCFA)</Label><Input type="number" value={form.salaire_base} onChange={e => setForm(f => ({ ...f, salaire_base: e.target.value }))} /></div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.nom || !form.prenom || addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{employes.length}</div>
            <p className="text-xs text-muted-foreground">Total personnel</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{employes.filter((e: any) => e.categorie === 'enseignant').length}</div>
            <p className="text-xs text-muted-foreground">Enseignants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{employes.filter((e: any) => e.statut === 'actif').length}</div>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{employes.filter((e: any) => e.statut !== 'actif').length}</div>
            <p className="text-xs text-muted-foreground">Inactifs</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher un employé..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Aucun personnel trouvé</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom & Prénom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Classes affectées</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp: any) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-xs">{emp.matricule}</TableCell>
                    <TableCell className="font-medium">{emp.prenom} {emp.nom}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={categorieBadge(emp.categorie)}>{emp.categorie}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{emp.poste}</TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {emp.telephone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.telephone}</div>}
                        {emp.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{emp.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {emp.enseignant_classes?.map((ec: any) => (
                          <Badge key={ec.id} variant="secondary" className="text-xs">
                            {ec.classes?.nom}
                          </Badge>
                        ))}
                        {(!emp.enseignant_classes || emp.enseignant_classes.length === 0) && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.statut === 'actif' ? 'default' : 'secondary'}>
                        {emp.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedEmp(emp)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedEmp} onOpenChange={() => setSelectedEmp(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fiche employé — {selectedEmp?.prenom} {selectedEmp?.nom}</DialogTitle>
          </DialogHeader>
          {selectedEmp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Matricule:</span> <strong>{selectedEmp.matricule}</strong></div>
                <div><span className="text-muted-foreground">Sexe:</span> {selectedEmp.sexe}</div>
                <div><span className="text-muted-foreground">Catégorie:</span> <Badge variant="outline" className={categorieBadge(selectedEmp.categorie)}>{selectedEmp.categorie}</Badge></div>
                <div><span className="text-muted-foreground">Poste:</span> {selectedEmp.poste}</div>
                <div><span className="text-muted-foreground">Téléphone:</span> {selectedEmp.telephone || '—'}</div>
                <div><span className="text-muted-foreground">Email:</span> {selectedEmp.email || '—'}</div>
                <div><span className="text-muted-foreground">Date embauche:</span> {selectedEmp.date_embauche ? format(new Date(selectedEmp.date_embauche), 'dd/MM/yyyy') : '—'}</div>
                <div><span className="text-muted-foreground">Statut:</span> <Badge variant={selectedEmp.statut === 'actif' ? 'default' : 'secondary'}>{selectedEmp.statut}</Badge></div>
              </div>

              {selectedEmp.enseignant_classes?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Classes affectées</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedEmp.enseignant_classes.map((ec: any) => (
                      <Badge key={ec.id} variant="outline">
                        {ec.classes?.nom} — {ec.classes?.niveaux?.nom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📋 Prévisualisation de l'import ({importPreview.length} employés)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Téléphone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{row.nom}</TableCell>
                    <TableCell>{row.prenom}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={categorieBadge(row.categorie)}>
                        {row.categorie}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.telephone || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importLoading}>
                Annuler
              </Button>
              <Button onClick={confirmImport} disabled={importLoading}>
                {importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                ✅ Confirmer l'import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

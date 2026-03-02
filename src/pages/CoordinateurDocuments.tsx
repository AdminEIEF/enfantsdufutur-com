import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, FileText, Undo2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DOCUMENT_TYPES = ['Photo d\'identité', 'Livret Scolaire', 'Extrait de Naissance'];
const NIVEAUX = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'];

interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  ecole_provenance: string;
  niveau_scolaire: string;
  statut: string;
  created_at: string;
}

interface Document {
  id: string;
  eleve_id: string;
  type_document: string;
  date_depot: string | null;
  date_retrait: string | null;
  note_retrait: string | null;
  statut: string;
}

export default function CoordinateurDocuments() {
  const { user } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEcole, setFilterEcole] = useState('all');
  const [filterNiveau, setFilterNiveau] = useState('all');
  const [expandedEleve, setExpandedEleve] = useState<string | null>(null);
  const [retraitDialog, setRetraitDialog] = useState<{ docId: string; typeName: string } | null>(null);
  const [noteRetrait, setNoteRetrait] = useState('');

  const [form, setForm] = useState({ nom: '', prenom: '', ecole_provenance: '', niveau_scolaire: '' });

  const fetchData = async () => {
    setLoading(true);
    const [elevesRes, docsRes] = await Promise.all([
      supabase.from('coordinateur_eleves').select('*').order('created_at', { ascending: false }),
      supabase.from('coordinateur_documents').select('*'),
    ]);
    if (elevesRes.data) setEleves(elevesRes.data as Eleve[]);
    if (docsRes.data) setDocuments(docsRes.data as Document[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const ecoles = useMemo(() => [...new Set(eleves.map(e => e.ecole_provenance).filter(Boolean))], [eleves]);

  const filteredEleves = useMemo(() => {
    return eleves.filter(e => {
      const matchSearch = `${e.nom} ${e.prenom}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchEcole = filterEcole === 'all' || e.ecole_provenance === filterEcole;
      const matchNiveau = filterNiveau === 'all' || e.niveau_scolaire === filterNiveau;
      return matchSearch && matchEcole && matchNiveau;
    });
  }, [eleves, searchTerm, filterEcole, filterNiveau]);

  const getEleveDocs = (eleveId: string) => documents.filter(d => d.eleve_id === eleveId);

  const getStatutDossier = (eleveId: string) => {
    const docs = getEleveDocs(eleveId);
    const eleve = eleves.find(e => e.id === eleveId);
    if (eleve?.statut === 'sortant') return 'sortant';
    const deposited = docs.filter(d => d.statut === 'depose').length;
    if (deposited === DOCUMENT_TYPES.length) return 'complet';
    return 'incomplet';
  };

  const handleAddEleve = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) {
      toast({ title: 'Erreur', description: 'Nom et prénom requis', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.from('coordinateur_eleves').insert({
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      ecole_provenance: form.ecole_provenance.trim(),
      niveau_scolaire: form.niveau_scolaire,
      created_by: user?.id,
    } as any).select().single();

    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }

    // Create document rows
    const docInserts = DOCUMENT_TYPES.map(type => ({
      eleve_id: (data as any).id,
      type_document: type,
      statut: 'non_depose',
    }));
    await supabase.from('coordinateur_documents').insert(docInserts as any);

    toast({ title: 'Élève enregistré' });
    setForm({ nom: '', prenom: '', ecole_provenance: '', niveau_scolaire: '' });
    setShowForm(false);
    fetchData();
  };

  const handleDepot = async (docId: string) => {
    await supabase.from('coordinateur_documents').update({
      statut: 'depose',
      date_depot: new Date().toISOString(),
    } as any).eq('id', docId);
    toast({ title: 'Document déposé' });
    fetchData();
  };

  const handleRetrait = async () => {
    if (!retraitDialog) return;
    await supabase.from('coordinateur_documents').update({
      statut: 'rendu',
      date_retrait: new Date().toISOString(),
      note_retrait: noteRetrait.trim() || null,
    } as any).eq('id', retraitDialog.docId);
    toast({ title: 'Document rendu' });
    setRetraitDialog(null);
    setNoteRetrait('');
    fetchData();
  };

  const statusBadge = (statut: string) => {
    switch (statut) {
      case 'complet': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Complet</Badge>;
      case 'incomplet': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Incomplet</Badge>;
      case 'sortant': return <Badge variant="destructive">Sortant</Badge>;
      default: return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const docStatusBadge = (statut: string) => {
    switch (statut) {
      case 'depose': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">Déposé</Badge>;
      case 'rendu': return <Badge variant="destructive" className="text-xs">Rendu</Badge>;
      default: return <Badge variant="outline" className="text-xs">Non déposé</Badge>;
    }
  };

  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy à HH:mm', { locale: fr }) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des documents - Coordinateur</h1>
          <p className="text-muted-foreground">Suivi des dépôts et retraits de documents scolaires</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Enregistrer un élève
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un élève..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterEcole} onValueChange={setFilterEcole}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="École de provenance" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les écoles</SelectItem>
                {ecoles.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterNiveau} onValueChange={setFilterNiveau}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Niveau" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                {NIVEAUX.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Élèves enregistrés ({filteredEleves.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom & Prénom</TableHead>
                <TableHead>École de provenance</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Dossier</TableHead>
                <TableHead>Date d'enregistrement</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filteredEleves.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
              ) : filteredEleves.map(eleve => {
                const isExpanded = expandedEleve === eleve.id;
                const docs = getEleveDocs(eleve.id);
                const dossierStatut = getStatutDossier(eleve.id);
                return (
                  <> 
                    <TableRow key={eleve.id} className="cursor-pointer" onClick={() => setExpandedEleve(isExpanded ? null : eleve.id)}>
                      <TableCell className="font-medium">{eleve.nom} {eleve.prenom}</TableCell>
                      <TableCell>{eleve.ecole_provenance || '—'}</TableCell>
                      <TableCell>{eleve.niveau_scolaire || '—'}</TableCell>
                      <TableCell>{statusBadge(dossierStatut)}</TableCell>
                      <TableCell>{formatDate(eleve.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${eleve.id}-docs`}>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Documents</h4>
                            <div className="grid gap-3">
                              {DOCUMENT_TYPES.map(type => {
                                const doc = docs.find(d => d.type_document === type);
                                if (!doc) return null;
                                return (
                                  <div key={doc.id} className="flex items-center justify-between bg-background rounded-lg border p-3">
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2 min-w-[180px]">
                                        {doc.statut === 'non_depose' && (
                                          <Checkbox checked={false} onCheckedChange={() => handleDepot(doc.id)} />
                                        )}
                                        <span className="text-sm font-medium">{type}</span>
                                      </div>
                                      {docStatusBadge(doc.statut)}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      {doc.date_depot && <span>Déposé le {formatDate(doc.date_depot)}</span>}
                                      {doc.date_retrait && <span>Récupéré le {formatDate(doc.date_retrait)}</span>}
                                      {doc.note_retrait && <span className="italic">({doc.note_retrait})</span>}
                                      {doc.statut === 'depose' && (
                                        <Button size="sm" variant="outline" className="ml-2 text-xs" onClick={(e) => { e.stopPropagation(); setRetraitDialog({ docId: doc.id, typeName: type }); }}>
                                          <Undo2 className="mr-1 h-3 w-3" /> Rendre
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Ajout */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enregistrer un élève</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
              <div><Label>Prénom *</Label><Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} /></div>
            </div>
            <div><Label>École de provenance</Label><Input value={form.ecole_provenance} onChange={e => setForm(f => ({ ...f, ecole_provenance: e.target.value }))} /></div>
            <div>
              <Label>Niveau scolaire</Label>
              <Select value={form.niveau_scolaire} onValueChange={v => setForm(f => ({ ...f, niveau_scolaire: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir le niveau" /></SelectTrigger>
                <SelectContent>{NIVEAUX.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={handleAddEleve}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Retrait */}
      <Dialog open={!!retraitDialog} onOpenChange={() => { setRetraitDialog(null); setNoteRetrait(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rendre le document : {retraitDialog?.typeName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Note de retrait (qui récupère ?)</Label>
            <Textarea placeholder="Ex: la mère, le père, l'élève lui-même..." value={noteRetrait} onChange={e => setNoteRetrait(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRetraitDialog(null); setNoteRetrait(''); }}>Annuler</Button>
            <Button onClick={handleRetrait}>Confirmer le retrait</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, FileText, Undo2, ChevronDown, ChevronUp, CheckCircle, History, Users, AlertTriangle, UserX, ClipboardList, XCircle } from 'lucide-react';
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
  valide: boolean;
  valide_at: string | null;
  pre_inscription_id: string | null;
  created_at: string;
}

interface Document {
  id: string;
  eleve_id: string;
  type_document: string;
  date_depot: string | null;
  date_retrait: string | null;
  note_retrait: string | null;
  telephone_retrait: string | null;
  statut: string;
}

interface HistoriqueEntry {
  id: string;
  document_id: string;
  eleve_id: string;
  action: string;
  type_document: string;
  note: string | null;
  telephone: string | null;
  created_at: string;
}

export default function CoordinateurDocuments() {
  const { user } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [historique, setHistorique] = useState<HistoriqueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEcole, setFilterEcole] = useState('all');
  const [filterNiveau, setFilterNiveau] = useState('all');
  const [expandedEleve, setExpandedEleve] = useState<string | null>(null);
  const [retraitDialog, setRetraitDialog] = useState<{ docId: string; typeName: string; eleveId: string } | null>(null);
  const [noteRetrait, setNoteRetrait] = useState('');
  const [telephoneRetrait, setTelephoneRetrait] = useState('');
  const [historiqueDialog, setHistoriqueDialog] = useState<string | null>(null);
  const [validationDialog, setValidationDialog] = useState<Eleve | null>(null);
  const [abandonDialog, setAbandonDialog] = useState<Eleve | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [form, setForm] = useState({ nom: '', prenom: '', ecole_provenance: '', niveau_scolaire: '' });

  const fetchData = async () => {
    setLoading(true);
    const [elevesRes, docsRes, histRes] = await Promise.all([
      supabase.from('coordinateur_eleves').select('*').order('created_at', { ascending: false }),
      supabase.from('coordinateur_documents').select('*'),
      supabase.from('coordinateur_documents_historique').select('*').order('created_at', { ascending: false }),
    ]);
    if (elevesRes.data) setEleves(elevesRes.data as Eleve[]);
    if (docsRes.data) setDocuments(docsRes.data as Document[]);
    if (histRes.data) setHistorique(histRes.data as HistoriqueEntry[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const ecoles = useMemo(() => [...new Set(eleves.map(e => e.ecole_provenance).filter(Boolean))], [eleves]);

  const getEleveDocs = (eleveId: string) => documents.filter(d => d.eleve_id === eleveId);
  const getEleveHistorique = (eleveId: string) => historique.filter(h => h.eleve_id === eleveId);

  const getStatutDossier = (eleveId: string) => {
    const docs = getEleveDocs(eleveId);
    if (docs.length === 0) return 'incomplet';
    const deposited = docs.filter(d => d.statut === 'depose').length;
    const total = docs.length;
    if (deposited === total) return 'complet';
    return 'incomplet';
  };

  // Stats
  const stats = useMemo(() => {
    const preInscrits = eleves.filter(e => e.valide && e.statut === 'actif');
    const enManqueDocs = eleves.filter(e => e.statut === 'actif' && !e.valide && getStatutDossier(e.id) === 'incomplet');
    const sortants = eleves.filter(e => e.statut === 'sortant');
    const abandons = eleves.filter(e => e.statut === 'abandon');
    const actifs = eleves.filter(e => e.statut === 'actif' && !e.valide);
    return { preInscrits: preInscrits.length, enManqueDocs: enManqueDocs.length, sortants: sortants.length, abandons: abandons.length, actifs: actifs.length, total: eleves.length };
  }, [eleves, documents]);

  // Filtered eleves based on active tab
  const filteredEleves = useMemo(() => {
    let base = eleves;

    if (activeTab === 'actifs') {
      base = eleves.filter(e => e.statut === 'actif' && !e.valide);
    } else if (activeTab === 'pre-inscrits') {
      base = eleves.filter(e => e.valide);
    } else if (activeTab === 'sortants') {
      base = eleves.filter(e => e.statut === 'sortant');
    } else if (activeTab === 'abandons') {
      base = eleves.filter(e => e.statut === 'abandon');
    } else if (activeTab === 'dashboard') {
      return [];
    }

    return base.filter(e => {
      const matchSearch = `${e.nom} ${e.prenom}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchEcole = filterEcole === 'all' || e.ecole_provenance === filterEcole;
      const matchNiveau = filterNiveau === 'all' || e.niveau_scolaire === filterNiveau;
      return matchSearch && matchEcole && matchNiveau;
    });
  }, [eleves, searchTerm, filterEcole, filterNiveau, activeTab, documents]);

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

  const handleDepot = async (docId: string, eleveId: string, typeDocument: string) => {
    await supabase.from('coordinateur_documents').update({
      statut: 'depose',
      date_depot: new Date().toISOString(),
    } as any).eq('id', docId);

    await supabase.from('coordinateur_documents_historique').upsert({
      document_id: docId,
      eleve_id: eleveId,
      action: 'depot',
      type_document: typeDocument,
      created_by: user?.id,
    } as any, { onConflict: 'document_id,action', ignoreDuplicates: true });

    toast({ title: 'Document déposé' });
    fetchData();
  };

  const handleRetrait = async () => {
    if (!retraitDialog) return;
    await supabase.from('coordinateur_documents').update({
      statut: 'rendu',
      date_retrait: new Date().toISOString(),
      note_retrait: noteRetrait.trim() || null,
      telephone_retrait: telephoneRetrait.trim() || null,
    } as any).eq('id', retraitDialog.docId);

    await supabase.from('coordinateur_documents_historique').upsert({
      document_id: retraitDialog.docId,
      eleve_id: retraitDialog.eleveId,
      action: 'retrait',
      type_document: retraitDialog.typeName,
      note: noteRetrait.trim() || null,
      telephone: telephoneRetrait.trim() || null,
      created_by: user?.id,
    } as any, { onConflict: 'document_id,action', ignoreDuplicates: true });

    toast({ title: 'Document rendu' });
    setRetraitDialog(null);
    setNoteRetrait('');
    setTelephoneRetrait('');
    fetchData();
  };

  const handleValider = async () => {
    if (!validationDialog) return;
    const eleve = validationDialog;

    const dossierStatut = getStatutDossier(eleve.id);
    const notesDossier = dossierStatut === 'complet'
      ? `Dossier complet.`
      : `Dossier incomplet — documents manquants.`;

    const { data: preInsc, error: preErr } = await supabase.from('pre_inscriptions').insert({
      nom_eleve: eleve.nom,
      prenom_eleve: eleve.prenom,
      nom_parent: 'Validé par coordinateur',
      telephone_parent: '—',
      statut: 'en_attente',
      notes_admin: `Élève pré-inscrit par le coordinateur. École: ${eleve.ecole_provenance || '—'}. Niveau: ${eleve.niveau_scolaire || '—'}. ${notesDossier}`,
    } as any).select().single();

    if (preErr) {
      toast({ title: 'Erreur', description: preErr.message, variant: 'destructive' });
      return;
    }

    await supabase.from('coordinateur_eleves').update({
      valide: true,
      valide_at: new Date().toISOString(),
      pre_inscription_id: (preInsc as any).id,
    } as any).eq('id', eleve.id);

    toast({ title: 'Élève pré-inscrit', description: 'L\'élève apparaît maintenant dans les pré-inscriptions' });
    setValidationDialog(null);
    fetchData();
  };

  const handleAbandon = async () => {
    if (!abandonDialog) return;
    await supabase.from('coordinateur_eleves').update({
      statut: 'abandon',
    } as any).eq('id', abandonDialog.id);

    toast({ title: 'Élève marqué en abandon' });
    setAbandonDialog(null);
    fetchData();
  };

  const handleMarquerSortant = async (eleve: Eleve) => {
    await supabase.from('coordinateur_eleves').update({
      statut: 'sortant',
    } as any).eq('id', eleve.id);
    toast({ title: 'Élève marqué comme sortant' });
    fetchData();
  };

  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy à HH:mm', { locale: fr }) : null;

  const statusBadge = (statut: string) => {
    switch (statut) {
      case 'complet': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Complet</Badge>;
      case 'incomplet': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Incomplet</Badge>;
      default: return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const eleveStatutBadge = (eleve: Eleve) => {
    if (eleve.statut === 'abandon') return <Badge variant="destructive">Abandon</Badge>;
    if (eleve.statut === 'sortant') return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">Sortant</Badge>;
    if (eleve.valide) return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800"><CheckCircle className="h-3 w-3 mr-1" />Pré-inscrit</Badge>;
    return <Badge variant="outline" className="text-xs">En attente</Badge>;
  };

  const docStatusBadge = (statut: string) => {
    switch (statut) {
      case 'depose': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">Déposé</Badge>;
      case 'rendu': return <Badge variant="destructive" className="text-xs">Rendu</Badge>;
      default: return <Badge variant="outline" className="text-xs">Non déposé</Badge>;
    }
  };

  const getSortantDocsInfo = (eleveId: string) => {
    const docs = getEleveDocs(eleveId);
    const rendus = docs.filter(d => d.statut === 'rendu').length;
    const restants = docs.filter(d => d.statut === 'depose').length;
    return { rendus, restants, total: docs.length };
  };

  const renderEleveCards = (list: Eleve[], showActions = true) => (
    <div className="space-y-3">
      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Chargement...</p>
      ) : list.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Aucun élève trouvé</p>
      ) : list.map(eleve => {
        const isExpanded = expandedEleve === eleve.id;
        const docs = getEleveDocs(eleve.id);
        const dossierStatut = getStatutDossier(eleve.id);
        const sortantInfo = eleve.statut === 'sortant' ? getSortantDocsInfo(eleve.id) : null;
        return (
          <div key={eleve.id} className="border rounded-lg overflow-hidden">
            <div
              className="p-3 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedEleve(isExpanded ? null : eleve.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm sm:text-base">{eleve.nom} {eleve.prenom}</span>
                    {eleveStatutBadge(eleve)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {eleve.ecole_provenance && <span>{eleve.ecole_provenance}</span>}
                    {eleve.niveau_scolaire && <span>• {eleve.niveau_scolaire}</span>}
                    <span>• {formatDate(eleve.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {statusBadge(dossierStatut)}
                    {sortantInfo && (
                      <span className="text-xs text-muted-foreground">
                        {sortantInfo.rendus} rendu(s), {sortantInfo.restants} restant(s)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoriqueDialog(eleve.id)} title="Historique">
                    <History className="h-4 w-4" />
                  </Button>
                  {showActions && eleve.statut === 'actif' && !eleve.valide && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setValidationDialog(eleve)} title="Pré-inscrire">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600" onClick={() => handleMarquerSortant(eleve)} title="Sortant">
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setAbandonDialog(eleve)} title="Abandon">
                        <UserX className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {eleve.statut === 'sortant' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setAbandonDialog(eleve)} title="Abandon">
                      <UserX className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="border-t bg-muted/30 p-3 sm:p-4 space-y-3">
                <h4 className="font-semibold text-sm">Documents</h4>
                <div className="grid gap-2">
                  {docs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun document enregistré</p>
                  ) : docs.map(doc => (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-background rounded-lg border p-3 gap-2">
                      <div className="flex items-center gap-2">
                        {doc.statut === 'non_depose' && (
                          <Checkbox checked={false} onCheckedChange={() => handleDepot(doc.id, eleve.id, doc.type_document)} />
                        )}
                        <span className="text-sm font-medium">{doc.type_document}</span>
                        {docStatusBadge(doc.statut)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {doc.date_depot && <span>Déposé {formatDate(doc.date_depot)}</span>}
                        {doc.date_retrait && <span>Récupéré {formatDate(doc.date_retrait)}</span>}
                        {doc.note_retrait && <span className="italic">({doc.note_retrait})</span>}
                        {doc.telephone_retrait && <span>📞 {doc.telephone_retrait}</span>}
                        {doc.statut === 'depose' && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); setRetraitDialog({ docId: doc.id, typeName: doc.type_document, eleveId: eleve.id }); }}>
                            <Undo2 className="mr-1 h-3 w-3" /> Rendre
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Espace Coordinateur</h1>
          <p className="text-sm text-muted-foreground">Gestion des pré-inscriptions et documents</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Enregistrer un élève
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 w-full">
          <TabsTrigger value="dashboard" className="gap-1 flex-1 min-w-[120px] text-xs sm:text-sm"><ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden xs:inline">Tableau de </span>bord</TabsTrigger>
          <TabsTrigger value="actifs" className="gap-1 flex-1 min-w-[100px] text-xs sm:text-sm"><Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> En cours ({stats.actifs})</TabsTrigger>
          <TabsTrigger value="pre-inscrits" className="gap-1 flex-1 min-w-[110px] text-xs sm:text-sm"><CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Pré-inscrits</span><span className="sm:hidden">Pré-ins.</span> ({stats.preInscrits})</TabsTrigger>
          <TabsTrigger value="sortants" className="gap-1 flex-1 min-w-[100px] text-xs sm:text-sm"><Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Sortants ({stats.sortants})</TabsTrigger>
          <TabsTrigger value="abandons" className="gap-1 flex-1 min-w-[100px] text-xs sm:text-sm"><UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Abandons ({stats.abandons})</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('actifs')}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.actifs}</p>
                    <p className="text-sm text-muted-foreground">En cours de traitement</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('pre-inscrits')}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.preInscrits}</p>
                    <p className="text-sm text-muted-foreground">Pré-inscrits</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                    <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.enManqueDocs}</p>
                    <p className="text-sm text-muted-foreground">Dossiers incomplets</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('sortants')}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30">
                    <Undo2 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.sortants}</p>
                    <p className="text-sm text-muted-foreground">Sortants</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('abandons')}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                    <UserX className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.abandons}</p>
                    <p className="text-sm text-muted-foreground">Abandons</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total enregistrés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Filtres + Tableaux pour chaque onglet */}
        {['actifs', 'pre-inscrits', 'sortants', 'abandons'].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher par nom..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterEcole} onValueChange={setFilterEcole}>
                      <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="École" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les écoles</SelectItem>
                        {ecoles.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterNiveau} onValueChange={setFilterNiveau}>
                      <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Niveau" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        {NIVEAUX.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {tab === 'actifs' && 'Élèves en cours de traitement'}
                  {tab === 'pre-inscrits' && 'Élèves pré-inscrits (historique)'}
                  {tab === 'sortants' && 'Élèves sortants'}
                  {tab === 'abandons' && 'Élèves en abandon'}
                  {' '}({filteredEleves.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderEleveCards(filteredEleves, tab === 'actifs' || tab === 'sortants')}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

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
      <Dialog open={!!retraitDialog} onOpenChange={() => { setRetraitDialog(null); setNoteRetrait(''); setTelephoneRetrait(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rendre le document : {retraitDialog?.typeName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Qui récupère le document ? *</Label>
              <Textarea placeholder="Ex: la mère, le père, l'élève lui-même..." value={noteRetrait} onChange={e => setNoteRetrait(e.target.value)} />
            </div>
            <div>
              <Label>Numéro de téléphone</Label>
              <Input placeholder="Ex: 620 00 00 00" value={telephoneRetrait} onChange={e => setTelephoneRetrait(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRetraitDialog(null); setNoteRetrait(''); setTelephoneRetrait(''); }}>Annuler</Button>
            <Button onClick={handleRetrait}>Confirmer le retrait</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Historique */}
      <Dialog open={!!historiqueDialog} onOpenChange={() => setHistoriqueDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Historique des mouvements</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {historiqueDialog && getEleveHistorique(historiqueDialog).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun mouvement enregistré</p>
            ) : historiqueDialog && getEleveHistorique(historiqueDialog).map(h => (
              <div key={h.id} className="flex items-start gap-3 border rounded-lg p-3">
                <Badge variant={h.action === 'depot' ? 'default' : 'destructive'} className="text-xs mt-0.5">
                  {h.action === 'depot' ? 'Dépôt' : 'Retrait'}
                </Badge>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{h.type_document}</p>
                  <p className="text-muted-foreground text-xs">{formatDate(h.created_at)}</p>
                  {h.note && <p className="text-xs mt-1">👤 {h.note}</p>}
                  {h.telephone && <p className="text-xs">📞 {h.telephone}</p>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Validation / Pré-inscription */}
      <Dialog open={!!validationDialog} onOpenChange={() => setValidationDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pré-inscrire l'élève</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Voulez-vous pré-inscrire <strong>{validationDialog?.prenom} {validationDialog?.nom}</strong> ?
            </p>
            {validationDialog && getStatutDossier(validationDialog.id) === 'incomplet' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  Le dossier est <strong>incomplet</strong>. L'élève sera pré-inscrit avec mention « dossier incomplet » dans les notes.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              L'élève apparaîtra dans la liste des pré-inscriptions avec la mention « Validé par coordinateur ».
              Il ne sera plus visible dans l'onglet « En cours » mais restera accessible via « Pré-inscrits ».
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidationDialog(null)}>Annuler</Button>
            <Button onClick={handleValider}>
              <CheckCircle className="mr-2 h-4 w-4" /> Confirmer la pré-inscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Abandon */}
      <Dialog open={!!abandonDialog} onOpenChange={() => setAbandonDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer comme abandon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Voulez-vous marquer <strong>{abandonDialog?.prenom} {abandonDialog?.nom}</strong> comme ayant abandonné ?
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">
                L'élève sera déplacé dans l'onglet « Abandons ». Cette action peut être annulée ultérieurement.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbandonDialog(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleAbandon}>
              <UserX className="mr-2 h-4 w-4" /> Confirmer l'abandon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

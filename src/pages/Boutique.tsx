import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Shirt, ShoppingBag, User, Search, Plus, Minus, Trash2, Package, History, BarChart3, ClipboardCheck, CheckCircle2, Clock, Settings, Pencil, AlertTriangle, Camera } from 'lucide-react';
import QRScannerDialog from '@/components/QRScannerDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTicketBoutique } from '@/lib/generateTicketBoutique';
import { generateBonRecuperation } from '@/lib/generateBonRecuperation';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type BoutiqueArticle = {
  id: string; nom: string; categorie: string; taille: string; prix: number; stock: number;
};

type CartItem = {
  article: BoutiqueArticle; quantite: number;
};

const CATEGORIES = [
  { key: 'tenue_scolaire', label: 'Tenue Scolaire', icon: Shirt, color: 'bg-blue-100 text-blue-800' },
  { key: 'tenue_sport', label: 'Tenue de Sport', icon: Shirt, color: 'bg-green-100 text-green-800' },
  { key: 'polo_lacoste', label: 'Polo Lacoste', icon: Shirt, color: 'bg-purple-100 text-purple-800' },
  { key: 'tenue_scout', label: 'Tenue de Scout', icon: User, color: 'bg-amber-100 text-amber-800' },
  { key: 'tenue_karate', label: 'Tenue de Karaté', icon: User, color: 'bg-red-100 text-red-800' },
];

const TAILLES = ['S', 'M', 'L', 'XL', 'Enfant', 'Adulte'];

// ─── Retraits Tab ─────────────────────────────────
function RetraitsPanel() {
  const queryClient = useQueryClient();
  const [searchEleve, setSearchEleve] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves_retraits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, classe_id, classes(nom)').is('deleted_at', null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch pending orders for selected student
  const { data: commandes = [], isLoading: loadingCommandes } = useQuery({
    queryKey: ['commandes_eleve', selectedEleve?.id],
    queryFn: async () => {
      if (!selectedEleve) return [];
      const { data, error } = await supabase
        .from('commandes_articles')
        .select('*')
        .eq('eleve_id', selectedEleve.id)
        .eq('article_type', 'boutique')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedEleve,
  });

  const commandesPaye = commandes.filter((c: any) => c.statut === 'paye');
  const commandesLivrees = commandes.filter((c: any) => c.statut === 'livre');

  const filteredEleves = useMemo(() => {
    if (!searchEleve.trim()) return [];
    const q = searchEleve.toLowerCase();
    return eleves.filter((e: any) =>
      e.nom?.toLowerCase().includes(q) || e.prenom?.toLowerCase().includes(q) || e.matricule?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchEleve, eleves]);

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllItems = () => {
    if (selectedItems.size === commandesPaye.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(commandesPaye.map((c: any) => c.id)));
    }
  };

  const validerLivraison = useMutation({
    mutationFn: async (commandeIds: string[]) => {
      const { error } = await supabase
        .from('commandes_articles' as any)
        .update({ statut: 'livre', livre_at: new Date().toISOString(), livre_par: (await supabase.auth.getUser()).data.user?.id } as any)
        .in('id', commandeIds);
      if (error) throw error;

      // Deduct stock for each delivered article
      const itemsToDeliver = commandesPaye.filter((c: any) => commandeIds.includes(c.id));
      for (const cmd of itemsToDeliver) {
        if (cmd.article_type === 'boutique') {
          const { data: matchArticles } = await supabase
            .from('boutique_articles')
            .select('id, stock')
            .eq('nom', cmd.article_nom)
            .eq('taille', cmd.article_taille || 'unique')
            .limit(1);
          if (matchArticles && matchArticles.length > 0) {
            await supabase
              .from('boutique_articles')
              .update({ stock: Math.max(0, matchArticles[0].stock - cmd.quantite), updated_at: new Date().toISOString() } as any)
              .eq('id', matchArticles[0].id);
          }
        }
      }
    },
    onSuccess: (_, commandeIds) => {
      const articlesLivres = commandesPaye
        .filter((c: any) => commandeIds.includes(c.id))
        .map((c: any) => ({
          nom: c.article_nom,
          taille: c.article_taille,
          quantite: c.quantite,
          prixUnitaire: Number(c.prix_unitaire),
        }));
      const totalMontant = articlesLivres.reduce((s, a) => s + a.prixUnitaire * a.quantite, 0);
      const now = new Date();

      generateBonRecuperation({
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        matricule: selectedEleve.matricule || '',
        classe: (selectedEleve as any).classes?.nom || '—',
        articles: articlesLivres,
        totalMontant,
        date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        heure: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      });

      toast.success(`${commandeIds.length} article(s) livré(s) ! Bon de récupération généré.`);
      setSelectedItems(new Set());
      queryClient.invalidateQueries({ queryKey: ['commandes_eleve', selectedEleve?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un élève (nom, prénom, matricule)..." value={searchEleve} onChange={e => setSearchEleve(e.target.value)} className="pl-10 pr-10" />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setScannerOpen(true)} title="Scanner par caméra">
              <Camera className="h-4 w-4 text-primary" />
            </Button>
          </div>
          <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={(m) => {
            const found = eleves.find((e: any) => e.matricule === m || e.id === m);
            if (found) { setSelectedEleve(found); setSearchEleve(`${found.prenom} ${found.nom}`); }
            else toast.error('Élève introuvable');
          }} />
          <AnimatePresence>
            {filteredEleves.length > 0 && !selectedEleve && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 border rounded-md divide-y max-h-48 overflow-y-auto">
                {filteredEleves.map((e: any) => (
                  <button key={e.id} className="w-full text-left px-3 py-2 hover:bg-accent/50 flex justify-between items-center" onClick={() => { setSelectedEleve(e); setSearchEleve(`${e.prenom} ${e.nom}`); }}>
                    <span className="font-medium">{e.prenom} {e.nom}</span>
                    <span className="text-xs text-muted-foreground">{e.matricule} — {(e as any).classes?.nom}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {selectedEleve && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary"><User className="h-3 w-3 mr-1" />{selectedEleve.prenom} {selectedEleve.nom}</Badge>
              <Badge variant="outline" className="text-xs">{selectedEleve.matricule}</Badge>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedEleve(null); setSearchEleve(''); }}>Changer</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEleve && (
        <>
          {/* Pending items */}
          {loadingCommandes ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
          ) : commandesPaye.length === 0 && commandesLivrees.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune commande trouvée pour cet élève</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {/* En attente de retrait */}
              {commandesPaye.length > 0 && (
                <Card className="border-orange-300/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                        <Clock className="h-4 w-4" /> En attente de retrait ({commandesPaye.length})
                      </CardTitle>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={selectAllItems}>
                        {selectedItems.size === commandesPaye.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">Cochez les articles disponibles pour une livraison partielle ou totale :</p>
                    {commandesPaye.map((c: any) => (
                      <div
                        key={c.id}
                        className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${selectedItems.has(c.id) ? 'bg-primary/10 border-primary/40' : 'bg-orange-50/50 dark:bg-orange-950/20'}`}
                        onClick={() => toggleItem(c.id)}
                      >
                        <Checkbox checked={selectedItems.has(c.id)} onCheckedChange={() => toggleItem(c.id)} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.article_nom}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.article_taille && <Badge variant="outline" className="text-[10px]">{c.article_taille}</Badge>}
                            <span>Qté: {c.quantite}</span>
                            <span>{Number(c.prix_unitaire).toLocaleString()} GNF</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
                          <Clock className="h-3 w-3 mr-1" /> Payé
                        </Badge>
                      </div>
                    ))}

                    <Button
                      className="w-full mt-2"
                      onClick={() => validerLivraison.mutate(Array.from(selectedItems))}
                      disabled={validerLivraison.isPending || selectedItems.size === 0}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {validerLivraison.isPending ? 'Validation...' : `Valider la livraison (${selectedItems.size}/${commandesPaye.length} articles) & Imprimer Bon`}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Déjà livrés */}
              {commandesLivrees.length > 0 && (
                <Card className="border-green-300/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> Déjà livrés ({commandesLivrees.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {commandesLivrees.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded border bg-green-50/50 dark:bg-green-950/20">
                        <div>
                          <p className="text-sm font-medium">{c.article_nom}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.article_taille && <Badge variant="outline" className="text-[10px]">{c.article_taille}</Badge>}
                            <span>Qté: {c.quantite}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Livré
                          </Badge>
                          {c.livre_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(c.livre_at).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Gestion Admin Commandes ─────────────────────
function GestionCommandesPanel() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [searchEleve, setSearchEleve] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editCmd, setEditCmd] = useState<any>(null);
  const [editQte, setEditQte] = useState(1);
  const [editPrix, setEditPrix] = useState(0);
  const [editNom, setEditNom] = useState('');
  const [editTaille, setEditTaille] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves_gestion_cmd'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, classe_id, famille_id, classes(nom)').is('deleted_at', null);
      if (error) throw error;
      return data;
    },
  });

  const { data: commandes = [], isLoading } = useQuery({
    queryKey: ['commandes_gestion', selectedEleve?.id],
    queryFn: async () => {
      if (!selectedEleve) return [];
      const { data, error } = await supabase
        .from('commandes_articles' as any)
        .select('*')
        .eq('eleve_id', selectedEleve.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedEleve,
  });

  const filteredEleves = useMemo(() => {
    if (!searchEleve.trim()) return [];
    const q = searchEleve.toLowerCase();
    return eleves.filter((e: any) =>
      e.nom?.toLowerCase().includes(q) || e.prenom?.toLowerCase().includes(q) || e.matricule?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchEleve, eleves]);

  const updateCommandeMut = useMutation({
    mutationFn: async () => {
      if (!editCmd) return;
      const oldTotal = Number(editCmd.prix_unitaire) * editCmd.quantite;
      const newTotal = editPrix * editQte;
      const diff = newTotal - oldTotal;

      // Update the commande
      const { error } = await supabase
        .from('commandes_articles' as any)
        .update({
          article_nom: editNom,
          article_taille: editTaille || null,
          quantite: editQte,
          prix_unitaire: editPrix,
        } as any)
        .eq('id', editCmd.id);
      if (error) throw error;

      // If amount changed and item is still 'paye', create adjustment payment
      if (diff !== 0 && editCmd.statut === 'paye') {
        const type = editCmd.article_type === 'librairie' ? 'librairie' : 'boutique';
        if (diff > 0) {
          // Additional charge - insert positive payment
          await supabase.from('paiements').insert({
            eleve_id: selectedEleve.id,
            montant: diff,
            type_paiement: type,
            canal: 'ajustement',
            reference: `Ajustement commande: ${editNom}`,
          } as any);
        } else {
          // Refund - insert negative payment (credit)
          await supabase.from('paiements').insert({
            eleve_id: selectedEleve.id,
            montant: diff,
            type_paiement: type,
            canal: 'ajustement',
            reference: `Remboursement partiel: ${editNom}`,
          } as any);
        }
      }
    },
    onSuccess: () => {
      toast.success('Commande mise à jour et solde ajusté');
      setEditCmd(null);
      queryClient.invalidateQueries({ queryKey: ['commandes_gestion', selectedEleve?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCommandeMut = useMutation({
    mutationFn: async (cmdId: string) => {
      const cmd = commandes.find((c: any) => c.id === cmdId);
      if (!cmd) return;

      // Delete the commande
      const { error } = await supabase
        .from('commandes_articles' as any)
        .delete()
        .eq('id', cmdId);
      if (error) throw error;

      // If item was 'paye', create refund payment
      if (cmd.statut === 'paye') {
        const refundAmount = -(Number(cmd.prix_unitaire) * cmd.quantite);
        const type = cmd.article_type === 'librairie' ? 'librairie' : 'boutique';
        await supabase.from('paiements').insert({
          eleve_id: selectedEleve.id,
          montant: refundAmount,
          type_paiement: type,
          canal: 'ajustement',
          reference: `Annulation commande: ${cmd.article_nom}`,
        } as any);
      }
    },
    onSuccess: () => {
      toast.success('Commande supprimée et solde remboursé');
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['commandes_gestion', selectedEleve?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (cmd: any) => {
    setEditCmd(cmd);
    setEditNom(cmd.article_nom);
    setEditTaille(cmd.article_taille || '');
    setEditQte(cmd.quantite);
    setEditPrix(Number(cmd.prix_unitaire));
  };

  if (!isAdmin) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-500" />
        <p>Seul l'administrateur peut gérer les commandes après inscription.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un élève..." value={searchEleve} onChange={e => setSearchEleve(e.target.value)} className="pl-10 pr-10" />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setScannerOpen(true)} title="Scanner par caméra">
              <Camera className="h-4 w-4 text-primary" />
            </Button>
          </div>
          <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={(m) => {
            const found = eleves.find((e: any) => e.matricule === m || e.id === m);
            if (found) { setSelectedEleve(found); setSearchEleve(`${found.prenom} ${found.nom}`); }
            else toast.error('Élève introuvable');
          }} />
          <AnimatePresence>
            {filteredEleves.length > 0 && !selectedEleve && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 border rounded-md divide-y max-h-48 overflow-y-auto">
                {filteredEleves.map((e: any) => (
                  <button key={e.id} className="w-full text-left px-3 py-2 hover:bg-accent/50 flex justify-between items-center" onClick={() => { setSelectedEleve(e); setSearchEleve(`${e.prenom} ${e.nom}`); }}>
                    <span className="font-medium">{e.prenom} {e.nom}</span>
                    <span className="text-xs text-muted-foreground">{e.matricule} — {(e as any).classes?.nom}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {selectedEleve && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary"><User className="h-3 w-3 mr-1" />{selectedEleve.prenom} {selectedEleve.nom}</Badge>
              <Badge variant="outline" className="text-xs">{selectedEleve.matricule}</Badge>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedEleve(null); setSearchEleve(''); }}>Changer</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEleve && !isLoading && commandes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" /> Commandes de {selectedEleve.prenom} ({commandes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {commandes.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.article_nom}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {c.article_taille && <Badge variant="outline" className="text-[10px]">{c.article_taille}</Badge>}
                      <span>Qté: {c.quantite}</span>
                      <span>{Number(c.prix_unitaire).toLocaleString()} GNF/unité</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{c.article_type}</Badge>
                      <Badge variant={c.statut === 'livre' ? 'default' : 'secondary'} className={`text-[10px] ${c.statut === 'livre' ? 'bg-green-600' : 'bg-orange-100 text-orange-800 border-orange-300'}`}>
                        {c.statut === 'livre' ? 'Livré' : 'Payé'}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Total: {(Number(c.prix_unitaire) * c.quantite).toLocaleString()} GNF — Source: {c.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.statut === 'paye' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEleve && !isLoading && commandes.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune commande pour cet élève</CardContent></Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editCmd} onOpenChange={v => !v && setEditCmd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la commande</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Article</Label><Input value={editNom} onChange={e => setEditNom(e.target.value)} /></div>
            <div><Label>Taille</Label><Input value={editTaille} onChange={e => setEditTaille(e.target.value)} placeholder="Ex: M, L, XL..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantité</Label><Input type="number" min={1} value={editQte} onChange={e => setEditQte(Number(e.target.value))} /></div>
              <div><Label>Prix unitaire (GNF)</Label><Input type="number" min={0} value={editPrix} onChange={e => setEditPrix(Number(e.target.value))} /></div>
            </div>
            {editCmd && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <p>Ancien total : <strong>{(Number(editCmd.prix_unitaire) * editCmd.quantite).toLocaleString()} GNF</strong></p>
                <p>Nouveau total : <strong>{(editPrix * editQte).toLocaleString()} GNF</strong></p>
                {(editPrix * editQte) !== (Number(editCmd.prix_unitaire) * editCmd.quantite) && (
                  <p className={`font-semibold ${(editPrix * editQte - Number(editCmd.prix_unitaire) * editCmd.quantite) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Ajustement : {((editPrix * editQte) - (Number(editCmd.prix_unitaire) * editCmd.quantite) > 0 ? '+' : '')}{((editPrix * editQte) - (Number(editCmd.prix_unitaire) * editCmd.quantite)).toLocaleString()} GNF
                  </p>
                )}
              </div>
            )}
            <Button className="w-full" onClick={() => updateCommandeMut.mutate()} disabled={updateCommandeMut.isPending}>
              {updateCommandeMut.isPending ? 'Mise à jour...' : 'Enregistrer & Ajuster le solde'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'article sera retiré de la commande et le montant correspondant sera remboursé automatiquement dans le solde financier de la famille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && deleteCommandeMut.mutate(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer & Rembourser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Boutique() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('retraits');
  const [searchEleve, setSearchEleve] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [remisePct, setRemisePct] = useState(0);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [newArticle, setNewArticle] = useState({ nom: '', categorie: 'tenue_scolaire', taille: 'M', prix: 0, stock: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch articles
  const { data: articles = [] } = useQuery({
    queryKey: ['boutique_articles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('boutique_articles').select('*').order('categorie').order('nom');
      if (error) throw error;
      return data as BoutiqueArticle[];
    },
  });

  // Fetch eleves
  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves_boutique'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, classe_id, famille_id, classes(nom)').is('deleted_at', null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch ventes for history
  const { data: ventes = [] } = useQuery({
    queryKey: ['boutique_ventes', selectedDate],
    queryFn: async () => {
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;
      const { data, error } = await supabase
        .from('boutique_ventes')
        .select('*, eleves(nom, prenom, matricule), boutique_vente_items(*, boutique_articles(nom, taille, categorie))')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredEleves = useMemo(() => {
    if (!searchEleve.trim()) return [];
    const q = searchEleve.toLowerCase();
    return eleves.filter((e: any) =>
      e.nom?.toLowerCase().includes(q) || e.prenom?.toLowerCase().includes(q) || e.matricule?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchEleve, eleves]);

  const montantTotal = cart.reduce((s, c) => s + c.article.prix * c.quantite, 0);
  const montantFinal = Math.round(montantTotal * (1 - remisePct / 100));

  const addToCart = (article: BoutiqueArticle) => {
    setCart(prev => {
      const existing = prev.find(c => c.article.id === article.id);
      if (existing) {
        if (existing.quantite >= article.stock) { toast.error('Stock insuffisant'); return prev; }
        return prev.map(c => c.article.id === article.id ? { ...c, quantite: c.quantite + 1 } : c);
      }
      if (article.stock <= 0) { toast.error('Rupture de stock'); return prev; }
      return [...prev, { article, quantite: 1 }];
    });
  };

  const updateQty = (articleId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.article.id !== articleId) return c;
      const newQ = c.quantite + delta;
      if (newQ <= 0) return c;
      if (newQ > c.article.stock) { toast.error('Stock insuffisant'); return c; }
      return { ...c, quantite: newQ };
    }));
  };

  const removeFromCart = (articleId: string) => setCart(prev => prev.filter(c => c.article.id !== articleId));

  // Validate sale
  const validateSale = useMutation({
    mutationFn: async () => {
      if (!selectedEleve || cart.length === 0) throw new Error('Sélectionnez un élève et des articles');
      // Insert vente
      const { data: vente, error: venteErr } = await supabase.from('boutique_ventes').insert({
        eleve_id: selectedEleve.id,
        montant_total: montantTotal,
        remise_pct: remisePct,
        montant_final: montantFinal,
      }).select().single();
      if (venteErr) throw venteErr;
      // Insert items
      const items = cart.map(c => ({
        vente_id: vente.id,
        article_id: c.article.id,
        quantite: c.quantite,
        prix_unitaire: c.article.prix,
      }));
      const { error: itemsErr } = await supabase.from('boutique_vente_items').insert(items);
      if (itemsErr) throw itemsErr;
      return vente;
    },
    onSuccess: () => {
      // Print ticket
      generateTicketBoutique({
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        matricule: selectedEleve.matricule || '',
        classe: (selectedEleve as any).classes?.nom || '',
        items: cart.map(c => ({ nom: c.article.nom, taille: c.article.taille, quantite: c.quantite, prixUnitaire: c.article.prix })),
        montantTotal, remisePct, montantFinal,
        date: new Date().toLocaleDateString('fr-FR'),
      });
      toast.success('Vente validée !');
      setCart([]);
      setSelectedEleve(null);
      setSearchEleve('');
      setRemisePct(0);
      queryClient.invalidateQueries({ queryKey: ['boutique_articles'] });
      queryClient.invalidateQueries({ queryKey: ['boutique_ventes'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add article
  const addArticleMut = useMutation({
    mutationFn: async () => {
      if (!newArticle.nom) throw new Error('Nom requis');
      const { error } = await supabase.from('boutique_articles').insert(newArticle);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Article ajouté');
      setNewArticle({ nom: '', categorie: 'tenue_scolaire', taille: 'M', prix: 0, stock: 0 });
      queryClient.invalidateQueries({ queryKey: ['boutique_articles'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update stock
  const updateStockMut = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const { error } = await supabase.from('boutique_articles').update({ stock }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boutique_articles'] });
      toast.success('Stock mis à jour');
    },
  });

  const totalVentesJour = ventes.reduce((s: number, v: any) => s + Number(v.montant_final), 0);

  // Cancel sale mutation - restores stock
  const cancelSale = useMutation({
    mutationFn: async (vente: any) => {
      // Restore stock for each item
      for (const item of (vente.boutique_vente_items || [])) {
        const { error: stockErr } = await supabase
          .from('boutique_articles')
          .update({ stock: (item.boutique_articles?.stock || 0) + item.quantite } as any)
          .eq('id', item.article_id);
        if (stockErr) throw stockErr;
      }
      // Delete vente items then vente
      await supabase.from('boutique_vente_items').delete().eq('vente_id', vente.id);
      const { error } = await supabase.from('boutique_ventes').delete().eq('id', vente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vente annulée — stock restauré');
      queryClient.invalidateQueries({ queryKey: ['boutique_articles'] });
      queryClient.invalidateQueries({ queryKey: ['boutique_ventes'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ShoppingBag className="h-8 w-8 text-purple-600" /> Boutique</h1>
          <p className="text-muted-foreground">Vente d'uniformes, équipements et gestion des retraits</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="retraits" className="gap-1"><ClipboardCheck className="h-4 w-4" /> Retraits</TabsTrigger>
          <TabsTrigger value="vente" className="gap-1"><ShoppingBag className="h-4 w-4" /> Vente directe</TabsTrigger>
          <TabsTrigger value="inventaire" className="gap-1"><Package className="h-4 w-4" /> Inventaire</TabsTrigger>
          <TabsTrigger value="historique" className="gap-1"><History className="h-4 w-4" /> Historique</TabsTrigger>
          <TabsTrigger value="gestion" className="gap-1"><Settings className="h-4 w-4" /> Gestion</TabsTrigger>
        </TabsList>

        {/* ===== RETRAITS TAB ===== */}
        <TabsContent value="retraits" className="space-y-4">
          <RetraitsPanel />
        </TabsContent>

        {/* ===== VENTE TAB ===== */}
        <TabsContent value="vente" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Search + Catalogue */}
            <div className="lg:col-span-2 space-y-4">
              {/* Student search */}
              <Card>
                <CardContent className="pt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher un élève (nom, prénom, matricule)..." value={searchEleve} onChange={e => setSearchEleve(e.target.value)} className="pl-10 pr-10" />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setScannerOpen(true)} title="Scanner par caméra">
                      <Camera className="h-4 w-4 text-primary" />
                    </Button>
                  </div>
                  <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={(m) => {
                    const found = eleves.find((e: any) => e.matricule === m || e.id === m);
                    if (found) { setSelectedEleve(found); setSearchEleve(`${found.prenom} ${found.nom}`); }
                    else toast.error('Élève introuvable');
                  }} />
                  <AnimatePresence>
                    {filteredEleves.length > 0 && !selectedEleve && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 border rounded-md divide-y max-h-48 overflow-y-auto">
                        {filteredEleves.map((e: any) => (
                          <button key={e.id} className="w-full text-left px-3 py-2 hover:bg-accent/50 flex justify-between items-center" onClick={() => { setSelectedEleve(e); setSearchEleve(`${e.prenom} ${e.nom}`); }}>
                            <span className="font-medium">{e.prenom} {e.nom}</span>
                            <span className="text-xs text-muted-foreground">{e.matricule} — {(e as any).classes?.nom}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {selectedEleve && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary"><User className="h-3 w-3 mr-1" />{selectedEleve.prenom} {selectedEleve.nom}</Badge>
                      {selectedEleve.famille_id && <Badge variant="outline" className="text-green-700 border-green-300">Famille — Remise possible</Badge>}
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEleve(null); setSearchEleve(''); }}>Changer</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Catalogue by category */}
              {CATEGORIES.map(cat => {
                const catArticles = articles.filter(a => a.categorie === cat.key);
                if (catArticles.length === 0) return null;
                const Icon = cat.icon;
                return (
                  <Card key={cat.key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4" /> {cat.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {catArticles.map(article => (
                          <motion.button key={article.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`p-3 rounded-lg border text-left transition-colors ${article.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:border-purple-400 hover:bg-purple-50/50'}`} onClick={() => article.stock > 0 && addToCart(article)} disabled={article.stock <= 0}>
                            <div className="font-medium text-sm">{article.nom}</div>
                            <div className="flex items-center justify-between mt-1">
                              <Badge variant="outline" className="text-xs">{article.taille}</Badge>
                              <span className="text-xs font-semibold">{article.prix.toLocaleString()} GNF</span>
                            </div>
                            <div className={`text-xs mt-1 ${article.stock < 5 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>Stock: {article.stock}</div>
                          </motion.button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Right: Cart */}
            <div>
              <Card className="sticky top-4 border-purple-200">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-purple-700"><ShoppingBag className="h-5 w-5" /> Panier ({cart.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucun article</p>
                  ) : (
                    <AnimatePresence>
                      {cart.map(item => (
                        <motion.div key={item.article.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.article.nom}</div>
                            <div className="text-xs text-muted-foreground">{item.article.taille} — {item.article.prix.toLocaleString()} GNF</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.article.id, -1)}><Minus className="h-3 w-3" /></Button>
                            <span className="text-sm font-bold w-6 text-center">{item.quantite}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.article.id, 1)}><Plus className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFromCart(item.article.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}

                  {selectedEleve?.famille_id && cart.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Remise famille (%)</Label>
                      <Input type="number" min={0} max={100} value={remisePct} onChange={e => setRemisePct(Number(e.target.value))} />
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-1">
                    <div className="flex justify-between text-sm"><span>Sous-total</span><span>{montantTotal.toLocaleString()} GNF</span></div>
                    {remisePct > 0 && <div className="flex justify-between text-sm text-red-600"><span>Remise ({remisePct}%)</span><span>-{Math.round(montantTotal * remisePct / 100).toLocaleString()} GNF</span></div>}
                    <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-purple-700">{montantFinal.toLocaleString()} GNF</span></div>
                  </div>

                  <Button className="w-full bg-purple-600 hover:bg-purple-700" disabled={!selectedEleve || cart.length === 0 || validateSale.isPending} onClick={() => validateSale.mutate()}>
                    {validateSale.isPending ? 'Validation...' : 'Valider & Imprimer Ticket'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ===== INVENTAIRE TAB ===== */}
        <TabsContent value="inventaire" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowInventoryDialog(true)} className="gap-1 bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4" /> Ajouter un article</Button>
          </div>

          {CATEGORIES.map(cat => {
            const catArticles = articles.filter(a => a.categorie === cat.key);
            return (
              <Card key={cat.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><cat.icon className="h-4 w-4" /> {cat.label} ({catArticles.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {catArticles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun article dans cette catégorie</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="text-left py-2">Nom</th><th>Taille</th><th className="text-right">Prix</th><th className="text-right">Stock</th><th className="text-right">Ajuster</th></tr></thead>
                        <tbody>
                          {catArticles.map(a => (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="py-2 font-medium">{a.nom}</td>
                              <td className="text-center"><Badge variant="outline">{a.taille}</Badge></td>
                              <td className="text-right">{a.prix.toLocaleString()} GNF</td>
                              <td className={`text-right font-bold ${a.stock < 5 ? 'text-red-500' : ''}`}>{a.stock}</td>
                              <td className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Input type="number" min={0} defaultValue={a.stock} className="w-20 h-8 text-right" onBlur={e => {
                                    const val = Number(e.target.value);
                                    if (val !== a.stock) updateStockMut.mutate({ id: a.id, stock: val });
                                  }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ===== HISTORIQUE TAB ===== */}
        <TabsContent value="historique" className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
            </div>
            <Card className="px-4 py-2">
              <div className="text-xs text-muted-foreground">Total du jour</div>
              <div className="text-lg font-bold text-purple-700">{totalVentesJour.toLocaleString()} GNF</div>
            </Card>
            <Card className="px-4 py-2">
              <div className="text-xs text-muted-foreground">Nombre de ventes</div>
              <div className="text-lg font-bold">{ventes.length}</div>
            </Card>
          </div>

          {ventes.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune vente pour cette date</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {ventes.map((v: any) => (
                <Card key={v.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{v.eleves?.prenom} {v.eleves?.nom}</span>
                        <span className="text-xs text-muted-foreground ml-2">{v.eleves?.matricule}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="font-bold text-purple-700">{Number(v.montant_final).toLocaleString()} GNF</div>
                          {Number(v.remise_pct) > 0 && <Badge variant="outline" className="text-xs text-red-600">-{v.remise_pct}%</Badge>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          title="Annuler cette vente (remise en stock)"
                          onClick={() => cancelSale.mutate(v)}
                          disabled={cancelSale.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {v.boutique_vente_items?.map((item: any) => (
                        <Badge key={item.id} variant="secondary" className="text-xs">
                          {item.boutique_articles?.nom} ({item.boutique_articles?.taille}) x{item.quantite}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== GESTION COMMANDES TAB ===== */}
        <TabsContent value="gestion" className="space-y-4">
          <GestionCommandesPanel />
        </TabsContent>
      </Tabs>

      {/* Add Article Dialog */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un article</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={newArticle.nom} onChange={e => setNewArticle(p => ({ ...p, nom: e.target.value }))} /></div>
            <div><Label>Catégorie</Label>
              <Select value={newArticle.categorie} onValueChange={v => setNewArticle(p => ({ ...p, categorie: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Taille</Label>
              <Select value={newArticle.taille} onValueChange={v => setNewArticle(p => ({ ...p, taille: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TAILLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prix (GNF)</Label><Input type="number" value={newArticle.prix} onChange={e => setNewArticle(p => ({ ...p, prix: Number(e.target.value) }))} /></div>
              <div><Label>Stock initial</Label><Input type="number" value={newArticle.stock} onChange={e => setNewArticle(p => ({ ...p, stock: Number(e.target.value) }))} /></div>
            </div>
            <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => { addArticleMut.mutate(); setShowInventoryDialog(false); }}>Ajouter</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

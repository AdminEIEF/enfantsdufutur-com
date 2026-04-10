import { useState, useMemo, useEffect } from 'react';
import { usePagination } from '@/hooks/usePaginatedQuery';
import PaginationControls from '@/components/PaginationControls';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Users, Plus, Search, Phone, Mail, MapPin, Edit, Trash2, UserPlus, ChevronRight, KeyRound, Copy, RefreshCw, GraduationCap, User, Eye, EyeOff, Download, Heart, Wallet, CreditCard, TrendingUp, Printer, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { generateBadgeFamillePDF, generateSingleBadgeFamillePDF } from '@/lib/generateBadgeFamillePDF';
import QRScannerDialog from '@/components/QRScannerDialog';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';


// ─── Hooks ───────────────────────────────────────────────
function useFamilles() {
  return useQuery({
    queryKey: ['familles-with-children'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('familles')
        .select('id, nom_famille, telephone_pere, telephone_mere, email_parent, adresse, solde_famille, photo_url, created_at, updated_at, eleves(id, nom, prenom, statut, matricule, date_naissance, sexe, photo_url, photo_thumbnail_url, classe_id, classes(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom))))')
        .order('nom_famille');
      if (error) throw error;
      return data;
    },
  });
}

function useFamillesPaiements() {
  return useQuery({
    queryKey: ['familles-paiements-totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('eleve_id, montant, type_paiement, eleves!inner(famille_id)')
        .not('eleves.famille_id', 'is', null);
      if (error) throw error;
      // Group by famille_id
      const map = new Map<string, { total: number; scolarite: number }>();
      (data || []).forEach((p: any) => {
        const fid = p.eleves?.famille_id;
        if (!fid) return;
        const prev = map.get(fid) || { total: 0, scolarite: 0 };
        prev.total += Number(p.montant || 0);
        if (p.type_paiement === 'scolarite' || p.type_paiement === 'inscription') {
          prev.scolarite += Number(p.montant || 0);
        }
        map.set(fid, prev);
      });
      return map;
    },
  });
}

function useClassesAll() {
  return useQuery({
    queryKey: ['classes-all-familles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, cycles:cycle_id(nom))').order('nom');
      if (error) throw error;
      return data;
    },
  });
}

export default function Familles() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isSuperviseur = hasRole('superviseur');
  const isAdmin = hasRole('admin');
  const { data: familles = [], isLoading } = useFamilles();
  const { data: schoolConfig } = useSchoolConfig();
  const { data: paiementsMap = new Map() } = useFamillesPaiements();
  const [scannerOpen, setScannerOpen] = useState(false);
  const { data: allClasses = [] } = useClassesAll();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nomFamille, setNomFamille] = useState('');
  const [telPere, setTelPere] = useState('');
  const [telMere, setTelMere] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [selectedFamille, setSelectedFamille] = useState<any>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [addChildMode, setAddChildMode] = useState<'search' | 'create'>('search');
  const [childSearch, setChildSearch] = useState('');
  const [childNom, setChildNom] = useState('');
  const [childPrenom, setChildPrenom] = useState('');
  const [childSexe, setChildSexe] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childClasseId, setChildClasseId] = useState('');
  const [editingChild, setEditingChild] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCodesPanel, setShowCodesPanel] = useState(false);
  const [codesSearch, setCodesSearch] = useState('');
  const [visibleCodeIds, setVisibleCodeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const familleId = searchParams.get('familleId');
    if (familleId && familles.length > 0 && !selectedFamille) {
      const found = familles.find((f: any) => f.id === familleId);
      if (found) setSelectedFamille(found);
    }
  }, [familles, searchParams]);

  const { data: generatedCodes = [], refetch: refetchCodes } = useQuery({
    queryKey: ['generated-family-codes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('generated_family_codes' as any).select('famille_id, code_plain, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin || isSuperviseur,
  });

  const codesMap = useMemo(() => {
    const m = new Map<string, string>();
    generatedCodes.forEach((c: any) => m.set(c.famille_id, c.code_plain));
    return m;
  }, [generatedCodes]);

  const { data: allEleves = [] } = useQuery({
    queryKey: ['eleves-for-famille-search'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, sexe, classe_id, famille_id, classes(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom)))').is('deleted_at', null).order('nom');
      if (error) throw error;
      return data;
    },
  });

  const searchedEleves = useMemo(() => {
    if (!childSearch.trim()) return [];
    const q = childSearch.toLowerCase();
    return allEleves.filter((e: any) => `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(q)).slice(0, 10);
  }, [allEleves, childSearch]);

  const resetForm = () => { setNomFamille(''); setTelPere(''); setTelMere(''); setEmail(''); setAdresse(''); setEditId(null); };
  const resetChildForm = () => { setChildNom(''); setChildPrenom(''); setChildSexe(''); setChildDob(''); setChildClasseId(''); setChildSearch(''); setAddChildMode('search'); };
  const openEdit = (f: any) => { setEditId(f.id); setNomFamille(f.nom_famille); setTelPere(f.telephone_pere || ''); setTelMere(f.telephone_mere || ''); setEmail(f.email_parent || ''); setAdresse(f.adresse || ''); setFormOpen(true); };
  const openCreate = () => { resetForm(); setFormOpen(true); };

  const saveFamille = useMutation({
    mutationFn: async () => {
      if (!nomFamille.trim()) throw new Error('Le nom de famille est obligatoire');
      const payload = { nom_famille: nomFamille.trim(), telephone_pere: telPere.trim() || null, telephone_mere: telMere.trim() || null, email_parent: email.trim() || null, adresse: adresse.trim() || null };
      if (editId) { const { error } = await supabase.from('familles').update(payload).eq('id', editId); if (error) throw error; }
      else { const { error } = await supabase.from('familles').insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['familles-with-children'] }); toast.success(editId ? 'Famille modifiée' : 'Famille créée'); resetForm(); setFormOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFamille = useMutation({
    mutationFn: async (id: string) => {
      const { error: detachErr } = await supabase.from('eleves').update({ famille_id: null }).eq('famille_id', id);
      if (detachErr) throw detachErr;
      const { error } = await supabase.from('familles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['familles-with-children'] }); toast.success('Famille supprimée'); setDeleteConfirmId(null); setSelectedFamille(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const attachExistingChild = useMutation({
    mutationFn: async (eleveId: string) => {
      if (!selectedFamille) throw new Error('Aucune famille sélectionnée');
      const { error } = await supabase.from('eleves').update({ famille_id: selectedFamille.id }).eq('id', eleveId);
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['familles-with-children'] }); await qc.invalidateQueries({ queryKey: ['eleves-for-famille-search'] }); toast.success('Élève rattaché'); resetChildForm(); setAddChildOpen(false); refreshSelectedFamille(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addChild = useMutation({
    mutationFn: async () => {
      if (!childNom.trim() || !childPrenom.trim()) throw new Error('Nom et prénom obligatoires');
      if (!selectedFamille) throw new Error('Aucune famille sélectionnée');
      const { error } = await supabase.from('eleves').insert({ nom: childNom.trim(), prenom: childPrenom.trim(), sexe: childSexe || null, date_naissance: childDob || null, classe_id: childClasseId || null, famille_id: selectedFamille.id, statut: 'inscrit' });
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['familles-with-children'] }); await qc.invalidateQueries({ queryKey: ['eleves-for-famille-search'] }); toast.success(`${childPrenom} ${childNom} ajouté(e)`); resetChildForm(); setAddChildOpen(false); refreshSelectedFamille(); },
    onError: (e: any) => toast.error(e.message),
  });

  const refreshSelectedFamille = () => {
    const updated = qc.getQueryData<any[]>(['familles-with-children']);
    if (updated && selectedFamille) { const f = updated.find((fam: any) => fam.id === selectedFamille.id); if (f) setSelectedFamille(f); }
  };

  const removeChildFromFamily = useMutation({
    mutationFn: async (eleveId: string) => { const { error } = await supabase.from('eleves').update({ famille_id: null }).eq('id', eleveId); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['familles-with-children'] }); toast.success('Enfant détaché'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateChild = useMutation({
    mutationFn: async (child: any) => { const { id, ...rest } = child; const { error } = await supabase.from('eleves').update(rest).eq('id', id); if (error) throw error; },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['familles-with-children'] }); await qc.invalidateQueries({ queryKey: ['eleves-for-famille-search'] }); toast.success('Élève mis à jour'); setEditingChild(null); refreshSelectedFamille(); },
    onError: (e: any) => toast.error(e.message),
  });

  const generateCode = useMutation({
    mutationFn: async (familleId: string) => {
      const code = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const { error } = await supabase.from('familles').update({ code_acces: code } as any).eq('id', familleId);
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => { qc.invalidateQueries({ queryKey: ['familles-with-children'] }); toast.success(`Code généré : ${code}`); if (selectedFamille) setSelectedFamille({ ...selectedFamille, code_acces_set: true }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleSelectAll = () => { if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map((f: any) => f.id))); };

  const bulkDeleteFamilles = useMutation({
    mutationFn: async () => { for (const id of Array.from(selectedIds)) { await supabase.from('eleves').update({ famille_id: null }).eq('famille_id', id); await supabase.from('familles').delete().eq('id', id); } },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['familles-with-children'] }); toast.success(`${selectedIds.size} famille(s) supprimée(s)`); setSelectedIds(new Set()); setBulkDeleteConfirm(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalFamilles = familles.length;
  const totalEnfants = familles.reduce((s: number, f: any) => s + (f.eleves?.length || 0), 0);
  const famillesMulti = familles.filter((f: any) => (f.eleves?.length || 0) > 1).length;

  const filtered = useMemo(() =>
    familles.filter((f: any) =>
      `${f.nom_famille} ${f.email_parent || ''} ${f.telephone_pere || ''} ${f.telephone_mere || ''} ${f.adresse || ''}`.toLowerCase().includes(search.toLowerCase())
    ), [familles, search]);

  const { paginatedData: paginatedFamilles, currentPage: famillesPage, totalPages: famillesTotalPages, totalItems: famillesTotalItems, pageSize: famillesPageSize, setCurrentPage: setFamillesPage } = usePagination(filtered);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Familles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 ml-[52px]">{totalFamilles} familles enregistrées</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-2xl gap-2 h-10" onClick={() => setScannerOpen(true)}>
            <QrCode className="h-4 w-4" /> Scanner
          </Button>
          {(isAdmin || isSuperviseur) && (
            <Button variant="outline" className="rounded-2xl gap-2 h-10" onClick={async () => {
              if (familles.length === 0) { toast.error('Aucune famille'); return; }
              toast.info('Génération des badges…');
              const badgeData = familles.map((f: any) => ({
                id: f.id,
                nom_famille: f.nom_famille,
                telephone_pere: f.telephone_pere,
                telephone_mere: f.telephone_mere,
                code_plain: codesMap.get(f.id),
                enfants: (f.eleves || []).map((e: any) => ({ prenom: e.prenom, nom: e.nom, classe: e.classes?.nom })),
              }));
              await generateBadgeFamillePDF(badgeData, schoolConfig?.nom, schoolConfig?.logo_url);
              toast.success('Badges générés !');
            }}>
              <Printer className="h-4 w-4" /> Badges
            </Button>
          )}
          <Button onClick={openCreate} className="rounded-2xl gap-2 h-10 shadow-sm">
            <Plus className="h-4 w-4" /> Nouvelle
          </Button>
        </div>
      </div>

      {/* Stats Cards - Glass */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'Familles', value: totalFamilles, gradient: 'from-primary/10 to-primary/5', color: 'text-primary' },
          { icon: GraduationCap, label: 'Enfants', value: totalEnfants, gradient: 'from-accent/10 to-accent/5', color: 'text-accent' },
          { icon: Heart, label: 'Fratries', value: famillesMulti, gradient: 'from-pink-500/10 to-pink-500/5', color: 'text-pink-600' },
        ].map(({ icon: Icon, label, value, gradient, color }) => (
          <div key={label} className={`rounded-2xl bg-gradient-to-br ${gradient} border p-3.5 flex items-center gap-2.5`}>
            <div className={`h-10 w-10 rounded-xl bg-card/80 flex items-center justify-center ${color} shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Identifiants Panel */}
      {(isAdmin || isSuperviseur) && (
        <div className="rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden">
          <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors" onClick={() => { setShowCodesPanel(!showCodesPanel); if (!showCodesPanel) refetchCodes(); }}>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-primary" />
              Identifiants Familles
              <Badge variant="secondary" className="text-[10px] rounded-full">{generatedCodes.length}</Badge>
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${showCodesPanel ? 'rotate-90' : ''}`} />
          </button>
          {showCodesPanel && (
            <div className="px-4 pb-4 space-y-3 border-t">
              <div className="flex items-center gap-2 pt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher…" className="pl-9 h-9 rounded-xl" value={codesSearch} onChange={e => setCodesSearch(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => {
                  const lines = ['Famille,Code'];
                  familles.forEach((f: any) => { const code = codesMap.get(f.id); if (code) lines.push(`"${f.nom_famille}","${code}"`); });
                  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'identifiants_familles.csv'; a.click();
                  URL.revokeObjectURL(url); toast.success('CSV téléchargé');
                }}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
              <div className="rounded-xl border divide-y max-h-[300px] overflow-y-auto">
                {familles.filter((f: any) => {
                  if (!codesSearch.trim()) return codesMap.has(f.id);
                  return codesMap.has(f.id) && f.nom_famille.toLowerCase().includes(codesSearch.toLowerCase());
                }).map((f: any) => {
                  const code = codesMap.get(f.id) || '';
                  const isVisible = visibleCodeIds.has(f.id);
                  return (
                    <div key={f.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{f.nom_famille}</p>
                        <p className="text-[11px] text-muted-foreground">{f.telephone_pere ? `📱 ${f.telephone_pere}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <code className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded-lg">{isVisible ? code : '••••••••'}</code>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisibleCodeIds(prev => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })}>
                          {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(code); toast.success('Copié !'); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {familles.filter((f: any) => codesMap.has(f.id)).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">Aucun code généré.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une famille…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-2xl h-10" />
        </div>
        {filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
            <span className="text-xs text-muted-foreground">Tout</span>
          </div>
        )}
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => setBulkDeleteConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> {selectedIds.size}
          </Button>
        )}
      </div>

      {/* Family Cards Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground col-span-full text-center py-12">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-12">Aucune famille trouvée</p>
        ) : paginatedFamilles.map((f: any) => {
          const famCode = codesMap.get(f.id);
          const payData = paiementsMap.get(f.id);
          const totalPaye = payData?.total || 0;
          return (
          <div
            key={f.id}
            className={`group relative rounded-2xl border bg-card/80 backdrop-blur-sm hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden ${selectedIds.has(f.id) ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedFamille(f)}
          >
            {/* Colored top bar */}
            <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-accent" />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.has(f.id)}
                    onCheckedChange={() => toggleSelect(f.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="h-10 w-10 rounded-xl overflow-hidden border-2 border-primary/15 shrink-0 bg-primary/10 flex items-center justify-center">
                    {f.photo_url ? (
                      <img src={f.photo_url} alt={f.nom_famille} className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{f.nom_famille}</h3>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-muted-foreground">{f.eleves?.length || 0} enfant{(f.eleves?.length || 0) > 1 ? 's' : ''}</p>
                      {famCode && (
                        <code className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold">{famCode}</code>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Contact pills */}
              <div className="flex flex-wrap gap-1.5">
                {f.telephone_pere && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                    <Phone className="h-2.5 w-2.5" /> Père
                  </span>
                )}
                {f.telephone_mere && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-pink-500/10 text-pink-700 dark:text-pink-400 px-2 py-0.5 rounded-full">
                    <Phone className="h-2.5 w-2.5" /> Mère
                  </span>
                )}
                {f.email_parent && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                    <Mail className="h-2.5 w-2.5" /> Email
                  </span>
                )}
              </div>

              {/* Payment summary */}
              {totalPaye > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="h-2.5 w-2.5" /> Total payé</span>
                    <span className="font-bold text-emerald-600">{totalPaye.toLocaleString()} GNF</span>
                  </div>
                </div>
              )}

              {/* Bottom badges */}
              <div className="flex gap-1.5 flex-wrap">
                {(f.eleves?.length || 0) > 1 && <Badge variant="secondary" className="text-[10px] rounded-full h-5">Fratrie</Badge>}
                {Number(f.solde_famille || 0) > 0 && (
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px] rounded-full h-5">
                    💰 {Number(f.solde_famille).toLocaleString()} GNF
                  </Badge>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
      <PaginationControls currentPage={famillesPage} totalPages={famillesTotalPages} totalItems={famillesTotalItems} pageSize={famillesPageSize} onPageChange={setFamillesPage} />

      {/* Bulk Delete */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Confirmer la suppression</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Supprimer <strong>{selectedIds.size}</strong> famille(s) ? Les élèves seront conservés.</p>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setBulkDeleteConfirm(false)}>Annuler</Button>
            <Button variant="destructive" className="rounded-xl" onClick={() => bulkDeleteFamilles.mutate()} disabled={bulkDeleteFamilles.isPending}>{bulkDeleteFamilles.isPending ? 'Suppression…' : 'Supprimer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>{editId ? 'Modifier la famille' : 'Nouvelle famille'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom de famille *</Label><Input value={nomFamille} onChange={e => setNomFamille(e.target.value)} maxLength={100} placeholder="Ex: Dupont" className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tél. père</Label><Input value={telPere} onChange={e => setTelPere(e.target.value)} placeholder="+224 6XX" className="rounded-xl" /></div>
              <div><Label>Tél. mère</Label><Input value={telMere} onChange={e => setTelMere(e.target.value)} placeholder="+224 6XX" className="rounded-xl" /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl" /></div>
            <div><Label>Adresse</Label><Input value={adresse} onChange={e => setAdresse(e.target.value)} className="rounded-xl" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setFormOpen(false); resetForm(); }}>Annuler</Button>
            <Button className="rounded-xl" onClick={() => saveFamille.mutate()} disabled={saveFamille.isPending}>{editId ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Family Detail */}
      <Dialog open={!!selectedFamille} onOpenChange={(o) => { if (!o) setSelectedFamille(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 rounded-3xl">
          {selectedFamille && (() => {
            const selCode = codesMap.get(selectedFamille.id);
            const selPay = paiementsMap.get(selectedFamille.id);
            const selTotalPaye = selPay?.total || 0;
            return (
            <>
              {/* Hero Header */}
              <div className="relative bg-gradient-to-br from-primary via-primary/90 to-accent p-5 pb-6 text-primary-foreground">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-14 w-14 rounded-2xl overflow-hidden bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                      {selectedFamille.photo_url ? (
                        <img src={selectedFamille.photo_url} alt={selectedFamille.nom_famille} className="h-full w-full object-cover" />
                      ) : (
                        <Users className="h-7 w-7" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold">{selectedFamille.nom_famille}</h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs opacity-80">{selectedFamille.eleves?.length || 0} enfant{(selectedFamille.eleves?.length || 0) > 1 ? 's' : ''} • {new Date(selectedFamille.created_at).toLocaleDateString('fr-FR')}</p>
                        {selCode && (
                          <code className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-md font-bold">{selCode}</code>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white rounded-xl gap-1 h-8 text-xs" onClick={() => { openEdit(selectedFamille); setSelectedFamille(null); }}>
                      <Edit className="h-3 w-3" /> Modifier
                    </Button>
                    <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white rounded-xl gap-1 h-8 text-xs" onClick={async () => {
                      await generateSingleBadgeFamillePDF({
                        id: selectedFamille.id,
                        nom_famille: selectedFamille.nom_famille,
                        telephone_pere: selectedFamille.telephone_pere,
                        telephone_mere: selectedFamille.telephone_mere,
                        code_plain: codesMap.get(selectedFamille.id),
                        enfants: (selectedFamille.eleves || []).map((e: any) => ({ prenom: e.prenom, nom: e.nom, classe: e.classes?.nom })),
                      }, schoolConfig?.nom, schoolConfig?.logo_url);
                      toast.success('Badge généré !');
                    }}>
                      <Printer className="h-3 w-3" /> Badge
                    </Button>
                    <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white rounded-xl gap-1 h-8 text-xs" onClick={() => { navigate(`/paiements?familleId=${selectedFamille.id}&famille=${encodeURIComponent(selectedFamille.nom_famille)}`); }}>
                      <CreditCard className="h-3 w-3" /> Paiement
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-xl gap-1 h-8 text-xs" onClick={() => setDeleteConfirmId(selectedFamille?.id)}>
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </Button>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5">
                {/* Payment Summary Card */}
                <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border p-4 mt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Suivi des paiements</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-card p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Total payé</p>
                      <p className="text-lg font-bold text-emerald-600">{selTotalPaye.toLocaleString()} <span className="text-xs">GNF</span></p>
                    </div>
                    <div className="rounded-xl bg-card p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Portefeuille</p>
                      <p className="text-lg font-bold text-primary">{Number(selectedFamille.solde_famille || 0).toLocaleString()} <span className="text-xs">GNF</span></p>
                    </div>
                  </div>
                  {selTotalPaye > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Progression globale</span>
                        <span className="font-semibold text-foreground">{selTotalPaye.toLocaleString()} GNF versés</span>
                      </div>
                      <Progress value={Math.min(100, (selTotalPaye / Math.max(selTotalPaye, 1)) * 100)} className="h-2.5 rounded-full" />
                    </div>
                  )}
                </div>

                <Tabs defaultValue="infos" className="mt-3">
                  <TabsList className="grid grid-cols-2 w-full rounded-2xl h-10 bg-muted/50 p-1">
                    <TabsTrigger value="infos" className="rounded-xl text-xs">Informations</TabsTrigger>
                    <TabsTrigger value="enfants" className="rounded-xl text-xs">Enfants ({selectedFamille.eleves?.length || 0})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="infos" className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedFamille.telephone_pere && (
                        <a href={`tel:${selectedFamille.telephone_pere}`} className="flex items-center gap-3 p-3 rounded-2xl border bg-card hover:bg-accent/30 transition-colors">
                          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center"><Phone className="h-4 w-4 text-blue-600" /></div>
                          <div><p className="text-[10px] text-muted-foreground">Père</p><p className="text-sm font-semibold">{selectedFamille.telephone_pere}</p></div>
                        </a>
                      )}
                      {selectedFamille.telephone_mere && (
                        <a href={`tel:${selectedFamille.telephone_mere}`} className="flex items-center gap-3 p-3 rounded-2xl border bg-card hover:bg-accent/30 transition-colors">
                          <div className="h-9 w-9 rounded-xl bg-pink-500/10 flex items-center justify-center"><Phone className="h-4 w-4 text-pink-600" /></div>
                          <div><p className="text-[10px] text-muted-foreground">Mère</p><p className="text-sm font-semibold">{selectedFamille.telephone_mere}</p></div>
                        </a>
                      )}
                      {selectedFamille.email_parent && (
                        <a href={`mailto:${selectedFamille.email_parent}`} className="flex items-center gap-3 p-3 rounded-2xl border bg-card hover:bg-accent/30 transition-colors">
                          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Mail className="h-4 w-4 text-emerald-600" /></div>
                          <div><p className="text-[10px] text-muted-foreground">Email</p><p className="text-sm font-semibold truncate">{selectedFamille.email_parent}</p></div>
                        </a>
                      )}
                      {selectedFamille.adresse && (
                        <div className="flex items-center gap-3 p-3 rounded-2xl border bg-card">
                          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center"><MapPin className="h-4 w-4 text-amber-600" /></div>
                          <div><p className="text-[10px] text-muted-foreground">Adresse</p><p className="text-sm font-semibold">{selectedFamille.adresse}</p></div>
                        </div>
                      )}
                    </div>

                    {/* Wallet */}
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-200/50 dark:border-emerald-800/30 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        <p className="text-xs text-muted-foreground">Portefeuille Famille</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{Number(selectedFamille.solde_famille || 0).toLocaleString()} GNF</p>
                    </div>

                    {/* Access code */}
                    <div className="rounded-2xl border p-4 space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Code d'accès Parent</p>
                      <div className="flex items-center gap-2">
                        {selectedFamille.code_acces_set ? (
                          <>
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 rounded-full">✓ Configuré</Badge>
                            {isSuperviseur && <Button variant="outline" size="sm" className="rounded-xl" onClick={() => generateCode.mutate(selectedFamille.id)}><RefreshCw className="h-3 w-3 mr-1" /> Régénérer</Button>}
                          </>
                        ) : isSuperviseur ? (
                          <Button size="sm" className="rounded-xl" onClick={() => generateCode.mutate(selectedFamille.id)}><KeyRound className="h-3.5 w-3.5 mr-1" /> Générer</Button>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Le superviseur doit générer le code.</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="enfants" className="mt-4 space-y-3">
                    <div className="flex justify-end">
                      <Button size="sm" className="rounded-xl gap-1.5" onClick={() => { resetChildForm(); setAddChildOpen(true); }}>
                        <UserPlus className="h-3.5 w-3.5" /> Ajouter
                      </Button>
                    </div>
                    {selectedFamille.eleves?.length > 0 ? (
                      <div className="space-y-2.5">
                        {selectedFamille.eleves.map((e: any) => (
                          <div key={e.id} className="flex items-center gap-3 p-3.5 rounded-2xl border bg-card/80 hover:shadow-md transition-all">
                            <div className="h-12 w-12 rounded-xl overflow-hidden border-2 border-primary/15 shrink-0 bg-muted flex items-center justify-center">
                              {e.photo_thumbnail_url || e.photo_url ? (
                                <img src={e.photo_thumbnail_url || e.photo_url} alt={`${e.prenom}`} className="h-full w-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <button className="font-semibold text-sm hover:text-primary transition-colors text-left truncate block" onClick={() => setEditingChild({ ...e })}>
                                {e.prenom} {e.nom}
                              </button>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {e.classes && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <GraduationCap className="h-2.5 w-2.5" /> {e.classes.nom}
                                  </span>
                                )}
                                <Badge variant={e.statut === 'inscrit' ? 'default' : 'outline'} className="text-[9px] rounded-full h-4">{e.statut}</Badge>
                                {e.sexe && <span className="text-[10px]">{e.sexe === 'M' ? '👦' : '👧'}</span>}
                              </div>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setEditingChild({ ...e })}><Edit className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => removeChildFromFamily.mutate(e.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-6">Aucun enfant rattaché</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Child */}
      <Dialog open={addChildOpen} onOpenChange={(o) => { setAddChildOpen(o); if (!o) resetChildForm(); }}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader><DialogTitle>Ajouter un enfant — {selectedFamille?.nom_famille}</DialogTitle></DialogHeader>
          <Tabs value={addChildMode} onValueChange={v => setAddChildMode(v as any)} className="mt-2">
            <TabsList className="grid grid-cols-2 w-full rounded-xl">
              <TabsTrigger value="search" className="rounded-lg text-xs"><Search className="h-3 w-3 mr-1" /> Chercher</TabsTrigger>
              <TabsTrigger value="create" className="rounded-lg text-xs"><Plus className="h-3 w-3 mr-1" /> Nouveau</TabsTrigger>
            </TabsList>
            <TabsContent value="search" className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nom, prénom ou matricule…" value={childSearch} onChange={e => setChildSearch(e.target.value)} className="pl-9 rounded-xl" autoFocus />
              </div>
              {childSearch.trim() && (
                <div className="border rounded-xl max-h-[300px] overflow-y-auto divide-y">
                  {searchedEleves.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucun résultat</p>
                  ) : searchedEleves.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{e.prenom} {e.nom}</p>
                        <p className="text-[11px] text-muted-foreground">{e.matricule && <span className="font-mono mr-2">{e.matricule}</span>}{e.classes?.nom || 'Sans classe'}{e.famille_id && <Badge variant="secondary" className="ml-1.5 text-[9px]">En famille</Badge>}</p>
                      </div>
                      <Button size="sm" variant={e.famille_id ? 'outline' : 'default'} className="rounded-xl h-7 text-xs" disabled={attachExistingChild.isPending} onClick={() => attachExistingChild.mutate(e.id)}>
                        <UserPlus className="h-3 w-3 mr-1" />{e.famille_id ? 'Réattribuer' : 'Ajouter'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="create" className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prénom *</Label><Input value={childPrenom} onChange={e => setChildPrenom(e.target.value)} className="rounded-xl" /></div>
                <div><Label>Nom *</Label><Input value={childNom} onChange={e => setChildNom(e.target.value)} className="rounded-xl" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sexe</Label><Select value={childSexe} onValueChange={setChildSexe}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent></Select></div>
                <div><Label>Date naissance</Label><Input type="date" value={childDob} onChange={e => setChildDob(e.target.value)} className="rounded-xl" /></div>
              </div>
              <div><Label>Classe</Label><Select value={childClasseId} onValueChange={setChildClasseId}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Classe" /></SelectTrigger><SelectContent>{allClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}</SelectItem>)}</SelectContent></Select></div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setAddChildOpen(false)}>Annuler</Button>
                <Button className="rounded-xl" onClick={() => addChild.mutate()} disabled={addChild.isPending}><UserPlus className="h-3.5 w-3.5 mr-1" /> Créer</Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Child */}
      <Dialog open={!!editingChild} onOpenChange={(o) => { if (!o) setEditingChild(null); }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Modifier l'élève</DialogTitle></DialogHeader>
          {editingChild && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prénom</Label><Input value={editingChild.prenom} onChange={e => setEditingChild({ ...editingChild, prenom: e.target.value })} className="rounded-xl" /></div>
                <div><Label>Nom</Label><Input value={editingChild.nom} onChange={e => setEditingChild({ ...editingChild, nom: e.target.value })} className="rounded-xl" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sexe</Label><Select value={editingChild.sexe || ''} onValueChange={v => setEditingChild({ ...editingChild, sexe: v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Sexe" /></SelectTrigger><SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent></Select></div>
                <div><Label>Date naissance</Label><Input type="date" value={editingChild.date_naissance || ''} onChange={e => setEditingChild({ ...editingChild, date_naissance: e.target.value })} className="rounded-xl" /></div>
              </div>
              <div><Label>Classe</Label><Select value={editingChild.classe_id || ''} onValueChange={v => setEditingChild({ ...editingChild, classe_id: v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Classe" /></SelectTrigger><SelectContent>{allClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Statut</Label><Select value={editingChild.statut || 'inscrit'} onValueChange={v => setEditingChild({ ...editingChild, statut: v })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inscrit">Inscrit</SelectItem><SelectItem value="réinscrit">Réinscrit</SelectItem><SelectItem value="suspendu">Suspendu</SelectItem><SelectItem value="radié">Radié</SelectItem></SelectContent></Select></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditingChild(null)}>Annuler</Button>
            <Button className="rounded-xl" disabled={updateChild.isPending} onClick={() => {
              if (!editingChild) return;
              updateChild.mutate({ id: editingChild.id, nom: editingChild.nom, prenom: editingChild.prenom, sexe: editingChild.sexe, date_naissance: editingChild.date_naissance || null, classe_id: editingChild.classe_id || null, statut: editingChild.statut });
            }}>{updateChild.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Supprimer la famille ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Les enfants seront conservés mais détachés de la famille.</p>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="destructive" className="rounded-xl" onClick={() => deleteConfirmId && deleteFamille.mutate(deleteConfirmId)} disabled={deleteFamille.isPending}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Scanner */}
      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(raw: string) => {
          setScannerOpen(false);
          try {
            // Try parsing as JSON famille QR
            const parsed = JSON.parse(raw);
            if (parsed?.type === 'famille' && parsed?.id) {
              const found = familles.find((f: any) => f.id === parsed.id);
              if (found) {
                setSelectedFamille(found);
                toast.success(`Famille "${found.nom_famille}" trouvée`);
              } else {
                toast.error('Famille introuvable');
              }
              return;
            }
          } catch {
            // Not JSON, try matching by family name or code
          }
          // Fallback: search by name or code
          const q = raw.trim().toLowerCase();
          const found = familles.find((f: any) =>
            f.nom_famille.toLowerCase() === q ||
            f.id === q ||
            codesMap.get(f.id)?.toLowerCase() === q
          );
          if (found) {
            setSelectedFamille(found);
            toast.success(`Famille "${found.nom_famille}" trouvée`);
          } else {
            toast.error('Aucune famille trouvée pour ce QR code');
          }
        }}
        title="Scanner un badge famille"
      />
    </div>
  );
}

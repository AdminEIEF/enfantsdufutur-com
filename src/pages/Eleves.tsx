import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { ClipboardList, Search, User, Users, UserCheck, Edit, QrCode, Printer, Download, ShieldCheck, Eye, EyeOff, RefreshCw, KeyRound, UserX, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function PasswordSection({ eleve, onUpdate }: { eleve: any; onUpdate: () => void }) {
  const [showPwd, setShowPwd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const save = async (pwd: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('eleves').update({ mot_de_passe_eleve: pwd } as any).eq('id', eleve.id);
      if (error) throw error;
      toast({ title: 'Mot de passe mis à jour' });
      setEditing(false);
      setNewPwd('');
      onUpdate();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const currentPwd = eleve.mot_de_passe_eleve;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <strong className="text-sm">Accès Espace Élève</strong>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Mot de passe :</span>
        <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
          {showPwd ? (currentPwd || 'Non défini') : (currentPwd ? '••••••' : 'Non défini')}
        </code>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowPwd(!showPwd)}>
          {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {editing ? (
        <div className="flex gap-2 items-center">
          <Input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nouveau mot de passe" className="h-8 text-sm w-40" />
          <Button size="sm" variant="outline" className="h-8" onClick={() => setNewPwd(generatePassword())}>
            <RefreshCw className="h-3 w-3 mr-1" /> Générer
          </Button>
          <Button size="sm" className="h-8" disabled={!newPwd.trim() || saving} onClick={() => save(newPwd.trim())}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(false); setNewPwd(''); }}>Annuler</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)}>
            <Edit className="h-3 w-3 mr-1" /> Modifier
          </Button>
          {!currentPwd && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => save(generatePassword())}>
              <KeyRound className="h-3 w-3 mr-1" /> Générer un mot de passe
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/excelUtils';
import { generateBadgeRetrait } from '@/lib/generateBadgeRetrait';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];
type TrancheConfig = { label: string; mois: string[]; montant: number };

export default function Eleves() {
  const [search, setSearch] = useState('');
  const [filterCycle, setFilterCycle] = useState('all');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'famille' | 'individuel'>('individuel');
  const [showComplete, setShowComplete] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [badgeEleve, setBadgeEleve] = useState<any>(null);
  const [abandonDialog, setAbandonDialog] = useState<any>(null);
  const [creatingFamille, setCreatingFamille] = useState(false);
  const [newFamilleName, setNewFamilleName] = useState('');
  const [newFamilleTelPere, setNewFamilleTelPere] = useState('');
  const [newFamilleTelMere, setNewFamilleTelMere] = useState('');
  const [savingFamille, setSavingFamille] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: schoolConfig } = useSchoolConfig();

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['eleves-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*, classes(nom, niveau_id, niveaux:niveau_id(nom, frais_scolarite, cycle_id, cycles:cycle_id(nom, id))), familles(id, nom_famille, telephone_pere, telephone_mere, email_parent)')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, cycle_id)').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: mandatairesAll = [] } = useQuery({
    queryKey: ['mandataires-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mandataires').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: familles = [] } = useQuery({
    queryKey: ['familles-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('familles').select('id, nom_famille').order('nom_famille');
      if (error) throw error;
      return data;
    },
  });

  const { data: paiementsAll = [] } = useQuery({
    queryKey: ['paiements-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('paiements').select('*').eq('type_paiement', 'scolarite');
      if (error) throw error;
      return data;
    },
  });

  const { data: tranchesConfig = {} } = useQuery({
    queryKey: ['parametres-tranches-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametres').select('*').eq('cle', 'tranches_paiement_v2').maybeSingle();
      if (error) throw error;
      if (data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)) {
        return data.valeur as Record<string, TrancheConfig[]>;
      }
      return {} as Record<string, TrancheConfig[]>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from('eleves').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-full'] });
      setEditing(null);
      toast({ title: 'Élève mis à jour' });
    },
  });

  const handleAbandon = async () => {
    if (!abandonDialog) return;
    // Update eleve status to 'abandon'
    const { error } = await supabase.from('eleves').update({ statut: 'abandon' }).eq('id', abandonDialog.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    // Create coordinator entry with full info for document management
    const { data: coordEleve } = await supabase.from('coordinateur_eleves').insert({
      nom: abandonDialog.nom,
      prenom: abandonDialog.prenom,
      ecole_provenance: abandonDialog.classes?.niveaux?.cycles?.nom ? `${abandonDialog.classes.niveaux.cycles.nom} — ${abandonDialog.classes.nom}` : '',
      niveau_scolaire: abandonDialog.classes?.niveaux?.nom || '',
      statut: 'abandon',
    } as any).select().single();

    // Create document entries ONLY for documents the student actually provided
    if (coordEleve) {
      // Documents récupérables par les parents (pas rames/marqueurs)
      const checklistItems: { label: string; provided: boolean }[] = [
        { label: 'Photo d\'identité', provided: !!abandonDialog.checklist_photo },
        { label: 'Livret Scolaire', provided: !!abandonDialog.checklist_livret },
        { label: 'Extrait de Naissance', provided: true }, // Toujours déposé à l'inscription
      ];
      const docInserts = checklistItems
        .filter(item => item.provided)
        .map(item => ({
          eleve_id: (coordEleve as any).id,
          type_document: item.label,
          statut: 'depose',
          date_depot: new Date().toISOString(),
        }));
      if (docInserts.length > 0) {
        await supabase.from('coordinateur_documents').insert(docInserts as any);
      }
    }

    toast({ title: 'Élève marqué en abandon', description: 'L\'élève est maintenant visible chez le coordinateur pour la gestion de ses documents.' });
    setAbandonDialog(null);
    qc.invalidateQueries({ queryKey: ['eleves-full'] });
  };

  const filteredClasses = filterCycle === 'all'
    ? classes
    : classes.filter((c: any) => c.niveaux?.cycle_id === filterCycle);

  // Helper: check if dossier is complete
  const isDossierComplete = (e: any) => !!e.checklist_livret && !!e.checklist_rames && !!e.checklist_marqueurs && !!e.checklist_photo;

  // Normalize phone for search
  const normalizePhone = (phone: string) => phone.replace(/[\s\-\+\(\)]/g, '').replace(/^(224|00224)/, '');

  const isSearchActive = search.trim().length > 0;
  const searchLower = search.toLowerCase();
  const searchNorm = normalizePhone(search);

  const completeDossiers = eleves.filter(isDossierComplete).length;

  const filtered = eleves.filter((e: any) => {
    // Search: name, matricule, phone
    const basicMatch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(searchLower);
    const telPere = e.familles?.telephone_pere || '';
    const telMere = e.familles?.telephone_mere || '';
    const phoneMatch = searchNorm.length >= 3 && (
      normalizePhone(telPere).includes(searchNorm) ||
      normalizePhone(telMere).includes(searchNorm)
    );
    const matchSearch = isSearchActive ? (basicMatch || phoneMatch) : true;

    const matchCycle = filterCycle === 'all' || e.classes?.niveaux?.cycles?.id === filterCycle;
    const matchClasse = filterClasse === 'all' || e.classe_id === filterClasse;
    const isFamille = !!e.famille_id;
    const matchType = filterType === 'all' || (filterType === 'famille' ? isFamille : !isFamille);

    // When searching, always show all results regardless of toggle
    if (isSearchActive) return matchSearch && matchCycle && matchClasse && matchType;

    // When not searching, apply complete filter
    if (!showComplete && isDossierComplete(e)) return false;

    return matchCycle && matchClasse && matchType;
  });

  const totalFamille = eleves.filter((e: any) => !!e.famille_id).length;
  const totalIndividuel = eleves.filter((e: any) => !e.famille_id).length;
  const totalAbandons = eleves.filter((e: any) => e.statut === 'abandon').length;

  const handleSaveEdit = () => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      nom: editing.nom,
      prenom: editing.prenom,
      sexe: editing.sexe,
      date_naissance: editing.date_naissance,
      classe_id: editing.classe_id,
      transport_zone: editing.transport_zone,
      option_cantine: editing.option_cantine,
      famille_id: editing.famille_id || null,
    });
  };

  const buildQrData = (eleve: any) => {
    const baseUrl = window.location.origin;
    return JSON.stringify({
      matricule: eleve.matricule || '',
      nom: eleve.nom,
      prenom: eleve.prenom,
      classe: eleve.classes?.nom || '',
      sexe: eleve.sexe || '',
      url: `${baseUrl}/eleves?matricule=${encodeURIComponent(eleve.matricule || eleve.id)}`,
    });
  };

  const printBadge = () => {
    const w = window.open('', '_blank', 'width=600,height=500');
    if (!w || !badgeEleve) return;
    const qrValue = buildQrData(badgeEleve);
    const sName = schoolConfig?.nom || 'Groupe Scolaire';
    const anneeScolaire = '2025-2026';
    const cycleName = badgeEleve.classes?.niveaux?.cycles?.nom || '';
    const className = badgeEleve.classes?.nom || '';
    const statutLabel = badgeEleve.statut === 'actif' ? 'Élève Actif' : badgeEleve.statut === 'suspendu' ? 'Suspendu' : badgeEleve.statut;
    const statutColor = badgeEleve.statut === 'actif' ? 'background:#dcfce7;color:#166534;' : 'background:#fee2e2;color:#991b1b;';

    w.document.write(`<!DOCTYPE html><html lang="fr"><head>
      <meta charset="UTF-8" />
      <title>Badge ${badgeEleve.prenom} ${badgeEleve.nom}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 20px; }
        .id-card {
          width: 450px; height: 280px; background: white; border-radius: 14px; position: relative;
          overflow: hidden; display: flex; flex-direction: column; border: 1px solid #e5e7eb;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .header-accent {
          position: absolute; top: 0; left: 0; right: 0; height: 85px;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          clip-path: polygon(0 0, 100% 0, 100% 80%, 0% 100%);
        }
        .card-body { display: flex; position: relative; z-index: 1; flex: 1; }
        .left-col { display: flex; flex-direction: column; align-items: center; padding-top: 30px; padding-left: 25px; }
        .photo-container {
          width: 105px; height: 125px; background: #f9fafb; border: 3px solid white;
          border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;
        }
        .photo-container img { width: 100%; height: 100%; object-fit: cover; }
        .photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #ccc; }
        .right-col { flex: 1; display: flex; flex-direction: column; padding: 14px 20px 0 20px; }
        .school-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
        .school-logo { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .school-name { color: white; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
        .school-year { color: rgba(255,255,255,0.85); font-size: 9px; font-weight: 600; margin-left: auto; }
        .status-badge {
          position: absolute; top: 95px; right: 25px; padding: 2px 10px; border-radius: 9999px;
          font-size: 10px; font-weight: 700; text-transform: uppercase; ${statutColor}
        }
        .info-section { margin-top: 30px; }
        .info-label { font-size: 8px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 13px; font-weight: 700; color: #1f2937; margin-bottom: 6px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4px; }
        .qr-code-container {
          position: absolute; bottom: 20px; right: 25px; background: white; padding: 4px;
          border-radius: 4px; border: 1px solid #e5e7eb;
        }
        .card-footer {
          position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 25px;
          background: #f9fafb; border-top: 1px solid #f3f4f6; display: flex; align-items: center;
        }
        .footer-text { font-size: 7px; color: #9ca3af; }
        .actions { display: flex; gap: 12px; margin-top: 10px; }
        .btn { padding: 10px 24px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
        @media print {
          body { background: white; padding: 0; }
          .actions, .hint { display: none !important; }
          .id-card { box-shadow: none !important; border: 1px solid #ddd !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head><body>
      <div class="id-card" id="badge-card">
        <div class="header-accent"></div>
        <div class="card-body">
          <div class="left-col">
            <div class="photo-container">
              ${badgeEleve.photo_url
                ? `<img src="${badgeEleve.photo_url}" alt="${badgeEleve.prenom}" />`
                : '<div class="photo-placeholder">👤</div>'}
            </div>
          </div>
          <div class="right-col">
            <div class="school-header">
              <div class="school-logo">🎓</div>
              <span class="school-name">${sName}</span>
              <span class="school-year">${anneeScolaire}</span>
            </div>
            <div class="status-badge">${statutLabel}</div>
            <div class="info-section">
              <p class="info-label">Nom & Prénoms</p>
              <p class="info-value">${badgeEleve.nom.toUpperCase()} ${badgeEleve.prenom}</p>
              <div class="info-grid">
                <div>
                  <p class="info-label">Classe</p>
                  <p class="info-value">${cycleName} — ${className}</p>
                </div>
                <div>
                  <p class="info-label">Matricule</p>
                  <p class="info-value" style="font-family:monospace;">${badgeEleve.matricule || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="qr-code-container"><canvas id="qr"></canvas></div>
        <div class="card-footer">
          <span class="footer-text">Carte obligatoire pour l'accès aux services scolaires.</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" onclick="downloadPNG()">📥 Télécharger Image (PNG)</button>
        <button class="btn btn-secondary" onclick="window.print()">🖨️ Imprimer / Export PDF</button>
      </div>
      <p class="hint" style="font-size:11px;color:#9ca3af;">Astuce : Pour le PDF, choisissez "Enregistrer au format PDF" dans la fenêtre d'impression.</p>

      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
      <script>
        QRCode.toCanvas(document.getElementById('qr'), ${JSON.stringify(qrValue)}, { width: 80, margin: 0 }, function(){});
        function downloadPNG() {
          html2canvas(document.getElementById('badge-card'), { scale: 3, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
            var a = document.createElement('a');
            a.download = '${badgeEleve.matricule || 'badge'}_${badgeEleve.nom}.png';
            a.href = canvas.toDataURL('image/png');
            a.click();
          });
        }
      <\/script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <ClipboardList className="h-7 w-7 text-primary" /> Élèves
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold">{eleves.length}</p><p className="text-xs text-muted-foreground">Total élèves</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-500" />
          <div><p className="text-2xl font-bold">{totalFamille}</p><p className="text-xs text-muted-foreground">En famille</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-orange-500" />
          <div><p className="text-2xl font-bold">{totalIndividuel}</p><p className="text-xs text-muted-foreground">Individuels</p></div>
        </CardContent></Card>
        {totalAbandons > 0 && (
          <Card className="border-destructive/30"><CardContent className="pt-4 flex items-center gap-3">
            <UserX className="h-8 w-8 text-destructive" />
            <div><p className="text-2xl font-bold text-destructive">{totalAbandons}</p><p className="text-xs text-muted-foreground">Abandons</p></div>
          </CardContent></Card>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher nom, téléphone, matricule..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCycle} onValueChange={v => { setFilterCycle(v); setFilterClasse('all'); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les cycles</SelectItem>
            {cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {filteredClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="famille">En famille</SelectItem>
            <SelectItem value="individuel">Individuel</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={showComplete} onCheckedChange={setShowComplete} id="toggle-complete-eleves" />
          <Label htmlFor="toggle-complete-eleves" className="text-sm cursor-pointer flex items-center gap-1.5">
            {showComplete ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showComplete ? 'Tous' : 'En cours'}
          </Label>
          {!showComplete && completeDossiers > 0 && (
            <Badge variant="secondary" className="text-xs">{completeDossiers} masqué{completeDossiers > 1 ? 's' : ''}</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
          const rows = filtered.map((e: any) => ({
            Matricule: e.matricule || '',
            Nom: e.nom,
            Prénom: e.prenom,
            Sexe: e.sexe || '',
            'Date de naissance': e.date_naissance || '',
            Cycle: e.classes?.niveaux?.cycles?.nom || '',
            Classe: e.classes?.nom || '',
            Statut: e.statut,
            'Nom du père': e.nom_prenom_pere || '',
            'Nom de la mère': e.nom_prenom_mere || '',
            Famille: e.familles?.nom_famille || '',
            'Tél. père': e.familles?.telephone_pere || '',
            'Tél. mère': e.familles?.telephone_mere || '',
            Email: e.familles?.email_parent || '',
            Cantine: e.option_cantine ? 'Oui' : 'Non',
            'Solde cantine': Number(e.solde_cantine || 0),
            Transport: e.transport_zone || '',
            'Uniforme scolaire': e.uniforme_scolaire ? 'Oui' : 'Non',
            'Uniforme sport': e.uniforme_sport ? 'Oui' : 'Non',
            'Livret': e.checklist_livret ? 'Oui' : 'Non',
            'Rames': e.checklist_rames ? 'Oui' : 'Non',
            'Marqueurs': e.checklist_marqueurs ? 'Oui' : 'Non',
            'Photo': e.checklist_photo ? 'Oui' : 'Non',
          }));
          exportToExcel(rows, `eleves_${new Date().toISOString().slice(0, 10)}`, 'Élèves');
          toast({ title: 'Export réussi', description: `${rows.length} élève(s) exporté(s)` });
        }}>
          <Download className="h-4 w-4 mr-1" /> Exporter Excel
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Prénom</TableHead>
                <TableHead>Sexe</TableHead><TableHead>Cycle</TableHead><TableHead>Classe</TableHead>
                <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setSelected(e)}>
                  <TableCell>
                    {e.famille_id ? (
                      <Badge variant="default" className="gap-1 text-xs"><Users className="h-3 w-3" />Famille</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs"><UserCheck className="h-3 w-3" />Individuel</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                  <TableCell className="font-medium">{e.nom}</TableCell>
                  <TableCell>{e.prenom}</TableCell>
                  <TableCell>{e.sexe || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{e.classes?.niveaux?.cycles?.nom || '—'}</Badge></TableCell>
                  <TableCell>{e.classes?.nom || '—'}</TableCell>
                  <TableCell><Badge variant={e.statut === 'inscrit' ? 'default' : e.statut === 'abandon' ? 'destructive' : 'secondary'}>{e.statut}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end" onClick={ev => ev.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...e })}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setBadgeEleve(e)}><QrCode className="h-4 w-4" /></Button>
                      {e.statut === 'inscrit' && (
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setAbandonDialog(e)} title="Marquer en abandon">
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">{filtered.length} élève(s) trouvé(s)</div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><User className="h-5 w-5" /> {selected?.prenom} {selected?.nom}</DialogTitle></DialogHeader>
          {selected && (() => {
            const niveauId = selected.classes?.niveau_id || null;
            const eleveTranches: TrancheConfig[] = (niveauId && tranchesConfig[niveauId]) ? tranchesConfig[niveauId] : [];
            const elevePaiements = paiementsAll.filter((p: any) => p.eleve_id === selected.id);
            const moisPayes = elevePaiements.map((p: any) => p.mois_concerne).filter(Boolean) as string[];
            const fraisAnnuels = Number(selected.classes?.niveaux?.frais_scolarite || 0);
            const totalPaye = elevePaiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
            const resteAPayer = Math.max(0, fraisAnnuels - totalPaye);

            // Build month -> tranche map
            const moisToTranche: Record<string, TrancheConfig> = {};
            eleveTranches.forEach(t => t.mois.forEach(m => { moisToTranche[m] = t; }));

            // Check if a tranche is fully paid (all its months are paid)
            const isTranchePaid = (t: TrancheConfig) => t.mois.every(m => moisPayes.includes(m));

            return (
            <Tabs defaultValue="info" className="mt-2">
              <TabsList className="grid w-full grid-cols-4"><TabsTrigger value="info">Infos</TabsTrigger><TabsTrigger value="scolarite">Scolarité</TabsTrigger><TabsTrigger value="options">Options</TabsTrigger><TabsTrigger value="famille">Famille</TabsTrigger></TabsList>
              <TabsContent value="info" className="space-y-3 text-sm mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Matricule:</strong> {selected.matricule || '—'}</div>
                  <div><strong>Sexe:</strong> {selected.sexe || '—'}</div>
                  <div><strong>Date de naissance:</strong> {selected.date_naissance || '—'}</div>
                  <div><strong>Statut:</strong> <Badge>{selected.statut}</Badge></div>
                  <div><strong>Cycle:</strong> {selected.classes?.niveaux?.cycles?.nom || '—'}</div>
                  <div><strong>Classe:</strong> {selected.classes?.nom || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <strong>Type:</strong>
                  {selected.famille_id ? <Badge className="gap-1"><Users className="h-3 w-3" />En famille — {selected.familles?.nom_famille}</Badge> : <Badge variant="outline" className="gap-1"><UserCheck className="h-3 w-3" />Individuel</Badge>}
                </div>
                {/* Mot de passe élève */}
                <PasswordSection eleve={selected} onUpdate={() => { qc.invalidateQueries({ queryKey: ['eleves-full'] }); setSelected({ ...selected }); }} />
              </TabsContent>

              {/* Scolarité tab - month-by-month status */}
              <TabsContent value="scolarite" className="space-y-3 text-sm mt-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">Total annuel</p>
                    <p className="font-bold">{fraisAnnuels.toLocaleString()} GNF</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">Payé</p>
                    <p className="font-bold text-green-600">{totalPaye.toLocaleString()} GNF</p>
                  </div>
                  <div className={`rounded-lg p-2 ${resteAPayer === 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-destructive/10'}`}>
                    <p className="text-xs text-muted-foreground">Reste</p>
                    <p className={`font-bold ${resteAPayer === 0 ? 'text-green-600' : 'text-destructive'}`}>{resteAPayer.toLocaleString()} GNF</p>
                  </div>
                </div>

                {eleveTranches.length > 0 ? (
                  <div className="space-y-3">
                    {eleveTranches.map((t, idx) => {
                      const tranchePaid = isTranchePaid(t);
                      return (
                        <div key={idx} className={`rounded-lg border p-3 ${tranchePaid ? 'border-green-300 bg-green-50 dark:bg-green-950' : 'border-destructive/30 bg-destructive/5'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-sm">{t.label}</span>
                            <span className="text-xs font-medium">{t.montant.toLocaleString()} GNF</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {t.mois.map(m => {
                              const paid = moisPayes.includes(m);
                              return (
                                <div key={m} className={`text-center text-xs rounded py-1 px-1 ${paid ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                                  {m.slice(0, 3)}
                                  <span className="block text-[10px]">{paid ? '✓' : '✗'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Statut par mois :</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {MOIS_SCOLAIRES.map(m => {
                        const paid = moisPayes.includes(m);
                        return (
                          <div key={m} className={`text-center text-xs rounded py-1.5 px-1 ${paid ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                            {m.slice(0, 3)}
                            <span className="block text-[10px]">{paid ? '✓ Payé' : '✗ Impayé'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="options" className="space-y-3 text-sm mt-3">
                <div>
                  <h4 className="font-semibold mb-1">Check-list</h4>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={selected.checklist_livret ? 'default' : 'outline'}>Livret {selected.checklist_livret ? '✓' : '✗'}</Badge>
                    <Badge variant={selected.checklist_rames ? 'default' : 'outline'}>Rames {selected.checklist_rames ? '✓' : '✗'}</Badge>
                    <Badge variant={selected.checklist_marqueurs ? 'default' : 'outline'}>Marqueurs {selected.checklist_marqueurs ? '✓' : '✗'}</Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Options</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selected.transport_zone && <Badge variant="outline">Transport: {selected.transport_zone}</Badge>}
                    {selected.option_cantine && <Badge variant="outline">Cantine</Badge>}
                    {selected.uniforme_scolaire && <Badge variant="outline">Uniforme scolaire</Badge>}
                    {selected.uniforme_sport && <Badge variant="outline">Uniforme sport</Badge>}
                    {selected.uniforme_polo_lacoste && <Badge variant="outline">Polo Lacoste</Badge>}
                    {selected.uniforme_karate && <Badge variant="outline">Karaté</Badge>}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="famille" className="space-y-3 text-sm mt-3">
                {selected.familles ? (
                  <div>
                    <h4 className="font-semibold mb-1">Famille: {selected.familles.nom_famille}</h4>
                    <div className="text-muted-foreground space-y-1">
                      {selected.familles.telephone_pere && <p>Tél. père: {selected.familles.telephone_pere}</p>}
                      {selected.familles.telephone_mere && <p>Tél. mère: {selected.familles.telephone_mere}</p>}
                      {selected.familles.email_parent && <p>Email: {selected.familles.email_parent}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Élève inscrit individuellement, non rattaché à une famille.</p>
                )}
              </TabsContent>
            </Tabs>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Modifier l'élève</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom</Label><Input value={editing.nom} onChange={e => setEditing({ ...editing, nom: e.target.value })} /></div>
                <div><Label>Prénom</Label><Input value={editing.prenom} onChange={e => setEditing({ ...editing, prenom: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sexe</Label>
                  <Select value={editing.sexe || ''} onValueChange={v => setEditing({ ...editing, sexe: v })}>
                    <SelectTrigger><SelectValue placeholder="Sexe" /></SelectTrigger>
                    <SelectContent><SelectItem value="M">M</SelectItem><SelectItem value="F">F</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Date de naissance</Label><Input type="date" value={editing.date_naissance || ''} onChange={e => setEditing({ ...editing, date_naissance: e.target.value })} /></div>
              </div>
              <div><Label>Classe</Label>
                <Select value={editing.classe_id || ''} onValueChange={v => setEditing({ ...editing, classe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Famille</Label>
                <div className="flex gap-2">
                  <Select value={editing.famille_id || 'none'} onValueChange={v => setEditing({ ...editing, famille_id: v === 'none' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucune famille" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune famille</SelectItem>
                      {familles.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nom_famille}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" onClick={() => setCreatingFamille(!creatingFamille)} className="shrink-0">
                    {creatingFamille ? '✕' : '+ Créer'}
                  </Button>
                </div>
                {creatingFamille && (
                  <div className="mt-2 border rounded-lg p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-semibold">Nouvelle famille</p>
                    <Input placeholder="Nom de famille *" value={newFamilleName} onChange={e => setNewFamilleName(e.target.value)} className="h-8 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Tél. père" value={newFamilleTelPere} onChange={e => setNewFamilleTelPere(e.target.value)} className="h-8 text-sm" />
                      <Input placeholder="Tél. mère" value={newFamilleTelMere} onChange={e => setNewFamilleTelMere(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <Button size="sm" disabled={!newFamilleName.trim() || savingFamille} onClick={async () => {
                      setSavingFamille(true);
                      try {
                        const { data, error } = await supabase.from('familles').insert({
                          nom_famille: newFamilleName.trim(),
                          telephone_pere: newFamilleTelPere.trim() || null,
                          telephone_mere: newFamilleTelMere.trim() || null,
                        }).select('id').single();
                        if (error) throw error;
                        qc.invalidateQueries({ queryKey: ['familles-all'] });
                        setEditing({ ...editing, famille_id: data.id });
                        setCreatingFamille(false);
                        setNewFamilleName('');
                        setNewFamilleTelPere('');
                        setNewFamilleTelMere('');
                        toast({ title: 'Famille créée', description: `"${newFamilleName.trim()}" ajoutée` });
                      } catch (err: any) {
                        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
                      } finally {
                        setSavingFamille(false);
                      }
                    }}>
                      {savingFamille ? 'Création...' : 'Créer et attribuer'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge QR dialog */}
      <Dialog open={!!badgeEleve} onOpenChange={() => setBadgeEleve(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Badge QR</DialogTitle></DialogHeader>
          {badgeEleve && (() => {
            const cycleName = badgeEleve.classes?.niveaux?.cycles?.nom?.toLowerCase() || '';
            const isCrecheMaternelle = cycleName.includes('crèche') || cycleName.includes('creche') || cycleName.includes('maternelle');
            const eleveMandataires = (mandatairesAll as any[]).filter((m: any) => m.eleve_id === badgeEleve.id);

            return (
              <div className="text-center space-y-4">
                <div className="border rounded-xl p-6 space-y-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Carte Scolaire</p>
                  <p className="text-xs text-muted-foreground">{badgeEleve.classes?.niveaux?.cycles?.nom} — {badgeEleve.classes?.nom}</p>
                  {badgeEleve.photo_url && (
                    <img src={badgeEleve.photo_url} alt={badgeEleve.prenom} className="w-20 h-20 rounded-full object-cover border-2 border-primary mx-auto" />
                  )}
                  <div className="flex justify-center">
                    <QRCodeSVG value={buildQrData(badgeEleve)} size={150} />
                  </div>
                  <p className="text-lg font-bold">{badgeEleve.prenom} {badgeEleve.nom}</p>
                  <p className="text-sm text-muted-foreground">{badgeEleve.sexe} • {badgeEleve.date_naissance || ''}</p>
                  <p className="font-mono text-sm">{badgeEleve.matricule || '—'}</p>
                </div>

                {/* Mandataires preview for Crèche/Maternelle */}
                {isCrecheMaternelle && eleveMandataires.length > 0 && (
                  <div className="border rounded-lg p-3 text-left space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-orange-600" /> Personnes autorisées</p>
                    {eleveMandataires.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        {m.photo_url ? (
                          <img src={m.photo_url} className="w-8 h-8 rounded-full object-cover border" alt={m.prenom} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">👤</div>
                        )}
                        <span className="font-medium">{m.prenom} {m.nom}</span>
                        <span className="text-muted-foreground text-xs">({m.lien_parente})</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={printBadge} className="gap-2"><Printer className="h-4 w-4" /> Badge standard</Button>
                  {isCrecheMaternelle && eleveMandataires.length > 0 && (
                    <Button
                      variant="outline"
                      className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={() => generateBadgeRetrait({
                        eleve: {
                          nom: badgeEleve.nom,
                          prenom: badgeEleve.prenom,
                          matricule: badgeEleve.matricule || '',
                          classe: badgeEleve.classes?.nom || '',
                          cycle: badgeEleve.classes?.niveaux?.cycles?.nom || '',
                          photo_url: badgeEleve.photo_url,
                        },
                        mandataires: eleveMandataires,
                        qrValue: buildQrData(badgeEleve),
                      })}
                    >
                      <ShieldCheck className="h-4 w-4" /> Badge de retrait
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Abandon dialog */}
      <Dialog open={!!abandonDialog} onOpenChange={() => setAbandonDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserX className="h-5 w-5 text-destructive" /> Marquer en abandon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Voulez-vous marquer <strong>{abandonDialog?.prenom} {abandonDialog?.nom}</strong> comme ayant abandonné ?
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm">
                L'élève sera marqué comme « abandon » et ses documents seront transférés au coordinateur pour gestion du retrait éventuel.
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

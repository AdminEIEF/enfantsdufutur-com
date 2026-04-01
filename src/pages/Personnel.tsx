import { useState, useRef, useCallback } from 'react';
import { usePagination } from '@/hooks/usePaginatedQuery';
import PaginationControls from '@/components/PaginationControls';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Briefcase, Plus, Search, Loader2, Clock, Calendar, FileText, DollarSign,
  Check, X, Eye, Trash2, Upload, UserPlus, Users, ScanLine, CreditCard, Printer,
  Camera, Download, Key, Mail, Paperclip, BarChart3, MessageSquare, TrendingUp, TrendingDown, AlertTriangle, GraduationCap, FileSpreadsheet, ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import AvancesValidationTab from '@/components/AvancesValidationTab';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import QRScannerDialog from '@/components/QRScannerDialog';
import { QRCodeCanvas } from 'qrcode.react';
import { generateBadgeEmployePDF, generatePlancheBadgesEmployesPDF } from '@/lib/generateBadgeEmploye';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { generateBulletinPaiePDF } from '@/lib/generateBulletinPaiePDF';
import { exportToExcel, readExcelFile } from '@/lib/excelUtils';

import AffectationsEnseignants from '@/components/AffectationsEnseignants';
import AffectationsSecondaire from '@/components/AffectationsSecondaire';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const DOC_TYPES = [
  { key: 'contrat', label: 'Contrat de travail' },
  { key: 'piece_identite', label: "Pièce d'identité" },
  { key: 'cv', label: 'CV' },
  { key: 'diplome', label: 'Diplôme' },
  { key: 'autre', label: 'Autre' },
];

function EmployeeDocuments({ employeId }: { employeId: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('contrat');

  const { data: docs = [], refetch } = useQuery({
    queryKey: ['emp-docs', employeId],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('documents-employes').list(employeId);
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${employeId}/${docType}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documents-employes').upload(path, file);
    setUploading(false);
    if (error) { toast({ title: 'Erreur upload', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Document uploadé' });
    refetch();
    e.target.value = '';
  };

  const handleDelete = async (name: string) => {
    await supabase.storage.from('documents-employes').remove([`${employeId}/${name}`]);
    toast({ title: '🗑️ Document supprimé' });
    refetch();
  };

  const handleDownload = async (name: string) => {
    const { data } = await supabase.storage.from('documents-employes').createSignedUrl(`${employeId}/${name}`, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const getDocLabel = (name: string) => {
    const match = DOC_TYPES.find(d => name.startsWith(d.key));
    return match?.label || 'Document';
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild disabled={uploading}>
            <span>{uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}Uploader</span>
          </Button>
        </label>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun document</p>
      ) : (
        <div className="space-y-1">
          {docs.map((doc: any) => (
            <div key={doc.name} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
              <span className="truncate flex-1 cursor-pointer hover:underline" onClick={() => handleDownload(doc.name)}>
                📄 {getDocLabel(doc.name)} <span className="text-muted-foreground">({(doc.metadata?.size / 1024)?.toFixed(0) || '?'} KB)</span>
              </span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDelete(doc.name)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvalForm({ employes, user, onDone }: { employes: any[]; user: any; onDone: () => void }) {
  const { toast } = useToast();
  const [empId, setEmpId] = useState('');
  const [periode, setPeriode] = useState(`${new Date().getFullYear()}-S1`);
  const [scores, setScores] = useState({ pedagogie: 5, ponctualite: 5, assiduite: 5, relations: 5, competences: 5, initiative: 5 });
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!empId) { toast({ title: 'Sélectionnez un employé', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('evaluations_employes').insert({
      employe_id: empId, periode, ...scores, commentaire: commentaire || null, evalue_par: user?.id,
    });
    setSaving(false);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Évaluation enregistrée' });
    onDone();
  };

  const labels: Record<string, string> = { pedagogie: 'Pédagogie', ponctualite: 'Ponctualité', assiduite: 'Assiduité', relations: 'Relations', competences: 'Compétences', initiative: 'Initiative' };

  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Employé *</Label>
        <Select value={empId} onValueChange={setEmpId}>
          <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
          <SelectContent>{employes.filter((e: any) => e.statut === 'actif').map((e: any) => (
            <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</SelectItem>
          ))}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Période</Label><Input value={periode} onChange={e => setPeriode(e.target.value)} placeholder="Ex: 2025-S1" /></div>
      {Object.keys(labels).map(k => (
        <div key={k} className="flex items-center justify-between">
          <Label className="text-xs">{labels[k]}</Label>
          <Input type="number" min={0} max={10} className="w-20 h-8 text-center" value={(scores as any)[k]} onChange={e => setScores(s => ({ ...s, [k]: Number(e.target.value) }))} />
        </div>
      ))}
      <div className="space-y-1"><Label>Commentaire</Label><Textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} /></div>
      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enregistrer l'évaluation
      </Button>
    </div>
  );
}

export default function Personnel() {
  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const { data: schoolConfig } = useSchoolConfig();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [pointageOpen, setPointageOpen] = useState(false);
  const [paieOpen, setPaieOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'add' | 'detail'>('add');
  const [passwordGenOpen, setPasswordGenOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [viewCourrierAdmin, setViewCourrierAdmin] = useState<any>(null);
  const [refuseMotif, setRefuseMotif] = useState('');
  const [refuseTarget, setRefuseTarget] = useState<{ type: 'conge'; id: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [filterCategorie, setFilterCategorie] = useState<string>('all');
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCategorie, setImportCategorie] = useState('enseignant');
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Form state for new employee
  const [form, setForm] = useState({
    nom: '', prenom: '', sexe: 'M', telephone: '', email: '',
    adresse: '', categorie: 'service' as string, poste: '', salaire_base: '',
    prix_heure: '',
    date_embauche: new Date().toISOString().slice(0, 10), niveau_enseignant: '',
  });

  // Paie form
  const [paieForm, setPaieForm] = useState({
    employe_id: '', mois: new Date().getMonth() + 1, annee: new Date().getFullYear(),
    salaire_brut: 0, retenues: 0, avances_deduites: 0, primes: 0, commentaire: '',
  });

  // Fetch employees
  const { data: employes = [], isLoading } = useQuery({
    queryKey: ['employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('id, matricule, nom, prenom, sexe, date_naissance, telephone, email, adresse, photo_url, categorie, poste, date_embauche, date_fin_contrat, salaire_base, prix_heure, statut, coord_edit_count, created_at, updated_at')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Fetch emploi du temps for secondary teacher hours calculation
  const { data: emploiDuTemps = [] } = useQuery({
    queryKey: ['emploi-du-temps-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('emploi_du_temps').select('enseignant_id, heure_debut, heure_fin');
      if (error) throw error;
      return data;
    },
  });

  // Compute weekly hours per teacher
  const heuresParEnseignant: Record<string, number> = {};
  for (const slot of emploiDuTemps) {
    if (!slot.enseignant_id) continue;
    const [hd, md] = slot.heure_debut.split(':').map(Number);
    const [hf, mf] = slot.heure_fin.split(':').map(Number);
    const duree = (hf + mf / 60) - (hd + md / 60);
    if (duree > 0) {
      heuresParEnseignant[slot.enseignant_id] = (heuresParEnseignant[slot.enseignant_id] || 0) + duree;
    }
  }

  const getHeuresMensuelles = (empId: string) => {
    const hebdo = heuresParEnseignant[empId] || 0;
    return Math.round(hebdo * 4.33 * 100) / 100;
  };

  const getSalaireCalculeSecondaire = (empId: string, prixHeure: number) => {
    return Math.round(getHeuresMensuelles(empId) * prixHeure);
  };

  // Fetch pointages today
  const today = new Date().toISOString().slice(0, 10);
  const { data: pointagesToday = [] } = useQuery({
    queryKey: ['pointages-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pointages_employes')
        .select('*, employes(nom, prenom, matricule)')
        .eq('date_pointage', today)
        .order('heure_arrivee', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch congés en attente
  const { data: congesEnAttente = [] } = useQuery({
    queryKey: ['conges-attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conges')
        .select('*, employes(nom, prenom, matricule, categorie)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch cycles for enseignant niveau selection
  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles-for-personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('id, nom').order('ordre');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch matieres with cycles for enseignant poste
  const { data: matieresWithCycles = [] } = useQuery({
    queryKey: ['matieres-cycles-for-personnel'],
    queryFn: async () => {
      const { data: matieres, error } = await supabase
        .from('matieres')
        .select('id, nom, cycle_id, cycles(id, nom)')
        .order('ordre');
      if (error) throw error;
      return matieres || [];
    },
  });

  // Fetch courriers
  const { data: courriers = [], refetch: refetchCourriers } = useQuery({
    queryKey: ['courriers-employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courriers_employes')
        .select('*, employes(nom, prenom, matricule, categorie)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch evaluations
  const { data: evaluationsAdmin = [] } = useQuery({
    queryKey: ['evaluations-employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluations_employes')
        .select('*, employes(nom, prenom, matricule)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch student evaluations of teachers
  const { data: evalElevesAdmin = [] } = useQuery({
    queryKey: ['eval-enseignants-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eval_enseignants_eleves' as any)
        .select('*, eleves:eleve_id(nom, prenom, matricule, classes:classe_id(nom)), employes:enseignant_id(nom, prenom, matricule)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch bulletins de paie
  const { data: bulletins = [] } = useQuery({
    queryKey: ['bulletins-paie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulletins_paie')
        .select('*, employes(nom, prenom, matricule, poste, categorie, date_embauche)')
        .order('annee', { ascending: false })
        .order('mois', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });


  const addEmployee = useMutation({
    mutationFn: async () => {
      if (!form.nom || !form.prenom) throw new Error('Nom et prénom obligatoires');
      const prefixMap: Record<string, string> = { enseignant_primaire: 'ENP', enseignant_secondaire: 'ESC', administration: 'ADM', service: 'SRV', direction: 'DIR', hygiene: 'HYG', securite_primaire: 'SCP', securite_lycee: 'SCL', chauffeur: 'CHF', infirmiere: 'INF', librairie: 'LIB', cantine: 'CAN', surveillant: 'SUR' };
      const prefix = prefixMap[form.categorie] || 'EMP';
      const { count } = await supabase.from('employes').select('id', { count: 'exact', head: true });
      const num = String((count || 0) + 1).padStart(4, '0');
      const matricule = `${prefix}-${num}`;
      const autoPassword = form.prenom.slice(0, 3).toLowerCase() + num + String(Math.floor(Math.random() * 100)).padStart(2, '0');

      const dbCategorie = (form.categorie === 'enseignant_primaire' || form.categorie === 'enseignant_secondaire') ? 'enseignant' : form.categorie;
      const { data: inserted, error } = await supabase.from('employes').insert({
        matricule, nom: form.nom, prenom: form.prenom, sexe: form.sexe,
        telephone: form.telephone || null, email: form.email || null,
        adresse: form.adresse || null, categorie: dbCategorie as any,
        poste: form.poste, salaire_base: Number(form.salaire_base) || 0,
        prix_heure: Number(form.prix_heure) || 0,
        date_embauche: form.date_embauche, mot_de_passe: autoPassword,
      }).select('id').single();
      if (error) throw error;

      // Upload camera photo if captured
      if (capturedPhoto && cameraTarget === 'add' && inserted) {
        const photoUrl = await uploadPhoto(inserted.id, capturedPhoto);
        if (photoUrl) await supabase.from('employes').update({ photo_url: photoUrl }).eq('id', inserted.id);
      }
      return { matricule, autoPassword };
    },
    onSuccess: (result) => {
      toast({ title: '✅ Employé ajouté', description: `Matricule: ${result?.matricule}` });
      setGeneratedPassword(result?.autoPassword || null);
      qc.invalidateQueries({ queryKey: ['employes'] });
      setAddOpen(false);
      setForm({ nom: '', prenom: '', sexe: 'M', telephone: '', email: '', adresse: '', categorie: 'service', poste: '', salaire_base: '', prix_heure: '', date_embauche: new Date().toISOString().slice(0, 10), niveau_enseignant: '' });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // QR Scan pointage
  const handleScanPointage = async (matricule: string) => {
    const emp = employes.find((e: any) => e.matricule === matricule);
    if (!emp) { toast({ title: 'Employé introuvable', variant: 'destructive' }); return; }
    if (emp.statut !== 'actif') { toast({ title: 'Employé inactif', variant: 'destructive' }); return; }

    const existing = pointagesToday.find((p: any) => p.employe_id === emp.id);
    if (existing && existing.heure_depart) {
      toast({ title: 'Déjà pointé arrivée et départ' }); return;
    }

    if (existing && !existing.heure_depart) {
      // Mark departure
      const heureDepart = new Date();
      const heuresT = existing.heure_arrivee
        ? ((heureDepart.getTime() - new Date(existing.heure_arrivee).getTime()) / 3600000).toFixed(1)
        : 0;
      await supabase.from('pointages_employes').update({
        heure_depart: heureDepart.toISOString(),
        heures_travaillees: Number(heuresT),
      }).eq('id', existing.id);
      toast({ title: `✅ Départ enregistré pour ${emp.prenom} ${emp.nom}` });
    } else {
      // Mark arrival
      const now = new Date();
      const heure = now.getHours();
      const retard = heure >= 8; // 8h = seuil de retard
      await supabase.from('pointages_employes').insert({
        employe_id: emp.id,
        date_pointage: today,
        heure_arrivee: now.toISOString(),
        retard,
      });
      const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==');
      beep.play().catch(() => {});
      toast({ title: `✅ Arrivée enregistrée pour ${emp.prenom} ${emp.nom}${retard ? ' (RETARD)' : ''}` });
    }
    qc.invalidateQueries({ queryKey: ['pointages-today'] });
    setScannerOpen(false);
  };

  useBarcodeScanner({ onScan: handleScanPointage });

  // Approve/reject congé
  const handleConge = async (id: string, statut: 'approuve' | 'refuse', motif?: string) => {
    const conge = congesEnAttente.find((c: any) => c.id === id);
    await supabase.from('conges').update({
      statut,
      motif: statut === 'refuse' && motif ? motif : undefined,
      traite_par: user?.id,
      traite_at: new Date().toISOString(),
    }).eq('id', id);
    // Notify employee
    if (conge?.employe_id) {
      await supabase.from('employee_notifications').insert({
        employe_id: conge.employe_id,
        titre: statut === 'approuve' ? '✅ Congé approuvé' : '❌ Congé refusé',
        message: statut === 'approuve'
          ? `Votre demande de congé du ${format(new Date(conge.date_debut), 'dd/MM/yyyy')} au ${format(new Date(conge.date_fin), 'dd/MM/yyyy')} a été approuvée.`
          : `Votre demande de congé a été refusée.${motif ? ' Motif: ' + motif : ''}`,
        type: statut === 'approuve' ? 'info' : 'alerte',
      });
    }
    toast({ title: statut === 'approuve' ? '✅ Congé approuvé' : '❌ Congé refusé' });
    qc.invalidateQueries({ queryKey: ['conges-attente'] });
  };

  

  // Refuse with motif
  const confirmRefuse = async () => {
    if (!refuseTarget) return;
    if (!refuseMotif.trim()) { toast({ title: 'Motif obligatoire', variant: 'destructive' }); return; }
    if (refuseTarget.type === 'conge') {
      await handleConge(refuseTarget.id, 'refuse', refuseMotif);
    }
    setRefuseTarget(null);
    setRefuseMotif('');
  };

  // Generate bulletin de paie with auto-deduction of approved advances
  const generateBulletin = async () => {
    if (!paieForm.employe_id) { toast({ title: 'Sélectionnez un employé', variant: 'destructive' }); return; }
    const emp = employes.find((e: any) => e.id === paieForm.employe_id);
    const brut = paieForm.salaire_brut || Number(emp?.salaire_base || 0);

    // Auto-calculate avances to deduct: approved advances not yet fully reimbursed
    const { data: pendingAvances } = await supabase
      .from('avances_salaire')
      .select('id, montant, montant_rembourse')
      .eq('employe_id', paieForm.employe_id)
      .eq('statut', 'approuve')
      .gt('montant', 0);

    let totalAvancesDeduites = paieForm.avances_deduites;
    const avancesToUpdate: { id: string; deduction: number }[] = [];

    if (pendingAvances && pendingAvances.length > 0 && paieForm.avances_deduites === 0) {
      // Auto-calculate: deduct all remaining approved advances
      for (const av of pendingAvances) {
        const restant = Number(av.montant) - Number(av.montant_rembourse);
        if (restant > 0) {
          totalAvancesDeduites += restant;
          avancesToUpdate.push({ id: av.id, deduction: restant });
        }
      }
    }

    const net = brut + paieForm.primes - paieForm.retenues - totalAvancesDeduites;

    const { error } = await supabase.from('bulletins_paie').upsert({
      employe_id: paieForm.employe_id,
      mois: paieForm.mois,
      annee: paieForm.annee,
      salaire_brut: brut,
      retenues: paieForm.retenues,
      avances_deduites: totalAvancesDeduites,
      primes: paieForm.primes,
      salaire_net: net,
      commentaire: paieForm.commentaire || null,
      genere_par: user?.id,
    }, { onConflict: 'employe_id,mois,annee' });

    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }

    // Update avances repayment tracking
    for (const av of avancesToUpdate) {
      const avData = pendingAvances?.find(a => a.id === av.id);
      const newRembourse = Number(avData?.montant_rembourse || 0) + av.deduction;
      await supabase.from('avances_salaire').update({
        montant_rembourse: newRembourse,
        mois_remboursement: `${MOIS_NOMS[paieForm.mois]} ${paieForm.annee}`,
        statut: newRembourse >= Number(avData?.montant || 0) ? 'rembourse' : 'approuve',
      }).eq('id', av.id);
    }

    // Notify employee
    await supabase.from('employee_notifications').insert({
      employe_id: paieForm.employe_id,
      titre: '💰 Bulletin de paie disponible',
      message: `Votre bulletin de paie de ${MOIS_NOMS[paieForm.mois]} ${paieForm.annee} est disponible. Salaire net: ${net.toLocaleString()} GNF.${totalAvancesDeduites > 0 ? ` (Avances déduites: ${totalAvancesDeduites.toLocaleString()} GNF)` : ''}`,
      type: 'info',
    });

    toast({ title: '✅ Bulletin généré', description: totalAvancesDeduites > 0 ? `${totalAvancesDeduites.toLocaleString()} GNF d'avances déduites automatiquement` : undefined });
    qc.invalidateQueries({ queryKey: ['bulletins-paie'] });
    qc.invalidateQueries({ queryKey: ['avances-attente'] });
    setPaieOpen(false);
  };

  // Camera functions
  const startCamera = async (target: 'add' | 'detail') => {
    setCameraTarget(target);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      setCameraStream(stream);
      setTimeout(() => { if (cameraRef.current) cameraRef.current.srcObject = stream; }, 100);
    } catch { toast({ title: 'Impossible d\'accéder à la caméra', variant: 'destructive' }); setCameraOpen(false); }
  };

  const capturePhoto = () => {
    if (!cameraRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = cameraRef.current.videoWidth;
    canvas.height = cameraRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(cameraRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraOpen(false);
  };

  const uploadPhoto = async (employeId: string, dataUrl: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${employeId}/photo_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (upErr) { toast({ title: 'Erreur upload photo', variant: 'destructive' }); return null; }
    const { data: signedData } = await supabase.storage.from('photos').createSignedUrl(path, 31536000);
    return signedData?.signedUrl || null;
  };

  // Generate password for existing employee
  const handleGeneratePassword = async () => {
    if (!selectedEmp) return;
    const newPw = selectedEmp.prenom.slice(0, 3).toLowerCase() + selectedEmp.matricule.slice(-4) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const { error } = await supabase.from('employes').update({ mot_de_passe: newPw }).eq('id', selectedEmp.id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setGeneratedPassword(newPw);
    setPasswordGenOpen(false);
    await supabase.from('employee_notifications').insert({
      employe_id: selectedEmp.id,
      titre: '🔐 Nouveau mot de passe',
      message: 'Un nouveau mot de passe a été généré pour votre compte. Contactez l\'administration pour le recevoir.',
      type: 'alerte',
    });
  };

  // Admin set custom password
  const handleSetCustomPassword = async () => {
    if (!selectedEmp || !customPassword.trim()) { toast({ title: 'Mot de passe requis', variant: 'destructive' }); return; }
    const { error } = await supabase.from('employes').update({ mot_de_passe: customPassword }).eq('id', selectedEmp.id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setGeneratedPassword(customPassword);
    setEditPasswordOpen(false);
    setCustomPassword('');
    await supabase.from('employee_notifications').insert({
      employe_id: selectedEmp.id,
      titre: '🔐 Mot de passe modifié',
      message: 'Votre mot de passe portail a été modifié par l\'administration.',
      type: 'alerte',
    });
  };

  // Delete employee
  const handleDeleteEmployee = async (emp: any) => {
    const { error } = await supabase.from('employes').delete().eq('id', emp.id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '🗑️ Employé supprimé', description: `${emp.prenom} ${emp.nom} a été supprimé.` });
    setSelectedEmp(null);
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ['employes'] });
  };

  // Print badge planche A4
  const handlePrintPlancheBadges = async () => {
    const activeEmps = employes.filter((e: any) => e.statut === 'actif');
    if (activeEmps.length === 0) { toast({ title: 'Aucun employé actif' }); return; }
    const QRCode = await import('qrcode');
    const qrMap: Record<string, string> = {};
    for (const emp of activeEmps) {
      qrMap[emp.matricule] = await QRCode.toDataURL(emp.matricule, { width: 200 });
    }
    await generatePlancheBadgesEmployesPDF(activeEmps, qrMap, schoolConfig?.nom, schoolConfig?.logo_url, { telephone: '625 00 00 00', adresse: schoolConfig?.ville || 'Conakry, Guinée' });
  };

  // Print bulletin paie
  const handlePrintBulletin = (b: any) => {
    generateBulletinPaiePDF({
      employe: { nom: b.employes?.nom || '', prenom: b.employes?.prenom || '', matricule: b.employes?.matricule || '', poste: b.employes?.poste || '', categorie: b.employes?.categorie || '', date_embauche: b.employes?.date_embauche || '' },
      mois: b.mois, annee: b.annee,
      salaire_brut: Number(b.salaire_brut), primes: Number(b.primes),
      retenues: Number(b.retenues), avances_deduites: Number(b.avances_deduites),
      salaire_net: Number(b.salaire_net), commentaire: b.commentaire,
      schoolName: schoolConfig?.nom, schoolSubtitle: schoolConfig?.soustitre, schoolCity: schoolConfig?.ville, logoUrl: schoolConfig?.logo_url,
    });
  };

  const filtered = employes.filter((e: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.nom.toLowerCase().includes(q) || e.prenom.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q);
    const effectiveCat = e.categorie === 'enseignant' 
      ? (e.matricule?.startsWith('ESC') ? 'enseignant_secondaire' : 'enseignant_primaire')
      : e.categorie;
    const matchCat = filterCategorie === 'all' || effectiveCat === filterCategorie;
    return matchSearch && matchCat;
  });

  const { paginatedData: paginatedPersonnel, currentPage: personnelPage, totalPages: personnelTotalPages, totalItems: personnelTotalItems, pageSize: personnelPageSize, setCurrentPage: setPersonnelPage } = usePagination(filtered);

  const categorieLabel: Record<string, string> = {
    enseignant_primaire: 'Enseignant Primaire', enseignant_secondaire: 'Enseignant Secondaire',
    enseignant: 'Enseignant', administration: 'Administration', service: 'Service', direction: 'Direction',
    hygiene: 'Service Hygiène', securite_primaire: 'Sécurité Primaire', securite_lycee: 'Sécurité Lycée',
    chauffeur: 'Chauffeur', infirmiere: 'Infirmière', librairie: 'Librairie', cantine: 'Cantine', surveillant: 'Surveillant',
  };

  const getEffectiveCat = (e: any) => e.categorie === 'enseignant' 
    ? (e.matricule?.startsWith('ESC') ? 'enseignant_secondaire' : 'enseignant_primaire')
    : e.categorie;

  const handleExportExcel = async () => {
    const dataToExport = filtered.map((e: any) => ({
      'Matricule': e.matricule,
      'Nom': e.nom,
      'Prénom': e.prenom,
      'Sexe': e.sexe || '',
      'Catégorie': categorieLabel[getEffectiveCat(e)] || e.categorie,
      'Poste': e.poste || '',
      'Téléphone': e.telephone || '',
      'Email': e.email || '',
      'Salaire (GNF)': Number(e.salaire_base) || 0,
      'Date embauche': e.date_embauche || '',
      'Statut': e.statut,
    }));
    const suffix = filterCategorie !== 'all' ? `_${filterCategorie}` : '';
    await exportToExcel(dataToExport, `personnel${suffix}`, 'Personnel');
    toast({ title: '✅ Export Excel réussi' });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const rows = await readExcelFile(file);
      if (rows.length === 0) { toast({ title: 'Fichier vide', variant: 'destructive' }); setImportLoading(false); return; }

      // Debug: log detected columns
      console.log('Excel columns detected:', Object.keys(rows[0]));
      console.log('First row:', rows[0]);

      // Flexible column matching
      const findCol = (row: Record<string, any>, patterns: string[]) => {
        for (const key of Object.keys(row)) {
          const k = key.toLowerCase().trim();
          for (const p of patterns) {
            if (k === p || k.includes(p)) return String(row[key] ?? '').trim();
          }
        }
        return '';
      };

      const preview = rows.map((row, index) => {
        let nom = findCol(row, ['nom']);
        let prenom = findCol(row, ['prénom', 'prenom', 'prenoms', 'prénoms']);
        const telephone = findCol(row, ['téléphone', 'telephone', 'tel', 'numéro', 'numero', 'contact', 'n°']);

        // If "Nom et Prénom" or "Nom & Prénom" in a single column
        if (!prenom && nom) {
          const fullNameCol = findCol(row, ['nom et prenom', 'nom et prénom', 'nom & prenom', 'nom & prénom', 'nom complet', 'nom_complet']);
          if (fullNameCol) {
            const parts = fullNameCol.split(/\s+/);
            nom = parts[0] || '';
            prenom = parts.slice(1).join(' ') || '';
          }
        }

        // If still no prenom, try splitting nom (if it has spaces)
        if (!prenom && nom && nom.includes(' ')) {
          const parts = nom.split(/\s+/);
          nom = parts[0];
          prenom = parts.slice(1).join(' ');
        }

        return { id: index, nom, prenom, telephone, poste: '' };
      }).filter(r => r.nom && r.prenom);

      if (preview.length === 0) { 
        const cols = rows.length > 0 ? Object.keys(rows[0]).join(', ') : 'aucune';
        toast({ title: 'Aucun employé valide trouvé', description: `Colonnes détectées: ${cols}. Attendu: Nom, Prénom`, variant: 'destructive' }); 
        setImportLoading(false); 
        return; 
      }
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

        const prefixMap: Record<string, string> = { enseignant: 'ENS', administration: 'ADM', service: 'SRV', direction: 'DIR' };
        const prefix = prefixMap[categorie] || 'EMP';
        const { count } = await supabase.from('employes').select('id', { count: 'exact', head: true });
        const num = String((count || 0) + added + 1).padStart(4, '0');
        const matricule = `${prefix}-${num}`;
        const autoPassword = row.prenom.slice(0, 3).toLowerCase() + num + String(Math.floor(Math.random() * 100)).padStart(2, '0');

        const { error } = await supabase.from('employes').insert({
          matricule,
          nom: row.nom,
          prenom: row.prenom,
          categorie: categorie as any,
          poste: row.poste || '',
          telephone: row.telephone || null,
          salaire_base: 0,
          date_embauche: new Date().toISOString().slice(0, 10),
          mot_de_passe: autoPassword,
        });
        if (!error) added++;
      }

      toast({ title: `✅ ${added} employé(s) importé(s)`, description: 'Cliquez sur chaque nom pour compléter les informations.' });
      qc.invalidateQueries({ queryKey: ['employes'] });
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-primary" /> Personnel
          <Badge>{employes.length}</Badge>
        </h1>
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
          <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)}>
            <ScanLine className="h-4 w-4 mr-1" /> Pointage QR
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrintPlancheBadges}>
            <Printer className="h-4 w-4 mr-1" /> Planches Badges A4
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nouvel employé</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1"><Label>Catégorie *</Label>
                    <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v, poste: '', niveau_enseignant: '' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enseignant_primaire">Enseignant Primaire (Crèche/Maternelle/Primaire)</SelectItem>
                        <SelectItem value="enseignant_secondaire">Enseignant Secondaire (Collège/Lycée)</SelectItem>
                        <SelectItem value="administration">Administration</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="direction">Direction</SelectItem>
                        <SelectItem value="hygiene">Service Hygiène</SelectItem>
                        <SelectItem value="securite_primaire">Sécurité Primaire</SelectItem>
                        <SelectItem value="securite_lycee">Sécurité Lycée</SelectItem>
                        <SelectItem value="chauffeur">Chauffeur</SelectItem>
                        <SelectItem value="infirmiere">Infirmière</SelectItem>
                        <SelectItem value="librairie">Librairie</SelectItem>
                        <SelectItem value="cantine">Cantine</SelectItem>
                        <SelectItem value="surveillant">Surveillant</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Le matricule sera généré automatiquement (ex: ENP-0001 ou ENS-0001)</p>
                  </div>
                </div>
                {(form.categorie === 'enseignant_primaire' || form.categorie === 'enseignant_secondaire') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Niveau *</Label>
                      <Select value={form.niveau_enseignant} onValueChange={v => setForm(f => ({ ...f, niveau_enseignant: v, poste: '' }))}>
                        <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                        <SelectContent>
                          {cycles.filter((c: any) => {
                            if (form.categorie === 'enseignant_primaire') {
                              return ['Crèche', 'Maternelle', 'Primaire'].some(n => c.nom.toLowerCase().includes(n.toLowerCase()));
                            }
                            return ['Collège', 'Lycée'].includes(c.nom);
                          }).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Matière(s) *</Label>
                      {!form.niveau_enseignant ? (
                        <p className="text-xs text-muted-foreground py-2">Sélectionnez un niveau</p>
                      ) : (
                        <div className="border rounded-md p-1.5 max-h-32 overflow-y-auto space-y-0.5">
                          {matieresWithCycles
                            .filter((m: any) => m.cycle_id === form.niveau_enseignant)
                            .filter((m: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.nom === m.nom) === i)
                            .map((m: any) => {
                              const val = `Professeur de ${m.nom}`;
                              const selected = form.poste.split(' / ').includes(val);
                              return (
                                <label key={m.id} className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-accent/50 cursor-pointer text-xs">
                                  <input type="checkbox" checked={selected} onChange={() => {
                                    setForm(f => {
                                      const current = f.poste ? f.poste.split(' / ').filter(Boolean) : [];
                                      const updated = selected ? current.filter(v => v !== val) : [...current, val];
                                      return { ...f, poste: updated.join(' / ') };
                                    });
                                  }} className="rounded border-input h-3.5 w-3.5" />
                                  {m.nom}
                                </label>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Prénom *</Label><Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {form.categorie !== 'enseignant_primaire' && form.categorie !== 'enseignant_secondaire' && (
                    <div className="space-y-1"><Label>Poste</Label><Input value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} placeholder="Ex: Secrétaire" /></div>
                  )}
                  <div className="space-y-1"><Label>Sexe</Label>
                    <Select value={form.sexe} onValueChange={v => setForm(f => ({ ...f, sexe: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                </div>
                {form.categorie === 'enseignant_secondaire' ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label>💰 Prix de l'heure (GNF)</Label>
                      <Input type="number" value={form.prix_heure} onChange={e => setForm(f => ({ ...f, prix_heure: e.target.value }))} placeholder="Ex: 50000" />
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                      ⏱️ Le salaire sera calculé automatiquement une fois l'emploi du temps attribué (heures hebdo × 4.33 × prix/h).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Salaire de base (GNF)</Label><Input type="number" value={form.salaire_base} onChange={e => setForm(f => ({ ...f, salaire_base: e.target.value }))} placeholder="Calculé auto ou saisie manuelle" /></div>
                      <div className="space-y-1"><Label>Date d'embauche</Label><Input type="date" value={form.date_embauche} onChange={e => setForm(f => ({ ...f, date_embauche: e.target.value }))} /></div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Salaire (GNF)</Label><Input type="number" value={form.salaire_base} onChange={e => setForm(f => ({ ...f, salaire_base: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Date d'embauche</Label><Input type="date" value={form.date_embauche} onChange={e => setForm(f => ({ ...f, date_embauche: e.target.value }))} /></div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">🔐 Le mot de passe sera généré automatiquement et affiché après création.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Adresse</Label><Input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} /></div>
                  <div className="space-y-1">
                    <Label>Photo (caméra)</Label>
                    {capturedPhoto && cameraTarget === 'add' ? (
                      <div className="flex items-center gap-2">
                        <img src={capturedPhoto} alt="Photo" className="w-16 h-16 rounded-full object-cover border" />
                        <Button size="sm" variant="outline" onClick={() => setCapturedPhoto(null)}>Reprendre</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => startCamera('add')}>
                        <Camera className="h-4 w-4 mr-1" /> Prendre une photo
                      </Button>
                    )}
                  </div>
                </div>
                <Button className="w-full" onClick={() => addEmployee.mutate()} disabled={addEmployee.isPending}>
                  {addEmployee.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Créer l'employé
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><Users className="h-5 w-5 mx-auto mb-1 text-primary" /><div className="text-xl font-bold">{employes.filter((e: any) => e.statut === 'actif').length}</div><p className="text-xs text-muted-foreground">Actifs</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" /><div className="text-xl font-bold">{pointagesToday.length}</div><p className="text-xs text-muted-foreground">Pointages aujourd'hui</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Calendar className="h-5 w-5 mx-auto mb-1 text-orange-500" /><div className="text-xl font-bold">{congesEnAttente.length}</div><p className="text-xs text-muted-foreground">Congés en attente</p></CardContent></Card>
        
      </div>

      <Tabs defaultValue="employes">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="employes"><Users className="h-3.5 w-3.5 mr-1" />Employés</TabsTrigger>
          <TabsTrigger value="pointage"><Clock className="h-3.5 w-3.5 mr-1" />Pointage</TabsTrigger>
          <TabsTrigger value="conges"><Calendar className="h-3.5 w-3.5 mr-1" />Congés ({congesEnAttente.length})</TabsTrigger>
          <TabsTrigger value="avances"><DollarSign className="h-3.5 w-3.5 mr-1" />Avances</TabsTrigger>
          <TabsTrigger value="paie"><FileText className="h-3.5 w-3.5 mr-1" />Paie</TabsTrigger>
          
          <TabsTrigger value="courriers"><Mail className="h-3.5 w-3.5 mr-1" />Courriers ({courriers.filter((c: any) => c.statut === 'non_lu').length})</TabsTrigger>
          <TabsTrigger value="evaluations"><BarChart3 className="h-3.5 w-3.5 mr-1" />Évaluations</TabsTrigger>
          <TabsTrigger value="affectations"><GraduationCap className="h-3.5 w-3.5 mr-1" />Affectations</TabsTrigger>
        </TabsList>

        {/* Employés */}
        <TabsContent value="employes" className="mt-4">
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <Select value={filterCategorie} onValueChange={setFilterCategorie}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="enseignant_primaire">Enseignants Primaire</SelectItem>
                <SelectItem value="enseignant_secondaire">Enseignants Secondaire</SelectItem>
                <SelectItem value="administration">Administration</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="direction">Direction</SelectItem>
                <SelectItem value="hygiene">Service Hygiène</SelectItem>
                <SelectItem value="securite_primaire">Sécurité Primaire</SelectItem>
                <SelectItem value="securite_lycee">Sécurité Lycée</SelectItem>
                <SelectItem value="chauffeur">Chauffeur</SelectItem>
                <SelectItem value="infirmiere">Infirmière</SelectItem>
                <SelectItem value="librairie">Librairie</SelectItem>
                <SelectItem value="cantine">Cantine</SelectItem>
                <SelectItem value="surveillant">Surveillant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mb-3 flex gap-2 flex-wrap">
            {['all', 'enseignant_primaire', 'enseignant_secondaire', 'administration', 'service', 'direction', 'hygiene', 'securite_primaire', 'securite_lycee', 'chauffeur', 'infirmiere', 'librairie', 'cantine', 'surveillant'].map(cat => {
              const count = cat === 'all' ? employes.length : employes.filter((e: any) => getEffectiveCat(e) === cat).length;
              const label = cat === 'all' ? 'Tous' : (categorieLabel[cat] || cat);
              return (
                <Badge key={cat} variant={filterCategorie === cat ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setFilterCategorie(cat)}>
                  {label} ({count})
                </Badge>
              );
            })}
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun employé trouvé</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedPersonnel.map((emp: any) => {
                const photoSrc = emp.photo_url
                  ? (emp.photo_url.startsWith('http') ? emp.photo_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/photos/${emp.photo_url}`)
                  : null;
                const isSecondaire = emp.matricule?.startsWith('ESC');
                const heuresMens = isSecondaire ? getHeuresMensuelles(emp.id) : 0;
                const salaireCalc = isSecondaire && Number(emp.prix_heure) > 0 ? getSalaireCalculeSecondaire(emp.id, Number(emp.prix_heure)) : 0;
                const catLabel = categorieLabel[getEffectiveCat(emp)] || emp.categorie;
                const catColors: Record<string, string> = {
                  enseignant_primaire: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
                  enseignant_secondaire: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                  administration: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
                  direction: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                  service: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
                  chauffeur: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
                  securite_primaire: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
                  securite_lycee: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
                  cantine: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
                  hygiene: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
                  librairie: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
                  surveillant: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
                  infirmiere: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20',
                };
                const catColor = catColors[getEffectiveCat(emp)] || 'bg-muted text-muted-foreground';

                return (
                  <Card
                    key={emp.id}
                    className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30 overflow-hidden"
                    onClick={() => setSelectedEmp(emp)}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                          {photoSrc && <AvatarImage src={photoSrc} alt={`${emp.prenom} ${emp.nom}`} />}
                          <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">{emp.prenom?.[0]}{emp.nom?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                              {emp.prenom} {emp.nom}
                            </h3>
                            <Badge variant={emp.statut === 'actif' ? 'default' : 'destructive'} className="shrink-0 text-[10px] h-5">
                              {emp.statut === 'actif' ? '● Actif' : emp.statut}
                            </Badge>
                          </div>
                          <p className="text-[11px] font-mono text-muted-foreground">{emp.matricule}</p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${catColor}`}>
                            {catLabel}
                          </span>
                          {emp.poste && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[50%] text-right" title={emp.poste}>
                              {emp.poste.length > 25 ? emp.poste.slice(0, 25) + '…' : emp.poste}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-dashed">
                          <div className="text-xs">
                            <span className="text-muted-foreground">Salaire : </span>
                            <span className="font-semibold">
                              {isSecondaire && salaireCalc > 0
                                ? `${salaireCalc.toLocaleString()} GNF`
                                : `${Number(emp.salaire_base).toLocaleString()} GNF`
                              }
                            </span>
                          </div>
                          {isSecondaire && heuresMens > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              ⏱ {heuresMens}h/mois
                            </span>
                          )}
                        </div>

                        {emp.telephone && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            📞 {emp.telephone}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <PaginationControls currentPage={personnelPage} totalPages={personnelTotalPages} totalItems={personnelTotalItems} pageSize={personnelPageSize} onPageChange={setPersonnelPage} />
          )}
        </TabsContent>

        {/* Pointage */}
        <TabsContent value="pointage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Pointages du {format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}
              </CardTitle>
            </CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Heures</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointagesToday.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun pointage</TableCell></TableRow>
                  ) : pointagesToday.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.employes?.prenom} {p.employes?.nom}</TableCell>
                      <TableCell>{p.heure_arrivee ? format(new Date(p.heure_arrivee), 'HH:mm') : '—'}</TableCell>
                      <TableCell>{p.heure_depart ? format(new Date(p.heure_depart), 'HH:mm') : '—'}</TableCell>
                      <TableCell>{p.heures_travaillees ? `${p.heures_travaillees}h` : '—'}</TableCell>
                      <TableCell>{p.retard ? <Badge variant="destructive" className="text-xs">Retard</Badge> : <Badge className="text-xs bg-green-500">OK</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Congés */}
        <TabsContent value="conges" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Demandes de congé en attente</CardTitle></CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {congesEnAttente.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell></TableRow>
                  ) : congesEnAttente.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.employes?.prenom} {c.employes?.nom}</TableCell>
                      <TableCell className="capitalize">{c.type_conge}</TableCell>
                      <TableCell className="text-sm">{format(new Date(c.date_debut), 'dd/MM')} → {format(new Date(c.date_fin), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-sm max-w-32 truncate">{c.motif || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleConge(c.id, 'approuve')}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setRefuseTarget({ type: 'conge', id: c.id }); setRefuseMotif(''); }}><X className="h-3.5 w-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        

        {/* Avances sur salaire - Validation par le Personnel */}
        <TabsContent value="avances" className="mt-4 space-y-4">
          <AvancesValidationTab />
        </TabsContent>

        {/* Paie */}
        <TabsContent value="paie" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">Les bulletins de paie sont générés automatiquement par le Trésorier lors du paiement des salaires.</p>

          <Card>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Brut</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulletins.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun bulletin</TableCell></TableRow>
                  ) : bulletins.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.employes?.prenom} {b.employes?.nom}</TableCell>
                      <TableCell>{MOIS_NOMS[b.mois]} {b.annee}</TableCell>
                      <TableCell>{Number(b.salaire_brut).toLocaleString()} GNF</TableCell>
                      <TableCell className="font-bold">{Number(b.salaire_net).toLocaleString()} GNF</TableCell>
                      <TableCell className="text-sm">{format(new Date(b.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handlePrintBulletin(b)} title="Télécharger PDF">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>



        <TabsContent value="courriers" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> Courriers reçus des employés</CardTitle></CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Pièce jointe</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courriers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun courrier</TableCell></TableRow>
                  ) : courriers.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.employes?.prenom} {c.employes?.nom}</TableCell>
                      <TableCell>
                        <Badge variant={c.type === 'maladie' ? 'destructive' : 'secondary'} className="text-xs">
                          {c.type === 'maladie' ? '🏥 Maladie' : c.type === 'plainte' ? '⚠️ Plainte' : c.type === 'demande' ? '📩 Demande' : '📝 Autre'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm">{c.objet}</TableCell>
                      <TableCell>
                        {c.fichier_url ? (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => window.open(c.fichier_url, '_blank')}>
                            <Paperclip className="h-3.5 w-3.5 mr-1" /> {c.fichier_nom || 'Voir'}
                          </Button>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(c.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={c.statut === 'traite' ? 'default' : c.statut === 'lu' ? 'secondary' : 'outline'} className="text-xs">
                          {c.statut === 'traite' ? 'Traité' : c.statut === 'lu' ? 'Lu' : 'Non lu'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                            setViewCourrierAdmin(c);
                          }} title="Lire">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {c.statut === 'non_lu' && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={async () => {
                              await supabase.from('courriers_employes').update({ statut: 'lu' }).eq('id', c.id);
                              refetchCourriers();
                            }} title="Marquer comme lu">
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          {c.statut !== 'traite' && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={async () => {
                              const reponse = prompt('Réponse à envoyer (optionnel):');
                              await supabase.from('courriers_employes').update({
                                statut: 'traite',
                                reponse: reponse || null,
                                traite_par: user?.id,
                                traite_at: new Date().toISOString(),
                              }).eq('id', c.id);
                              toast({ title: '✅ Courrier traité' });
                              refetchCourriers();
                            }} title="Traiter">
                              <FileText className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Évaluations */}
        <TabsContent value="evaluations" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm"><BarChart3 className="h-4 w-4 mr-1" /> Nouvelle évaluation</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Évaluer un employé</DialogTitle></DialogHeader>
                <EvalForm employes={employes} user={user} onDone={() => qc.invalidateQueries({ queryKey: ['evaluations-employes'] })} />
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Moyenne</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluationsAdmin.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune évaluation</TableCell></TableRow>
                  ) : evaluationsAdmin.map((ev: any) => {
                    const avg = ((Number(ev.pedagogie) + Number(ev.ponctualite) + Number(ev.assiduite) + Number(ev.relations) + Number(ev.competences) + Number(ev.initiative)) / 6).toFixed(1);
                    return (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{ev.employes?.prenom} {ev.employes?.nom}</TableCell>
                        <TableCell>{ev.periode}</TableCell>
                        <TableCell>
                          <Badge variant={Number(avg) >= 7 ? 'default' : Number(avg) >= 5 ? 'secondary' : 'destructive'}>{avg}/10</Badge>
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm">{ev.commentaire || '—'}</TableCell>
                        <TableCell className="text-sm">{format(new Date(ev.created_at), 'dd/MM/yyyy')}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Student evaluations of teachers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Évaluations par les élèves
              </CardTitle>
            </CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enseignant</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Péd.</TableHead>
                    <TableHead>Ponct.</TableHead>
                    <TableHead>Comp.</TableHead>
                    <TableHead>Rel.</TableHead>
                    <TableHead>Moy.</TableHead>
                    <TableHead>Commentaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evalElevesAdmin.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune évaluation d'élève</TableCell></TableRow>
                  ) : evalElevesAdmin.map((ev: any) => {
                    const avg = ((Number(ev.pedagogie) + Number(ev.ponctualite) + Number(ev.competences) + Number(ev.relations)) / 4).toFixed(1);
                    return (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{ev.employes?.prenom} {ev.employes?.nom}</TableCell>
                        <TableCell className="text-sm">{ev.eleves?.prenom} {ev.eleves?.nom}</TableCell>
                        <TableCell className="text-sm">{ev.eleves?.classes?.nom || '—'}</TableCell>
                        <TableCell className="text-sm">{ev.periode}</TableCell>
                        <TableCell className="text-center">{ev.pedagogie}</TableCell>
                        <TableCell className="text-center">{ev.ponctualite}</TableCell>
                        <TableCell className="text-center">{ev.competences}</TableCell>
                        <TableCell className="text-center">{ev.relations}</TableCell>
                        <TableCell>
                          <Badge variant={Number(avg) >= 7 ? 'default' : Number(avg) >= 5 ? 'secondary' : 'destructive'}>{avg}/10</Badge>
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm">{ev.commentaire || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Affectations enseignants */}
        <TabsContent value="affectations" className="mt-4">
          <Tabs defaultValue="primaire" className="w-full">
            <TabsList className="mb-3">
              <TabsTrigger value="primaire">🏫 Primaire / Maternelle</TabsTrigger>
              <TabsTrigger value="secondaire">🎓 Secondaire</TabsTrigger>
            </TabsList>
            <TabsContent value="primaire">
              <AffectationsEnseignants primaryOnly />
            </TabsContent>
            <TabsContent value="secondaire">
              <AffectationsSecondaire />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Employee detail dialog */}
      <Dialog open={!!selectedEmp} onOpenChange={v => { if (!v) { setSelectedEmp(null); setEditForm(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedEmp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedEmp.prenom} {selectedEmp.nom}</span>
                  {!editForm ? (
                    <Button size="sm" variant="outline" onClick={() => setEditForm({
                      nom: selectedEmp.nom, prenom: selectedEmp.prenom, sexe: selectedEmp.sexe || 'M',
                      categorie: selectedEmp.categorie, poste: selectedEmp.poste || '', telephone: selectedEmp.telephone || '',
                      email: selectedEmp.email || '', adresse: selectedEmp.adresse || '', salaire_base: String(selectedEmp.salaire_base || 0),
                      prix_heure: String(selectedEmp.prix_heure || 0),
                      date_embauche: selectedEmp.date_embauche || '', statut: selectedEmp.statut,
                    })}>
                      ✏️ Modifier
                    </Button>
                  ) : null}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {/* Photo */}
                <div className="flex items-center gap-3">
                  {selectedEmp.photo_url ? (
                    <img src={selectedEmp.photo_url} alt="Photo" loading="lazy" decoding="async" className="w-16 h-16 rounded-full object-cover border" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                      {selectedEmp.prenom?.[0]}{selectedEmp.nom?.[0]}
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => startCamera('detail')}>
                    <Camera className="h-4 w-4 mr-1" /> {selectedEmp.photo_url ? 'Changer photo' : 'Prendre photo'}
                  </Button>
                </div>

                {editForm ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Nom *</Label><Input value={editForm.nom} onChange={e => setEditForm((f: any) => ({ ...f, nom: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>Prénom *</Label><Input value={editForm.prenom} onChange={e => setEditForm((f: any) => ({ ...f, prenom: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Catégorie</Label>
                        <Select value={editForm.categorie} onValueChange={v => setEditForm((f: any) => ({ ...f, categorie: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enseignant">Enseignant</SelectItem>
                            <SelectItem value="administration">Administration</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                            <SelectItem value="direction">Direction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Sexe</Label>
                        <Select value={editForm.sexe} onValueChange={v => setEditForm((f: any) => ({ ...f, sexe: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">Masculin</SelectItem>
                            <SelectItem value="F">Féminin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Poste</Label><Input value={editForm.poste} onChange={e => setEditForm((f: any) => ({ ...f, poste: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>Téléphone</Label><Input value={editForm.telephone} onChange={e => setEditForm((f: any) => ({ ...f, telephone: e.target.value }))} /></div>
                    </div>
                    {(editForm.categorie === 'enseignant' && selectedEmp?.matricule?.startsWith('ESC')) ? (
                      <>
                        <div className="space-y-1">
                          <Label>💰 Prix de l'heure (GNF)</Label>
                          <Input type="number" value={editForm.prix_heure} onChange={e => setEditForm((f: any) => ({ ...f, prix_heure: e.target.value }))} placeholder="Ex: 50000" />
                        </div>
                        {Number(editForm.prix_heure) > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                            <p className="text-xs font-medium">📊 Calcul automatique du salaire</p>
                            <p className="text-xs text-muted-foreground">
                              Heures hebdo: <strong>{(heuresParEnseignant[selectedEmp.id] || 0).toFixed(1)}h</strong> → 
                              Heures mensuelles: <strong>{getHeuresMensuelles(selectedEmp.id)}h</strong>
                            </p>
                            <p className="text-sm font-bold">
                              Salaire calculé: {getSalaireCalculeSecondaire(selectedEmp.id, Number(editForm.prix_heure)).toLocaleString()} GNF
                            </p>
                            {getHeuresMensuelles(selectedEmp.id) === 0 && (
                              <p className="text-xs text-destructive">⚠️ Aucun créneau dans l'emploi du temps. Attribuez des heures d'abord.</p>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                          <div className="space-y-1"><Label>Salaire base (GNF)</Label><Input type="number" value={editForm.salaire_base} onChange={e => setEditForm((f: any) => ({ ...f, salaire_base: e.target.value }))} /></div>
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                        <div className="space-y-1"><Label>Salaire (GNF)</Label><Input type="number" value={editForm.salaire_base} onChange={e => setEditForm((f: any) => ({ ...f, salaire_base: e.target.value }))} /></div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Date embauche</Label><Input type="date" value={editForm.date_embauche} onChange={e => setEditForm((f: any) => ({ ...f, date_embauche: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>Statut</Label>
                        <Select value={editForm.statut} onValueChange={v => setEditForm((f: any) => ({ ...f, statut: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="actif">Actif</SelectItem>
                            <SelectItem value="inactif">Inactif</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1"><Label>Adresse</Label><Input value={editForm.adresse} onChange={e => setEditForm((f: any) => ({ ...f, adresse: e.target.value }))} /></div>
                    <div className="flex gap-2">
                      <Button className="flex-1" disabled={editSaving} onClick={async () => {
                        if (!editForm.nom || !editForm.prenom) { toast({ title: 'Nom et prénom obligatoires', variant: 'destructive' }); return; }
                        setEditSaving(true);
                        const { error } = await supabase.from('employes').update({
                          nom: editForm.nom, prenom: editForm.prenom, sexe: editForm.sexe,
                          categorie: editForm.categorie as any, poste: editForm.poste,
                          telephone: editForm.telephone || null, email: editForm.email || null,
                          adresse: editForm.adresse || null, salaire_base: Number(editForm.salaire_base) || 0,
                          prix_heure: Number(editForm.prix_heure) || 0,
                          date_embauche: editForm.date_embauche || undefined, statut: editForm.statut,
                        }).eq('id', selectedEmp.id);
                        setEditSaving(false);
                        if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
                        toast({ title: '✅ Employé mis à jour' });
                        const updated = { ...selectedEmp, ...editForm, salaire_base: Number(editForm.salaire_base) || 0 };
                        setSelectedEmp(updated);
                        setEditForm(null);
                        qc.invalidateQueries({ queryKey: ['employes'] });
                      }}>
                        {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        Valider les modifications
                      </Button>
                      <Button variant="outline" onClick={() => setEditForm(null)}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Matricule:</span> <span className="font-mono">{selectedEmp.matricule}</span></div>
                    <div><span className="text-muted-foreground">Catégorie:</span> {categorieLabel[getEffectiveCat(selectedEmp)]}</div>
                    <div><span className="text-muted-foreground">Poste:</span> {selectedEmp.poste || '—'}</div>
                    <div><span className="text-muted-foreground">Sexe:</span> {selectedEmp.sexe || '—'}</div>
                    <div><span className="text-muted-foreground">Téléphone:</span> {selectedEmp.telephone || '—'}</div>
                    <div><span className="text-muted-foreground">Email:</span> {selectedEmp.email || '—'}</div>
                    <div><span className="text-muted-foreground">Adresse:</span> {selectedEmp.adresse || '—'}</div>
                    <div><span className="text-muted-foreground">Embauche:</span> {selectedEmp.date_embauche ? format(new Date(selectedEmp.date_embauche), 'dd/MM/yyyy') : '—'}</div>
                    <div><span className="text-muted-foreground">Salaire:</span> <span className="font-bold">{Number(selectedEmp.salaire_base).toLocaleString()} GNF</span></div>
                    <div><span className="text-muted-foreground">Statut:</span> <Badge variant={selectedEmp.statut === 'actif' ? 'default' : 'destructive'}>{selectedEmp.statut}</Badge></div>
            </div>
          )}
                {/* Generate / Modify password - superviseur only */}
                {hasRole('superviseur') && (
                <div className="border-t pt-3 space-y-2">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setPasswordGenOpen(true)}>
                    <Key className="h-4 w-4 mr-1" /> Générer un mot de passe portail
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { setEditPasswordOpen(true); setCustomPassword(''); }}>
                    <Key className="h-4 w-4 mr-1" /> Modifier le mot de passe
                  </Button>
                </div>
                )}

                {/* Badge PVC */}
                <div className="border-t pt-3">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => {
                    const canvas = qrRef.current?.querySelector('canvas');
                    if (!canvas) return;
                    const qrDataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
                    generateBadgeEmployePDF(selectedEmp, qrDataUrl, schoolConfig?.nom, schoolConfig?.logo_url, { telephone: '625 00 00 00', adresse: schoolConfig?.ville || 'Conakry, Guinée' });
                  }}>
                    <Printer className="h-4 w-4 mr-1" /> Imprimer Badge PVC
                  </Button>
                  <div ref={qrRef} className="hidden">
                    <QRCodeCanvas value={selectedEmp.matricule} size={200} />
                  </div>
                </div>

                {/* Documents */}
                <div className="border-t pt-3">
                  <h4 className="font-semibold mb-2 flex items-center gap-1"><Upload className="h-4 w-4" /> Documents</h4>
                  <EmployeeDocuments employeId={selectedEmp.id} />
                </div>

                {/* Delete employee */}
                <div className="border-t pt-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="w-full">
                        <Trash2 className="h-4 w-4 mr-1" /> Supprimer cet employé
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir supprimer <strong>{selectedEmp.prenom} {selectedEmp.nom}</strong> ({selectedEmp.matricule}) ? Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteEmployee(selectedEmp)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Scanner */}
      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScanPointage}
        title="Scanner badge employé"
      />

      {/* Camera Dialog */}
      <Dialog open={cameraOpen} onOpenChange={v => { if (!v) stopCamera(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Prendre une photo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <video ref={cameraRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-[4/3]" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={capturePhoto}><Camera className="h-4 w-4 mr-1" /> Capturer</Button>
              <Button variant="outline" onClick={stopCamera}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera capture result for detail target */}
      <Dialog open={!!capturedPhoto && cameraTarget === 'detail'} onOpenChange={v => { if (!v) setCapturedPhoto(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Confirmer la photo</DialogTitle></DialogHeader>
          {capturedPhoto && (
            <div className="space-y-3">
              <img src={capturedPhoto} alt="Captured" className="w-32 h-32 rounded-full object-cover mx-auto border" />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={async () => {
                  if (!selectedEmp || !capturedPhoto) return;
                  const photoUrl = await uploadPhoto(selectedEmp.id, capturedPhoto);
                  if (photoUrl) {
                    await supabase.from('employes').update({ photo_url: photoUrl }).eq('id', selectedEmp.id);
                    setSelectedEmp({ ...selectedEmp, photo_url: photoUrl });
                    qc.invalidateQueries({ queryKey: ['employes'] });
                    toast({ title: '✅ Photo mise à jour' });
                  }
                  setCapturedPhoto(null);
                }}>Enregistrer</Button>
                <Button variant="outline" onClick={() => { setCapturedPhoto(null); startCamera('detail'); }}>Reprendre</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password generation confirmation */}
      <Dialog open={passwordGenOpen} onOpenChange={setPasswordGenOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Générer un mot de passe</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Un nouveau mot de passe sera généré pour <strong>{selectedEmp?.prenom} {selectedEmp?.nom}</strong> pour accéder au portail employé.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleGeneratePassword}><Key className="h-4 w-4 mr-1" /> Confirmer</Button>
            <Button variant="outline" onClick={() => setPasswordGenOpen(false)}>Annuler</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generated password display */}
      <Dialog open={!!generatedPassword} onOpenChange={v => { if (!v) setGeneratedPassword(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>🔐 Mot de passe généré</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Mot de passe pour <strong>{selectedEmp?.prenom} {selectedEmp?.nom}</strong> :</p>
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-mono font-bold tracking-widest select-all">{generatedPassword}</p>
            </div>
            <p className="text-xs text-destructive">⚠️ Notez ce mot de passe, il ne sera plus affiché après fermeture.</p>
            <Button className="w-full" variant="outline" onClick={() => {
              navigator.clipboard.writeText(generatedPassword || '');
              toast({ title: '📋 Copié dans le presse-papier' });
            }}>
              Copier le mot de passe
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit password dialog */}
      <Dialog open={editPasswordOpen} onOpenChange={setEditPasswordOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Modifier le mot de passe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Définir un nouveau mot de passe pour <strong>{selectedEmp?.prenom} {selectedEmp?.nom}</strong></p>
            <Input value={customPassword} onChange={e => setCustomPassword(e.target.value)} placeholder="Nouveau mot de passe" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSetCustomPassword}><Key className="h-4 w-4 mr-1" /> Enregistrer</Button>
              <Button variant="outline" onClick={() => setEditPasswordOpen(false)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refuse with motif dialog */}
      <Dialog open={!!refuseTarget} onOpenChange={v => { if (!v) setRefuseTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Motif du refus</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Veuillez indiquer le motif du refus :</p>
            <Textarea value={refuseMotif} onChange={e => setRefuseMotif(e.target.value)} placeholder="Motif du refus..." />
            <div className="flex gap-2">
              <Button className="flex-1" variant="destructive" onClick={confirmRefuse}><X className="h-4 w-4 mr-1" /> Refuser</Button>
              <Button variant="outline" onClick={() => setRefuseTarget(null)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Courrier detail dialog */}
      <Dialog open={!!viewCourrierAdmin} onOpenChange={v => { if (!v) setViewCourrierAdmin(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {viewCourrierAdmin && (
            <>
              <DialogHeader>
                <DialogTitle>{viewCourrierAdmin.objet}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={viewCourrierAdmin.type === 'maladie' ? 'destructive' : 'secondary'}>
                    {viewCourrierAdmin.type === 'maladie' ? '🏥 Maladie' : viewCourrierAdmin.type === 'plainte' ? '⚠️ Plainte' : '📩 ' + viewCourrierAdmin.type}
                  </Badge>
                  <span className="text-sm text-muted-foreground">de {viewCourrierAdmin.employes?.prenom} {viewCourrierAdmin.employes?.nom}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">{viewCourrierAdmin.contenu}</div>
                {viewCourrierAdmin.fichier_url && (
                  <Button size="sm" variant="outline" onClick={() => window.open(viewCourrierAdmin.fichier_url, '_blank')}>
                    <Paperclip className="h-3.5 w-3.5 mr-1" /> {viewCourrierAdmin.fichier_nom || 'Voir la pièce jointe'}
                  </Button>
                )}
                {viewCourrierAdmin.reponse && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Réponse</p>
                    <p className="text-sm">{viewCourrierAdmin.reponse}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{format(new Date(viewCourrierAdmin.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📋 Import du personnel ({importPreview.length} employés)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-sm font-medium">Catégorie pour tous</Label>
                <Select value={importCategorie} onValueChange={setImportCategorie}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enseignant">Enseignant</SelectItem>
                    <SelectItem value="administration">Administration</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="direction">Direction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={() => setImportPreview(p => [...p, { id: Date.now(), nom: '', prenom: '', telephone: '', poste: '' }])}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter une ligne
              </Button>
            </div>

            <details open>
              <summary className="cursor-pointer select-none font-medium text-sm py-2 px-1 rounded hover:bg-muted flex items-center gap-1">
                <span>📝 Liste des employés à importer ({importPreview.length})</span>
              </summary>
              <div className="mt-2 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Nom *</TableHead>
                      <TableHead>Prénom *</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Poste</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((row, idx) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={row.nom} onChange={e => setImportPreview(p => p.map((r, i) => i === idx ? { ...r, nom: e.target.value } : r))} placeholder="Nom" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={row.prenom} onChange={e => setImportPreview(p => p.map((r, i) => i === idx ? { ...r, prenom: e.target.value } : r))} placeholder="Prénom" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={row.telephone || ''} onChange={e => setImportPreview(p => p.map((r, i) => i === idx ? { ...r, telephone: e.target.value } : r))} placeholder="Téléphone" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={row.poste || ''} onChange={e => setImportPreview(p => p.map((r, i) => i === idx ? { ...r, poste: e.target.value } : r))} placeholder="Poste" />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setImportPreview(p => p.filter((_, i) => i !== idx))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importLoading}>
                Annuler
              </Button>
              <Button onClick={confirmImport} disabled={importLoading || importPreview.filter(r => r.nom && r.prenom).length === 0}>
                {importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                ✅ Valider l'import ({importPreview.filter(r => r.nom && r.prenom).length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import Cropper from 'react-easy-crop';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardList, Search, User, Users, UserCheck, Edit, QrCode, Printer, Download, ShieldCheck, Eye, EyeOff, RefreshCw, KeyRound, UserX, XCircle, Camera, Upload, Bus, FileDown, Trash2, ChevronRight, GraduationCap, ImageDown } from 'lucide-react';
import PlancheBadgesScolaires from '@/components/PlancheBadgesScolaires';
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

  // Never display the hash - just show if password is set or not
  const hasPassword = !!eleve.mot_de_passe_eleve;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <strong className="text-sm">Accès Espace Élève</strong>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Mot de passe :</span>
        <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
          {hasPassword ? '✓ Configuré' : 'Non défini'}
        </code>
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
            <Edit className="h-3 w-3 mr-1" /> {hasPassword ? 'Réinitialiser' : 'Définir'}
          </Button>
          {!hasPassword && (
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
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/excelUtils';
import { sortClasses } from '@/lib/utils';
import { generateBadgeRetrait } from '@/lib/generateBadgeRetrait';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];
type TrancheConfig = { label: string; mois: string[]; montant: number };

export default function Eleves() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterCycle, setFilterCycle] = useState('all');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'famille' | 'individuel'>('individuel');
  const [showComplete, setShowComplete] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [badgeEleve, setBadgeEleve] = useState<any>(null);
  const [abandonDialog, setAbandonDialog] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPlanche, setShowPlanche] = useState(false);
  const [creatingFamille, setCreatingFamille] = useState(false);
  const [newFamilleName, setNewFamilleName] = useState('');
  const [newFamilleTelPere, setNewFamilleTelPere] = useState('');
  const [newFamilleTelMere, setNewFamilleTelMere] = useState('');
  const [savingFamille, setSavingFamille] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const [generatingMatricules, setGeneratingMatricules] = useState(false);
  const [compressingPhotos, setCompressingPhotos] = useState(false);
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [zoomEleveId, setZoomEleveId] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [savingCrop, setSavingCrop] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: schoolConfig } = useSchoolConfig();

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['eleves-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, matricule, nom, prenom, sexe, date_naissance, photo_url, photo_thumbnail_url, classe_id, famille_id, statut, transport_zone, zone_transport_id, option_fournitures, option_cantine, option_robotique, robotique_paye, uniforme_scolaire, uniforme_sport, uniforme_polo_lacoste, uniforme_karate, uniforme_scout, qr_code, solde_cantine, checklist_livret, checklist_rames, checklist_marqueurs, checklist_photo, nom_prenom_pere, nom_prenom_mere, session_id, created_at, updated_at, deleted_at, classes(nom, niveau_id, niveaux:niveau_id(nom, frais_scolarite, cycle_id, cycles:cycle_id(nom, id))), familles(id, nom_famille, telephone_pere, telephone_mere, email_parent, adresse)')
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
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, ordre, cycle_id, cycles:cycle_id(nom, ordre))');
      if (error) throw error;
      return sortClasses(data || []);
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

  const { data: zonesTransport = [] } = useQuery({
    queryKey: ['zones-transport-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones_transport').select('id, nom, prix_mensuel').order('nom');
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

  const searchTerms = searchLower.split(/\s+/).filter(t => t.length > 0);

  const filtered = eleves.filter((e: any) => {
    // Search: only by nom, prénom and matricule
    const fullText = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase();
    const basicMatch = searchTerms.length > 0 && searchTerms.some(term => fullText.includes(term));
    const matchSearch = isSearchActive ? basicMatch : true;

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
  const elevesWithoutMatricule = eleves.filter((e: any) => !e.matricule && e.statut === 'inscrit');

  const generateMissingMatricules = async () => {
    if (elevesWithoutMatricule.length === 0) return;
    setGeneratingMatricules(true);
    try {
      const now = new Date();
      const prefix = `EDU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { count: existingCount } = await supabase.from('eleves').select('*', { count: 'exact', head: true }).like('matricule', `${prefix}%`);
      let seqCounter = existingCount || 0;
      let updated = 0;
      for (const eleve of elevesWithoutMatricule) {
        seqCounter++;
        const matricule = `${prefix}-${String(seqCounter).padStart(4, '0')}`;
        const { error } = await supabase.from('eleves').update({ matricule } as any).eq('id', eleve.id);
        if (!error) updated++;
      }
      toast({ title: 'Matricules générés', description: `${updated} matricule(s) ajouté(s)` });
      qc.invalidateQueries({ queryKey: ['eleves-full'] });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingMatricules(false);
    }
  };

  const compressAllPhotos = async () => {
    setCompressingPhotos(true);
    try {
      const elevesWithPhotos = (eleves || []).filter(e => e.photo_url);
      let compressed = 0, skipped = 0, failed = 0, totalSaved = 0;

      for (const eleve of elevesWithPhotos) {
        try {
          const res = await fetch(eleve.photo_url!);
          if (!res.ok) { failed++; continue; }
          const originalBlob = await res.blob();
          if (originalBlob.size < 50_000) { skipped++; continue; }

          // Main photo: 300px, 60%
          const compressedBlob = await compressImage(originalBlob, 300, 0.6);
          if (compressedBlob.size >= originalBlob.size) { skipped++; continue; }

          const ts = Date.now();
          const mainPath = `eleves/${eleve.id}/photo_opt_${ts}.jpg`;
          const { error: upErr } = await supabase.storage.from('photos').upload(mainPath, compressedBlob, { contentType: 'image/jpeg', upsert: true });
          if (upErr) { failed++; continue; }

          // Thumbnail: 100px, 50%
          const thumbBlob = await compressImage(originalBlob, 100, 0.5);
          const thumbPath = `eleves/${eleve.id}/thumb_${ts}.jpg`;
          await supabase.storage.from('photos').upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true });

          const { data: mainSigned } = await supabase.storage.from('photos').createSignedUrl(mainPath, 31536000);
          const { data: thumbSigned } = await supabase.storage.from('photos').createSignedUrl(thumbPath, 31536000);
          
          if (mainSigned?.signedUrl) {
            await supabase.from('eleves').update({ 
              photo_url: mainSigned.signedUrl,
              photo_thumbnail_url: thumbSigned?.signedUrl || null,
            } as any).eq('id', eleve.id);
            totalSaved += originalBlob.size - compressedBlob.size;
            compressed++;
          } else { failed++; }
        } catch { failed++; }
      }

      toast({
        title: '✅ Compression terminée',
        description: `${compressed} photo(s) compressée(s) + miniatures, ${skipped} déjà optimisée(s), ${failed} échouée(s). ${Math.round(totalSaved / 1024)} KB économisés.`,
      });
      qc.invalidateQueries({ queryKey: ['eleves-full'] });
    } catch (err: any) {
      toast({ title: 'Erreur compression', description: err.message, variant: 'destructive' });
    } finally {
      setCompressingPhotos(false);
    }
  };

  const startCamera = async () => {
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
    setPhotoFile(null);
    setPhotoPreview(dataUrl);
    stopCamera();
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setCapturedPhoto(null);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const compressImage = (blob: Blob, maxWidth = 300, quality = 0.6): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', quality);
      };
      img.onerror = () => resolve(blob);
      img.src = URL.createObjectURL(blob);
    });
  };

  const createThumbnail = (blob: Blob): Promise<Blob> => compressImage(blob, 100, 0.5);

  const uploadElevePhoto = async (eleveId: string): Promise<{ photoUrl: string; thumbUrl: string } | null> => {
    let blob: Blob;
    if (capturedPhoto) {
      blob = await (await fetch(capturedPhoto)).blob();
    } else if (photoFile) {
      blob = photoFile;
    } else {
      return null;
    }
    const ts = Date.now();
    // Compress main photo (300px, 60%)
    const mainBlob = await compressImage(blob, 300, 0.6);
    const mainPath = `eleves/${eleveId}/photo_${ts}.jpg`;
    const { error } = await supabase.storage.from('photos').upload(mainPath, mainBlob, { contentType: 'image/jpeg', upsert: true });
    if (error) { toast({ title: 'Erreur upload photo', description: error.message, variant: 'destructive' }); return null; }

    // Create & upload thumbnail (100px, 50%)
    const thumbBlob = await createThumbnail(blob);
    const thumbPath = `eleves/${eleveId}/thumb_${ts}.jpg`;
    await supabase.storage.from('photos').upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true });

    const { data: mainSigned } = await supabase.storage.from('photos').createSignedUrl(mainPath, 31536000);
    const { data: thumbSigned } = await supabase.storage.from('photos').createSignedUrl(thumbPath, 31536000);
    
    return {
      photoUrl: mainSigned?.signedUrl || '',
      thumbUrl: thumbSigned?.signedUrl || '',
    };
  };

  const resetPhotoState = () => {
    setCapturedPhoto(null);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;

    // Upload photo if new one selected
    let photoUrl = editing.photo_url;
    let thumbUrl = (editing as any).photo_thumbnail_url;
    if (photoPreview) {
      setUploadingPhoto(true);
      const result = await uploadElevePhoto(editing.id);
      if (result) { photoUrl = result.photoUrl; thumbUrl = result.thumbUrl; }
      setUploadingPhoto(false);
    }

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
      photo_url: photoUrl,
      photo_thumbnail_url: thumbUrl,
    } as any);
    resetPhotoState();
  };

  const handleSavePhotoOnly = async (eleve: any) => {
    if (!photoPreview) return;
    setUploadingPhoto(true);
    const result = await uploadElevePhoto(eleve.id);
    if (result) {
      const { error } = await supabase.from('eleves').update({ photo_url: result.photoUrl, photo_thumbnail_url: result.thumbUrl } as any).eq('id', eleve.id);
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Photo mise à jour' });
        qc.invalidateQueries({ queryKey: ['eleves-full'] });
        setSelected({ ...eleve, photo_url: result.photoUrl, photo_thumbnail_url: result.thumbUrl });
      }
    }
    setUploadingPhoto(false);
    resetPhotoState();
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

  const printBadge = async () => {
    if (!badgeEleve) return;
    const qrValue = buildQrData(badgeEleve);
    const qrDataUrl = await QRCode.toDataURL(qrValue, { width: 300, margin: 1, color: { dark: '#1a1a2e', light: '#ffffff' } });
    const siteQrUrl = await QRCode.toDataURL('https://enfantsdufutur-com.lovable.app/eleve', { width: 200, margin: 1, color: { dark: '#1e8449', light: '#ffffff' } });
    const w = window.open('', '_blank', 'width=650,height=750');
    if (!w) return;
    const sName = schoolConfig?.nom || 'Groupe Scolaire';
    const anneeScolaire = '2025-2026';
    const cycleName = badgeEleve.classes?.niveaux?.cycles?.nom || '';
    const className = badgeEleve.classes?.nom || '';
    const logoUrl = schoolConfig?.logo_url || '';
    const dateNaissance = badgeEleve.date_naissance ? new Date(badgeEleve.date_naissance).toLocaleDateString('fr-FR') : '—';

    w.document.write(`<!DOCTYPE html><html lang="fr"><head>
      <meta charset="UTF-8" />
      <title>Badge ${badgeEleve.prenom} ${badgeEleve.nom}</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Poppins', sans-serif; background: #f0f2f5; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 24px; }

        .id-card {
          width: 520px; height: 310px; border-radius: 14px; position: relative;
          overflow: hidden; background: #ffffff;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12);
        }

        /* VERSO */
        .id-card-verso {
          width: 520px; height: 310px; border-radius: 14px; position: relative;
          overflow: hidden; background: #f8faf8;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          margin-top: 20px;
        }
        .verso-header {
          background: linear-gradient(90deg, #c0392b, #1e8449);
          color: white; padding: 8px 0; text-align: center; width: 100%;
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
        }
        .verso-body {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 16px;
        }
        .verso-qr-frame {
          background: white; padding: 8px; border-radius: 10px;
          border: 2px solid #1e8449; box-shadow: 0 4px 14px rgba(30,132,73,0.15);
        }
        .verso-qr-hint { font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
        .verso-mention {
          font-size: 9px; text-align: center; color: #888; font-style: italic;
          max-width: 380px; line-height: 1.5;
        }
        .verso-footer {
          background: linear-gradient(90deg, #c0392b, #a93226, #1e8449, #196f3d);
          color: rgba(255,255,255,0.8); padding: 6px 0; text-align: center; width: 100%;
          font-size: 7.5px; font-weight: 600; letter-spacing: 0.8px;
        }
        .card-label { font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }

        /* Top banner — rouge + vert */
        .top-banner {
          height: 80px; position: relative; display: flex; align-items: center; padding: 0 18px;
          background: linear-gradient(135deg, #c0392b 0%, #a93226 35%, #1e8449 65%, #196f3d 100%);
        }
        .top-banner::after {
          content: ''; position: absolute; bottom: -12px; left: 0; right: 0; height: 24px;
          background: linear-gradient(135deg, #c0392b 0%, #a93226 35%, #1e8449 65%, #196f3d 100%);
          clip-path: ellipse(55% 100% at 50% 0%);
        }
        .banner-pattern {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.06;
          background-image: repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.4) 8px, rgba(255,255,255,0.4) 16px);
        }

        /* Logo avec fond blanc */
        .school-logo-badge {
          width: 50px; height: 50px; border-radius: 50%; background: #ffffff;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; overflow: hidden; border: 2.5px solid rgba(255,255,255,0.9);
          box-shadow: 0 3px 10px rgba(0,0,0,0.25); z-index: 2;
        }
        .school-logo-badge img { width: 82%; height: 82%; object-fit: contain; }
        .school-info { flex: 1; margin-left: 12px; z-index: 1; }
        .school-name-text { color: white; font-size: 11.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; text-shadow: 0 1px 3px rgba(0,0,0,0.25); line-height: 1.3; }
        .school-year-text { color: rgba(255,255,255,0.85); font-size: 9.5px; font-weight: 500; margin-top: 2px; }
        .card-type-label {
          z-index: 1; background: rgba(255,255,255,0.25); backdrop-filter: blur(8px);
          color: white; padding: 4px 12px; border-radius: 12px; font-size: 8px;
          font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.4); white-space: nowrap;
        }

        /* Body — photo + infos uniquement */
        .card-body {
          display: flex; padding: 14px 16px 0; position: relative; z-index: 2; margin-top: -4px;
          align-items: stretch;
        }

        /* Photo — contour fin */
        .photo-wrapper {
          width: 90px; height: 110px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
          border: 1.5px solid #1e8449; box-shadow: 0 3px 8px rgba(30,132,73,0.15);
          background: #f5f5f5;
        }
        .photo-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        .photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 36px; color: #c5cee0; background: linear-gradient(135deg, #f5f5f5, #e8e8e8); }

        /* Info */
        .info-col { flex: 1; padding-left: 14px; display: flex; flex-direction: column; }
        .site-qr-zone {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          flex-shrink: 0; margin-left: 10px; padding: 4px;
          background: rgba(30,132,73,0.04); border-radius: 8px;
        }
        .site-qr-img {
          width: 88px; height: 88px; border-radius: 6px; border: 2px solid #1e8449;
          padding: 3px; background: white; box-shadow: 0 3px 10px rgba(30,132,73,0.15);
        }
        .site-qr-label {
          font-size: 7px; font-weight: 800; color: #1e8449; text-transform: uppercase;
          letter-spacing: 0.6px; margin-top: 3px; text-align: center;
        }
        .student-name { font-size: 16px; font-weight: 800; color: #1a1a2e; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.3px; }
        .info-rows { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
        .info-row { display: flex; align-items: baseline; gap: 6px; }
        .info-row .lbl { font-size: 8px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; min-width: 58px; flex-shrink: 0; }
        .info-row .val { font-size: 12px; font-weight: 600; color: #2d3436; }
        .matricule-box {
          margin-top: 10px; background: linear-gradient(135deg, #c0392b, #1e8449);
          color: white; padding: 5px 14px; border-radius: 6px; display: inline-flex;
          align-items: center; gap: 6px; width: fit-content;
        }
        .matricule-box .m-label { font-size: 7px; font-weight: 600; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.8px; }
        .matricule-box .m-value { font-size: 14px; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 1.2px; }

        /* Motto + Contact */
        .motto-contact {
          padding: 3px 20px 2px; position: relative; z-index: 2; text-align: center;
        }
        .motto-line {
          font-size: 13px; font-weight: 800; color: #1e8449; font-style: italic;
          letter-spacing: 0.5px;
        }
        .contact-line {
          font-size: 8px; font-weight: 600; color: #555; letter-spacing: 0.2px; margin-top: 1px;
          display: flex; align-items: center; justify-content: center; gap: 4px;
        }
        .contact-line svg { width: 9px; height: 9px; flex-shrink: 0; }
        .contact-line .sep { margin: 0 3px; color: #ccc; }

        /* Footer */
        .card-footer-bar {
          position: absolute; bottom: 0; left: 0; right: 0; height: 24px;
          background: linear-gradient(90deg, #c0392b, #a93226, #1e8449, #196f3d);
          display: flex; align-items: center; justify-content: center;
        }
        .footer-bar-text { font-size: 7.5px; color: rgba(255,255,255,0.85); font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; }

        /* Decorative */
        .deco-circle { position: absolute; border-radius: 50%; opacity: 0.04; }

        .actions { display: flex; gap: 12px; }
        .btn { padding: 12px 28px; border-radius: 10px; border: none; cursor: pointer; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; font-family: 'Poppins', sans-serif; transition: transform 0.15s; }
        .btn:hover { transform: translateY(-1px); }
        .btn-primary { background: linear-gradient(135deg, #c0392b, #1e8449); color: white; box-shadow: 0 4px 15px rgba(30,132,73,0.3); }
        .btn-secondary { background: white; color: #2d3436; border: 1.5px solid #dfe6e9; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

        @media print {
          body { background: white; padding: 0; }
          .actions, .hint, .card-label { display: none !important; }
          .id-card, .id-card-verso { box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: 86mm 108mm; margin: 0; }
        }
      </style>
    </head><body>
      <div id="badge-card">
      <!-- RECTO -->
      <div class="card-label">▸ Recto</div>
      <div class="id-card">
        <div class="deco-circle" style="width:160px;height:160px;right:-40px;bottom:40px;background:#1e8449;"></div>
        <div class="deco-circle" style="width:100px;height:100px;left:-25px;bottom:-20px;background:#c0392b;"></div>

        <div class="top-banner">
          <div class="banner-pattern"></div>
          <div class="school-logo-badge">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : '<span style="font-size:24px;">🎓</span>'}
          </div>
          <div class="school-info">
            <div class="school-name-text">${sName}</div>
            <div class="school-year-text">Année scolaire ${anneeScolaire}</div>
          </div>
          <div class="card-type-label">Carte Scolaire</div>
        </div>

        <div class="card-body">
          <div class="photo-wrapper">
            ${badgeEleve.photo_url
              ? `<img src="${badgeEleve.photo_url}" alt="${badgeEleve.prenom}" />`
              : '<div class="photo-placeholder">👤</div>'}
          </div>
          <div class="info-col">
            <div class="student-name">${badgeEleve.nom.toUpperCase()} ${badgeEleve.prenom}</div>
            <div class="info-rows">
              <div class="info-row"><span class="lbl">Cycle</span><span class="val">${cycleName}</span></div>
              <div class="info-row"><span class="lbl">Classe</span><span class="val">${className}</span></div>
              <div class="info-row"><span class="lbl">Né(e) le</span><span class="val">${dateNaissance}</span></div>
            </div>
            <div class="matricule-box">
              <span class="m-label">N°</span>
              <span class="m-value">${badgeEleve.matricule || '—'}</span>
            </div>
          </div>
          <div class="site-qr-zone">
            <img src="${siteQrUrl}" class="site-qr-img" alt="QR Site" />
            <span class="site-qr-label">Espace Élève</span>
          </div>
        </div>

        <div class="motto-contact">
          <div class="motto-line">Faisons plus !</div>
          <div class="contact-line">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1e8449" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            (+224) 628 84 84 37 / 625 54 95 79
          </div>
          <div class="contact-line">
            <svg viewBox="0 0 24 24" fill="none" stroke="#1e8449" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            eiefinfos@enfantsdufutur.com
          </div>
        </div>

        <div class="card-footer-bar">
          <span class="footer-bar-text">Carte obligatoire — Accès aux services scolaires — www.enfantsdufutur.com</span>
        </div>
      </div>

      <!-- VERSO -->
      <div class="card-label" style="margin-top:16px;">▸ Verso</div>
      <div class="id-card-verso">
        <div class="verso-header">🎓 Carte Scolaire — Verso</div>
        <div class="verso-body">
          <div class="verso-qr-frame"><img src="${qrDataUrl}" style="width:140px;height:140px;" alt="QR Code" /></div>
          <span class="verso-qr-hint">Scanner pour identification</span>
          <div class="verso-mention">
            Cette carte est personnelle et obligatoire. Elle doit être présentée pour l'accès aux services scolaires. En cas de perte, veuillez contacter l'administration.
          </div>
        </div>
        <div class="verso-footer">
          ${sName} — Année scolaire ${anneeScolaire}
        </div>
      </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" onclick="downloadPNG()">📥 Télécharger PNG</button>
        <button class="btn btn-secondary" onclick="window.print()">🖨️ Imprimer / PDF</button>
      </div>
      <p class="hint" style="font-size:11px;color:#9ca3af;margin-top:-8px;">Astuce : choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</p>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
      <script>
        function downloadPNG() {
          html2canvas(document.getElementById('badge-card'), { scale: 4, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
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
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold">{eleves.length}</p><p className="text-xs text-muted-foreground">Total élèves</p></div>
        </CardContent></Card>
        <Card className="border-primary/30"><CardContent className="pt-4 flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-primary" />
          <div>
            <p className="text-2xl font-bold">{eleves.filter((e: any) => { const cn = (e.classes?.niveaux?.cycles?.nom || '').toLowerCase(); return cn.includes('collège') || cn.includes('college') || cn.includes('lycée') || cn.includes('lycee'); }).length}</p>
            <p className="text-xs text-muted-foreground">Secondaire (Collège & Lycée)</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-accent-foreground" />
          <div>
            <p className="text-2xl font-bold">{eleves.filter((e: any) => { const cn = (e.classes?.niveaux?.cycles?.nom || '').toLowerCase(); return !(cn.includes('collège') || cn.includes('college') || cn.includes('lycée') || cn.includes('lycee')); }).length}</p>
            <p className="text-xs text-muted-foreground">Préscolaire & Primaire</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-500" />
          <div><p className="text-2xl font-bold">{totalFamille}</p><p className="text-xs text-muted-foreground">En famille</p></div>
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
          <Input placeholder="Rechercher par nom, prénom ou matricule..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
        {elevesWithoutMatricule.length > 0 && (
          <Button variant="outline" size="sm" onClick={generateMissingMatricules} disabled={generatingMatricules} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${generatingMatricules ? 'animate-spin' : ''}`} />
            Générer matricules ({elevesWithoutMatricule.length})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={compressAllPhotos} disabled={compressingPhotos} className="gap-1.5">
          <ImageDown className={`h-4 w-4 ${compressingPhotos ? 'animate-spin' : ''}`} />
          {compressingPhotos ? 'Compression...' : 'Optimiser photos'}
        </Button>
        {selectedIds.size > 0 && (
          <Button size="sm" onClick={() => setShowPlanche(true)} className="gap-2">
            <FileDown className="h-4 w-4" /> Planches badges ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((e: any) => selectedIds.has(e.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set([...selectedIds, ...filtered.map((e: any) => e.id)]));
                      } else {
                        const newSet = new Set(selectedIds);
                        filtered.forEach((e: any) => newSet.delete(e.id));
                        setSelectedIds(newSet);
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="w-10">Photo</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Prénom</TableHead>
                <TableHead>Sexe</TableHead><TableHead>Cycle</TableHead><TableHead>Classe</TableHead>
                <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setSelected(e)}>
                  <TableCell onClick={ev => ev.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(e.id)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedIds);
                        if (checked) newSet.add(e.id); else newSet.delete(e.id);
                        setSelectedIds(newSet);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                  {(e as any).photo_thumbnail_url || e.photo_url ? (
                      <img 
                        src={(e as any).photo_thumbnail_url || e.photo_url} 
                        alt={`${e.prenom} ${e.nom}`} 
                        loading="lazy" decoding="async" 
                        className="w-8 h-8 rounded-full object-cover border border-border cursor-pointer hover:ring-2 hover:ring-primary transition-all" 
                        onClick={(ev) => { ev.stopPropagation(); setZoomPhotoUrl(e.photo_url); setZoomEleveId(e.id); setCropMode(false); setCrop({x:0,y:0}); setZoom(1); }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
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
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteDialog(e)} title="Supprimer l'élève">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); resetPhotoState(); }}>
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
                {/* Photo section */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {(photoPreview || selected.photo_url) ? (
                      <img src={photoPreview || selected.photo_url} alt={selected.prenom} loading="lazy" decoding="async" className="w-20 h-20 rounded-lg object-cover border-2 border-primary" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-3xl border-2 border-dashed border-muted-foreground/30">👤</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => photoInputRef.current?.click()}>
                      <Upload className="h-3 w-3 mr-1" /> {selected.photo_url ? 'Changer photo' : 'Ajouter photo'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startCamera}>
                      <Camera className="h-3 w-3 mr-1" /> Caméra
                    </Button>
                    {photoPreview && (
                      <Button size="sm" className="h-7 text-xs" disabled={uploadingPhoto} onClick={() => handleSavePhotoOnly(selected)}>
                        {uploadingPhoto ? 'Envoi...' : 'Enregistrer photo'}
                      </Button>
                    )}
                  </div>
                </div>
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
                    {selected.zone_transport_id && zonesTransport.find((z: any) => z.id === selected.zone_transport_id) && (
                      <Badge variant="default" className="gap-1"><Bus className="h-3 w-3" />Transport: {zonesTransport.find((z: any) => z.id === selected.zone_transport_id)?.nom}</Badge>
                    )}
                    {selected.option_cantine && <Badge variant="outline">Cantine</Badge>}
                    {selected.uniforme_scolaire && <Badge variant="outline">Uniforme scolaire</Badge>}
                    {selected.uniforme_sport && <Badge variant="outline">Uniforme sport</Badge>}
                    {selected.uniforme_polo_lacoste && <Badge variant="outline">Polo Lacoste</Badge>}
                    {selected.uniforme_karate && <Badge variant="outline">Karaté</Badge>}
                  </div>
                </div>
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Bus className="h-4 w-4 text-muted-foreground" />
                    <strong className="text-sm">Affecter au transport</strong>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Zone de transport</Label>
                      <Select
                        value={selected.zone_transport_id || 'none'}
                        onValueChange={async (val) => {
                          const zoneId = val === 'none' ? null : val;
                          const { error } = await supabase.from('eleves').update({ zone_transport_id: zoneId }).eq('id', selected.id);
                          if (error) {
                            toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                          } else {
                            toast({ title: zoneId ? 'Transport assigné' : 'Transport retiré', description: zoneId ? `${selected.prenom} ${selected.nom} a été affecté(e) à la zone sélectionnée.` : `${selected.prenom} ${selected.nom} a été retiré(e) du transport.` });
                            qc.invalidateQueries({ queryKey: ['eleves-full'] });
                            qc.invalidateQueries({ queryKey: ['transport-eleves'] });
                            qc.invalidateQueries({ queryKey: ['transport-card-eleves'] });
                            setSelected({ ...selected, zone_transport_id: zoneId });
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Choisir une zone" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun (pas de transport)</SelectItem>
                          {zonesTransport.map((z: any) => (
                            <SelectItem key={z.id} value={z.id}>{z.nom} — {Number(z.prix_mensuel).toLocaleString()} GNF/mois</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selected.zone_transport_id && (
                    <p className="text-xs text-muted-foreground">Cet élève apparaîtra dans le module Transport avec sa classe et sa zone.</p>
                  )}
                </div>
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      <strong className="text-sm">Inscription Cantine</strong>
                    </div>
                    <Switch
                      checked={!!selected.option_cantine}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase.from('eleves').update({ option_cantine: checked }).eq('id', selected.id);
                        if (error) {
                          toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                        } else {
                          toast({ title: checked ? 'Inscrit à la cantine' : 'Retiré de la cantine', description: `${selected.prenom} ${selected.nom} a été ${checked ? 'inscrit(e) à' : 'retiré(e) de'} la cantine.` });
                          qc.invalidateQueries({ queryKey: ['eleves-full'] });
                          setSelected({ ...selected, option_cantine: checked });
                        }
                      }}
                    />
                  </div>
                  {selected.option_cantine && (
                    <p className="text-xs text-muted-foreground">Solde cantine : <span className="font-semibold">{Number(selected.solde_cantine || 0).toLocaleString()} GNF</span></p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="famille" className="space-y-3 text-sm mt-3">
                {selected.familles ? (
                  <div>
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      Famille:
                      <button
                        className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                        onClick={() => {
                          setSelected(null);
                          navigate(`/familles?familleId=${selected.familles.id}`);
                        }}
                      >
                        {selected.familles.nom_famille}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </h4>
                    <div className="text-muted-foreground space-y-1">
                      {selected.familles.telephone_pere && <p>Tél. père: {selected.familles.telephone_pere}</p>}
                      {selected.familles.telephone_mere && <p>Tél. mère: {selected.familles.telephone_mere}</p>}
                      {selected.familles.email_parent && <p>Email: {selected.familles.email_parent}</p>}
                      {selected.familles.adresse && <p>Adresse: {selected.familles.adresse}</p>}
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
              {/* Photo upload in edit */}
              <div className="flex items-center gap-3">
                {(photoPreview || editing.photo_url) ? (
                  <img src={photoPreview || editing.photo_url} alt={editing.prenom} loading="lazy" decoding="async" className="w-16 h-16 rounded-lg object-cover border" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-2xl border-2 border-dashed border-muted-foreground/30">👤</div>
                )}
                <div className="flex flex-col gap-1">
                  <input type="file" accept="image/*" className="hidden" id="edit-photo-input" onChange={handleFileSelect} />
                  <label htmlFor="edit-photo-input" className="cursor-pointer">
                    <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Upload className="h-3 w-3" /> {editing.photo_url || photoPreview ? 'Changer photo' : 'Ajouter photo'}
                    </span>
                  </label>
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={startCamera}>
                    <Camera className="h-3 w-3" /> Caméra
                  </button>
                </div>
              </div>
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
              {/* Option Cantine */}
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="edit-option-cantine"
                  checked={!!editing.option_cantine}
                  onCheckedChange={(checked) => setEditing({ ...editing, option_cantine: !!checked })}
                />
                <Label htmlFor="edit-option-cantine" className="text-sm cursor-pointer">Inscrit à la cantine</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); resetPhotoState(); }}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending || uploadingPhoto}>{uploadingPhoto ? 'Upload photo...' : updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
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
                    <img src={badgeEleve.photo_url} alt={badgeEleve.prenom} loading="lazy" decoding="async" className="w-20 h-20 rounded-full object-cover border-2 border-primary mx-auto" />
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
                          <img src={m.photo_url} loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover border" alt={m.prenom} />
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

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" /> Supprimer l'élève</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Voulez-vous supprimer <strong>{deleteDialog?.prenom} {deleteDialog?.nom}</strong> ?
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm">
                L'élève sera placé dans la corbeille. Vous pourrez le restaurer depuis la Configuration si nécessaire.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Annuler</Button>
            <Button variant="destructive" onClick={async () => {
              const { error } = await supabase.from('eleves').update({ deleted_at: new Date().toISOString() }).eq('id', deleteDialog.id);
              if (error) {
                toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
              } else {
                toast({ title: 'Élève supprimé', description: `${deleteDialog.prenom} ${deleteDialog.nom} a été placé dans la corbeille.` });
                qc.invalidateQueries({ queryKey: ['eleves-full'] });
              }
              setDeleteDialog(null);
            }}>
              <Trash2 className="mr-2 h-4 w-4" /> Confirmer la suppression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Dialog */}
      <Dialog open={cameraOpen} onOpenChange={v => { if (!v) stopCamera(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Prendre une photo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <video ref={cameraRef} autoPlay playsInline muted className="w-full rounded-lg bg-muted aspect-[4/3] object-cover" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={capturePhoto}><Camera className="h-4 w-4 mr-1" /> Capturer</Button>
              <Button variant="outline" onClick={stopCamera}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Planche Badges Scolaires */}
      {showPlanche && selectedIds.size > 0 && (
        <PlancheBadgesScolaires
          eleves={eleves.filter((e: any) => selectedIds.has(e.id))}
          onClose={() => setShowPlanche(false)}
          schoolName={schoolConfig?.nom}
          schoolLogo={schoolConfig?.logo_url}
        />
      )}

      {/* Photo Zoom Dialog */}
      <Dialog open={!!zoomPhotoUrl} onOpenChange={() => { setZoomPhotoUrl(null); setCropMode(false); }}>
        <DialogContent className="max-w-2xl flex flex-col items-center justify-center p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo élève</DialogTitle>
          </DialogHeader>
          {zoomPhotoUrl && !cropMode && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={zoomPhotoUrl}
                alt="Photo élève"
                className="max-h-[70vh] max-w-full rounded-lg object-contain"
              />
              <Button variant="outline" size="sm" onClick={() => setCropMode(true)}>
                <Edit className="w-4 h-4 mr-2" /> Recadrer la photo
              </Button>
            </div>
          )}
          {zoomPhotoUrl && cropMode && (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="relative w-full" style={{ height: '60vh' }}>
                <Cropper
                  image={zoomPhotoUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_: any, cap: any) => setCroppedAreaPixels(cap)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCropMode(false)}>Annuler</Button>
                <Button size="sm" disabled={savingCrop} onClick={async () => {
                  if (!croppedAreaPixels || !zoomPhotoUrl || !zoomEleveId) return;
                  setSavingCrop(true);
                  try {
                    const canvas = document.createElement('canvas');
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = zoomPhotoUrl; });
                    canvas.width = croppedAreaPixels.width;
                    canvas.height = croppedAreaPixels.height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, croppedAreaPixels.width, croppedAreaPixels.height);
                    const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85));
                    const path = `eleves/${zoomEleveId}_crop_${Date.now()}.jpg`;
                    const { error: upErr } = await supabase.storage.from('photos').upload(path, blob, { upsert: true });
                    if (upErr) throw upErr;
                    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
                    await supabase.from('eleves').update({ photo_url: urlData.publicUrl, photo_thumbnail_url: urlData.publicUrl }).eq('id', zoomEleveId);
                    toast({ title: 'Photo recadrée et sauvegardée' });
                    setZoomPhotoUrl(urlData.publicUrl);
                    setCropMode(false);
                    qc.invalidateQueries({ queryKey: ['eleves'] });
                  } catch (err: any) {
                    toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
                  } finally { setSavingCrop(false); }
                }}>
                  {savingCrop ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

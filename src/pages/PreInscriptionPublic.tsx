import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, CheckCircle2, ArrowLeft, Upload, Camera, X, FileText, Download, Eye, Plus, Trash2, MapPin, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

const DOCUMENTS_REQUIS = [
  { key: 'extrait_naissance', label: 'Extrait de naissance', required: false },
  { key: 'certificat_scolarite', label: 'Certificat de scolarité (ancienne école)', required: false },
  { key: 'bulletins', label: 'Bulletins scolaires (année précédente)', required: false },
  { key: 'photos_identite', label: "Photos d'identité (4 photos)", required: false },
  { key: 'carnet_vaccination', label: 'Carnet de vaccination', required: false },
  { key: 'certificat_medical', label: 'Certificat médical', required: false },
  { key: 'piece_identite_parent', label: "Pièce d'identité du parent/tuteur", required: false },
  { key: 'justificatif_domicile', label: 'Justificatif de domicile', required: false },
];

interface UploadedDoc {
  key: string;
  file: File;
  preview?: string;
}

interface EnfantSupplementaire {
  id: string;
  prenom: '';
  nom: '';
  date_naissance: '';
  sexe: '';
  niveau_id: '';
  classe_id: '';
}

function FichesDownloadSection() {
  const [viewingFiche, setViewingFiche] = useState<string | null>(null);
  const { data: fiches = [] } = useQuery({
    queryKey: ['fiches-renseignements-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiches_renseignements')
        .select('*')
        .order('ordre');
      if (error) throw error;
      return data;
    },
  });

  if (fiches.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Fiches de renseignements
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visualisez en ligne ou téléchargez ces fiches avant votre rendez-vous.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {fiches.map((f: any) => (
          <div
            key={f.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-primary/5 hover:border-primary/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">{f.nom}</p>
              <p className="text-xs text-muted-foreground">{f.fichier_nom}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setViewingFiche(viewingFiche === f.id ? null : f.id)}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Voir</span>
              </Button>
              <a href={f.fichier_url} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Télécharger</span>
                </Button>
              </a>
            </div>
          </div>
        ))}
        {fiches.map((f: any) => viewingFiche === f.id && (
          <div key={`view-${f.id}`} className="rounded-xl border border-primary/20 overflow-hidden bg-background">
            <div className="flex items-center justify-between p-2 bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">{f.nom}</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewingFiche(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <iframe
              src={f.fichier_url}
              className="w-full h-[500px] border-0"
              title={f.nom}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PreInscriptionPublic() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [form, setForm] = useState({
    prenom_eleve: '',
    nom_eleve: '',
    date_naissance: '',
    sexe: '',
    nom_pere: '',
    fonction_pere: '',
    telephone_pere: '',
    nom_mere: '',
    fonction_mere: '',
    telephone_mere: '',
    email_parent: '',
    niveau_id: '',
    classe_id: '',
    option_cantine: false,
    option_transport: false,
    adresse_transport: '',
    uniforme_scolaire: false,
    uniforme_sport: false,
    uniforme_scout: false,
    uniforme_karate: false,
  });

  // Multi-child support
  const [enfantsSupp, setEnfantsSupp] = useState<Array<{
    id: string; prenom: string; nom: string; date_naissance: string; sexe: string; niveau_id: string; classe_id: string;
  }>>([]);

  const addEnfant = () => {
    setEnfantsSupp(prev => [...prev, {
      id: crypto.randomUUID(),
      prenom: '', nom: '', date_naissance: '', sexe: '', niveau_id: '', classe_id: ''
    }]);
  };

  const removeEnfant = (id: string) => {
    setEnfantsSupp(prev => prev.filter(e => e.id !== id));
  };

  const updateEnfant = (id: string, field: string, value: string) => {
    setEnfantsSupp(prev => prev.map(e => e.id === id ? { ...e, [field]: value, ...(field === 'niveau_id' ? { classe_id: '' } : {}) } : e));
  };

  const { data: niveaux = [] } = useQuery({
    queryKey: ['niveaux-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('niveaux')
        .select('id, nom, cycle_id, cycles:cycle_id(nom, ordre)')
        .order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-public', form.niveau_id],
    queryFn: async () => {
      if (!form.niveau_id) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom')
        .eq('niveau_id', form.niveau_id)
        .order('nom');
      if (error) throw error;
      return data;
    },
    enabled: !!form.niveau_id,
  });

  // Fetch classes for each supplementary child
  const allNiveauIds = [...new Set(enfantsSupp.map(e => e.niveau_id).filter(Boolean))];
  const { data: allClassesMap = {} } = useQuery({
    queryKey: ['classes-multi', allNiveauIds],
    queryFn: async () => {
      if (allNiveauIds.length === 0) return {};
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom, niveau_id')
        .in('niveau_id', allNiveauIds)
        .order('nom');
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach(c => {
        if (!map[c.niveau_id]) map[c.niveau_id] = [];
        map[c.niveau_id].push(c);
      });
      return map;
    },
    enabled: allNiveauIds.length > 0,
  });

  const handleFileSelect = (docKey: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 10 Mo');
      return;
    }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setUploadedDocs(prev => {
      const filtered = prev.filter(d => d.key !== docKey);
      return [...filtered, { key: docKey, file, preview }];
    });
  };

  const handleCapture = (docKey: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'camera';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileSelect(docKey, file);
    };
    input.click();
  };

  const removeDoc = (docKey: string) => {
    setUploadedDocs(prev => {
      const doc = prev.find(d => d.key === docKey);
      if (doc?.preview) URL.revokeObjectURL(doc.preview);
      return prev.filter(d => d.key !== docKey);
    });
  };

  const getDocForKey = (key: string) => uploadedDocs.find(d => d.key === key);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.prenom_eleve || !form.nom_eleve || !form.nom_pere || !form.telephone_pere) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (form.option_transport && !form.adresse_transport.trim()) {
      toast.error('Veuillez saisir votre adresse pour le transport');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        prenom_eleve: form.prenom_eleve.trim(),
        nom_eleve: form.nom_eleve.trim(),
        nom_parent: `${form.nom_pere.trim()} / ${form.nom_mere.trim()}`.trim(),
        telephone_parent: form.telephone_pere.trim(),
        option_cantine: form.option_cantine,
        option_transport: form.option_transport,
        option_uniformes: form.uniforme_scolaire || form.uniforme_sport || form.uniforme_scout || form.uniforme_karate,
        adresse_transport: form.option_transport ? form.adresse_transport.trim() : null,
        uniforme_scolaire: form.uniforme_scolaire,
        uniforme_sport: form.uniforme_sport,
        uniforme_scout: form.uniforme_scout,
        uniforme_karate: form.uniforme_karate,
        nom_pere: form.nom_pere.trim(),
        fonction_pere: form.fonction_pere.trim() || null,
        telephone_pere: form.telephone_pere.trim(),
        nom_mere: form.nom_mere.trim() || null,
        fonction_mere: form.fonction_mere.trim() || null,
        telephone_mere: form.telephone_mere.trim() || null,
        enfants_supplementaires: enfantsSupp.length > 0 ? enfantsSupp.map(e => ({
          prenom: e.prenom, nom: e.nom, date_naissance: e.date_naissance || null,
          sexe: e.sexe || null, niveau_id: e.niveau_id || null, classe_id: e.classe_id || null,
        })) : [],
      };
      if (form.date_naissance) payload.date_naissance = form.date_naissance;
      if (form.sexe) payload.sexe = form.sexe;
      if (form.email_parent) payload.email_parent = form.email_parent.trim();
      if (form.niveau_id) payload.niveau_id = form.niveau_id;
      if (form.classe_id) payload.classe_id = form.classe_id;

      const { data: insertedRow, error } = await supabase.from('pre_inscriptions').insert(payload).select('id').single();
      if (error) throw error;

      const preInscriptionId = insertedRow.id;

      for (const doc of uploadedDocs) {
        const ext = doc.file.name.split('.').pop() || 'jpg';
        const path = `${preInscriptionId}/${doc.key}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('pre-inscriptions-docs')
          .upload(path, doc.file, { upsert: true });
        if (uploadError) {
          console.error('Upload error for', doc.key, uploadError);
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">Demande envoyée !</h2>
            <p className="text-muted-foreground">
              Votre demande de pré-inscription a été enregistrée avec succès.
              {enfantsSupp.length > 0 && ` (${enfantsSupp.length + 1} enfant(s) inscrits)`}
              {' '}L'administration vous contactera pour fixer un rendez-vous.
            </p>
            <p className="text-sm text-muted-foreground">
              📎 {uploadedDocs.length} document(s) joint(s)
            </p>
            <p className="text-sm text-muted-foreground">
              Un membre de l'équipe vous rappellera au <strong>{form.telephone_pere}</strong>.
            </p>
            <Link to="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Retour à l'accueil
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group niveaux by cycle
  const cycleMap = new Map<string, { cycleName: string; ordre: number; niveaux: typeof niveaux }>();
  niveaux.forEach((n: any) => {
    const key = n.cycle_id;
    if (!cycleMap.has(key)) {
      cycleMap.set(key, { cycleName: n.cycles?.nom || '', ordre: n.cycles?.ordre ?? 0, niveaux: [] });
    }
    cycleMap.get(key)!.niveaux.push(n);
  });
  const sortedCycles = [...cycleMap.entries()].sort((a, b) => a[1].ordre - b[1].ordre);

  const renderNiveauSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 rounded-xl border-2 border-primary/20 bg-background shadow-sm hover:border-primary/40 transition-colors">
        <SelectValue placeholder="🎓 Niveau..." />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {sortedCycles.map(([cycleId, { cycleName, niveaux: cycleNiveaux }]) => (
          <div key={cycleId}>
            <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 border-b">
              {cycleName}
            </div>
            {cycleNiveaux.map((n: any) => (
              <SelectItem key={n.id} value={n.id} className="py-2.5 text-sm font-medium">
                {n.nom}
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );

  const renderClasseSelect = (value: string, onChange: (v: string) => void, classesList: any[], disabled: boolean) => (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-11 rounded-xl border-2 border-primary/20 bg-background shadow-sm hover:border-primary/40 transition-colors">
        <SelectValue placeholder={disabled ? 'Niveau d\'abord' : '📚 Classe...'} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {classesList.map((c: any) => (
          <SelectItem key={c.id} value={c.id} className="py-2.5 text-sm font-medium">{c.nom}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <nav className="bg-background/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-md">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-bold text-sm">Les Ecoles la Mame Plus</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/20 mb-5 shadow-sm">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold text-primary tracking-wide">Inscription simplifiée</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Pré-inscription en ligne
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Remplissez ce formulaire pour soumettre une demande de pré-inscription.
            Vous pouvez inscrire plusieurs enfants en une seule demande.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Infos Élève principal */}
          <Card className="border-primary/10 shadow-lg shadow-primary/5 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b border-primary/10 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-base">👶</span>
                </div>
                Informations de l'élève
                {enfantsSupp.length > 0 && <Badge variant="outline" className="ml-auto text-xs">Enfant 1</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prénom *</Label>
                  <Input value={form.prenom_eleve} onChange={e => setForm(f => ({ ...f, prenom_eleve: e.target.value }))} required className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-colors" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom *</Label>
                  <Input value={form.nom_eleve} onChange={e => setForm(f => ({ ...f, nom_eleve: e.target.value }))} required className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date de naissance</Label>
                  <Input type="date" value={form.date_naissance} onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value }))} className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-colors" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sexe</Label>
                  <Select value={form.sexe} onValueChange={v => setForm(f => ({ ...f, sexe: v }))}>
                    <SelectTrigger className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 transition-colors"><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="M">👦 Masculin</SelectItem>
                      <SelectItem value="F">👧 Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Niveau souhaité</Label>
                  {renderNiveauSelect(form.niveau_id, v => setForm(f => ({ ...f, niveau_id: v, classe_id: '' })))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classe souhaitée</Label>
                  {renderClasseSelect(form.classe_id, v => setForm(f => ({ ...f, classe_id: v })), classes, !form.niveau_id || classes.length === 0)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enfants supplémentaires */}
          {enfantsSupp.map((enfant, idx) => (
            <Card key={enfant.id} className="border-accent/10 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-accent/10 to-transparent border-b border-accent/10 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                      <span className="text-base">👶</span>
                    </div>
                    Enfant {idx + 2}
                  </CardTitle>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeEnfant(enfant.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prénom *</Label>
                    <Input value={enfant.prenom} onChange={e => updateEnfant(enfant.id, 'prenom', e.target.value)} className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom *</Label>
                    <Input value={enfant.nom} onChange={e => updateEnfant(enfant.id, 'nom', e.target.value)} className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date de naissance</Label>
                    <Input type="date" value={enfant.date_naissance} onChange={e => updateEnfant(enfant.id, 'date_naissance', e.target.value)} className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sexe</Label>
                    <Select value={enfant.sexe} onValueChange={v => updateEnfant(enfant.id, 'sexe', v)}>
                      <SelectTrigger className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 transition-colors"><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="M">👦 Masculin</SelectItem>
                        <SelectItem value="F">👧 Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Niveau souhaité</Label>
                    {renderNiveauSelect(enfant.niveau_id, v => updateEnfant(enfant.id, 'niveau_id', v))}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classe souhaitée</Label>
                    {renderClasseSelect(
                      enfant.classe_id,
                      v => updateEnfant(enfant.id, 'classe_id', v),
                      (allClassesMap as any)[enfant.niveau_id] || [],
                      !enfant.niveau_id
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add child button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all text-primary font-semibold gap-2"
            onClick={addEnfant}
          >
            <Plus className="h-5 w-5" />
            <Users className="h-4 w-4" />
            Ajouter un autre enfant ({enfantsSupp.length + 1} enfant{enfantsSupp.length > 0 ? 's' : ''} actuellement)
          </Button>

          {/* Infos Parent */}
          <Card className="border-accent/10 shadow-lg shadow-accent/5 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-accent/10 to-transparent border-b border-accent/10 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                  <span className="text-base">👨‍👩‍👧</span>
                </div>
                Informations du parent / tuteur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Père */}
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 space-y-3">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <span className="text-base">👨</span> Informations du Père
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom & Prénom *</Label>
                    <Input value={form.nom_pere} onChange={e => setForm(f => ({ ...f, nom_pere: e.target.value }))} required placeholder="Nom complet du père" className="h-11 rounded-xl border-2 border-blue-200/50 hover:border-blue-300 focus:border-blue-500 transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fonction / Profession</Label>
                    <Input value={form.fonction_pere} onChange={e => setForm(f => ({ ...f, fonction_pere: e.target.value }))} placeholder="Ex: Ingénieur, Commerçant..." className="h-11 rounded-xl border-2 border-blue-200/50 hover:border-blue-300 focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact téléphonique *</Label>
                  <Input type="tel" value={form.telephone_pere} onChange={e => setForm(f => ({ ...f, telephone_pere: e.target.value }))} required placeholder="+224 6XX XXX XXX" className="h-11 rounded-xl border-2 border-blue-200/50 hover:border-blue-300 focus:border-blue-500 transition-colors" />
                </div>
              </div>

              {/* Mère */}
              <div className="p-4 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200/50 dark:border-pink-800/30 space-y-3">
                <p className="text-sm font-bold text-pink-700 dark:text-pink-400 flex items-center gap-2">
                  <span className="text-base">👩</span> Informations de la Mère
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom & Prénom</Label>
                    <Input value={form.nom_mere} onChange={e => setForm(f => ({ ...f, nom_mere: e.target.value }))} placeholder="Nom complet de la mère" className="h-11 rounded-xl border-2 border-pink-200/50 hover:border-pink-300 focus:border-pink-500 transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fonction / Profession</Label>
                    <Input value={form.fonction_mere} onChange={e => setForm(f => ({ ...f, fonction_mere: e.target.value }))} placeholder="Ex: Enseignante, Médecin..." className="h-11 rounded-xl border-2 border-pink-200/50 hover:border-pink-300 focus:border-pink-500 transition-colors" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact téléphonique</Label>
                  <Input type="tel" value={form.telephone_mere} onChange={e => setForm(f => ({ ...f, telephone_mere: e.target.value }))} placeholder="+224 6XX XXX XXX" className="h-11 rounded-xl border-2 border-pink-200/50 hover:border-pink-300 focus:border-pink-500 transition-colors" />
                </div>
              </div>

              {/* Email commun */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📧 Email de contact (optionnel)</Label>
                <Input type="email" value={form.email_parent} onChange={e => setForm(f => ({ ...f, email_parent: e.target.value }))} placeholder="email@exemple.com" className="h-11 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-colors" />
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="border-secondary/10 shadow-lg shadow-secondary/5 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-secondary/10 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-secondary-foreground" />
                </div>
                Dossier à fournir
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Scannez ou prenez en photo chaque document.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              {DOCUMENTS_REQUIS.map((doc) => {
                const uploaded = getDocForKey(doc.key);
                return (
                  <div
                    key={doc.key}
                    className={`rounded-xl border p-3 transition-all ${
                      uploaded
                        ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{doc.label}</span>
                          {uploaded && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Ajouté
                            </Badge>
                          )}
                        </div>
                        {uploaded && (
                          <div className="mt-2 flex items-center gap-2">
                            {uploaded.preview ? (
                              <img src={uploaded.preview} alt={doc.label} className="h-14 w-14 rounded-lg object-cover border" />
                            ) : (
                              <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">{uploaded.file.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {uploaded && (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeDoc(doc.key)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleCapture(doc.key)}>
                          <Camera className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Photo</span>
                        </Button>
                        <div className="relative">
                          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => fileInputRefs.current[doc.key]?.click()}>
                            <Upload className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Fichier</span>
                          </Button>
                          <input
                            ref={el => { fileInputRefs.current[doc.key] = el; }}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(doc.key, file);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Documents ajoutés</span>
                  <span className="font-semibold">{uploadedDocs.length} / {DOCUMENTS_REQUIS.length}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(uploadedDocs.length / DOCUMENTS_REQUIS.length) * 100}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fiches */}
          <FichesDownloadSection />

          {/* Options */}
          <Card className="border-primary/10 shadow-lg shadow-primary/5 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b border-primary/10 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-base">⚙️</span>
                </div>
                Options souhaitées
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {/* Cantine */}
              <label htmlFor="cantine" className={`cursor-pointer flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${form.option_cantine ? 'border-primary bg-primary/5 shadow-md' : 'border-muted hover:border-primary/30'}`}>
                <Checkbox id="cantine" checked={form.option_cantine} onCheckedChange={v => setForm(f => ({ ...f, option_cantine: !!v }))} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🍽️</span>
                    <p className="text-sm font-bold">Cantine scolaire</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Repas chauds et équilibrés servis chaque jour à l'école. Système de portefeuille rechargeable.</p>
                  <p className="text-xs font-semibold text-primary mt-1">💰 400 000 GNF / mois</p>
                </div>
              </label>

              {/* Transport */}
              <div className="space-y-3">
                <label htmlFor="transport" className={`cursor-pointer flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${form.option_transport ? 'border-primary bg-primary/5 shadow-md' : 'border-muted hover:border-primary/30'}`}>
                  <Checkbox id="transport" checked={form.option_transport} onCheckedChange={v => setForm(f => ({ ...f, option_transport: !!v }))} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚌</span>
                      <p className="text-sm font-bold">Transport scolaire</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Navette aller-retour sécurisée avec chauffeur dédié. Suivi GPS en temps réel et pointage automatique.</p>
                    <p className="text-xs font-semibold text-primary mt-1">💰 Petit trajet : 300 000 GNF — Long trajet : 350 000 GNF / mois</p>
                  </div>
                </label>

                {form.option_transport && (
                  <div className="ml-8 p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 space-y-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                        📍 Veuillez saisir votre adresse complète ci-dessous. C'est l'endroit où le bus viendra chercher votre enfant. 
                        La direction déterminera le tarif applicable (petit ou long trajet) en fonction de cette adresse.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adresse de prise en charge *</Label>
                      <Textarea
                        value={form.adresse_transport}
                        onChange={e => setForm(f => ({ ...f, adresse_transport: e.target.value }))}
                        placeholder="Ex: Quartier Kipé, à côté de la mosquée centrale, Commune de Ratoma, Conakry"
                        className="min-h-[80px] rounded-xl border-2 border-amber-200/60 hover:border-amber-300 focus:border-amber-500 transition-colors resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Uniformes — individual selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-muted bg-muted/30">
                  <span className="text-xl">👔</span>
                  <div>
                    <p className="text-sm font-bold">Uniformes & Équipements</p>
                    <p className="text-xs text-muted-foreground">Sélectionnez les tenues souhaitées ci-dessous</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-2">
                  <label htmlFor="u_scolaire" className={`cursor-pointer flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all ${form.uniforme_scolaire ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted/80 hover:border-primary/30'}`}>
                    <Checkbox id="u_scolaire" checked={form.uniforme_scolaire} onCheckedChange={v => setForm(f => ({ ...f, uniforme_scolaire: !!v }))} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">👕 Tenue scolaire (×2)</p>
                      <p className="text-[11px] text-muted-foreground">Primaire : 350 000 GNF</p>
                      <p className="text-[11px] text-muted-foreground">Secondaire : 450 000 GNF</p>
                    </div>
                  </label>

                  <label htmlFor="u_sport" className={`cursor-pointer flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all ${form.uniforme_sport ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted/80 hover:border-primary/30'}`}>
                    <Checkbox id="u_sport" checked={form.uniforme_sport} onCheckedChange={v => setForm(f => ({ ...f, uniforme_sport: !!v }))} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">🏃 Tenue de sport (EPS)</p>
                      <p className="text-[11px] font-medium text-primary">100 000 GNF</p>
                    </div>
                  </label>

                  <label htmlFor="u_scout" className={`cursor-pointer flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all ${form.uniforme_scout ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted/80 hover:border-primary/30'}`}>
                    <Checkbox id="u_scout" checked={form.uniforme_scout} onCheckedChange={v => setForm(f => ({ ...f, uniforme_scout: !!v }))} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">⚜️ Tenue Scout</p>
                      <p className="text-[11px] font-medium text-primary">250 000 GNF</p>
                    </div>
                  </label>

                  <label htmlFor="u_karate" className={`cursor-pointer flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all ${form.uniforme_karate ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted/80 hover:border-primary/30'}`}>
                    <Checkbox id="u_karate" checked={form.uniforme_karate} onCheckedChange={v => setForm(f => ({ ...f, uniforme_karate: !!v }))} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">🥋 Tenue de Karaté</p>
                      <p className="text-[11px] font-medium text-primary">200 000 GNF</p>
                    </div>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all" size="lg" disabled={loading}>
            {loading ? 'Envoi en cours…' : `🚀 Soumettre la pré-inscription (${enfantsSupp.length + 1} enfant${enfantsSupp.length > 0 ? 's' : ''})`}
          </Button>
        </form>
      </div>
    </div>
  );
}

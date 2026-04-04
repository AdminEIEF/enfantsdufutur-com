import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, CheckCircle2, ArrowLeft, Upload, Camera, X, FileText, AlertCircle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

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

function FichesDownloadSection() {
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
          Fiches de renseignements à télécharger
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Téléchargez, imprimez et remplissez ces fiches avant votre rendez-vous.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {fiches.map((f: any) => (
          <a
            key={f.id}
            href={f.fichier_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-primary/5 hover:border-primary/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">{f.nom}</p>
              <p className="text-xs text-muted-foreground">{f.fichier_nom}</p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </a>
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
    nom_parent: '',
    telephone_parent: '',
    email_parent: '',
    niveau_id: '',
    classe_id: '',
    option_cantine: false,
    option_transport: false,
    option_uniformes: false,
  });

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
    input.capture = 'environment';
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
    if (!form.prenom_eleve || !form.nom_eleve || !form.nom_parent || !form.telephone_parent) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Check required documents
    const missingRequired = DOCUMENTS_REQUIS.filter(d => d.required && !getDocForKey(d.key));
    if (missingRequired.length > 0) {
      toast.error(`Documents manquants : ${missingRequired.map(d => d.label).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        prenom_eleve: form.prenom_eleve.trim(),
        nom_eleve: form.nom_eleve.trim(),
        nom_parent: form.nom_parent.trim(),
        telephone_parent: form.telephone_parent.trim(),
        option_cantine: form.option_cantine,
        option_transport: form.option_transport,
        option_uniformes: form.option_uniformes,
      };
      if (form.date_naissance) payload.date_naissance = form.date_naissance;
      if (form.sexe) payload.sexe = form.sexe;
      if (form.email_parent) payload.email_parent = form.email_parent.trim();
      if (form.niveau_id) payload.niveau_id = form.niveau_id;
      if (form.classe_id) payload.classe_id = form.classe_id;

      const { data: insertedRow, error } = await supabase.from('pre_inscriptions').insert(payload).select('id').single();
      if (error) throw error;

      const preInscriptionId = insertedRow.id;

      // Upload documents
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
              L'administration vous contactera pour fixer un rendez-vous.
            </p>
            <p className="text-sm text-muted-foreground">
              📎 {uploadedDocs.length} document(s) joint(s)
            </p>
            <p className="text-sm text-muted-foreground">
              Un membre de l'équipe vous rappellera au <strong>{form.telephone_parent}</strong>.
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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <nav className="bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm">EI Enfants du Futur</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Pré-inscription en ligne</h1>
          <p className="text-muted-foreground">
            Remplissez ce formulaire pour soumettre une demande de pré-inscription. 
            Notre équipe vous contactera pour un rendez-vous.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Infos Élève */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations de l'élève</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input value={form.prenom_eleve} onChange={e => setForm(f => ({ ...f, prenom_eleve: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={form.nom_eleve} onChange={e => setForm(f => ({ ...f, nom_eleve: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de naissance</Label>
                  <Input type="date" value={form.date_naissance} onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sexe</Label>
                  <Select value={form.sexe} onValueChange={v => setForm(f => ({ ...f, sexe: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculin</SelectItem>
                      <SelectItem value="F">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Niveau souhaité</Label>
                <Select value={form.niveau_id} onValueChange={v => setForm(f => ({ ...f, niveau_id: v, classe_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
                  <SelectContent>
                    {sortedCycles.map(([cycleId, { cycleName, niveaux: cycleNiveaux }]) => (
                      <div key={cycleId}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cycleName}</div>
                        {cycleNiveaux.map((n: any) => (
                          <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.niveau_id && classes.length > 0 && (
                <div className="space-y-2">
                  <Label>Classe souhaitée</Label>
                  <Select value={form.classe_id} onValueChange={v => setForm(f => ({ ...f, classe_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Infos Parent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations du parent/tuteur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input value={form.nom_parent} onChange={e => setForm(f => ({ ...f, nom_parent: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input type="tel" value={form.telephone_parent} onChange={e => setForm(f => ({ ...f, telephone_parent: e.target.value }))} required placeholder="+224 6XX XXX XXX" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email_parent} onChange={e => setForm(f => ({ ...f, email_parent: e.target.value }))} placeholder="optionnel" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents à fournir */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Dossier à fournir
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Scannez ou prenez en photo chaque document. Les documents marqués <span className="text-destructive font-medium">*</span> sont obligatoires.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
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
                          {doc.required && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Obligatoire
                            </Badge>
                          )}
                          {uploaded && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Ajouté
                            </Badge>
                          )}
                        </div>

                        {uploaded && (
                          <div className="mt-2 flex items-center gap-2">
                            {uploaded.preview ? (
                              <img
                                src={uploaded.preview}
                                alt={doc.label}
                                className="h-14 w-14 rounded-lg object-cover border"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {uploaded.file.name}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {uploaded && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeDoc(doc.key)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleCapture(doc.key)}
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Photo</span>
                        </Button>
                        <div className="relative">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => fileInputRefs.current[doc.key]?.click()}
                          >
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

              {/* Progress */}
              <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Documents ajoutés</span>
                  <span className="font-semibold">
                    {uploadedDocs.length} / {DOCUMENTS_REQUIS.length}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(uploadedDocs.length / DOCUMENTS_REQUIS.length) * 100}%` }}
                  />
                </div>
                {DOCUMENTS_REQUIS.filter(d => d.required && !getDocForKey(d.key)).length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {DOCUMENTS_REQUIS.filter(d => d.required && !getDocForKey(d.key)).length} document(s) obligatoire(s) manquant(s)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fiches de renseignements */}
          <FichesDownloadSection />

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Options souhaitées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox id="cantine" checked={form.option_cantine} onCheckedChange={v => setForm(f => ({ ...f, option_cantine: !!v }))} />
                <Label htmlFor="cantine" className="cursor-pointer">Cantine scolaire</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="transport" checked={form.option_transport} onCheckedChange={v => setForm(f => ({ ...f, option_transport: !!v }))} />
                <Label htmlFor="transport" className="cursor-pointer">Transport scolaire</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="uniformes" checked={form.option_uniformes} onCheckedChange={v => setForm(f => ({ ...f, option_uniformes: !!v }))} />
                <Label htmlFor="uniformes" className="cursor-pointer">Kit uniformes complet</Label>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Envoi en cours…' : 'Soumettre ma demande de pré-inscription'}
          </Button>
        </form>
      </div>
    </div>
  );
}

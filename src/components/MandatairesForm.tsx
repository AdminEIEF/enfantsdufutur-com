import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Upload, X, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Mandataire {
  nom: string;
  prenom: string;
  lien_parente: string;
  photo_url: string | null;
  photoFile?: File | null;
  photoPreview?: string | null;
}

interface MandatairesFormProps {
  mandataires: Mandataire[];
  onChange: (mandataires: Mandataire[]) => void;
}

const MANDATAIRE_LABELS = ['Personne autorisée 1', 'Personne autorisée 2', 'Personne autorisée 3'];
const LIEN_SUGGESTIONS = ['Père', 'Mère', 'Nounou', 'Chauffeur', 'Grand-père', 'Grand-mère', 'Oncle', 'Tante', 'Frère', 'Sœur'];

export function createEmptyMandataires(): Mandataire[] {
  return [
    { nom: '', prenom: '', lien_parente: 'Père', photo_url: null, photoFile: null, photoPreview: null },
    { nom: '', prenom: '', lien_parente: 'Mère', photo_url: null, photoFile: null, photoPreview: null },
    { nom: '', prenom: '', lien_parente: 'Nounou', photo_url: null, photoFile: null, photoPreview: null },
  ];
}

export async function uploadMandatairePhotos(
  mandataires: Mandataire[],
  eleveId: string
): Promise<Mandataire[]> {
  const results: Mandataire[] = [];
  for (let i = 0; i < mandataires.length; i++) {
    const m = mandataires[i];
    let photoUrl = m.photo_url;
    if (m.photoFile) {
      const ext = m.photoFile.name.split('.').pop() || 'jpg';
      const path = `mandataires/${eleveId}/${i + 1}.${ext}`;
      const { error } = await supabase.storage.from('photos').upload(path, m.photoFile, { upsert: true });
      if (error) {
        toast({ title: 'Erreur upload photo', description: error.message, variant: 'destructive' });
      } else {
        const { data: signedData } = await supabase.storage.from('photos').createSignedUrl(path, 31536000);
        photoUrl = signedData?.signedUrl || null;
      }
    }
    results.push({ ...m, photo_url: photoUrl, photoFile: null, photoPreview: null });
  }
  return results;
}

export default function MandatairesForm({ mandataires, onChange }: MandatairesFormProps) {
  const updateField = (index: number, field: keyof Mandataire, value: any) => {
    const updated = [...mandataires];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handlePhotoChange = (index: number, file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Photo trop volumineuse', description: 'Max 5 Mo', variant: 'destructive' });
      return;
    }
    const preview = URL.createObjectURL(file);
    const updated = [...mandataires];
    updated[index] = { ...updated[index], photoFile: file, photoPreview: preview };
    onChange(updated);
  };

  const removePhoto = (index: number) => {
    const updated = [...mandataires];
    updated[index] = { ...updated[index], photoFile: null, photoPreview: null, photo_url: null };
    onChange(updated);
  };

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-orange-600" />
          Sécurité Crèche — Mandataires autorisés
        </CardTitle>
        <p className="text-xs text-muted-foreground">3 personnes autorisées à récupérer l'enfant. Photos et identité obligatoires.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {mandataires.map((m, i) => (
          <div key={i} className="border rounded-lg p-3 bg-background space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{MANDATAIRE_LABELS[i]}</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Nom *</Label>
                <Input
                  value={m.nom}
                  onChange={e => updateField(i, 'nom', e.target.value)}
                  placeholder="Nom"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Prénom *</Label>
                <Input
                  value={m.prenom}
                  onChange={e => updateField(i, 'prenom', e.target.value)}
                  placeholder="Prénom"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Lien de parenté *</Label>
                <select
                  value={m.lien_parente}
                  onChange={e => updateField(i, 'lien_parente', e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {LIEN_SUGGESTIONS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Photo */}
            <div className="flex items-center gap-3">
              {(m.photoPreview || m.photo_url) ? (
                <div className="relative">
                  <img
                    src={m.photoPreview || m.photo_url || ''}
                    alt={`${m.prenom} ${m.nom}`}
                    className="w-14 h-14 rounded-lg object-cover border"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoChange(i, e.target.files?.[0] || null)}
                />
                <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Upload className="h-3 w-3" /> {m.photoPreview || m.photo_url ? 'Changer' : 'Télécharger photo'}
                </span>
              </label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

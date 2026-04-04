import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Trash2, FileText, GripVertical } from 'lucide-react';

export default function FichesRenseignementsAdmin() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [nom, setNom] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: fiches = [], isLoading } = useQuery({
    queryKey: ['fiches-renseignements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiches_renseignements')
        .select('*')
        .order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async () => {
    if (!file || !nom.trim()) {
      toast.error('Veuillez remplir le nom et sélectionner un fichier');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('fiches-renseignements')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('fiches-renseignements')
        .getPublicUrl(path);

      const { error } = await supabase.from('fiches_renseignements').insert({
        nom: nom.trim(),
        fichier_nom: file.name,
        fichier_url: urlData.publicUrl,
        ordre: fiches.length,
      });
      if (error) throw error;

      toast.success('Fiche ajoutée avec succès');
      setNom('');
      setFile(null);
      qc.invalidateQueries({ queryKey: ['fiches-renseignements'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fichierUrl: string) => {
    if (!confirm('Supprimer cette fiche ?')) return;
    try {
      // Extract path from URL
      const urlParts = fichierUrl.split('/fiches-renseignements/');
      if (urlParts[1]) {
        await supabase.storage.from('fiches-renseignements').remove([decodeURIComponent(urlParts[1])]);
      }
      const { error } = await supabase.from('fiches_renseignements').delete().eq('id', id);
      if (error) throw error;
      toast.success('Fiche supprimée');
      qc.invalidateQueries({ queryKey: ['fiches-renseignements'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Fiches de renseignements
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Uploadez vos fiches PDF. Elles seront téléchargeables sur la page de pré-inscription et la landing page.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload form */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5">
          <div className="flex-1 space-y-2">
            <Label className="text-xs font-medium">Nom de la fiche</Label>
            <Input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex: Fiche de renseignements Primaire"
              className="h-9"
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label className="text-xs font-medium">Fichier PDF</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="h-9"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleUpload} disabled={uploading || !file || !nom.trim()} size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              {uploading ? 'Envoi…' : 'Ajouter'}
            </Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>
        ) : fiches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune fiche ajoutée</p>
        ) : (
          <div className="space-y-2">
            {fiches.map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.nom}</p>
                  <p className="text-xs text-muted-foreground truncate">{f.fichier_nom}</p>
                </div>
                <a href={f.fichier_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="text-xs h-7">Voir</Button>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(f.id, f.fichier_url)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

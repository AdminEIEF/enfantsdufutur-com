import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Image as ImageIcon, Video, Trash2, ArrowLeft, ArrowRight, Plus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLandingMedia, toEmbedUrl, LANDING_MEDIA_KEY, type LandingImage, type LandingVideo } from '@/hooks/useLandingMedia';

export default function LandingMediaAdmin() {
  const qc = useQueryClient();
  const { data } = useLandingMedia();
  const [images, setImages] = useState<LandingImage[]>([]);
  const [videos, setVideos] = useState<LandingVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newVideo, setNewVideo] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');

  useEffect(() => {
    if (data && !loaded) {
      setImages(data.images);
      setVideos(data.videos);
      setLoaded(true);
    }
  }, [data, loaded]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const added: LandingImage[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `landing/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('support-images').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('support-images').getPublicUrl(path);
        added.push({ url: pub.publicUrl, alt: file.name.replace(/\.[^.]+$/, '') });
      }
      setImages(prev => [...prev, ...added]);
      toast.success(`${added.length} image(s) ajoutée(s) — pensez à enregistrer`);
    } catch (err: any) {
      toast.error('Erreur upload: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const copy = [...arr];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  };

  const save = async () => {
    setSaving(true);
    try {
      const valeur = { images, videos } as any;
      const { data: existing } = await supabase.from('parametres').select('id').eq('cle', LANDING_MEDIA_KEY).maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from('parametres').update({ valeur }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('parametres').insert({ cle: LANDING_MEDIA_KEY, valeur });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ['landing-media'] });
      toast.success("Médias de la page d'accueil enregistrés");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Galerie d'images (page d'accueil)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ces images défilent dans le carrousel « Notre école en images ». Si aucune image n'est ajoutée, la section reste masquée.
          </p>
          <Button variant="outline" size="sm" asChild disabled={uploading}>
            <label className="cursor-pointer">
              {uploading ? 'Téléversement…' : '📷 Ajouter des images'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            </label>
          </Button>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div key={img.url + i} className="rounded-xl border overflow-hidden bg-muted/30">
                <img src={img.url} alt={img.alt || ''} className="w-full h-28 object-cover" />
                <div className="p-2 space-y-2">
                  <Input
                    value={img.alt || ''}
                    onChange={e => setImages(prev => prev.map((x, k) => k === i ? { ...x, alt: e.target.value } : x))}
                    placeholder="Légende"
                    className="h-7 text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setImages(prev => move(prev, i, -1))}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setImages(prev => move(prev, i, 1))}><ArrowRight className="h-3.5 w-3.5" /></Button>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setImages(prev => prev.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {images.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune image pour le moment.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" /> Vidéos (page d'accueil)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Collez un lien YouTube ou Facebook. La conversion en lecteur intégré est automatique.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Lien de la vidéo</Label>
              <Input value={newVideo} onChange={e => setNewVideo(e.target.value)} placeholder="https://youtu.be/… ou https://facebook.com/reel/…" />
            </div>
            <div>
              <Label className="text-xs">Titre (optionnel)</Label>
              <Input value={newVideoTitle} onChange={e => setNewVideoTitle(e.target.value)} placeholder="Ex: Cérémonie de rentrée" />
            </div>
            <Button
              onClick={() => {
                if (!newVideo.trim()) return;
                setVideos(prev => [...prev, { url: newVideo.trim(), title: newVideoTitle.trim() || undefined }]);
                setNewVideo(''); setNewVideoTitle('');
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {videos.map((v, i) => (
              <div key={v.url + i} className="rounded-xl border overflow-hidden">
                <iframe src={toEmbedUrl(v.url)} className="w-full h-40 border-0" allowFullScreen title={v.title || `Vidéo ${i + 1}`} />
                <div className="p-2 flex items-center justify-between">
                  <span className="text-xs truncate">{v.title || `Vidéo ${i + 1}`}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVideos(prev => move(prev, i, -1))}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVideos(prev => move(prev, i, 1))}><ArrowRight className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setVideos(prev => prev.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {videos.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune vidéo pour le moment.</p>}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? 'Enregistrement…' : 'Enregistrer les médias'}
      </Button>
    </div>
  );
}

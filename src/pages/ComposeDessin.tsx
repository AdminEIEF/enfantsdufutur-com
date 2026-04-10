import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/components/AppLayout';
import { Save, Eye, Palette, Shapes, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const CANVAS_W = 500;
const CANVAS_H = 400;
const CELL = 40;
const GRID_COLOR = '#e5e7eb';

type ShapeType = 'square' | 'circle' | 'triangle' | 'rectangle' | 'star' | '';
type ColorName = 'rouge' | 'bleu' | 'vert' | 'jaune' | 'orange' | 'violet' | 'noir' | '';

const SHAPE_KEYWORDS: Record<string, ShapeType> = {
  'carré': 'square', 'carre': 'square',
  'rond': 'circle', 'cercle': 'circle',
  'triangle': 'triangle',
  'rectangle': 'rectangle',
  'étoile': 'star', 'etoile': 'star',
};

const COLOR_KEYWORDS: Record<string, string> = {
  'rouge': '#ef4444', 'red': '#ef4444',
  'bleu': '#2563eb', 'blue': '#2563eb',
  'vert': '#22c55e', 'green': '#22c55e',
  'jaune': '#eab308', 'yellow': '#eab308',
  'orange': '#f97316',
  'violet': '#8b5cf6', 'purple': '#8b5cf6',
  'noir': '#1f2937', 'black': '#1f2937',
  'rose': '#ec4899', 'pink': '#ec4899',
};

function parseConsigne(text: string): { shape: ShapeType; color: string; colorName: string } {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let shape: ShapeType = '';
  let color = '#2563eb';
  let colorName = 'bleu';

  for (const [kw, s] of Object.entries(SHAPE_KEYWORDS)) {
    const norm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(norm)) { shape = s; break; }
  }
  for (const [kw, c] of Object.entries(COLOR_KEYWORDS)) {
    if (lower.includes(kw)) { color = c; colorName = kw; break; }
  }
  return { shape, color, colorName };
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
}

export default function ComposeDessin() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [consigne, setConsigne] = useState('');
  const [titre, setTitre] = useState('');
  const [classeId, setClasseId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<{ shape: ShapeType; color: string; colorName: string }>({ shape: '', color: '#2563eb', colorName: 'bleu' });

  // Load primary classes
  useEffect(() => {
    supabase
      .from('classes')
      .select('id, nom, niveaux!inner(id, nom, cycles!inner(id, nom))')
      .then(({ data }) => {
        const primary = (data || []).filter((c: any) =>
          ['Crèche', 'Maternelle', 'Primaire'].includes(c.niveaux?.cycles?.nom)
        );
        setClasses(primary);
      });
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= CANVAS_W; x += CELL) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += CELL) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }
  }, []);

  // Real-time preview
  useEffect(() => {
    const p = parseConsigne(consigne);
    setParsed(p);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawGrid(ctx);

    if (!p.shape) return;

    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const size = 120;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;

    if (p.shape === 'square') {
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    } else if (p.shape === 'circle') {
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx - size / 2, cy + size / 2);
      ctx.lineTo(cx + size / 2, cy + size / 2);
      ctx.closePath(); ctx.fill();
    } else if (p.shape === 'rectangle') {
      ctx.fillRect(cx - size, cy - size / 3, size * 2, size * 2 / 3);
    } else if (p.shape === 'star') {
      drawStar(ctx, cx, cy, 5, size / 2, size / 4);
      ctx.fill();
    }
  }, [consigne, drawGrid]);

  const handleSave = async () => {
    if (!titre.trim() || !classeId || !parsed.shape) {
      toast.error('Remplis le titre, la classe et une consigne valide (ex: "carré bleu")');
      return;
    }
    setSaving(true);
    try {
      const shapeParams = `shape=${parsed.shape}&color=${encodeURIComponent(parsed.color)}`;

      const { error } = await supabase.from('compositions').insert({
        titre,
        classe_id: classeId,
        matiere_id: classes[0]?.niveaux?.id || classeId, // fallback
        type_composition: 'dessin',
        description: consigne,
        date_debut: new Date().toISOString(),
        date_fin: new Date(Date.now() + 7 * 86400000).toISOString(),
        duree_minutes: 30,
        publie: false,
        sujet_url: shapeParams,
      });

      if (error) throw error;
      toast.success('✅ Sujet de dessin enregistré !');
      setTitre('');
      setConsigne('');
      setClasseId('');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const examples = [
    { text: 'carré bleu', emoji: '🟦' },
    { text: 'rond rouge', emoji: '🔴' },
    { text: 'triangle vert', emoji: '🟢' },
    { text: 'étoile jaune', emoji: '⭐' },
    { text: 'rectangle orange', emoji: '🟧' },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Header */}
        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5">
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7" />
              Créer un sujet de Dessin
            </h1>
            <p className="text-white/80 text-sm mt-1">
              Écris une consigne et le système génère automatiquement le modèle visuel
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shapes className="h-5 w-5 text-violet-500" />
                  Paramètres du sujet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-1 block">Titre de la composition</label>
                  <Input
                    value={titre}
                    onChange={e => setTitre(e.target.value)}
                    placeholder="Ex: Dessiner une forme géométrique"
                    className="rounded-xl h-12 text-base"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-1 block">Classe</label>
                  <Select value={classeId} onValueChange={setClasseId}>
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="Choisir une classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom} — {c.niveaux?.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-1 block">
                    <Palette className="h-4 w-4 inline mr-1" />
                    Consigne textuelle
                  </label>
                  <Textarea
                    value={consigne}
                    onChange={e => setConsigne(e.target.value)}
                    placeholder="Ex: carré bleu"
                    className="rounded-xl text-base min-h-[80px]"
                  />
                </div>

                {/* Quick examples */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Exemples rapides :</p>
                  <div className="flex flex-wrap gap-2">
                    {examples.map(ex => (
                      <Button
                        key={ex.text}
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        onClick={() => setConsigne(ex.text)}
                      >
                        {ex.emoji} {ex.text}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Detected */}
                {parsed.shape && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 space-y-2">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">✅ Détecté :</p>
                    <div className="flex gap-2">
                      <Badge className="bg-violet-100 text-violet-700">
                        Forme: {parsed.shape}
                      </Badge>
                      <Badge style={{ backgroundColor: parsed.color + '20', color: parsed.color }}>
                        Couleur: {parsed.colorName}
                      </Badge>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving || !parsed.shape}
                  className="w-full rounded-2xl h-14 text-base font-bold bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg gap-2"
                >
                  <Save className="h-5 w-5" />
                  {saving ? 'Enregistrement...' : 'Enregistrer le sujet'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  Aperçu en temps réel
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="border-4 border-dashed border-violet-200 rounded-2xl bg-white p-1">
                  <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    className="max-w-full h-auto rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>

            {/* How students see it */}
            <Card className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <CardContent className="p-4">
                <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-2 text-sm">
                  👁️ Ce que verra l'élève :
                </h3>
                <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <p>1. Le modèle généré (ci-dessus) s'affichera en haut</p>
                  <p>2. Un quadrillage vide en dessous pour reproduire</p>
                  <p>3. Outils : Crayon ✏️, Gomme 🧼, Règle 📏</p>
                  <p>4. Bouton "Envoyer ma copie" pour soumettre</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

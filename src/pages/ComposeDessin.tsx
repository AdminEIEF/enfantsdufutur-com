import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/components/AppLayout';
import { Save, Eye, Palette, Shapes, Sparkles, Paintbrush, Eraser, Trash2, Volume2, CheckCircle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

// ─── CANVAS CONSTANTS ───
const GRID_SIZE = 10;
const CELL_PX = 40;
const CANVAS_SIZE = GRID_SIZE * CELL_PX; // 400x400
const GRID_COLOR = '#e2e8f0';

// ─── SHAPE & COLOR DETECTION ───
type ShapeType = 'square' | 'circle' | 'triangle' | 'rectangle' | 'star' | '';

const SHAPE_KEYWORDS: Record<string, ShapeType> = {
  'carre': 'square', 'carré': 'square',
  'rond': 'circle', 'cercle': 'circle',
  'triangle': 'triangle',
  'rectangle': 'rectangle',
  'etoile': 'star', 'étoile': 'star',
};

const COLOR_KEYWORDS: Record<string, string> = {
  'rouge': '#ef4444', 'bleu': '#2563eb', 'vert': '#22c55e',
  'jaune': '#eab308', 'orange': '#f97316', 'violet': '#8b5cf6',
  'noir': '#1f2937', 'rose': '#ec4899',
};

function parseConsigne(text: string): { shape: ShapeType; color: string; colorName: string; filled: boolean } {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let shape: ShapeType = '';
  let color = '#2563eb';
  let colorName = 'bleu';
  const filled = lower.includes('rempli') || lower.includes('plein');

  for (const [kw, s] of Object.entries(SHAPE_KEYWORDS)) {
    const norm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(norm)) { shape = s; break; }
  }
  for (const [kw, c] of Object.entries(COLOR_KEYWORDS)) {
    if (lower.includes(kw)) { color = c; colorName = kw; break; }
  }
  return { shape, color, colorName, filled };
}

// ─── DRAW HELPERS ───
function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * CELL_PX;
    ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, CANVAS_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(CANVAS_SIZE, pos); ctx.stroke();
  }
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

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeType, color: string, filled: boolean) {
  if (!shape) return;
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const size = CELL_PX * 4; // 4 cells

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;

  const doFill = (pathFn: () => void) => {
    pathFn();
    if (filled) ctx.fill(); else ctx.stroke();
  };

  switch (shape) {
    case 'square':
      if (filled) ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      else ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
      break;
    case 'circle':
      doFill(() => { ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.closePath(); });
      break;
    case 'triangle':
      doFill(() => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - size / 2);
        ctx.lineTo(cx - size / 2, cy + size / 2);
        ctx.lineTo(cx + size / 2, cy + size / 2);
        ctx.closePath();
      });
      break;
    case 'rectangle':
      if (filled) ctx.fillRect(cx - size, cy - size / 3, size * 2, size * 2 / 3);
      else ctx.strokeRect(cx - size, cy - size / 3, size * 2, size * 2 / 3);
      break;
    case 'star':
      drawStar(ctx, cx, cy, 5, size / 2, size / 4);
      if (filled) ctx.fill(); else ctx.stroke();
      break;
  }
}

// ─── MODEL CANVAS (read-only) ───
function ModelCanvas({ consigne }: { consigne: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parsed = parseConsigne(consigne);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawGrid(ctx);
    drawShape(ctx, parsed.shape, parsed.color, parsed.filled);
  }, [consigne]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      className="max-w-full h-auto rounded-2xl border-4 border-dashed border-violet-200 bg-white"
    />
  );
}

// ─── DRAWING CANVAS (interactive) ───
function DrawingCanvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) {
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState('#2563eb');
  const isDrawing = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawGrid(ctx);
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scale, y: (e.touches[0].clientY - rect.top) * scale };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scale, y: ((e as React.MouseEvent).clientY - rect.top) * scale };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : penColor;
    ctx.lineWidth = tool === 'eraser' ? 24 : 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawGrid(ctx);
  };

  const colors = ['#2563eb', '#ef4444', '#22c55e', '#eab308', '#f97316', '#8b5cf6', '#ec4899', '#1f2937'];

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="max-w-full h-auto rounded-2xl border-4 border-dashed border-emerald-200 bg-white cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      {/* Tools */}
      <div className="flex items-center gap-2 justify-center flex-wrap">
        <Button
          size="lg"
          variant={tool === 'pen' ? 'default' : 'outline'}
          className="rounded-2xl h-12 px-5 font-bold text-sm"
          onClick={() => setTool('pen')}
        >
          <Paintbrush className="h-5 w-5 mr-1" /> ✏️ Crayon
        </Button>
        <Button
          size="lg"
          variant={tool === 'eraser' ? 'default' : 'outline'}
          className="rounded-2xl h-12 px-5 font-bold text-sm"
          onClick={() => setTool('eraser')}
        >
          <Eraser className="h-5 w-5 mr-1" /> 🧼 Gomme
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="rounded-2xl h-12 px-5 font-bold text-sm border-destructive text-destructive hover:bg-destructive/10"
          onClick={clearCanvas}
        >
          <Trash2 className="h-5 w-5 mr-1" /> 🗑️
        </Button>
      </div>
      {/* Colors */}
      <div className="flex gap-2 justify-center">
        {colors.map(c => (
          <button
            key={c}
            className={`w-9 h-9 rounded-full border-4 transition-transform ${penColor === c && tool === 'pen' ? 'scale-125 border-foreground shadow-lg' : 'border-transparent'}`}
            style={{ background: c }}
            onClick={() => { setPenColor(c); setTool('pen'); }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── TTS BUTTON ───
function TTSButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);

  const speak = () => {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 0.8;
    u.pitch = 1.1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  return (
    <motion.button
      onClick={speak}
      animate={speaking ? { rotate: [0, -8, 8, -8, 8, 0] } : {}}
      transition={speaking ? { duration: 0.6, repeat: Infinity } : {}}
      className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl transition-shadow"
      title="Écouter la consigne"
    >
      <Volume2 className="h-7 w-7" />
    </motion.button>
  );
}

// ─── PIXEL COMPARISON ───
function compareCanvases(modelCanvas: HTMLCanvasElement, drawingCanvas: HTMLCanvasElement, expectedColor: string): { colorMatch: number; shapeMatch: number } {
  const modelCtx = modelCanvas.getContext('2d')!;
  const drawCtx = drawingCanvas.getContext('2d')!;
  const modelData = modelCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
  const drawData = drawCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;

  // Parse expected color
  const tmp = document.createElement('canvas').getContext('2d')!;
  tmp.fillStyle = expectedColor;
  tmp.fillRect(0, 0, 1, 1);
  const [er, eg, eb] = tmp.getImageData(0, 0, 1, 1).data;

  let modelColorPx = 0;
  let drawColorPx = 0;
  let modelShapePx = 0;
  let drawShapePx = 0;
  let overlapPx = 0;
  const tolerance = 60;

  for (let i = 0; i < modelData.length; i += 4) {
    const mr = modelData[i], mg = modelData[i + 1], mb = modelData[i + 2];
    const dr = drawData[i], dg = drawData[i + 1], db = drawData[i + 2];

    const isModelShape = !(mr > 220 && mg > 220 && mb > 220) && !(Math.abs(mr - mg) < 10 && Math.abs(mg - mb) < 10 && mr > 200);
    const isDrawShape = !(dr > 220 && dg > 220 && db > 220) && !(Math.abs(dr - dg) < 10 && Math.abs(dg - db) < 10 && dr > 200);

    if (isModelShape) modelShapePx++;
    if (isDrawShape) {
      drawShapePx++;
      if (Math.abs(dr - er) < tolerance && Math.abs(dg - eg) < tolerance && Math.abs(db - eb) < tolerance) {
        drawColorPx++;
      }
    }
    if (isModelShape && isDrawShape) overlapPx++;
  }

  const colorMatch = drawShapePx > 0 ? Math.round((drawColorPx / drawShapePx) * 100) : 0;
  const union = modelShapePx + drawShapePx - overlapPx;
  const shapeMatch = union > 0 ? Math.round((overlapPx / union) * 100) : 0;

  return { colorMatch, shapeMatch };
}

// ─── MAIN PAGE ───
export default function ComposeDessin() {
  const modelCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [consigne, setConsigne] = useState('');
  const [titre, setTitre] = useState('');
  const [classeId, setClasseId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [comparison, setComparison] = useState<{ colorMatch: number; shapeMatch: number } | null>(null);
  const [activeTab, setActiveTab] = useState('creer');

  const parsed = parseConsigne(consigne);

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

  const handleSave = async () => {
    if (!titre.trim() || !classeId || !parsed.shape) {
      toast.error('Remplis le titre, la classe et une consigne valide');
      return;
    }
    setSaving(true);
    try {
      const shapeParams = `shape=${parsed.shape}&color=${encodeURIComponent(parsed.color)}&filled=${parsed.filled}`;
      const { error } = await supabase.from('compositions').insert({
        titre,
        classe_id: classeId,
        matiere_id: classes[0]?.niveaux?.id || classeId,
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
      setTitre(''); setConsigne(''); setClasseId('');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleCompare = () => {
    // Build a temporary model canvas for comparison
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = CANVAS_SIZE;
    tmpCanvas.height = CANVAS_SIZE;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    drawGrid(tmpCtx);
    drawShape(tmpCtx, parsed.shape, parsed.color, parsed.filled);

    if (!drawCanvasRef.current) return;
    const result = compareCanvases(tmpCanvas, drawCanvasRef.current, parsed.color);
    setComparison(result);
    if (result.shapeMatch > 50 && result.colorMatch > 50) {
      toast.success(`🎉 Bravo ! Forme: ${result.shapeMatch}% — Couleur: ${result.colorMatch}%`);
    } else {
      toast('📊 Résultat : Forme ' + result.shapeMatch + '% — Couleur ' + result.colorMatch + '%');
    }
  };

  const examples = [
    { text: 'carré bleu rempli', emoji: '🟦' },
    { text: 'rond rouge', emoji: '🔴' },
    { text: 'triangle vert rempli', emoji: '🟢' },
    { text: 'étoile jaune', emoji: '⭐' },
    { text: 'rectangle orange rempli', emoji: '🟧' },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-3">
                <Sparkles className="h-7 w-7" />
                Générateur de Sujet Visuel
              </h1>
              <p className="text-white/80 text-sm mt-1">
                Créez des sujets interactifs — les élèves reproduisent le modèle
              </p>
            </div>
            <TTSButton text={consigne || 'Écris une consigne pour activer la lecture audio'} />
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-2xl h-12 bg-muted/50 p-1">
            <TabsTrigger value="creer" className="rounded-xl text-sm font-bold px-6 data-[state=active]:bg-background data-[state=active]:shadow">
              ✏️ Créer un sujet
            </TabsTrigger>
            <TabsTrigger value="preview" className="rounded-xl text-sm font-bold px-6 data-[state=active]:bg-background data-[state=active]:shadow">
              👁️ Aperçu élève
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB: CRÉER ─── */}
          <TabsContent value="creer" className="mt-4">
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
                      <label className="text-sm font-semibold text-muted-foreground mb-1 block">Titre</label>
                      <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex: Dessiner une forme géométrique" className="rounded-xl h-12 text-base" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-muted-foreground mb-1 block">Classe</label>
                      <Select value={classeId} onValueChange={setClasseId}>
                        <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                        <SelectContent>
                          {classes.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.nom} — {c.niveaux?.nom}</SelectItem>
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
                        placeholder="Ex: Dessine un grand rond rouge rempli"
                        className="rounded-xl text-base min-h-[80px]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 Mots reconnus : carré, rond, triangle, rectangle, étoile + couleurs + "rempli" pour forme pleine
                      </p>
                    </div>

                    {/* Quick examples */}
                    <div className="flex flex-wrap gap-2">
                      {examples.map(ex => (
                        <Button key={ex.text} variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setConsigne(ex.text)}>
                          {ex.emoji} {ex.text}
                        </Button>
                      ))}
                    </div>

                    {/* Detection badges */}
                    {parsed.shape && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 space-y-2">
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">✅ Détecté :</p>
                        <div className="flex gap-2 flex-wrap">
                          <Badge className="bg-violet-100 text-violet-700">Forme: {parsed.shape}</Badge>
                          <Badge style={{ backgroundColor: parsed.color + '20', color: parsed.color }}>Couleur: {parsed.colorName}</Badge>
                          <Badge className={parsed.filled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                            {parsed.filled ? '● Rempli' : '○ Contour'}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <Button onClick={handleSave} disabled={saving || !parsed.shape} className="w-full rounded-2xl h-14 text-base font-bold bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg gap-2">
                      <Save className="h-5 w-5" />
                      {saving ? 'Enregistrement...' : 'Enregistrer le sujet'}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Model Preview */}
              <div className="space-y-4">
                <Card className="rounded-2xl shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="h-5 w-5 text-blue-500" />
                      Aperçu du modèle (10×10)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <ModelCanvas consigne={consigne} />
                  </CardContent>
                </Card>
                <Card className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                  <CardContent className="p-4">
                    <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-2 text-sm">👁️ Ce que verra l'élève :</h3>
                    <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                      <p>1. Le modèle généré en haut (lecture seule)</p>
                      <p>2. Un quadrillage vide pour reproduire le dessin</p>
                      <p>3. Outils : Crayon ✏️, Gomme 🧼, Couleurs</p>
                      <p>4. 🔊 Bouton audio pour écouter la consigne</p>
                      <p>5. 📊 Bouton "Comparer" pour vérifier forme & couleur</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ─── TAB: APERÇU ÉLÈVE ─── */}
          <TabsContent value="preview" className="mt-4">
            <div className="max-w-xl mx-auto space-y-6">
              {/* Consigne + TTS */}
              <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 flex items-center gap-3">
                  <h3 className="text-xl font-black text-white flex-1">
                    🎨 {consigne || 'Écris une consigne dans l\'onglet "Créer"'}
                  </h3>
                  <TTSButton text={consigne} />
                </div>
              </Card>

              {/* Model (read-only) */}
              <Card className="rounded-2xl shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    📌 MODÈLE à reproduire
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ModelCanvas consigne={consigne} />
                </CardContent>
              </Card>

              {/* Drawing canvas */}
              <Card className="rounded-2xl shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    ✍️ Ta zone de dessin
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <DrawingCanvas canvasRef={drawCanvasRef} />
                </CardContent>
              </Card>

              {/* Compare button */}
              <Button onClick={handleCompare} disabled={!parsed.shape} className="w-full rounded-2xl h-14 text-lg font-black bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg gap-2">
                <BarChart3 className="h-6 w-6" />
                📊 Comparer mon dessin
              </Button>

              {/* Results */}
              {comparison && (
                <Card className="rounded-2xl shadow-lg border-2 border-emerald-200">
                  <CardContent className="p-5">
                    <h3 className="text-lg font-black text-center mb-4">📊 Résultat de la comparaison</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20">
                        <p className="text-xs font-bold text-muted-foreground mb-1">Forme</p>
                        <p className={`text-4xl font-black ${comparison.shapeMatch > 50 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {comparison.shapeMatch}%
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20">
                        <p className="text-xs font-bold text-muted-foreground mb-1">Couleur</p>
                        <p className={`text-4xl font-black ${comparison.colorMatch > 50 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {comparison.colorMatch}%
                        </p>
                      </div>
                    </div>
                    {comparison.shapeMatch > 50 && comparison.colorMatch > 50 && (
                      <div className="mt-4 text-center">
                        <span className="text-3xl">🎉</span>
                        <p className="font-bold text-emerald-600 mt-1">Excellent travail !</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

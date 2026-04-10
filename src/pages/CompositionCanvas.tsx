import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Eraser, Trash2, Ruler, Send, Undo2 } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

type Tool = 'pencil' | 'eraser' | 'ruler';

const GRID_COLOR = '#e5e7eb';
const DRAW_COLOR = '#2563eb';
const ERASER_SIZE = 20;

export default function CompositionCanvas() {
  const { session } = useStudentAuth();
  const [searchParams] = useSearchParams();
  const compositionId = searchParams.get('id');
  const modelData = searchParams.get('model'); // shape params from compose-dessin

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const CELL = 40;

  // Draw grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += CELL) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += CELL) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }, []);

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx, CANVAS_W, CANVAS_H);
    saveState();
  }, [drawGrid]);

  // Draw model if provided
  useEffect(() => {
    if (!modelData || !modelCanvasRef.current) return;
    const ctx = modelCanvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx, CANVAS_W, CANVAS_H);

    try {
      const params = new URLSearchParams(modelData);
      const shape = params.get('shape');
      const color = params.get('color') || '#2563eb';
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      const size = 120;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      if (shape === 'square') {
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      } else if (shape === 'circle') {
        ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
      } else if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(cx, cy - size / 2);
        ctx.lineTo(cx - size / 2, cy + size / 2);
        ctx.lineTo(cx + size / 2, cy + size / 2);
        ctx.closePath(); ctx.fill();
      } else if (shape === 'rectangle') {
        ctx.fillRect(cx - size, cy - size / 3, size * 2, size * 2 / 3);
      } else if (shape === 'star') {
        drawStar(ctx, cx, cy, 5, size / 2, size / 4);
        ctx.fill();
      }
    } catch {}
  }, [modelData, drawGrid]);

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

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setHistory(prev => [...prev.slice(-20), ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)]);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prev = history[history.length - 2];
    ctx.putImageData(prev, 0, 0);
    setHistory(h => h.slice(0, -1));
  };

  const clearAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx, CANVAS_W, CANVAS_H);
    saveState();
  };

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (tool === 'ruler') {
      setRulerStart(pos);
      setIsDrawing(true);
      return;
    }
    setIsDrawing(true);
    lastPos.current = pos;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);

    if (tool === 'ruler') return; // wait for pointerUp

    if (tool === 'pencil') {
      ctx.strokeStyle = DRAW_COLOR;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (lastPos.current) {
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    } else if (tool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ERASER_SIZE, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Redraw grid underneath
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawGrid(ctx, CANVAS_W, CANVAS_H);
      ctx.restore();
    }
    lastPos.current = pos;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'ruler' && rulerStart) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pos = getPos(e);
          ctx.strokeStyle = DRAW_COLOR;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(rulerStart.x, rulerStart.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      }
      setRulerStart(null);
    }

    lastPos.current = null;
    saveState();
  };

  const handleSubmit = async () => {
    if (!session || !canvasRef.current) return;
    setSending(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      
      const token = localStorage.getItem('student_token') || '';
      const res = await supabase.functions.invoke('student-data', {
        body: {
          token,
          action: 'submit_exam',
          composition_id: compositionId,
          dessin_url: dataUrl,
        },
      });
      if (res.error) throw res.error;
      toast.success('🎉 Copie envoyée avec succès !');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  // Prevent scroll on touch
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest?.('canvas')) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: 'pencil', icon: Pencil, label: 'Crayon' },
    { id: 'ruler', icon: Ruler, label: 'Règle' },
    { id: 'eraser', icon: Eraser, label: 'Gomme' },
  ];

  return (
    <StudentLayout>
      <div className="max-w-5xl mx-auto p-3 space-y-4">
        {/* Header */}
        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              🎨 Composition de Dessin
            </h1>
            <p className="text-white/80 text-sm mt-1">
              Utilise les outils pour dessiner ta réponse sur le quadrillage
            </p>
          </div>
        </Card>

        {/* Model display if provided */}
        {modelData && (
          <Card className="rounded-3xl border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-400 to-teal-400 px-5 py-3">
              <h2 className="text-lg font-bold text-white">📌 Modèle à reproduire</h2>
            </div>
            <CardContent className="p-3 flex justify-center">
              <div className="border-4 border-dashed border-emerald-300 rounded-2xl bg-white p-1 overflow-auto">
                <canvas
                  ref={modelCanvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="max-w-full h-auto rounded-xl"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 justify-center">
          {tools.map(t => (
            <Button
              key={t.id}
              variant={tool === t.id ? 'default' : 'outline'}
              className={`rounded-2xl h-14 px-6 text-base font-bold gap-2 transition-all ${
                tool === t.id
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'border-2 hover:border-blue-300'
              }`}
              onClick={() => setTool(t.id)}
            >
              <t.icon className="h-6 w-6" />
              {t.label}
            </Button>
          ))}

          <div className="w-px h-10 bg-border mx-1" />

          <Button
            variant="outline"
            className="rounded-2xl h-14 px-5 font-bold text-base border-2"
            onClick={undo}
            disabled={history.length < 2}
          >
            <Undo2 className="h-5 w-5 mr-1" /> Annuler
          </Button>

          <Button
            variant="outline"
            className="rounded-2xl h-14 px-5 font-bold text-base border-2 border-destructive text-destructive hover:bg-destructive/10"
            onClick={clearAll}
          >
            <Trash2 className="h-5 w-5 mr-1" /> Tout effacer
          </Button>
        </div>

        {/* Mode indicator */}
        <div className="text-center">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
            tool === 'ruler'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : tool === 'eraser'
              ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          }`}>
            {tool === 'pencil' && '✏️ Mode Dessin libre'}
            {tool === 'ruler' && '📏 Mode Règle — Touche un point et glisse'}
            {tool === 'eraser' && '🧼 Mode Gomme — Glisse pour effacer'}
          </span>
        </div>

        {/* Canvas */}
        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
          <CardContent className="p-3 flex justify-center">
            <div className="border-4 border-dashed border-indigo-300 rounded-2xl bg-white p-1 touch-none overflow-auto">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="max-w-full h-auto cursor-crosshair rounded-xl"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{ touchAction: 'none' }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-center pb-6">
          <Button
            onClick={handleSubmit}
            disabled={sending}
            className="rounded-2xl h-16 px-10 text-lg font-black bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-xl gap-3"
          >
            <Send className="h-6 w-6" />
            {sending ? 'Envoi en cours...' : 'Envoyer ma copie'}
          </Button>
        </div>
      </div>
    </StudentLayout>
  );
}

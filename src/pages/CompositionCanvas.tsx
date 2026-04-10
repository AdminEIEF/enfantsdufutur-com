import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Eraser, Trash2, Ruler, Send, Undo2, CheckCircle } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type Tool = 'pencil' | 'eraser' | 'ruler';

const GRID_COLOR = '#e5e7eb';
const DRAW_COLOR = '#2563eb';
const ERASER_SIZE = 20;

// ─── Reference point types ───
interface RefPoint {
  label: string;
  col: number;
  row: number;
  px: number;
  py: number;
}

interface RequiredConnection {
  from: string;
  to: string;
}

// ─── Parse consigne for reference points (e.g. "Relie A à B puis B à C") ───
function parseRefPoints(consigne: string, cellSize: number, gridCols: number, gridRows: number): {
  points: RefPoint[];
  connections: RequiredConnection[];
} {
  if (!consigne) return { points: [], connections: [] };

  // Extract letters mentioned like A, B, C, D...
  const letterMatches = consigne.match(/\b([A-Z])\b/g);
  if (!letterMatches || letterMatches.length < 2) return { points: [], connections: [] };

  const uniqueLetters = [...new Set(letterMatches)];

  // Predefined grid positions for labeled points (spread across the grid)
  const positions: [number, number][] = [
    [3, 2], [7, 3], [5, 7], [2, 5], [8, 6],
    [4, 1], [6, 4], [1, 8], [9, 1], [8, 8],
  ];

  const points: RefPoint[] = uniqueLetters.map((letter, i) => {
    const [col, row] = positions[i % positions.length];
    return {
      label: letter,
      col,
      row,
      px: col * cellSize,
      py: row * cellSize,
    };
  });

  // Extract connections: "A à B", "B à C", "A-B", etc.
  const connections: RequiredConnection[] = [];
  // Pattern: letter followed by à/a/vers/- and another letter
  const connPatterns = [
    /([A-Z])\s*(?:à|a|vers|-|→)\s*([A-Z])/g,
    /(?:relie|relier|trace|tracer|dessine)\s+([A-Z])\s+(?:à|a|et|vers|-)\s+([A-Z])/gi,
  ];
  for (const pat of connPatterns) {
    let m;
    while ((m = pat.exec(consigne)) !== null) {
      const from = m[1].toUpperCase();
      const to = m[2].toUpperCase();
      if (!connections.find(c => (c.from === from && c.to === to) || (c.from === to && c.to === from))) {
        connections.push({ from, to });
      }
    }
  }

  // If no explicit connections found but letters exist, create sequential connections
  if (connections.length === 0 && uniqueLetters.length >= 2) {
    for (let i = 0; i < uniqueLetters.length - 1; i++) {
      connections.push({ from: uniqueLetters[i], to: uniqueLetters[i + 1] });
    }
  }

  return { points, connections };
}

// ─── Snap detection ───
const SNAP_RADIUS = 20; // 20px invisible detection zone

function snapToPoint(x: number, y: number, points: RefPoint[]): RefPoint | null {
  for (const p of points) {
    const d = Math.sqrt((x - p.px) ** 2 + (y - p.py) ** 2);
    if (d <= SNAP_RADIUS) return p;
  }
  return null;
}

// ─── Check if a line connects two points ───
function checkConnection(
  x1: number, y1: number, x2: number, y2: number,
  points: RefPoint[],
): { from: string; to: string } | null {
  const fromPt = snapToPoint(x1, y1, points);
  const toPt = snapToPoint(x2, y2, points);
  if (fromPt && toPt && fromPt.label !== toPt.label) {
    return { from: fromPt.label, to: toPt.label };
  }
  return null;
}

export default function CompositionCanvas() {
  const { session } = useStudentAuth();
  const [searchParams] = useSearchParams();
  const compositionId = searchParams.get('id');
  const modelData = searchParams.get('model');
  const consigne = searchParams.get('consigne') || '';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [completedConnections, setCompletedConnections] = useState<Set<string>>(new Set());
  const [flashPoint, setFlashPoint] = useState<string | null>(null);

  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const CELL = 40;

  // Parse reference points from consigne
  const { points: refPoints, connections: requiredConnections } = useMemo(
    () => parseRefPoints(consigne, CELL, CANVAS_W / CELL, CANVAS_H / CELL),
    [consigne]
  );

  const hasRefPoints = refPoints.length > 0;

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

  // Draw reference points on canvas
  const drawRefPoints = useCallback((ctx: CanvasRenderingContext2D, completed: Set<string>) => {
    refPoints.forEach(p => {
      const isCompleted = completed.has(p.label);
      // Outer ring (snap zone indicator - subtle)
      ctx.beginPath();
      ctx.arc(p.px, p.py, SNAP_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isCompleted ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.03)';
      ctx.fill();

      // Main dot
      ctx.beginPath();
      ctx.arc(p.px, p.py, 8, 0, Math.PI * 2);
      ctx.fillStyle = isCompleted ? '#22c55e' : '#1f2937';
      ctx.fill();
      ctx.strokeStyle = isCompleted ? '#16a34a' : '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // White inner dot
      ctx.beginPath();
      ctx.arc(p.px, p.py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Label
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isCompleted ? '#16a34a' : '#1f2937';
      ctx.fillText(p.label, p.px + 14, p.py - 2);

      // Green checkmark if completed
      if (isCompleted) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#22c55e';
        ctx.fillText('✓', p.px + 14, p.py + 14);
      }
    });
  }, [refPoints]);

  // Full redraw (grid + points)
  const fullRedraw = useCallback((ctx: CanvasRenderingContext2D, imgData?: ImageData) => {
    if (imgData) {
      ctx.putImageData(imgData, 0, 0);
    }
    // Always redraw points on top
    drawRefPoints(ctx, completedConnections);
  }, [drawRefPoints, completedConnections]);

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx, CANVAS_W, CANVAS_H);
    drawRefPoints(ctx, completedConnections);
    saveState();
  }, [drawGrid, drawRefPoints]);

  // Redraw points when completed connections change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasRefPoints) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Re-overlay points
    drawRefPoints(ctx, completedConnections);
  }, [completedConnections, drawRefPoints, hasRefPoints]);

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

      // Also draw reference points on the model canvas
      if (refPoints.length > 0) {
        refPoints.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.px, p.py, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#1f2937';
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.px, p.py, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#1f2937';
          ctx.fillText(p.label, p.px + 14, p.py - 2);
        });

        // Draw required connections on model
        requiredConnections.forEach(conn => {
          const fromPt = refPoints.find(p => p.label === conn.from);
          const toPt = refPoints.find(p => p.label === conn.to);
          if (fromPt && toPt) {
            ctx.strokeStyle = '#0891b2';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(fromPt.px, fromPt.py);
            ctx.lineTo(toPt.px, toPt.py);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      }
    } catch {}
  }, [modelData, drawGrid, refPoints, requiredConnections]);

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
    drawRefPoints(ctx, completedConnections);
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
    drawRefPoints(ctx, new Set());
    setCompletedConnections(new Set());
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

    // Snap start position to nearest reference point
    if (hasRefPoints && tool === 'ruler') {
      const snapped = snapToPoint(pos.x, pos.y, refPoints);
      if (snapped) {
        setRulerStart({ x: snapped.px, y: snapped.py });
        setIsDrawing(true);
        return;
      }
    }

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

    if (tool === 'ruler') return;

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
          let endPos = getPos(e);

          // Snap end position to nearest reference point
          if (hasRefPoints) {
            const snapped = snapToPoint(endPos.x, endPos.y, refPoints);
            if (snapped) {
              endPos = { x: snapped.px, y: snapped.py };
            }
          }

          ctx.strokeStyle = DRAW_COLOR;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(rulerStart.x, rulerStart.y);
          ctx.lineTo(endPos.x, endPos.y);
          ctx.stroke();

          // Check if this line connects two reference points
          if (hasRefPoints) {
            const conn = checkConnection(rulerStart.x, rulerStart.y, endPos.x, endPos.y, refPoints);
            if (conn) {
              // Check if this matches a required connection
              const isRequired = requiredConnections.some(
                rc => (rc.from === conn.from && rc.to === conn.to) ||
                      (rc.from === conn.to && rc.to === conn.from)
              );
              if (isRequired) {
                const key = [conn.from, conn.to].sort().join('-');
                setCompletedConnections(prev => {
                  const next = new Set(prev);
                  next.add(conn.from);
                  next.add(conn.to);
                  return next;
                });
                // Flash both points
                setFlashPoint(conn.from);
                setTimeout(() => setFlashPoint(conn.to), 300);
                setTimeout(() => setFlashPoint(null), 800);
              }
            }
          }

          // Redraw points on top
          drawRefPoints(ctx, completedConnections);
        }
      }
      setRulerStart(null);
    }

    lastPos.current = null;
    saveState();
  };

  // Calculate score
  const score = useMemo(() => {
    if (requiredConnections.length === 0) return null;
    let matched = 0;
    requiredConnections.forEach(rc => {
      const k1 = completedConnections.has(rc.from) && completedConnections.has(rc.to);
      if (k1) matched++;
    });
    return { matched, total: requiredConnections.length };
  }, [completedConnections, requiredConnections]);

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
          score: score ? `${score.matched}/${score.total}` : undefined,
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

        {/* Consigne with reference points info */}
        {consigne && (
          <Card className="rounded-3xl border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-violet-400 to-purple-400 px-5 py-3">
              <h2 className="text-lg font-bold text-white">📌 Consigne</h2>
            </div>
            <CardContent className="p-4">
              <p className="text-base font-semibold text-center">{consigne}</p>
              {hasRefPoints && (
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  {refPoints.map(p => (
                    <span
                      key={p.label}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-all duration-300 ${
                        completedConnections.has(p.label)
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {completedConnections.has(p.label) && <CheckCircle className="h-4 w-4" />}
                      Point {p.label}
                    </span>
                  ))}
                </div>
              )}
              {score && (
                <div className="mt-3 text-center">
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                    score.matched === score.total
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                  }`}>
                    {score.matched === score.total ? '✅' : '⏳'} {score.matched}/{score.total} liaison{score.total > 1 ? 's' : ''} correcte{score.total > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
            {tool === 'ruler' && (hasRefPoints
              ? '📏 Mode Règle — Touche un point repère et glisse vers un autre'
              : '📏 Mode Règle — Touche un point et glisse'
            )}
            {tool === 'eraser' && '🧼 Mode Gomme — Glisse pour effacer'}
          </span>
        </div>

        {/* Canvas with flash overlay */}
        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden relative">
          <CardContent className="p-3 flex justify-center relative">
            <div className="border-4 border-dashed border-indigo-300 rounded-2xl bg-white p-1 touch-none overflow-auto relative">
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
              {/* Green flash overlay when a point is connected */}
              <AnimatePresence>
                {flashPoint && (
                  <motion.div
                    key={flashPoint}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.5 }}
                    transition={{ duration: 0.4 }}
                    className="absolute top-4 right-4 bg-green-500 text-white rounded-full px-4 py-2 font-bold text-lg shadow-lg flex items-center gap-2 pointer-events-none"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Point {flashPoint} ✓
                  </motion.div>
                )}
              </AnimatePresence>
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

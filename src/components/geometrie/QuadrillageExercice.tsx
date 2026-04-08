import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Volume2, Undo2, Trash2 } from 'lucide-react';

interface Props {
  onCapture: (dataUrl: string) => void;
  speak: (text: string) => void;
}

const GRID = 5;
const DOT_R = 6;
const CELL = 56;
const PAD = 28;
const SIZE = PAD * 2 + GRID * CELL;

// Model: a simple house drawn on the grid
const MODEL_LINES: [number, number, number, number][] = [
  // walls
  [1, 4, 3, 4], [1, 4, 1, 2], [3, 4, 3, 2],
  // roof
  [1, 2, 2, 1], [2, 1, 3, 2],
  // door
  [2, 4, 2, 3],
];

function gridToPixel(col: number, row: number): [number, number] {
  return [PAD + col * CELL, PAD + row * CELL];
}

function findNearestDot(x: number, y: number): [number, number] | null {
  for (let r = 0; r <= GRID; r++) {
    for (let c = 0; c <= GRID; c++) {
      const [px, py] = gridToPixel(c, r);
      const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (d < 22) return [c, r];
    }
  }
  return null;
}

function GridDots({ highlight }: { highlight?: [number, number] | null }) {
  const dots = [];
  for (let r = 0; r <= GRID; r++) {
    for (let c = 0; c <= GRID; c++) {
      const [px, py] = gridToPixel(c, r);
      const isHighlighted = highlight && highlight[0] === c && highlight[1] === r;
      dots.push(
        <circle key={`${c}-${r}`} cx={px} cy={py} r={isHighlighted ? DOT_R + 2 : DOT_R}
          fill={isHighlighted ? '#6366f1' : '#94a3b8'} stroke={isHighlighted ? '#4f46e5' : 'transparent'} strokeWidth={2}
          className="transition-all duration-150" />
      );
    }
  }
  return <>{dots}</>;
}

export function QuadrillageExercice({ onCapture, speak }: Props) {
  const [lines, setLines] = useState<[number, number, number, number][]>([]);
  const [startDot, setStartDot] = useState<[number, number] | null>(null);
  const [tempEnd, setTempEnd] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getEventPos = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = getEventPos(e);
    const dot = findNearestDot(pos.x, pos.y);
    if (dot) {
      setStartDot(dot);
      (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startDot) return;
    const pos = getEventPos(e);
    setTempEnd(pos);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!startDot) return;
    const pos = getEventPos(e);
    const endDot = findNearestDot(pos.x, pos.y);
    if (endDot && (endDot[0] !== startDot[0] || endDot[1] !== startDot[1])) {
      setLines(prev => [...prev, [startDot[0], startDot[1], endDot[0], endDot[1]]]);
    }
    setStartDot(null);
    setTempEnd(null);
  };

  const undo = () => setLines(prev => prev.slice(0, -1));
  const clearAll = () => setLines([]);

  // Capture as data URL whenever lines change
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.drawImage(img, 0, 0);
        onCapture(canvas.toDataURL('image/png'));
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [lines, onCapture]);

  return (
    <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-400 to-blue-400 px-6 py-4 flex items-center justify-between">
        <h3 className="text-xl font-black text-white flex items-center gap-2">
          🪄 Quadrillage Magique
        </h3>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-white/20 hover:bg-white/30 text-white"
          onClick={() => speak('Reproduis le dessin sur le quadrillage de droite. Touche un point et glisse vers un autre pour tracer un trait droit.')}>
          <Volume2 className="h-5 w-5" />
        </Button>
      </div>
      <CardContent className="p-4 space-y-4">
        <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl p-3">
          <p className="text-center text-base font-bold text-cyan-700 dark:text-cyan-300" style={{ fontFamily: 'Nunito, sans-serif' }}>
            📌 Reproduis le modèle à gauche sur le quadrillage de droite !
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          {/* Zone A: Model */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Modèle</span>
            <div className="border-4 border-dashed border-cyan-300 rounded-2xl bg-white p-1">
              <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                <GridDots />
                {MODEL_LINES.map(([c1, r1, c2, r2], i) => {
                  const [x1, y1] = gridToPixel(c1, r1);
                  const [x2, y2] = gridToPixel(c2, r2);
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0891b2" strokeWidth={4} strokeLinecap="round" />;
                })}
              </svg>
            </div>
          </div>

          {/* Zone B: Drawing area */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ton tracé</span>
            <div className="border-4 border-dashed border-indigo-300 rounded-2xl bg-white p-1 touch-none">
              <svg ref={svgRef} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="cursor-crosshair"
              >
                <GridDots highlight={startDot} />
                {lines.map(([c1, r1, c2, r2], i) => {
                  const [x1, y1] = gridToPixel(c1, r1);
                  const [x2, y2] = gridToPixel(c2, r2);
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366f1" strokeWidth={4} strokeLinecap="round" />;
                })}
                {startDot && tempEnd && (() => {
                  const [sx, sy] = gridToPixel(startDot[0], startDot[1]);
                  return <line x1={sx} y1={sy} x2={tempEnd.x} y2={tempEnd.y}
                    stroke="#a78bfa" strokeWidth={3} strokeDasharray="6 4" strokeLinecap="round" />;
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-3 justify-center">
          <Button variant="outline" className="rounded-2xl h-12 px-5 font-bold text-base border-2" onClick={undo} disabled={lines.length === 0}>
            <Undo2 className="h-5 w-5 mr-2" /> Annuler
          </Button>
          <Button variant="outline" className="rounded-2xl h-12 px-5 font-bold text-base border-2 border-destructive text-destructive hover:bg-destructive/10" onClick={clearAll} disabled={lines.length === 0}>
            <Trash2 className="h-5 w-5 mr-2" /> Tout effacer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onScoreChange: (score: number) => void;
  speak: (text: string) => void;
}

type ShapeName = 'CARRÉ' | 'TRIANGLE' | 'ROND' | 'RECTANGLE';

const SHAPES: { name: ShapeName; color: string }[] = [
  { name: 'CARRÉ', color: '#ef4444' },
  { name: 'TRIANGLE', color: '#3b82f6' },
  { name: 'ROND', color: '#f59e0b' },
  { name: 'RECTANGLE', color: '#8b5cf6' },
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ShapeSVG({ name, size = 64, color }: { name: ShapeName; size?: number; color: string }) {
  const s = size;
  switch (name) {
    case 'CARRÉ':
      return <rect x={s * 0.15} y={s * 0.15} width={s * 0.7} height={s * 0.7} fill={color} rx={4} />;
    case 'TRIANGLE':
      return <polygon points={`${s / 2},${s * 0.1} ${s * 0.1},${s * 0.9} ${s * 0.9},${s * 0.9}`} fill={color} />;
    case 'ROND':
      return <circle cx={s / 2} cy={s / 2} r={s * 0.4} fill={color} />;
    case 'RECTANGLE':
      return <rect x={s * 0.08} y={s * 0.25} width={s * 0.84} height={s * 0.5} fill={color} rx={4} />;
  }
}

export function RelierFormesExercice({ onScoreChange, speak }: Props) {
  const [shuffledShapes] = useState(() => shuffleArray(SHAPES));
  const [matches, setMatches] = useState<Record<ShapeName, boolean>>({} as any);
  const [dragging, setDragging] = useState<ShapeName | null>(null);
  const [dragLine, setDragLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [errorFlash, setErrorFlash] = useState<ShapeName | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shapeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [matchedLines, setMatchedLines] = useState<{ name: ShapeName; x1: number; y1: number; x2: number; y2: number }[]>([]);

  const score = Object.values(matches).filter(Boolean).length;

  useEffect(() => {
    onScoreChange(score);
  }, [score, onScoreChange]);

  const getCenter = (el: HTMLElement | null) => {
    if (!el || !containerRef.current) return { x: 0, y: 0 };
    const cr = containerRef.current.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    return { x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 };
  };

  const handlePointerDown = (name: ShapeName) => (e: React.PointerEvent) => {
    if (matches[name]) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(name);
    const center = getCenter(wordRefs.current[name]);
    setDragLine({ x1: center.x, y1: center.y, x2: center.x, y2: center.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    setDragLine(prev => prev ? { ...prev, x2: e.clientX - cr.left, y2: e.clientY - cr.top } : null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    const px = e.clientX - cr.left;
    const py = e.clientY - cr.top;

    // Check if pointer is over any shape target
    let found: ShapeName | null = null;
    for (const shape of shuffledShapes) {
      const el = shapeRefs.current[shape.name];
      if (!el) continue;
      const er = el.getBoundingClientRect();
      const relLeft = er.left - cr.left;
      const relTop = er.top - cr.top;
      if (px >= relLeft && px <= relLeft + er.width && py >= relTop && py <= relTop + er.height) {
        found = shape.name;
        break;
      }
    }

    if (found === dragging) {
      // Correct match!
      setMatches(prev => ({ ...prev, [dragging]: true }));
      const wordCenter = getCenter(wordRefs.current[dragging]);
      const shapeCenter = getCenter(shapeRefs.current[dragging]);
      setMatchedLines(prev => [...prev, { name: dragging, x1: wordCenter.x, y1: wordCenter.y, x2: shapeCenter.x, y2: shapeCenter.y }]);
    } else if (found) {
      // Wrong match - vibration
      setErrorFlash(found);
      if ('vibrate' in navigator) navigator.vibrate(200);
      setTimeout(() => setErrorFlash(null), 500);
    }

    setDragging(null);
    setDragLine(null);
  };

  return (
    <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-4 flex items-center justify-between">
        <h3 className="text-xl font-black text-white flex items-center gap-2">
          🔗 Relier les Formes
        </h3>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white font-bold text-sm">{score}/4</Badge>
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-white/20 hover:bg-white/30 text-white"
            onClick={() => speak('Relie chaque mot à sa forme géométrique. Tire un trait avec ton doigt du mot vers la bonne forme.')}>
            <Volume2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <CardContent className="p-6">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 mb-4">
          <p className="text-center text-base font-bold text-emerald-700 dark:text-emerald-300" style={{ fontFamily: 'Nunito, sans-serif' }}>
            👆 Tire un trait du mot vers la bonne forme !
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative select-none touch-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ minHeight: 360 }}
        >
          {/* SVG overlay for lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {matchedLines.map(ml => (
              <line key={ml.name} x1={ml.x1} y1={ml.y1} x2={ml.x2} y2={ml.y2}
                stroke="#10b981" strokeWidth={4} strokeLinecap="round" />
            ))}
            {dragLine && (
              <line x1={dragLine.x1} y1={dragLine.y1} x2={dragLine.x2} y2={dragLine.y2}
                stroke="#6366f1" strokeWidth={3} strokeDasharray="8 4" strokeLinecap="round" />
            )}
          </svg>

          <div className="flex justify-between items-stretch gap-4">
            {/* Left column - words */}
            <div className="flex flex-col gap-5 justify-center w-2/5">
              {SHAPES.map(shape => (
                <motion.div
                  key={shape.name}
                  ref={el => { wordRefs.current[shape.name] = el; }}
                  onPointerDown={handlePointerDown(shape.name)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative z-20 flex items-center justify-center h-16 rounded-2xl border-4 font-black text-lg cursor-grab active:cursor-grabbing transition-all ${
                    matches[shape.name]
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700'
                      : 'border-muted bg-white dark:bg-card hover:border-indigo-300 hover:shadow-md text-foreground'
                  }`}
                  style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                  {shape.name}
                  {matches[shape.name] && <Check className="h-5 w-5 ml-2 text-emerald-500" />}
                </motion.div>
              ))}
            </div>

            {/* Right column - shapes (shuffled) */}
            <div className="flex flex-col gap-5 justify-center w-2/5">
              {shuffledShapes.map(shape => (
                <motion.div
                  key={shape.name}
                  ref={el => { shapeRefs.current[shape.name] = el; }}
                  animate={errorFlash === shape.name ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`relative z-20 flex items-center justify-center h-16 rounded-2xl border-4 transition-all ${
                    matches[shape.name]
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                      : errorFlash === shape.name
                        ? 'border-destructive bg-destructive/10'
                        : 'border-muted bg-white dark:bg-card'
                  }`}
                >
                  <svg width={64} height={64} viewBox="0 0 64 64">
                    <ShapeSVG name={shape.name} size={64} color={shape.color} />
                  </svg>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eraser, PenTool, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const LETTERS_MAJ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LETTERS_MIN = 'abcdefghijklmnopqrstuvwxyz'.split('');
const NUMBERS = '0123456789'.split('');

type Category = 'majuscules' | 'minuscules' | 'chiffres';

const CATEGORIES: { key: Category; label: string; items: string[] }[] = [
  { key: 'majuscules', label: '🔤 Majuscules', items: LETTERS_MAJ },
  { key: 'minuscules', label: '🔡 Minuscules', items: LETTERS_MIN },
  { key: 'chiffres', label: '🔢 Chiffres', items: NUMBERS },
];

export default function StudentEcriture() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [category, setCategory] = useState<Category>('majuscules');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [penColor, setPenColor] = useState('#1e40af');
  const [penSize, setPenSize] = useState(4);

  const currentItems = CATEGORIES.find(c => c.key === category)!.items;
  const currentLetter = currentItems[currentIndex];

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw guide letter (faded)
    ctx.font = 'bold 280px "Nunito", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentLetter, canvas.width / 2, canvas.height / 2);
    // Draw guidelines
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [currentLetter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      const size = Math.min(parent.clientWidth - 16, 400);
      canvas.width = size;
      canvas.height = size;
    }
    clearCanvas();
  }, [clearCanvas, category, currentIndex]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const prev = () => setCurrentIndex(i => (i - 1 + currentItems.length) % currentItems.length);
  const next = () => setCurrentIndex(i => (i + 1) % currentItems.length);

  const colors = ['#1e40af', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

  return (
    <StudentLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
          <PenTool className="h-6 w-6 text-blue-600" /> Apprendre à écrire ✏️
        </h2>

        {/* Category selector */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <Button
              key={cat.key}
              size="sm"
              variant={category === cat.key ? 'default' : 'outline'}
              className={category === cat.key ? 'bg-blue-600' : ''}
              onClick={() => { setCategory(cat.key); setCurrentIndex(0); }}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-center flex items-center justify-center gap-4">
              <Button size="icon" variant="outline" className="rounded-full" onClick={prev}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-6xl font-bold text-blue-600" style={{ fontFamily: 'Nunito, sans-serif' }}>
                {currentLetter}
              </span>
              <Button size="icon" variant="outline" className="rounded-full" onClick={next}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              Trace la lettre avec ton doigt ou ta souris !
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {/* Canvas */}
            <div className="w-full flex justify-center">
              <canvas
                ref={canvasRef}
                className="border-2 border-dashed border-blue-300 rounded-2xl bg-white cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="flex gap-1">
                {colors.map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${penColor === c ? 'scale-110 border-foreground' : 'border-transparent'}`}
                    style={{ background: c }}
                    onClick={() => setPenColor(c)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Taille:</span>
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={penSize}
                  onChange={e => setPenSize(Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <Button variant="outline" size="sm" onClick={clearCanvas}>
                <Eraser className="h-4 w-4 mr-1" /> Effacer
              </Button>
              <Button variant="outline" size="sm" onClick={() => { next(); }}>
                <RotateCcw className="h-4 w-4 mr-1" /> Suivante
              </Button>
            </div>

            {/* Letter grid */}
            <div className="flex flex-wrap gap-1 justify-center pt-2">
              {currentItems.map((letter, idx) => (
                <button
                  key={letter}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                    idx === currentIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted hover:bg-muted-foreground/10'
                  }`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {letter}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </StudentLayout>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Palette, RotateCcw, Trophy, Timer, Star, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const COLORS: Record<string, string> = {
  A: '#e53e3e', B: '#dd6b20', C: '#d69e2e', D: '#38a169',
  E: '#319795', F: '#3182ce', G: '#5a67d8', H: '#805ad5',
  I: '#d53f8c', J: '#e53e3e', K: '#dd6b20', L: '#38a169',
  M: '#d69e2e', N: '#3182ce', O: '#e53e3e', P: '#805ad5',
  Q: '#319795', R: '#d53f8c', S: '#38a169', T: '#dd6b20',
  U: '#5a67d8', V: '#d69e2e', W: '#3182ce', X: '#e53e3e',
  Y: '#38a169', Z: '#805ad5',
};

function pickRandomLetters(count: number): string[] {
  const shuffled = [...ALPHABET].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateGrid(targets: string[], size: number): string[] {
  const grid: string[] = [];
  // Ensure each target appears at least 3 times
  for (const t of targets) {
    for (let i = 0; i < 3; i++) grid.push(t);
  }
  // Fill remaining with targets randomly
  while (grid.length < size) {
    grid.push(targets[Math.floor(Math.random() * targets.length)]);
  }
  return grid.sort(() => Math.random() - 0.5);
}

type Difficulty = 'facile' | 'moyen' | 'difficile';

const DIFFICULTY_CONFIG: Record<Difficulty, { letterCount: number; gridSize: number; label: string; emoji: string }> = {
  facile: { letterCount: 3, gridSize: 20, label: 'Facile', emoji: '🌟' },
  moyen: { letterCount: 4, gridSize: 30, label: 'Moyen', emoji: '⭐' },
  difficile: { letterCount: 5, gridSize: 36, label: 'Difficile', emoji: '🏆' },
};

export default function StudentColoriage() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [grid, setGrid] = useState<string[]>([]);
  const [colored, setColored] = useState<Record<number, boolean>>({});
  const [currentTarget, setCurrentTarget] = useState(0);
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [shake, setShake] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (running && !finished) {
      intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, finished]);

  const startGame = useCallback((diff: Difficulty) => {
    const config = DIFFICULTY_CONFIG[diff];
    const letters = pickRandomLetters(config.letterCount);
    const newGrid = generateGrid(letters, config.gridSize);
    setDifficulty(diff);
    setTargets(letters);
    setGrid(newGrid);
    setColored({});
    setCurrentTarget(0);
    setTimer(0);
    setScore(0);
    setErrors(0);
    setFinished(false);
    setShowResult(false);
    setRunning(true);
  }, []);

  const targetLetter = targets[currentTarget];

  const totalForTarget = grid.filter(l => l === targetLetter).length;
  const coloredForTarget = Object.entries(colored).filter(
    ([idx, val]) => val && grid[Number(idx)] === targetLetter
  ).length;

  const handleCellClick = (index: number) => {
    if (finished || colored[index]) return;

    const letter = grid[index];
    if (letter === targetLetter) {
      const newColored = { ...colored, [index]: true };
      setColored(newColored);
      setScore(s => s + 10);

      // Check if all of this target are found
      const newColoredForTarget = Object.entries(newColored).filter(
        ([idx, val]) => val && grid[Number(idx)] === targetLetter
      ).length;

      if (newColoredForTarget >= totalForTarget) {
        // Move to next target
        if (currentTarget + 1 >= targets.length) {
          setFinished(true);
          setRunning(false);
          setShowResult(true);
        } else {
          setCurrentTarget(ct => ct + 1);
        }
      }
    } else {
      setErrors(e => e + 1);
      setScore(s => Math.max(0, s - 5));
      setShake(index);
      setTimeout(() => setShake(null), 500);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const stars = errors === 0 ? 3 : errors <= 3 ? 2 : 1;

  // Menu screen
  if (!difficulty) {
    return (
      <StudentLayout>
        <div className="space-y-6 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-center" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <Palette className="inline h-7 w-7 text-primary mr-2" />
            Colorie les lettres ! 🎨
          </h2>
          <p className="text-center text-muted-foreground text-sm">
            Trouve et colorie toutes les lettres demandées le plus vite possible !
          </p>
          <div className="grid gap-4">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(([key, conf]) => (
              <motion.div key={key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  className="w-full h-16 text-lg font-bold rounded-2xl"
                  variant={key === 'facile' ? 'default' : 'outline'}
                  onClick={() => startGame(key)}
                >
                  {conf.emoji} {conf.label} — {conf.letterCount} lettres
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="space-y-3 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <Palette className="h-5 w-5 text-primary" /> Colorie les lettres
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1 text-base px-3 py-1">
              <Timer className="h-4 w-4" /> {formatTime(timer)}
            </Badge>
            <Badge variant="secondary" className="gap-1 text-base px-3 py-1">
              <Star className="h-4 w-4" /> {score}
            </Badge>
          </div>
        </div>

        {/* Legend - color key */}
        <Card className="border-2 border-primary/20">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Légende des couleurs :</p>
            <div className="flex gap-3 flex-wrap justify-center">
              {targets.map((letter, i) => (
                <motion.div
                  key={letter}
                  className="flex flex-col items-center gap-1"
                  animate={i === currentTarget ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md ${i === currentTarget ? 'ring-4 ring-offset-2 ring-primary' : 'opacity-60'}`}
                    style={{ backgroundColor: COLORS[letter], fontFamily: 'Nunito, sans-serif' }}
                  >
                    {letter}
                  </div>
                  {i === currentTarget && (
                    <span className="text-[10px] font-bold text-primary">À trouver !</span>
                  )}
                  {i < currentTarget && (
                    <span className="text-[10px] text-green-600 font-bold">✅</span>
                  )}
                </motion.div>
              ))}
            </div>
            {!finished && (
              <p className="text-center text-sm mt-2 font-semibold" style={{ color: COLORS[targetLetter] }}>
                Trouve tous les « {targetLetter} » ! ({coloredForTarget}/{totalForTarget})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Grid */}
        <Card>
          <CardContent className="p-3">
            <div
              className="grid gap-2 justify-center"
              style={{
                gridTemplateColumns: `repeat(${difficulty === 'facile' ? 5 : 6}, minmax(0, 1fr))`,
              }}
            >
              {grid.map((letter, idx) => {
                const isColored = colored[idx];
                const color = COLORS[letter];
                const isShaking = shake === idx;

                return (
                  <motion.button
                    key={idx}
                    className={`aspect-square rounded-full border-2 flex items-center justify-center font-bold text-lg transition-all ${
                      isColored
                        ? 'text-white shadow-lg scale-95'
                        : 'bg-background border-border hover:border-primary/50 hover:shadow-sm text-foreground'
                    }`}
                    style={{
                      backgroundColor: isColored ? color : undefined,
                      borderColor: isColored ? color : undefined,
                      fontFamily: 'Nunito, sans-serif',
                      maxWidth: 52,
                      maxHeight: 52,
                    }}
                    onClick={() => handleCellClick(idx)}
                    animate={isShaking ? { x: [-4, 4, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    whileTap={!isColored ? { scale: 0.85 } : {}}
                    disabled={finished}
                  >
                    {letter}
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => startGame(difficulty)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Recommencer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDifficulty(null)}>
            Changer niveau
          </Button>
        </div>

        {/* Result dialog */}
        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent className="text-center max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center justify-center gap-2">
                <Trophy className="h-7 w-7 text-yellow-500" /> Bravo ! 🎉
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3].map(s => (
                      <Star
                        key={s}
                        className={`h-8 w-8 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`}
                      />
                    ))}
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    Temps : {formatTime(timer)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Score : <span className="font-bold text-primary">{score}</span> • Erreurs : <span className="font-bold text-destructive">{errors}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stars === 3 ? 'Parfait ! Aucune erreur ! 🌟' : stars === 2 ? 'Très bien ! Continue comme ça ! ⭐' : 'Bon effort ! Essaie encore ! 💪'}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={() => startGame(difficulty)} className="w-full">
                <RotateCcw className="h-4 w-4 mr-1" /> Rejouer
              </Button>
              <Button variant="outline" onClick={() => { setShowResult(false); setDifficulty(null); }} className="w-full">
                Changer niveau
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StudentLayout>
  );
}

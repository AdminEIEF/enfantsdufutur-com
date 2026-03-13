import { useState, useEffect, useCallback, useRef } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Palette, RotateCcw, Trophy, Timer, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

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

/** Returns the base uppercase letter for color lookup */
function baseLetter(l: string): string {
  return l.toUpperCase();
}

/**
 * Generate grid mixing uppercase and lowercase versions of target letters.
 * The target letter (used for matching) is always uppercase,
 * but the displayed letter can be upper or lower randomly.
 */
function generateGrid(targets: string[], size: number): { display: string; base: string }[] {
  const cells: { display: string; base: string }[] = [];

  // Ensure each target appears at least 3 times (mix of cases)
  for (const t of targets) {
    cells.push({ display: t, base: t }); // uppercase
    cells.push({ display: t.toLowerCase(), base: t }); // lowercase
    cells.push({ display: Math.random() > 0.5 ? t : t.toLowerCase(), base: t }); // random
  }

  // Fill remaining
  while (cells.length < size) {
    const t = targets[Math.floor(Math.random() * targets.length)];
    const display = Math.random() > 0.5 ? t : t.toLowerCase();
    cells.push({ display, base: t });
  }

  return cells.sort(() => Math.random() - 0.5);
}

type Difficulty = 'facile' | 'moyen' | 'difficile';

const DIFFICULTY_CONFIG: Record<Difficulty, { letterCount: number; gridSize: number; label: string; emoji: string }> = {
  facile: { letterCount: 3, gridSize: 20, label: 'Facile', emoji: '🌟' },
  moyen: { letterCount: 4, gridSize: 30, label: 'Moyen', emoji: '⭐' },
  difficile: { letterCount: 5, gridSize: 36, label: 'Difficile', emoji: '🏆' },
};

export default function StudentColoriage() {
  const isMobile = useIsMobile();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [grid, setGrid] = useState<{ display: string; base: string }[]>([]);
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

  const totalForTarget = grid.filter(c => c.base === targetLetter).length;
  const coloredForTarget = Object.entries(colored).filter(
    ([idx, val]) => val && grid[Number(idx)].base === targetLetter
  ).length;

  const handleCellClick = (index: number) => {
    if (finished || colored[index]) return;
    const cell = grid[index];
    if (cell.base === targetLetter) {
      const newColored = { ...colored, [index]: true };
      setColored(newColored);
      setScore(s => s + 10);
      const newColoredForTarget = Object.entries(newColored).filter(
        ([idx, val]) => val && grid[Number(idx)].base === targetLetter
      ).length;
      if (newColoredForTarget >= totalForTarget) {
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

  // Responsive grid columns
  const getGridCols = () => {
    if (difficulty === 'facile') return isMobile ? 4 : 5;
    return isMobile ? 5 : 6;
  };

  // Menu screen
  if (!difficulty) {
    return (
      <StudentLayout>
        <div className="space-y-6 max-w-lg mx-auto px-3 sm:px-0">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
              <Palette className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: 'Nunito, sans-serif' }}>
              Colorie les lettres ! 🎨
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-xs mx-auto">
              Trouve et colorie toutes les lettres (majuscules et minuscules) le plus vite possible !
            </p>
          </div>
          <div className="grid gap-3">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(([key, conf]) => (
              <motion.div key={key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Button
                  className="w-full h-14 sm:h-16 text-base sm:text-lg font-bold rounded-2xl"
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
      <div className="space-y-2 sm:space-y-3 max-w-2xl mx-auto px-2 sm:px-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-lg font-bold flex items-center gap-1.5 text-foreground" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <span className="hidden sm:inline">Colorie les lettres</span>
            <span className="sm:hidden">Lettres</span>
          </h2>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Badge variant="outline" className="gap-1 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-base">
              <Timer className="h-3 w-3 sm:h-4 sm:w-4" /> {formatTime(timer)}
            </Badge>
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-base">
              <Star className="h-3 w-3 sm:h-4 sm:w-4" /> {score}
            </Badge>
          </div>
        </div>

        {/* Legend */}
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardContent className="py-2.5 sm:py-3 px-3 sm:px-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 font-medium">Légende (Aa = majuscule + minuscule) :</p>
            <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
              {targets.map((letter, i) => (
                <motion.div
                  key={letter}
                  className="flex flex-col items-center gap-0.5"
                  animate={i === currentTarget ? { scale: [1, 1.12, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-xl shadow-md transition-all ${
                      i === currentTarget ? 'ring-3 sm:ring-4 ring-offset-2 ring-primary' : 'opacity-50'
                    }`}
                    style={{ backgroundColor: COLORS[letter], fontFamily: 'Nunito, sans-serif' }}
                  >
                    {letter}{letter.toLowerCase()}
                  </div>
                  {i === currentTarget && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-primary whitespace-nowrap">À trouver !</span>
                  )}
                  {i < currentTarget && (
                    <span className="text-[9px] sm:text-[10px] text-green-600 font-bold">✅</span>
                  )}
                </motion.div>
              ))}
            </div>
            {!finished && (
              <p className="text-center text-xs sm:text-sm mt-1.5 font-semibold" style={{ color: COLORS[targetLetter] }}>
                Trouve tous les « {targetLetter} » et « {targetLetter.toLowerCase()} » ! ({coloredForTarget}/{totalForTarget})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Grid */}
        <Card className="shadow-sm">
          <CardContent className="p-2 sm:p-3">
            <div
              className="grid gap-1.5 sm:gap-2 justify-items-center mx-auto"
              style={{
                gridTemplateColumns: `repeat(${getGridCols()}, minmax(0, 1fr))`,
                maxWidth: isMobile ? '100%' : 420,
              }}
            >
              {grid.map((cell, idx) => {
                const isColored = colored[idx];
                const color = COLORS[cell.base];
                const isShaking = shake === idx;
                const isUpper = cell.display === cell.display.toUpperCase();

                return (
                  <motion.button
                    key={idx}
                    className={`aspect-square w-full rounded-full border-2 flex items-center justify-center font-bold transition-all select-none ${
                      isColored
                        ? 'text-white shadow-lg'
                        : 'bg-background border-border hover:border-primary/40 hover:shadow-sm text-foreground active:scale-90'
                    } ${isUpper ? 'text-sm sm:text-lg' : 'text-base sm:text-xl italic'}`}
                    style={{
                      backgroundColor: isColored ? color : undefined,
                      borderColor: isColored ? color : undefined,
                      fontFamily: 'Nunito, sans-serif',
                      maxWidth: isMobile ? 48 : 52,
                      maxHeight: isMobile ? 48 : 52,
                    }}
                    onClick={() => handleCellClick(idx)}
                    animate={isShaking ? { x: [-4, 4, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    whileTap={!isColored ? { scale: 0.85 } : {}}
                    disabled={finished}
                  >
                    {cell.display}
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 justify-center pb-2">
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => startGame(difficulty)}>
            <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> Recommencer
          </Button>
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setDifficulty(null)}>
            Changer niveau
          </Button>
        </div>

        {/* Result dialog */}
        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent className="text-center max-w-[90vw] sm:max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-500" /> Bravo ! 🎉
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 sm:space-y-3 pt-2">
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3].map(s => (
                      <Star
                        key={s}
                        className={`h-7 w-7 sm:h-8 sm:w-8 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`}
                      />
                    ))}
                  </div>
                  <p className="text-base sm:text-lg font-bold text-foreground">
                    Temps : {formatTime(timer)}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Score : <span className="font-bold text-primary">{score}</span> • Erreurs : <span className="font-bold text-destructive">{errors}</span>
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
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

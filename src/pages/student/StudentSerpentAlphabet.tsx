import { useState, useEffect, useRef, useCallback } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Timer, Star, Trophy, RotateCcw, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const SNAKE_COLORS = [
  '#38a169', '#2f855a', '#276749', '#38a169', '#48bb78',
];

const LETTER_COLORS = [
  '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795',
  '#3182ce', '#5a67d8', '#805ad5', '#d53f8c', '#e53e3e',
  '#dd6b20', '#d69e2e', '#38a169', '#319795', '#3182ce',
  '#5a67d8', '#805ad5', '#d53f8c', '#e53e3e', '#dd6b20',
  '#d69e2e', '#38a169', '#319795', '#3182ce', '#5a67d8', '#805ad5',
];

// Snake path layout: zigzag rows
function getSnakePath(): { letter: string; row: number; col: number }[] {
  const cols = 5;
  const path: { letter: string; row: number; col: number }[] = [];
  let idx = 0;
  const totalRows = Math.ceil(ALPHABET.length / cols);

  for (let row = 0; row < totalRows; row++) {
    const isEven = row % 2 === 0;
    for (let c = 0; c < cols; c++) {
      if (idx >= ALPHABET.length) break;
      const col = isEven ? c : cols - 1 - c;
      path.push({ letter: ALPHABET[idx], row, col });
      idx++;
    }
  }
  return path;
}

const SNAKE_PATH = getSnakePath();
const TOTAL_ROWS = Math.ceil(ALPHABET.length / 5);

export default function StudentSerpentAlphabet() {
  const [currentTargetIdx, setCurrentTargetIdx] = useState(0);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [errors, setErrors] = useState(0);
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [mode, setMode] = useState<'sequence' | 'random' | null>(null);
  const [randomOrder, setRandomOrder] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && !finished) {
      intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, finished]);

  const startGame = useCallback((m: 'sequence' | 'random') => {
    setMode(m);
    setCurrentTargetIdx(0);
    setFound(new Set());
    setTimer(0);
    setErrors(0);
    setScore(0);
    setFinished(false);
    setShowResult(false);
    setStarted(true);
    setRunning(true);
    if (m === 'random') {
      const order = [...Array(26).keys()].sort(() => Math.random() - 0.5);
      setRandomOrder(order);
    } else {
      setRandomOrder([]);
    }
  }, []);

  const targetAlphabetIdx = mode === 'random' ? randomOrder[currentTargetIdx] : currentTargetIdx;
  const targetLetter = ALPHABET[targetAlphabetIdx];
  const targetColor = LETTER_COLORS[targetAlphabetIdx];

  const handleClick = (alphabetIdx: number) => {
    if (finished || found.has(alphabetIdx)) return;

    if (alphabetIdx === targetAlphabetIdx) {
      const newFound = new Set(found);
      newFound.add(alphabetIdx);
      setFound(newFound);
      setScore(s => s + 10);
      setCelebrate(alphabetIdx);
      setTimeout(() => setCelebrate(null), 600);

      if (newFound.size >= ALPHABET.length) {
        setFinished(true);
        setRunning(false);
        setTimeout(() => setShowResult(true), 500);
      } else {
        setCurrentTargetIdx(i => i + 1);
      }
    } else {
      setErrors(e => e + 1);
      setScore(s => Math.max(0, s - 5));
      setShake(alphabetIdx);
      setTimeout(() => setShake(null), 500);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const stars = errors === 0 ? 3 : errors <= 3 ? 2 : 1;

  // Menu
  if (!mode) {
    return (
      <StudentLayout>
        <div className="space-y-6 max-w-lg mx-auto text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl"
          >
            🐍
          </motion.div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Nunito, sans-serif' }}>
            Le Serpent de l'Alphabet
          </h2>
          <p className="text-muted-foreground text-sm">
            Une lettre est colorée en haut. Retrouve-la sur le serpent et clique dessus !
          </p>
          <div className="grid gap-4">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button className="w-full h-14 text-lg font-bold rounded-2xl" onClick={() => startGame('sequence')}>
                🔤 Dans l'ordre (A → Z)
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button className="w-full h-14 text-lg font-bold rounded-2xl" variant="outline" onClick={() => startGame('random')}>
                🎲 Dans le désordre
              </Button>
            </motion.div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="space-y-3 max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            🐍 Serpent Alphabet
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 px-3 py-1 text-base">
              <Timer className="h-4 w-4" /> {formatTime(timer)}
            </Badge>
            <Badge variant="secondary" className="gap-1 px-3 py-1 text-base">
              <Star className="h-4 w-4" /> {score}
            </Badge>
          </div>
        </div>

        {/* Target letter */}
        {!finished && (
          <Card className="border-2 border-primary/20">
            <CardContent className="py-4 flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground font-medium">Trouve cette lettre sur le serpent :</p>
              <motion.div
                key={targetLetter}
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-lg"
                style={{ backgroundColor: targetColor, fontFamily: 'Nunito, sans-serif' }}
              >
                {targetLetter}
              </motion.div>
              <p className="text-xs text-muted-foreground">
                {found.size} / {ALPHABET.length} lettres trouvées
              </p>
            </CardContent>
          </Card>
        )}

        {/* Snake grid */}
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            {/* Snake head */}
            <div className="flex justify-center mb-2">
              <div className="relative">
                <div className="w-14 h-10 bg-green-600 rounded-t-full flex items-center justify-center">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
                    </div>
                    <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-2 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
              </div>
            </div>

            {/* Snake body - grid */}
            <div className="space-y-1">
              {Array.from({ length: TOTAL_ROWS }).map((_, rowIdx) => {
                const rowCells = SNAKE_PATH.filter(p => p.row === rowIdx);
                const isEven = rowIdx % 2 === 0;

                return (
                  <div key={rowIdx} className="flex justify-center gap-1">
                    {Array.from({ length: 5 }).map((_, colIdx) => {
                      const cell = rowCells.find(c => c.col === colIdx);
                      if (!cell) return <div key={colIdx} className="w-12 h-12" />;

                      const alphaIdx = ALPHABET.indexOf(cell.letter);
                      const isFound = found.has(alphaIdx);
                      const isTarget = alphaIdx === targetAlphabetIdx && !finished;
                      const isShaking = shake === alphaIdx;
                      const isCelebrating = celebrate === alphaIdx;
                      const segmentColor = SNAKE_COLORS[rowIdx % SNAKE_COLORS.length];

                      return (
                        <motion.button
                          key={colIdx}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border-2 transition-all ${
                            isFound
                              ? 'text-white shadow-inner'
                              : 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-foreground hover:shadow-md'
                          }`}
                          style={{
                            backgroundColor: isFound ? LETTER_COLORS[alphaIdx] : undefined,
                            borderColor: isFound ? LETTER_COLORS[alphaIdx] : undefined,
                            fontFamily: 'Nunito, sans-serif',
                          }}
                          onClick={() => handleClick(alphaIdx)}
                          animate={
                            isShaking
                              ? { x: [-4, 4, -4, 4, 0] }
                              : isCelebrating
                                ? { scale: [1, 1.3, 1] }
                                : isTarget
                                  ? { scale: [1, 1.05, 1] }
                                  : {}
                          }
                          transition={
                            isTarget
                              ? { repeat: Infinity, duration: 1.2 }
                              : { duration: 0.4 }
                          }
                          whileTap={{ scale: 0.85 }}
                          disabled={finished || isFound}
                        >
                          {cell.letter}
                        </motion.button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Snake tail */}
            <div className="flex justify-center mt-1">
              <div className="w-6 h-3 bg-green-600 rounded-b-full" />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => startGame(mode)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Recommencer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode(null)}>
            Menu
          </Button>
        </div>

        {/* Result */}
        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent className="text-center max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center justify-center gap-2">
                <Trophy className="h-7 w-7 text-yellow-500" /> Super ! 🐍🎉
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3].map(s => (
                      <Star key={s} className={`h-8 w-8 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`} />
                    ))}
                  </div>
                  <p className="text-lg font-bold text-foreground">Temps : {formatTime(timer)}</p>
                  <p className="text-sm text-muted-foreground">
                    Score : <span className="font-bold text-primary">{score}</span> • Erreurs : <span className="font-bold text-destructive">{errors}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stars === 3 ? 'Parfait ! Tu connais tout l\'alphabet ! 🌟' : stars === 2 ? 'Très bien ! Continue ! ⭐' : 'Bon effort ! Essaie encore ! 💪'}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={() => startGame(mode)} className="w-full">
                <RotateCcw className="h-4 w-4 mr-1" /> Rejouer
              </Button>
              <Button variant="outline" onClick={() => { setShowResult(false); setMode(null); }} className="w-full">
                Menu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StudentLayout>
  );
}

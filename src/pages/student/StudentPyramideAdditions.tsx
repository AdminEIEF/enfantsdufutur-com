import { useState, useCallback, useMemo } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trophy, RotateCcw, Star, ChevronRight, CheckCircle2, Pyramid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Difficulty = 'facile' | 'moyen' | 'difficile';

interface PyramidPuzzle {
  rows: (number | null)[][];
  solution: number[][];
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; emoji: string; color: string; rows: number; maxBase: number }> = {
  facile: { label: 'Facile', emoji: '🌱', color: 'bg-green-500', rows: 3, maxBase: 10 },
  moyen: { label: 'Moyen', emoji: '🔥', color: 'bg-orange-500', rows: 4, maxBase: 12 },
  difficile: { label: 'Difficile', emoji: '🚀', color: 'bg-red-500', rows: 5, maxBase: 15 },
};

const TOTAL_PUZZLES = 5;

function generatePyramid(numRows: number, maxBase: number): PyramidPuzzle {
  // Generate base row with random numbers
  const solution: number[][] = [];
  const baseRow: number[] = [];
  for (let i = 0; i < numRows; i++) {
    baseRow.push(Math.floor(Math.random() * maxBase) + 1);
  }
  solution.push(baseRow);

  // Build up: each cell = sum of two below
  for (let r = 1; r < numRows; r++) {
    const prev = solution[r - 1];
    const row: number[] = [];
    for (let c = 0; c < prev.length - 1; c++) {
      row.push(prev[c] + prev[c + 1]);
    }
    solution.push(row);
  }

  // Reverse so top is index 0
  solution.reverse();

  // Decide which cells to hide (keep ~40% visible including top)
  const rows: (number | null)[][] = solution.map((row, ri) => 
    row.map((val, ci) => {
      // Always show the top
      if (ri === 0) return val;
      // Always hide some cells in middle rows
      if (ri === solution.length - 1) {
        // Base: hide ~half
        return Math.random() < 0.5 ? null : val;
      }
      // Middle rows: hide ~60%
      return Math.random() < 0.6 ? null : val;
    })
  );

  // Ensure at least 2 cells are hidden total
  let hiddenCount = rows.flat().filter(v => v === null).length;
  if (hiddenCount < 2) {
    // Force hide some middle cells
    for (let ri = 1; ri < rows.length && hiddenCount < 3; ri++) {
      for (let ci = 0; ci < rows[ri].length && hiddenCount < 3; ci++) {
        if (rows[ri][ci] !== null) {
          rows[ri][ci] = null;
          hiddenCount++;
        }
      }
    }
  }

  return { rows, solution };
}

export default function StudentPyramideAdditions() {
  const [difficulty, setDifficulty] = useState<Difficulty>('facile');
  const [playing, setPlaying] = useState(false);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [puzzles, setPuzzles] = useState<PyramidPuzzle[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [currentCorrect, setCurrentCorrect] = useState(false);

  const startGame = useCallback(() => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const ps = Array.from({ length: TOTAL_PUZZLES }, () => generatePyramid(config.rows, config.maxBase));
    setPuzzles(ps);
    setPuzzleIndex(0);
    setScore(0);
    setGameOver(false);
    setPlaying(true);
    setUserAnswers({});
    setChecked(false);
    setCurrentCorrect(false);
  }, [difficulty]);

  const currentPuzzle = puzzles[puzzleIndex];

  const checkAnswers = () => {
    if (!currentPuzzle) return;
    let allCorrect = true;
    currentPuzzle.rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (cell === null) {
          const key = `${ri}-${ci}`;
          const userVal = parseInt(userAnswers[key] || '', 10);
          if (userVal !== currentPuzzle.solution[ri][ci]) {
            allCorrect = false;
          }
        }
      });
    });
    setChecked(true);
    setCurrentCorrect(allCorrect);
    if (allCorrect) setScore(s => s + 1);

    setTimeout(() => {
      if (puzzleIndex + 1 >= TOTAL_PUZZLES) {
        setGameOver(true);
      } else {
        setPuzzleIndex(i => i + 1);
        setUserAnswers({});
        setChecked(false);
        setCurrentCorrect(false);
      }
    }, 1500);
  };

  const getStars = () => {
    if (score >= 5) return 3;
    if (score >= 3) return 2;
    if (score >= 1) return 1;
    return 0;
  };

  // Menu
  if (!playing) {
    return (
      <StudentLayout>
        <div className="space-y-5">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <Pyramid className="h-6 w-6 text-amber-600" /> Pyramide des Additions 🔺
          </h2>

          <Card className="border-2 border-amber-200 bg-amber-50/50">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong>Règle :</strong> Chaque nombre est la <span className="text-amber-700 font-bold">somme</span> de ses deux voisins de l'étage inférieur. 
                Remplis les cases vides ! 🧩
              </p>
              <div className="flex items-center justify-center gap-1 mt-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-8 rounded bg-amber-200 flex items-center justify-center font-bold text-sm">10</div>
                  <div className="flex gap-0.5">
                    <div className="w-12 h-8 rounded bg-amber-300 flex items-center justify-center font-bold text-sm text-amber-800">4</div>
                    <div className="w-12 h-8 rounded bg-amber-300 flex items-center justify-center font-bold text-sm text-amber-800">6</div>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground ml-2">4 + 6 = 10</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Choisis ton niveau :</p>
            <div className="flex gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => (
                <Button
                  key={d}
                  variant={difficulty === d ? 'default' : 'outline'}
                  size="sm"
                  className={difficulty === d ? DIFFICULTY_CONFIG[d].color + ' text-white' : ''}
                  onClick={() => setDifficulty(d)}
                >
                  {DIFFICULTY_CONFIG[d].emoji} {DIFFICULTY_CONFIG[d].label}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={startGame} className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg py-6">
            🏗️ Commencer !
          </Button>
        </div>
      </StudentLayout>
    );
  }

  // Game Over
  if (gameOver) {
    const stars = getStars();
    return (
      <StudentLayout>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="border-2 border-amber-200">
            <CardContent className="py-8 flex flex-col items-center gap-4">
              <Trophy className="h-16 w-16 text-yellow-500" />
              <h2 className="text-2xl font-bold">Résultat</h2>
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <Star key={i} className={`h-10 w-10 ${i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
                ))}
              </div>
              <p className="text-4xl font-bold text-amber-600">{score}/{TOTAL_PUZZLES}</p>
              <p className="text-center text-muted-foreground">
                {score === TOTAL_PUZZLES ? 'Parfait ! Tu es un architecte des nombres ! 🏆' :
                 score >= 3 ? 'Bien joué ! Continue de t\'entraîner ! 💪' :
                 'Pas mal, essaie encore ! 📚'}
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setPlaying(false)}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Menu
                </Button>
                <Button onClick={startGame} className="bg-amber-600 hover:bg-amber-700">
                  <ChevronRight className="h-4 w-4 mr-2" /> Rejouer
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </StudentLayout>
    );
  }

  // Puzzle screen
  const puzzle = currentPuzzle;
  if (!puzzle) return null;

  const allFilled = puzzle.rows.every((row, ri) =>
    row.every((cell, ci) => cell !== null || (userAnswers[`${ri}-${ci}`] || '').trim() !== '')
  );

  return (
    <StudentLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setPlaying(false)}>← Menu</Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{score} ✓</Badge>
            <Badge variant="outline">Pyramide {puzzleIndex + 1}/{TOTAL_PUZZLES}</Badge>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={puzzleIndex}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-amber-200">
              <CardContent className="py-6 flex flex-col items-center gap-2 overflow-x-auto">
                {puzzle.rows.map((row, ri) => (
                  <div key={ri} className="flex gap-1 justify-center">
                    {row.map((cell, ci) => {
                      const key = `${ri}-${ci}`;
                      const isBlank = cell === null;
                      const correctVal = puzzle.solution[ri][ci];
                      const userVal = parseInt(userAnswers[key] || '', 10);
                      const isCorrectAnswer = checked && isBlank && userVal === correctVal;
                      const isWrongAnswer = checked && isBlank && !isNaN(userVal) && userVal !== correctVal;
                      const isMissing = checked && isBlank && isNaN(userVal);

                      if (isBlank) {
                        return (
                          <div key={ci} className="relative">
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={userAnswers[key] || ''}
                              onChange={e => {
                                if (checked) return;
                                setUserAnswers(prev => ({ ...prev, [key]: e.target.value }));
                              }}
                              disabled={checked}
                              className={`w-12 h-10 sm:w-14 sm:h-12 text-center font-bold text-sm sm:text-base p-0 rounded-lg border-2 
                                ${checked 
                                  ? isCorrectAnswer 
                                    ? 'border-green-500 bg-green-50 text-green-700' 
                                    : 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-amber-400 bg-amber-50 focus:border-amber-600'
                                }
                              `}
                              style={{ MozAppearance: 'textfield' }}
                            />
                            {(isWrongAnswer || isMissing) && (
                              <span className="absolute -bottom-4 left-0 right-0 text-[10px] text-center text-red-600 font-bold">
                                {correctVal}
                              </span>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={ci}
                          className="w-12 h-10 sm:w-14 sm:h-12 rounded-lg bg-amber-200 flex items-center justify-center font-bold text-sm sm:text-base text-amber-900 border-2 border-amber-300"
                        >
                          {cell}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {checked && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 mt-4">
                    {currentCorrect ? (
                      <><CheckCircle2 className="h-6 w-6 text-green-500" /><span className="font-bold text-green-600">Bravo ! 🎉</span></>
                    ) : (
                      <span className="font-bold text-red-600">Pas tout à fait... regarde les corrections 🔍</span>
                    )}
                  </motion.div>
                )}

                {!checked && (
                  <Button
                    onClick={checkAnswers}
                    disabled={!allFilled}
                    className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    ✅ Vérifier
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </StudentLayout>
  );
}


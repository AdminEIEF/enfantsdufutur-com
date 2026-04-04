import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, FileText, DollarSign, Download, PenTool, Wallet, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { generateBulletinPaiePDF } from '@/lib/generateBulletinPaiePDF';
import { motion } from 'framer-motion';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function EmployeePaie() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ token: session.token, action: 'dashboard' }),
    }).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [session]);

  if (!session) return null;

  const handleDownload = (b: any) => {
    generateBulletinPaiePDF({
      employe: { nom: session.employe.nom, prenom: session.employe.prenom, matricule: session.employe.matricule, poste: session.employe.poste, categorie: session.employe.categorie, date_embauche: session.employe.date_embauche },
      mois: b.mois, annee: b.annee, salaire_brut: Number(b.salaire_brut), primes: Number(b.primes), retenues: Number(b.retenues), avances_deduites: Number(b.avances_deduites), salaire_net: Number(b.salaire_net), commentaire: b.commentaire, signatureEmploye: b.signature_employe || undefined,
    });
  };

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <FileText className="h-4.5 w-4.5 text-violet-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Bulletins de paie</h2>
          </motion.div>

          {/* Salaire card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 p-5 text-white shadow-xl shadow-emerald-600/20"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-white/60 text-xs font-medium">Salaire de base</p>
                <p className="text-2xl font-bold">{fmtNum(Number(session.employe.salaire_base))} GNF</p>
              </div>
            </div>
          </motion.div>

          {/* Avance en cours */}
          {data?.avances?.filter((a: any) => a.statut === 'approuve' || a.statut === 'en_cours').length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Crédit / Avance en cours</h3>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {data.avances.filter((a: any) => a.statut === 'approuve' || a.statut === 'en_cours').map((a: any) => {
                    const restant = Number(a.montant) - Number(a.montant_rembourse || 0);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-background/60">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{fmtNum(Number(a.montant))} GNF</p>
                          {a.motif && <p className="text-[10px] text-muted-foreground">{a.motif}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Restant</p>
                          <p className="font-bold text-amber-600 text-sm">{fmtNum(restant)} GNF</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Bulletins */}
          {(data?.bulletins || []).length === 0 ? (
            <div className="rounded-2xl bg-card border border-border/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun bulletin disponible</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.bulletins.map((b: any, i: number) => (
                <motion.div key={b.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                  <div className="rounded-2xl bg-card border border-border/40 overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-foreground">{MOIS_NOMS[b.mois]} {b.annee}</h3>
                        {b.signature_employe && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 mt-0.5">
                            <PenTool className="h-3 w-3" /> Signé
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">{fmtNum(Number(b.salaire_net))} GNF</span>
                        <button onClick={() => handleDownload(b)} className="w-9 h-9 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 text-xs">
                          <span className="text-muted-foreground">Brut</span>
                          <span className="font-semibold text-foreground">{fmtNum(Number(b.salaire_brut))}</span>
                        </div>
                        {Number(b.primes) > 0 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/5 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1"><ArrowUp className="h-3 w-3 text-emerald-500" /> Primes</span>
                            <span className="font-semibold text-emerald-600">+{fmtNum(Number(b.primes))}</span>
                          </div>
                        )}
                        {Number(b.retenues) > 0 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-destructive/5 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1"><ArrowDown className="h-3 w-3 text-destructive" /> Retenues</span>
                            <span className="font-semibold text-destructive">-{fmtNum(Number(b.retenues))}</span>
                          </div>
                        )}
                        {Number(b.avances_deduites) > 0 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/5 text-xs">
                            <span className="text-muted-foreground">Avances</span>
                            <span className="font-semibold text-amber-600">-{fmtNum(Number(b.avances_deduites))}</span>
                          </div>
                        )}
                      </div>
                      {b.commentaire && (
                        <p className="text-[10px] text-muted-foreground mt-3 border-l-2 border-emerald-500/30 pl-2 italic">{b.commentaire}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}

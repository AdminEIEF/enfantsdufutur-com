import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Upload, Camera, Edit, KeyRound, RefreshCw, Bus, Users, UserCheck,
  ClipboardList, ChevronRight, GraduationCap, UtensilsCrossed, Heart,
  Phone, Mail, MapPin, Shield, CreditCard, CheckCircle2, XCircle, Wallet
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

type TrancheConfig = { label: string; mois: string[]; montant: number };

const TABS = [
  { key: 'info', label: 'Infos', icon: User, emoji: '👤' },
  { key: 'scolarite', label: 'Scolarité', icon: GraduationCap, emoji: '📚' },
  { key: 'options', label: 'Options', icon: ClipboardList, emoji: '⚙️' },
  { key: 'famille', label: 'Famille', icon: Heart, emoji: '👨‍👩‍👧' },
];

function PasswordSectionModern({ eleve, onUpdate, isSuperviseur }: { eleve: any; onUpdate: () => void; isSuperviseur: boolean }) {
  const [editing, setEditing] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const save = async (pwd: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('eleves').update({ mot_de_passe_eleve: pwd } as any).eq('id', eleve.id);
      if (error) throw error;
      toast({ title: 'Mot de passe mis à jour' });
      setEditing(false);
      setNewPwd('');
      onUpdate();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hasPassword = !!eleve.mot_de_passe_eleve;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Accès Espace Élève</p>
          <p className="text-xs text-muted-foreground">
            {hasPassword ? '✅ Mot de passe configuré' : '⚠️ Non défini'}
          </p>
        </div>
      </div>
      {!isSuperviseur ? (
        <p className="text-xs text-muted-foreground italic pl-10">Seul le superviseur peut gérer les mots de passe.</p>
      ) : editing ? (
        <div className="flex gap-2 items-center pl-10">
          <Input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nouveau mot de passe" className="h-9 text-sm rounded-xl" />
          <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => setNewPwd(generatePassword())}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-9 rounded-xl" disabled={!newPwd.trim() || saving} onClick={() => save(newPwd.trim())}>
            {saving ? '...' : 'OK'}
          </Button>
          <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={() => { setEditing(false); setNewPwd(''); }}>✕</Button>
        </div>
      ) : (
        <div className="flex gap-2 pl-10">
          <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl" onClick={() => setEditing(true)}>
            <Edit className="h-3 w-3 mr-1" /> {hasPassword ? 'Réinitialiser' : 'Définir'}
          </Button>
          {!hasPassword && (
            <Button size="sm" className="h-8 text-xs rounded-xl bg-primary" onClick={() => save(generatePassword())}>
              <KeyRound className="h-3 w-3 mr-1" /> Générer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface EleveDetailSheetProps {
  selected: any;
  onClose: () => void;
  onUpdate: (updatedFields?: Partial<any>) => void;
  isSuperviseur: boolean;
  tranchesConfig: Record<string, TrancheConfig[]>;
  paiementsAll: any[];
  zonesTransport: any[];
  photoInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  startCamera: () => void;
  photoPreview: string | null;
  uploadingPhoto: boolean;
  handleSavePhotoOnly: (eleve: any) => void;
}

export default function EleveDetailSheet({
  selected, onClose, onUpdate, isSuperviseur, tranchesConfig, paiementsAll,
  zonesTransport, photoInputRef, handleFileSelect, startCamera, photoPreview,
  uploadingPhoto, handleSavePhotoOnly,
}: EleveDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('info');
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  if (!selected) return null;

  const niveauId = selected.classes?.niveau_id || null;
  const eleveTranches: TrancheConfig[] = (niveauId && tranchesConfig[niveauId]) ? tranchesConfig[niveauId] : [];
  const elevePaiements = paiementsAll.filter((p: any) => p.eleve_id === selected.id);
  const moisPayes = elevePaiements.map((p: any) => p.mois_concerne).filter(Boolean) as string[];
  const fraisAnnuels = Number(selected.classes?.niveaux?.frais_scolarite || 0);
  const totalPaye = elevePaiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
  const resteAPayer = Math.max(0, fraisAnnuels - totalPaye);

  const isTranchePaid = (t: TrancheConfig) => t.mois.every(m => moisPayes.includes(m));

  const activeTabData = TABS.find(t => t.key === activeTab);

  return (
    <Dialog open={!!selected} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-hidden p-0 rounded-3xl border-0 shadow-2xl">
        {/* ─── Premium Header ─── */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden px-5 pt-5 pb-4">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary-foreground/5 -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-primary-foreground/5 translate-y-1/2 -translate-x-1/4" />
          
          <div className="relative flex items-center gap-4">
            <div className="relative">
              {(photoPreview || selected.photo_url) ? (
                <img 
                  src={photoPreview || selected.photo_url} 
                  alt={selected.prenom} 
                  loading="lazy" 
                  decoding="async" 
                  className="w-20 h-20 rounded-2xl object-cover ring-3 ring-primary-foreground/30 shadow-lg" 
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary-foreground/15 flex items-center justify-center text-3xl text-primary-foreground shadow-lg">
                  👤
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                <button 
                  onClick={() => photoInputRef.current?.click()}
                  className="w-7 h-7 rounded-full bg-primary-foreground/90 text-primary flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={startCamera}
                  className="w-7 h-7 rounded-full bg-primary-foreground/90 text-primary flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold text-primary-foreground leading-tight truncate">
                {selected.prenom} {selected.nom}
              </h2>
              <p className="text-xs text-primary-foreground/60 font-mono mt-0.5">{selected.matricule || '—'}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-foreground/15 text-primary-foreground text-[10px] font-semibold">
                  {selected.classes?.niveaux?.cycles?.nom || '—'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-foreground/15 text-primary-foreground text-[10px] font-semibold">
                  {selected.classes?.nom || '—'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  selected.statut === 'inscrit' ? 'bg-green-400/20 text-green-100' : 
                  selected.statut === 'abandon' ? 'bg-red-400/20 text-red-100' : 'bg-yellow-400/20 text-yellow-100'
                }`}>
                  {selected.statut}
                </span>
              </div>
            </div>
          </div>

          {photoPreview && (
            <div className="mt-3">
              <Button size="sm" className="h-8 text-xs rounded-xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 w-full" disabled={uploadingPhoto} onClick={() => handleSavePhotoOnly(selected)}>
                {uploadingPhoto ? 'Envoi de la photo...' : '📸 Enregistrer la nouvelle photo'}
              </Button>
            </div>
          )}
        </div>

        {/* ─── Tab Navigation ─── */}
        <div className="px-4 pt-3">
          <div className="flex gap-1.5 bg-muted/50 rounded-2xl p-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive 
                      ? 'bg-card shadow-md text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-sm">{tab.emoji}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Tab Content ─── */}
        <div className="px-4 pb-5 pt-3 overflow-y-auto max-h-[50vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'info' && (
                <div className="space-y-3">
                  {/* Info cards grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Matricule', value: selected.matricule || '—', icon: '🆔' },
                      { label: 'Sexe', value: selected.sexe || '—', icon: selected.sexe === 'F' ? '👧' : '👦' },
                      { label: 'Naissance', value: selected.date_naissance || '—', icon: '🎂' },
                      { label: 'Cycle', value: selected.classes?.niveaux?.cycles?.nom || '—', icon: '🏫' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-muted/40 border border-border/50 p-3 flex items-start gap-2.5">
                        <span className="text-lg">{item.icon}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                          <p className="text-sm font-semibold truncate">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Type badge */}
                  <div className="rounded-2xl bg-muted/40 border border-border/50 p-3 flex items-center gap-3">
                    <span className="text-lg">{selected.famille_id ? '👨‍👩‍👧' : '👤'}</span>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Type d'inscription</p>
                      {selected.famille_id ? (
                        <p className="text-sm font-semibold">En famille — {selected.familles?.nom_famille}</p>
                      ) : (
                        <p className="text-sm font-semibold">Individuel</p>
                      )}
                    </div>
                  </div>

                  {/* Password section */}
                  <PasswordSectionModern eleve={selected} onUpdate={onUpdate} isSuperviseur={isSuperviseur} />
                </div>
              )}

              {activeTab === 'scolarite' && (
                <div className="space-y-3">
                  {/* Financial summary cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-muted/40 border border-border/50 p-3 text-center">
                      <Wallet className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-[10px] text-muted-foreground font-medium">Total</p>
                      <p className="text-sm font-bold">{fraisAnnuels.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-3 text-center">
                      <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
                      <p className="text-[10px] text-green-600 font-medium">Payé</p>
                      <p className="text-sm font-bold text-green-600">{totalPaye.toLocaleString()}</p>
                    </div>
                    <div className={`rounded-2xl p-3 text-center ${resteAPayer === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                      <CreditCard className={`h-4 w-4 mx-auto mb-1 ${resteAPayer === 0 ? 'text-green-600' : 'text-destructive'}`} />
                      <p className={`text-[10px] font-medium ${resteAPayer === 0 ? 'text-green-600' : 'text-destructive'}`}>Reste</p>
                      <p className={`text-sm font-bold ${resteAPayer === 0 ? 'text-green-600' : 'text-destructive'}`}>{resteAPayer.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Tranches */}
                  {eleveTranches.length > 0 ? (
                    <div className="space-y-2">
                      {eleveTranches.map((t, idx) => {
                        const tranchePaid = isTranchePaid(t);
                        return (
                          <div key={idx} className={`rounded-2xl border p-3 ${tranchePaid ? 'border-green-300/50 bg-green-50/50 dark:bg-green-950/30' : 'border-destructive/20 bg-destructive/5'}`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-sm">{t.label}</span>
                              <span className="text-xs font-medium text-muted-foreground">{t.montant.toLocaleString()} GNF</span>
                            </div>
                            <div className="grid grid-cols-5 gap-1">
                              {t.mois.map(m => {
                                const paid = moisPayes.includes(m);
                                return (
                                  <div key={m} className={`text-center text-xs rounded-xl py-1.5 font-medium ${paid ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                                    {m.slice(0, 3)}
                                    <span className="block text-[10px]">{paid ? '✓' : '✗'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Statut par mois :</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {MOIS_SCOLAIRES.map(m => {
                          const paid = moisPayes.includes(m);
                          return (
                            <div key={m} className={`text-center text-xs rounded-xl py-1.5 font-medium ${paid ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                              {m.slice(0, 3)}
                              <span className="block text-[10px]">{paid ? '✓' : '✗'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'options' && (
                <div className="space-y-3">
                  {/* Checklist */}
                  <div className="rounded-2xl bg-muted/40 border border-border/50 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📋 Check-list</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'Livret', val: selected.checklist_livret },
                        { label: 'Rames', val: selected.checklist_rames },
                        { label: 'Marqueurs', val: selected.checklist_marqueurs },
                      ].map(item => (
                        <span key={item.label} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
                          item.val ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-muted text-muted-foreground'
                        }`}>
                          {item.val ? '✅' : '❌'} {item.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Options badges */}
                  <div className="rounded-2xl bg-muted/40 border border-border/50 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🎯 Options actives</p>
                    <div className="flex gap-2 flex-wrap">
                      {selected.zone_transport_id && zonesTransport.find((z: any) => z.id === selected.zone_transport_id) && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                          🚌 {zonesTransport.find((z: any) => z.id === selected.zone_transport_id)?.nom}
                        </span>
                      )}
                      {selected.option_cantine && <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">🍽️ Cantine</span>}
                      {selected.uniforme_scolaire && <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">👔 Uniforme scolaire</span>}
                      {selected.uniforme_sport && <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">🏃 Sport</span>}
                      {selected.uniforme_polo_lacoste && <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">👕 Polo</span>}
                      {selected.uniforme_karate && <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">🥋 Karaté</span>}
                      {!selected.zone_transport_id && !selected.option_cantine && !selected.uniforme_scolaire && !selected.uniforme_sport && !selected.uniforme_polo_lacoste && !selected.uniforme_karate && (
                        <p className="text-xs text-muted-foreground">Aucune option active</p>
                      )}
                    </div>
                  </div>

                  {/* Transport assignment */}
                  <div className="rounded-2xl bg-gradient-to-br from-blue-500/5 to-blue-600/5 border border-blue-500/10 p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Bus className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="text-sm font-semibold">Transport scolaire</p>
                    </div>
                    <Select
                      value={selected.zone_transport_id || 'none'}
                      onValueChange={async (val) => {
                        const zoneId = val === 'none' ? null : val;
                        const { error } = await supabase.from('eleves').update({ zone_transport_id: zoneId }).eq('id', selected.id);
                        if (error) {
                          toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                        } else {
                          toast({ title: zoneId ? 'Transport assigné' : 'Transport retiré' });
                          onUpdate({ zone_transport_id: zoneId });
                        }
                      }}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir une zone" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun (pas de transport)</SelectItem>
                        {zonesTransport.map((z: any) => (
                          <SelectItem key={z.id} value={z.id}>{z.nom} — {Number(z.prix_mensuel).toLocaleString()} GNF/mois</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cantine toggle */}
                  <div className="rounded-2xl bg-gradient-to-br from-orange-500/5 to-amber-500/5 border border-orange-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                          <UtensilsCrossed className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Cantine</p>
                          {selected.option_cantine && (
                            <p className="text-xs text-muted-foreground">Solde : {Number(selected.solde_cantine || 0).toLocaleString()} GNF</p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={!!selected.option_cantine}
                        onCheckedChange={async (checked) => {
                          const { error } = await supabase.from('eleves').update({ option_cantine: checked }).eq('id', selected.id);
                          if (error) {
                            toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                          } else {
                            toast({ title: checked ? 'Inscrit à la cantine' : 'Retiré de la cantine' });
                            onUpdate();
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'famille' && (
                <div className="space-y-3">
                  {selected.familles ? (
                    <>
                      <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg">👨‍👩‍👧</span>
                            <p className="font-bold text-sm">{selected.familles.nom_famille}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 rounded-xl text-xs"
                            onClick={() => { onClose(); navigate(`/familles?familleId=${selected.familles.id}`); }}
                          >
                            Voir <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                        <div className="space-y-2.5">
                          {selected.familles.telephone_pere && (
                            <a href={`tel:${selected.familles.telephone_pere}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-card/60 hover:bg-card transition-colors">
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Phone className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Père</p>
                                <p className="text-sm font-medium">{selected.familles.telephone_pere}</p>
                              </div>
                            </a>
                          )}
                          {selected.familles.telephone_mere && (
                            <a href={`tel:${selected.familles.telephone_mere}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-card/60 hover:bg-card transition-colors">
                              <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
                                <Phone className="h-3.5 w-3.5 text-pink-600" />
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Mère</p>
                                <p className="text-sm font-medium">{selected.familles.telephone_mere}</p>
                              </div>
                            </a>
                          )}
                          {selected.familles.email_parent && (
                            <a href={`mailto:${selected.familles.email_parent}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-card/60 hover:bg-card transition-colors">
                              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Mail className="h-3.5 w-3.5 text-green-600" />
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Email</p>
                                <p className="text-sm font-medium">{selected.familles.email_parent}</p>
                              </div>
                            </a>
                          )}
                          {selected.familles.adresse && (
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card/60">
                              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <MapPin className="h-3.5 w-3.5 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Adresse</p>
                                <p className="text-sm font-medium">{selected.familles.adresse}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl bg-muted/40 border border-border/50 p-6 text-center">
                      <span className="text-3xl mb-2 block">👤</span>
                      <p className="text-sm text-muted-foreground">Élève inscrit individuellement</p>
                      <p className="text-xs text-muted-foreground mt-1">Non rattaché à une famille</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

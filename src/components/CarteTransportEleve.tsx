import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bus, CreditCard, Download, Printer, Search, Wallet, RefreshCw, MapPin, Banknote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { QRCodeCanvas } from 'qrcode.react';
import { useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import transportMapWatermark from '@/assets/transport-map-watermark.png';

interface CarteTransportEleveProps {
  zones: any[];
}

export default function CarteTransportEleve({ zones }: CarteTransportEleveProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: schoolConfig } = useSchoolConfig();
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [rechargeDialog, setRechargeDialog] = useState<any>(null);
  const [printCard, setPrintCard] = useState<any>(null);
  const [cashPayDialog, setCashPayDialog] = useState<any>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const bulkCardRef = useRef<HTMLDivElement>(null);

  const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisCourant = MOIS_FR[new Date().getMonth()];
  const anneeCourante = new Date().getFullYear();

  const getTransportPrix = (eleve: any) => {
    const zone = (eleve.zones_transport as any);
    if (!zone) return 0;
    const typeTrajet = eleve.type_trajet_transport || 'aller_retour';
    if (typeTrajet === 'aller_simple') return zone.prix_aller_simple || zone.prix_mensuel || 0;
    if (typeTrajet === 'retour_simple') return zone.prix_retour_simple || zone.prix_mensuel || 0;
    return zone.prix_mensuel || 0;
  };

  const getTrajetLabel = (type: string) => {
    if (type === 'aller_simple') return 'Aller simple';
    if (type === 'retour_simple') return 'Retour simple';
    return 'Aller-Retour';
  };

  const { data: eleves = [] } = useQuery({
    queryKey: ['transport-card-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, photo_url, type_trajet_transport, classes(nom), zone_transport_id, zones_transport:zone_transport_id(id, nom, prix_mensuel, prix_aller_simple, prix_retour_simple, chauffeur_bus)')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: recharges = [] } = useQuery({
    queryKey: ['recharges-transport'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recharges_transport')
        .select('*')
        .order('date_recharge', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Paiements transport pour vérifier si le parent a payé
  const { data: paiementsTransport = [] } = useQuery({
    queryKey: ['paiements-transport'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('*')
        .eq('type_paiement', 'transport')
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const rechargeMutation = useMutation({
    mutationFn: async ({ eleveId, montant }: { eleveId: string; montant: number }) => {
      // First deactivate all active recharges for this student
      const { error: updateErr } = await supabase
        .from('recharges_transport')
        .update({ actif: false } as any)
        .eq('eleve_id', eleveId)
        .eq('actif', true);
      if (updateErr) console.warn('Deactivate error:', updateErr);

      // Delete any existing recharges for this month to avoid trigger conflict
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
      const endOfMonth = now.getMonth() === 11
        ? `${now.getFullYear() + 1}-01-01T00:00:00`
        : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01T00:00:00`;
      
      await supabase
        .from('recharges_transport')
        .delete()
        .eq('eleve_id', eleveId)
        .gte('date_recharge', startOfMonth)
        .lt('date_recharge', endOfMonth);

      const { error } = await supabase.from('recharges_transport').insert({
        eleve_id: eleveId,
        montant,
        actif: true,
      } as any);
      if (error) {
        if (error.message?.includes('déjà été rechargé')) {
          throw new Error('Cet élève a déjà été rechargé pour ce mois.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recharges-transport'] });
      queryClient.invalidateQueries({ queryKey: ['paiements-transport'] });
      toast({ title: 'Recharge effectuée', description: 'La carte transport a été rechargée pour 30 jours.' });
      setRechargeDialog(null);
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message || 'Erreur lors de la recharge', variant: 'destructive' });
    },
  });

  // Cash payment by comptable (creates paiement + recharge in one step)
  const cashPayMutation = useMutation({
    mutationFn: async ({ eleveId, montant }: { eleveId: string; montant: number }) => {
      // 1. Create paiement record
      const { error: payErr } = await supabase.from('paiements').insert({
        eleve_id: eleveId,
        type_paiement: 'transport',
        montant,
        canal: 'especes',
        mois_concerne: `Transport du mois de ${moisCourant} ${anneeCourante}`,
      });
      if (payErr) throw payErr;
      // 2. Deactivate old recharge
      await supabase.from('recharges_transport').update({ actif: false } as any).eq('eleve_id', eleveId).eq('actif', true);
      // 3. Create new recharge
      const { error: rechErr } = await supabase.from('recharges_transport').insert({ eleve_id: eleveId, montant, actif: true } as any);
      if (rechErr) throw rechErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recharges-transport'] });
      queryClient.invalidateQueries({ queryKey: ['paiements-transport'] });
      toast({ title: 'Paiement enregistré', description: 'Paiement espèces + carte rechargée.' });
      setCashPayDialog(null);
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const eligible = filteredEleves.filter((e: any) => !hasRechargeThisMonth(e.id) && hasTransportPaidThisMonth(e.id));
    if (selectedIds.size === eligible.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligible.map((e: any) => e.id)));
    }
  };

  const handleBulkRecharge = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    let success = 0;
    let errors = 0;
    for (const id of selectedIds) {
      const eleve = eleves.find((e: any) => e.id === id);
      if (!eleve) continue;
      const montant = (eleve as any).zones_transport?.prix_mensuel || 0;
      try {
        await supabase
          .from('recharges_transport')
          .update({ actif: false } as any)
          .eq('eleve_id', id)
          .eq('actif', true);
        const { error } = await supabase.from('recharges_transport').insert({
          eleve_id: id,
          montant,
          actif: true,
        } as any);
        if (error) { errors++; } else { success++; }
      } catch { errors++; }
    }
    setBulkLoading(false);
    queryClient.invalidateQueries({ queryKey: ['recharges-transport'] });
    setSelectedIds(new Set());
    setBulkMode(false);
    toast({
      title: `Recharge en lot terminée`,
      description: `${success} rechargé(s) avec succès${errors > 0 ? `, ${errors} erreur(s)` : ''}.`,
      variant: errors > 0 ? 'destructive' : 'default',
    });
  };

  const getActiveRecharge = (eleveId: string) => {
    return recharges.find(
      (r: any) => r.eleve_id === eleveId && r.actif && new Date(r.date_expiration) > new Date()
    );
  };

  const hasRechargeThisMonth = (eleveId: string) => {
    const now = new Date();
    return recharges.some(
      (r: any) => r.eleve_id === eleveId &&
        new Date(r.date_recharge).getMonth() === now.getMonth() &&
        new Date(r.date_recharge).getFullYear() === now.getFullYear()
    );
  };

  const getDaysRemaining = (dateExpiration: string) => {
    const diff = new Date(dateExpiration).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const hasTransportPaidThisMonth = (eleveId: string) => {
    const now = new Date();
    return paiementsTransport.some(
      (p: any) => p.eleve_id === eleveId &&
        new Date(p.date_paiement).getMonth() === now.getMonth() &&
        new Date(p.date_paiement).getFullYear() === now.getFullYear()
    );
  };

  const filteredEleves = useMemo(() => {
    const filtered = eleves.filter((e: any) => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchZone = filterZone === 'all' || e.zone_transport_id === filterZone;
      return matchSearch && matchZone;
    });
    // Sort: pending validation (paid but not recharged) first, then not paid, then already recharged
    return filtered.sort((a: any, b: any) => {
      const aPaid = hasTransportPaidThisMonth(a.id);
      const bPaid = hasTransportPaidThisMonth(b.id);
      const aRecharged = hasRechargeThisMonth(a.id);
      const bRecharged = hasRechargeThisMonth(b.id);
      // Priority: paid & not recharged > not paid > recharged
      const aScore = aPaid && !aRecharged ? 0 : !aPaid ? 1 : 2;
      const bScore = bPaid && !bRecharged ? 0 : !bPaid ? 1 : 2;
      return aScore - bScore;
    });
  }, [eleves, search, filterZone, paiementsTransport, recharges]);

  // PVC card dimensions: CR80 standard 85.6mm × 54mm = ratio ~1.585
  const PVC_DISPLAY_W = 460;
  const PVC_DISPLAY_H = 290;
  const PVC_EXPORT_W = 1012; // 85.6mm at 300 DPI
  const PVC_EXPORT_H = 638;  // 54mm at 300 DPI

  const captureCardCanvas = async (el: HTMLElement) => {
    const canvas = await html2canvas(el, {
      scale: 4,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#FFFFFF',
      width: el.offsetWidth,
      height: el.offsetHeight,
      imageTimeout: 15000,
      logging: false,
      onclone: (_clonedDoc, clonedElement) => {
        clonedElement.style.width = el.offsetWidth + 'px';
        clonedElement.style.height = el.offsetHeight + 'px';
        clonedElement.style.overflow = 'hidden';
        clonedElement.style.borderRadius = '14px';
        _clonedDoc.querySelectorAll('svg path').forEach((node) => {
          const path = node as SVGPathElement;
          const fill = path.getAttribute('fill')?.toLowerCase() || '';
          if (fill.includes('f87171')) {
            path.setAttribute('fill', '#F87171');
            path.setAttribute('opacity', '0.6');
            path.style.fill = '#F87171';
            path.style.opacity = '0.6';
            path.removeAttribute('class');
          } else if (fill.includes('4ade80')) {
            path.setAttribute('fill', '#4ADE80');
            path.setAttribute('opacity', '0.5');
            path.style.fill = '#4ADE80';
            path.style.opacity = '0.5';
            path.removeAttribute('class');
          }
        });
        _clonedDoc.querySelectorAll('svg').forEach((svg) => {
          (svg as SVGElement).style.overflow = 'visible';
        });
        _clonedDoc.querySelectorAll('div').forEach((node) => {
          if (node.textContent?.includes('\u25CF ACTIVE')) {
            const badge = node as HTMLElement;
            badge.style.backgroundColor = '#16A34A';
            badge.style.color = '#FFFFFF';
            badge.style.borderColor = '#16A34A';
            badge.style.opacity = '1';
          }
        });
      },
    });
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = PVC_EXPORT_W;
    resizedCanvas.height = PVC_EXPORT_H;
    const ctx = resizedCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, PVC_EXPORT_W, PVC_EXPORT_H);
    return resizedCanvas;
  };

  const exportCard = async () => {
    if (!cardRef.current) return;
    try {
      const resizedCanvas = await captureCardCanvas(cardRef.current);
      resizedCanvas.toBlob((blob) => {
        if (!blob) {
          toast({ title: 'Erreur export', variant: 'destructive' });
          return;
        }
        const filename = `carte_transport_${printCard?.matricule || 'eleve'}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast({ title: 'Carte exportée (format PVC 300 DPI)' });
      }, 'image/png', 1);
    } catch {
      toast({ title: 'Erreur export', variant: 'destructive' });
    }
  };

  const exportBulkCards = async () => {
    const targets = filteredEleves.filter((e: any) => selectedIds.has(e.id) || !bulkMode);
    const toExport = bulkMode && selectedIds.size > 0
      ? filteredEleves.filter((e: any) => selectedIds.has(e.id))
      : filteredEleves;

    if (toExport.length === 0) {
      toast({ title: 'Aucun élève sélectionné', variant: 'destructive' });
      return;
    }

    setBulkDownloading(true);
    let exported = 0;

    for (const eleve of toExport) {
      const recharge = getActiveRecharge(eleve.id);
      // Render card off-screen
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      // Create card element
      const cardEl = document.createElement('div');
      cardEl.style.width = PVC_DISPLAY_W + 'px';
      cardEl.style.height = PVC_DISPLAY_H + 'px';
      cardEl.style.borderRadius = '14px';
      cardEl.style.overflow = 'hidden';
      cardEl.style.fontFamily = "'Inter', 'Space Grotesk', sans-serif";
      cardEl.style.background = '#FFFFFF';
      cardEl.style.position = 'relative';

      const zoneName = (eleve.zones_transport as any)?.nom || '—';
      const expDate = recharge ? new Date(recharge.date_expiration).toLocaleDateString('fr-FR') : '';

      cardEl.innerHTML = `
        <svg style="position:absolute;bottom:0;left:0;width:100%;height:100px" viewBox="0 0 460 100" preserveAspectRatio="none">
          <path d="M0,45 C90,0 180,70 270,35 C340,10 400,55 460,25 L460,100 L0,100 Z" fill="#F87171" opacity="0.6"/>
          <path d="M0,60 C70,30 160,75 250,50 C330,30 400,70 460,42 L460,100 L0,100 Z" fill="#4ADE80" opacity="0.5"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.1;pointer-events:none">
          <img src="${transportMapWatermark}" style="width:85%;height:85%;object-fit:contain" crossorigin="anonymous"/>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px 4px;position:relative;z-index:10">
          ${schoolConfig?.logo_url
            ? `<img src="${schoolConfig.logo_url}" style="height:40px;width:40px;border-radius:50%;object-fit:cover" crossorigin="anonymous"/>`
            : '<div style="height:40px;width:40px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center">🚌</div>'}
          <p style="font-size:13px;color:#DC2626;font-weight:900;text-transform:uppercase;text-align:center;line-height:1.2">${schoolConfig?.nom || 'École'}</p>
        </div>
        <div style="display:flex;gap:12px;padding:6px 16px 0;position:relative;z-index:10;height:150px">
          <div style="width:80px;height:100px;border-radius:8px;overflow:hidden;background:#F3F4F6;border:1px solid #E5E7EB;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
            ${eleve.photo_url
              ? `<img src="${eleve.photo_url}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%" crossorigin="anonymous"/>`
              : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#9CA3AF">Photo</div>'}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:2px 0">
            <div>
              <p style="font-size:16px;font-weight:800;color:#1F2937;line-height:1.1">${eleve.prenom} ${eleve.nom}</p>
              <div style="margin-top:6px">
                <p style="font-size:7px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em">Matricule</p>
                <p style="font-size:10px;font-weight:600;color:#374151;font-family:monospace">${eleve.matricule || '—'}</p>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:4px">
              <span style="font-size:9px;font-weight:700;color:#1E40AF">📍 LIGNE : ${zoneName}</span>
            </div>
            ${recharge ? `
              <div style="margin-top:4px;display:flex;align-items:center;gap:8px">
                <span style="background:#D1FAE5;font-size:7px;font-weight:600;color:#065F46;border-radius:9999px;padding:2px 8px">● ACTIVE</span>
                <span style="font-size:8px;color:#6B7280">Expire le ${expDate}</span>
              </div>` : ''}
          </div>
          <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="background:#FFF;border-radius:8px;padding:6px;box-shadow:0 1px 6px rgba(0,0,0,0.1);border:2px solid #E5E7EB" id="qr-placeholder-${eleve.id}"></div>
            <p style="font-size:6px;color:#9CA3AF;margin-top:3px">Scanner pour valider</p>
          </div>
        </div>
        <div style="position:absolute;bottom:6px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;z-index:10">
          <p style="font-size:7px;color:#111827;font-weight:700">${schoolConfig?.ville || 'Conakry, Guinée'}</p>
          <p style="font-size:6px;color:#111827;font-weight:600">Carte permanente • Rechargeable</p>
        </div>
      `;

      container.appendChild(cardEl);

      // Render QR code into placeholder
      const qrPlaceholder = cardEl.querySelector(`#qr-placeholder-${eleve.id}`);
      if (qrPlaceholder) {
        const qrCanvas = document.createElement('canvas');
        const { QRCodeCanvas: _Q } = await import('qrcode.react');
        // Use simple canvas QR approach
        const { toCanvas } = await import('qrcode');
        await toCanvas(qrCanvas, JSON.stringify({ type: 'transport', matricule: eleve.matricule, id: eleve.id }), {
          width: 90,
          margin: 0,
          errorCorrectionLevel: 'H',
        });
        qrPlaceholder.appendChild(qrCanvas);
      }

      // Wait for images to load
      await new Promise(r => setTimeout(r, 500));

      try {
        const resizedCanvas = await captureCardCanvas(cardEl);
        const blob = await new Promise<Blob | null>(resolve => resizedCanvas.toBlob(resolve, 'image/png', 1));
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `carte_transport_${eleve.matricule || eleve.id}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          exported++;
        }
      } catch (err) {
        console.error('Export error for', eleve.matricule, err);
      }

      document.body.removeChild(container);
      // Small delay between downloads
      await new Promise(r => setTimeout(r, 300));
    }

    setBulkDownloading(false);
    toast({ title: `${exported} carte(s) exportée(s)`, description: 'Format PVC CR80 — 300 DPI' });
  };

  const totalActives = eleves.filter((e: any) => getActiveRecharge(e.id)).length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Cartes actives</p>
                <p className="text-2xl font-bold">{totalActives} / {eleves.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Recharges ce mois</p>
                <p className="text-2xl font-bold">
                  {recharges.filter((r: any) => {
                    const d = new Date(r.date_recharge);
                    const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Cartes expirées</p>
                <p className="text-2xl font-bold text-destructive">{eleves.length - totalActives}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres + Bulk */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterZone} onValueChange={setFilterZone}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les zones</SelectItem>
            {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={bulkMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          {bulkMode ? 'Annuler sélection' : 'Recharge en lot'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={bulkDownloading || (bulkMode && selectedIds.size === 0)}
          onClick={exportBulkCards}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          {bulkDownloading ? 'Export en cours…' : bulkMode && selectedIds.size > 0 ? `Télécharger ${selectedIds.size} carte(s)` : 'Télécharger toutes les cartes'}
        </Button>
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="font-semibold">{selectedIds.size}</span> élève(s) sélectionné(s) — <span className="font-medium text-primary">Transport du mois de {moisCourant} {anneeCourante}</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground">
                Total : {Array.from(selectedIds).reduce((sum, id) => {
                  const el = eleves.find((e: any) => e.id === id);
                  return sum + ((el as any)?.zones_transport?.prix_mensuel || 0);
                }, 0).toLocaleString('fr-FR')} GNF
              </span>
              <Button size="sm" disabled={selectedIds.size === 0 || bulkLoading} onClick={handleBulkRecharge}>
                {bulkLoading ? 'Recharge en cours…' : `Recharger ${selectedIds.size} carte(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {bulkMode && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="rounded border-muted-foreground"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredEleves.filter((e: any) => !hasRechargeThisMonth(e.id)).length}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Matricule</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Zone</TableHead>
                {bulkMode && <TableHead className="text-right">Montant</TableHead>}
                <TableHead className="text-center">Paiement parent</TableHead>
                <TableHead className="text-center">Statut carte</TableHead>
                <TableHead className="text-center">Jours restants</TableHead>
                {!bulkMode && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEleves.length === 0 ? (
                <TableRow><TableCell colSpan={bulkMode ? 8 : 7} className="text-center py-8 text-muted-foreground">Aucun élève</TableCell></TableRow>
              ) : filteredEleves.map((e: any) => {
                const recharge = getActiveRecharge(e.id);
                const jours = recharge ? getDaysRemaining(recharge.date_expiration) : 0;
                const alreadyThisMonth = hasRechargeThisMonth(e.id);
                const parentPaid = hasTransportPaidThisMonth(e.id);
                const prixZone = (e.zones_transport as any)?.prix_mensuel || 0;
                return (
                  <TableRow key={e.id} className={bulkMode && selectedIds.has(e.id) ? 'bg-primary/5' : ''}>
                    {bulkMode && (
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded border-muted-foreground"
                          disabled={alreadyThisMonth || !parentPaid}
                          checked={selectedIds.has(e.id)}
                          onChange={() => toggleSelect(e.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                    <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                    <TableCell>{e.classes?.nom || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{(e.zones_transport as any)?.nom || '—'}</Badge></TableCell>
                    {bulkMode && (
                      <TableCell className="text-right font-medium text-sm">
                        {alreadyThisMonth ? (
                          <span className="text-muted-foreground text-xs">Déjà rechargé</span>
                        ) : (
                          <>{prixZone.toLocaleString('fr-FR')} GNF</>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <Badge variant={parentPaid ? 'default' : 'secondary'} className={parentPaid ? 'bg-emerald-600' : ''}>
                        {parentPaid ? '✓ Payé' : 'Non payé'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={recharge ? 'default' : 'destructive'}>
                        {recharge ? 'Active' : 'Expirée'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {recharge ? (
                        <span className={jours <= 5 ? 'text-destructive font-bold' : jours <= 10 ? 'text-warning font-medium' : ''}>
                          {jours}j
                        </span>
                      ) : '—'}
                    </TableCell>
                    {!bulkMode && (
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {parentPaid && !alreadyThisMonth ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRechargeDialog(e)}
                            >
                              <Wallet className="h-3 w-3 mr-1" /> Valider
                            </Button>
                          ) : !parentPaid && !alreadyThisMonth ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setCashPayDialog(e)}
                            >
                              <Banknote className="h-3 w-3 mr-1" /> Espèces
                            </Button>
                          ) : alreadyThisMonth ? (
                            <Badge variant="secondary" className="text-[10px]">✓ Rechargé</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">En attente</Badge>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setPrintCard({ ...e, recharge })}>
                            <Printer className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog recharge — validation de carte */}
      <Dialog open={!!rechargeDialog} onOpenChange={(open) => { if (!open) setRechargeDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Valider la carte transport</DialogTitle></DialogHeader>
          {rechargeDialog && (() => {
            const prixZoneRecharge = getTransportPrix(rechargeDialog);
            const zoneNom = (rechargeDialog.zones_transport as any)?.nom || '—';
            const trajetType = rechargeDialog.type_trajet_transport || 'aller_retour';
            return (
              <div className="space-y-4">
                <div className="text-sm space-y-1">
                  <p><strong>Élève :</strong> {rechargeDialog.prenom} {rechargeDialog.nom}</p>
                  <p><strong>Zone :</strong> {zoneNom}</p>
                  <p><strong>Trajet :</strong> {getTrajetLabel(trajetType)}</p>
                  <p><strong>Description :</strong> Transport du mois de {moisCourant} {anneeCourante}</p>
                  <p><strong>Montant :</strong> <span className="font-bold text-primary">{prixZoneRecharge.toLocaleString()} GNF</span></p>
                  <p><strong>Validité :</strong> 30 jours à partir d'aujourd'hui</p>
                </div>
                {hasRechargeThisMonth(rechargeDialog.id) && (
                  <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-sm text-warning-foreground">
                    ⚠️ Cet élève a déjà été rechargé ce mois-ci.
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setRechargeDialog(null)}>Annuler</Button>
                  <Button
                    type="button"
                    disabled={rechargeMutation.isPending || hasRechargeThisMonth(rechargeDialog.id)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      rechargeMutation.mutate({ eleveId: rechargeDialog.id, montant: prixZoneRecharge });
                    }}
                  >
                    {rechargeMutation.isPending ? 'En cours…' : 'Confirmer la validation'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog paiement espèce comptable */}
      <Dialog open={!!cashPayDialog} onOpenChange={(open) => { if (!open) setCashPayDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Paiement transport en espèces</DialogTitle></DialogHeader>
          {cashPayDialog && (() => {
            const prixZoneCash = getTransportPrix(cashPayDialog);
            const trajetTypeCash = cashPayDialog.type_trajet_transport || 'aller_retour';
            return (
              <div className="space-y-4">
                <div className="text-sm space-y-1">
                  <p><strong>Élève :</strong> {cashPayDialog.prenom} {cashPayDialog.nom}</p>
                  <p><strong>Zone :</strong> {(cashPayDialog.zones_transport as any)?.nom}</p>
                  <p><strong>Trajet :</strong> {getTrajetLabel(trajetTypeCash)}</p>
                  <p><strong>Montant :</strong> <span className="font-bold text-primary">{prixZoneCash.toLocaleString()} GNF</span></p>
                  <p><strong>Mois :</strong> {moisCourant} {anneeCourante}</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setCashPayDialog(null)}>Annuler</Button>
                  <Button
                    type="button"
                    disabled={cashPayMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      cashPayMutation.mutate({ eleveId: cashPayDialog.id, montant: prixZoneCash });
                    }}
                  >
                    {cashPayMutation.isPending ? 'En cours…' : 'Enregistrer le paiement'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog impression carte PVC */}
      <Dialog open={!!printCard} onOpenChange={() => setPrintCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Carte de transport scolaire</DialogTitle></DialogHeader>
          {printCard && (
            <div className="space-y-4">
              {/* PVC Card — CR80 standard 85.6mm × 54mm */}
               <div
                ref={cardRef}
                className="relative mx-auto overflow-hidden"
                style={{
                  width: PVC_DISPLAY_W,
                  height: PVC_DISPLAY_H,
                  borderRadius: 14,
                  fontFamily: "'Inter', 'Space Grotesk', sans-serif",
                  background: '#FFFFFF',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
                }}
              >
                {/* Background wave shape */}
                <svg
                  className="absolute bottom-0 left-0 w-full"
                  viewBox="0 0 460 100"
                  preserveAspectRatio="none"
                  style={{ height: 100 }}
                >
                    <path
                     d="M0,45 C90,0 180,70 270,35 C340,10 400,55 460,25 L460,100 L0,100 Z"
                     fill="#F87171"
                     opacity="0.6"
                     style={{ fill: '#F87171' }}
                   />
                   <path
                     d="M0,60 C70,30 160,75 250,50 C330,30 400,70 460,42 L460,100 L0,100 Z"
                     fill="#4ADE80"
                     opacity="0.5"
                     style={{ fill: '#4ADE80' }}
                   />
                </svg>

                {/* Map watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.10] pointer-events-none">
                  <img src={transportMapWatermark} alt="" className="w-[85%] h-[85%] object-contain" crossOrigin="anonymous" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-center gap-2 px-4 pt-3 pb-1 relative z-10">
                  {schoolConfig?.logo_url ? (
                    <img
                      src={schoolConfig.logo_url}
                      alt="Logo"
                      className="h-10 w-10 rounded-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bus className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, textAlign: 'center' }}>
                    {schoolConfig?.nom || 'École'}
                  </p>
                </div>

                {/* Body */}
                <div className="flex gap-3 px-4 pt-1 relative z-10" style={{ height: 150 }}>
                  {/* Photo */}
                  <div
                    className="flex-shrink-0 rounded-lg overflow-hidden bg-muted border"
                    style={{
                      width: 72,
                      height: 90,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }}
                  >
                    {printCard.photo_url ? (
                      <img
                        src={printCard.photo_url}
                        alt="Photo"
                        className="w-full h-full object-cover"
                        style={{ objectPosition: 'center 20%' }}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground" style={{ fontSize: 10 }}>
                        Photo
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#1F2937', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                        {printCard.prenom} {printCard.nom}
                      </p>
                      <div className="mt-1.5">
                        <p style={{ fontSize: 7, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matricule</p>
                        <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>{printCard.matricule || '—'}</p>
                      </div>
                    </div>

                    {/* Zone / Ligne */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MapPin style={{ width: 9, height: 9, color: '#3B82F6', flexShrink: 0 }} />
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#1E40AF',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        LIGNE : {(printCard.zones_transport as any)?.nom || '—'}
                      </span>
                    </div>

                    {/* Validity */}
                    <div className="mt-1">
                      {printCard.recharge ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="rounded-full px-2 py-0.5"
                            style={{ background: '#D1FAE5', fontSize: 7, fontWeight: 600, color: '#065F46' }}
                          >
                            ● ACTIVE
                          </div>
                          <span style={{ fontSize: 8, color: '#6B7280' }}>
                            Expire le {new Date(printCard.recharge.date_expiration).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center">
                    <div
                      className="bg-white rounded-lg p-1.5"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.1)', border: '2px solid #E5E7EB' }}
                    >
                      <QRCodeCanvas
                        value={JSON.stringify({ type: 'transport', matricule: printCard.matricule, id: printCard.id })}
                        size={90}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <p style={{ fontSize: 6, color: '#9CA3AF', marginTop: 3 }}>Scanner pour valider</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-1.5 left-4 right-4 flex justify-between items-center z-10">
                  <p style={{ fontSize: 7, color: '#111827', fontWeight: 700 }}>
                    {schoolConfig?.ville || 'Conakry, Guinée'}
                  </p>
                  <p style={{ fontSize: 6, color: '#111827', fontWeight: 600 }}>
                    Carte permanente • Rechargeable
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPrintCard(null)}>Fermer</Button>
                <Button onClick={exportCard}>
                  <Download className="h-4 w-4 mr-1" /> Exporter PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

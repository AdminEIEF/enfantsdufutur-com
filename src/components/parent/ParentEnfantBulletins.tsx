import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  bulletinPublications: any[];
  notes?: any[];
  periodes?: any[];
  eleve?: any;
  schoolConfig?: any;
}

export default function ParentEnfantBulletins({ bulletinPublications, notes = [], periodes = [], eleve, schoolConfig }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const bareme = eleve?.classes?.niveaux?.cycles?.bareme ?? 20;
  const seuil = bareme / 2;

  const getMention = (note: number | null) => {
    if (note === null) return '—';
    const r = note / bareme;
    if (r >= 0.85) return 'Excellent';
    if (r >= 0.70) return 'Très Bien';
    if (r >= 0.60) return 'Bien';
    if (r >= 0.50) return 'Assez Bien';
    if (r >= 0.40) return 'Passable';
    return 'Insuffisant';
  };

  const handleDownload = async (pub: any) => {
    setLoadingId(pub.id);
    try {
      const { default: jsPDF } = await import('jspdf');
      const periodeId = pub.periode_id;
      const periodeNom = pub.periodes?.nom || '';

      const periodeNotes = notes.filter((n: any) => n.periode_id === periodeId && n.note !== null);
      if (periodeNotes.length === 0) {
        toast.error('Aucune note disponible pour cette période.');
        setLoadingId(null);
        return;
      }

      // Group by matiere - take latest note per matiere
      const byMatiere = new Map<string, any>();
      periodeNotes.forEach((n: any) => {
        if (!byMatiere.has(n.matiere_id)) byMatiere.set(n.matiere_id, n);
      });

      const rows = Array.from(byMatiere.values()).map((n: any) => {
        const coef = Number(n.matieres?.coefficient) || 1;
        const note = Number(n.note);
        return {
          matiere: n.matieres?.nom || '—',
          pole: n.matieres?.pole || '',
          note,
          coef,
          total: note * coef,
        };
      });

      const totalCoef = rows.reduce((s, r) => s + r.coef, 0);
      const totalPoints = rows.reduce((s, r) => s + r.total, 0);
      const moyenne = totalCoef > 0 ? totalPoints / totalCoef : null;

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const W = 210;
      let y = 12;

      // Header
      if (schoolConfig?.nom) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(schoolConfig.nom.toUpperCase(), W / 2, y, { align: 'center' });
        y += 5;
      }
      if (schoolConfig?.soustitre) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(schoolConfig.soustitre, W / 2, y, { align: 'center' });
        y += 4;
      }
      if (schoolConfig?.ville) {
        pdf.setFontSize(8);
        pdf.text(schoolConfig.ville, W / 2, y, { align: 'center' });
        y += 5;
      }

      pdf.setLineWidth(0.5);
      pdf.line(15, y, W - 15, y);
      y += 6;

      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`BULLETIN SCOLAIRE — ${periodeNom}`, W / 2, y, { align: 'center' });
      y += 7;

      // Student info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Élève : ${eleve?.prenom || ''} ${eleve?.nom || ''}`, 15, y);
      pdf.text(`Matricule : ${eleve?.matricule || '—'}`, W - 15, y, { align: 'right' });
      y += 5;
      pdf.text(`Classe : ${eleve?.classes?.niveaux?.nom || ''} — ${eleve?.classes?.nom || ''}`, 15, y);
      pdf.text(`Cycle : ${eleve?.classes?.niveaux?.cycles?.nom || ''}`, W - 15, y, { align: 'right' });
      y += 7;

      // Table header
      pdf.setFillColor(230, 230, 230);
      pdf.rect(15, y, W - 30, 7, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('Matière', 17, y + 5);
      pdf.text('Note', 110, y + 5, { align: 'center' });
      pdf.text('Coef', 130, y + 5, { align: 'center' });
      pdf.text('Total', 150, y + 5, { align: 'center' });
      pdf.text('Mention', 175, y + 5, { align: 'center' });
      y += 7;

      // Rows
      pdf.setFont('helvetica', 'normal');
      rows.forEach((r) => {
        if (y > 260) { pdf.addPage(); y = 15; }
        pdf.setDrawColor(220);
        pdf.line(15, y, W - 15, y);
        pdf.text(r.matiere.substring(0, 50), 17, y + 5);
        pdf.text(r.note.toFixed(2), 110, y + 5, { align: 'center' });
        pdf.text(String(r.coef), 130, y + 5, { align: 'center' });
        pdf.text(r.total.toFixed(2), 150, y + 5, { align: 'center' });
        pdf.text(getMention(r.note), 175, y + 5, { align: 'center' });
        y += 6;
      });
      pdf.line(15, y, W - 15, y);
      y += 8;

      // Summary
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`Moyenne ${periodeNom} :`, 15, y);
      const moyText = moyenne !== null ? `${moyenne.toFixed(2)} / ${bareme}` : '—';
      const isPass = moyenne !== null && moyenne >= seuil;
      pdf.setTextColor(isPass ? 0 : 200, isPass ? 120 : 0, 0);
      pdf.text(moyText, W - 15, y, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
      y += 7;
      pdf.setFontSize(10);
      pdf.text(`Mention :`, 15, y);
      pdf.text(getMention(moyenne), W - 15, y, { align: 'right' });
      y += 10;

      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`Bulletin publié le ${new Date(pub.published_at).toLocaleDateString('fr-FR')}`, W / 2, 285, { align: 'center' });

      const filename = `Bulletin_${eleve?.prenom || ''}_${eleve?.nom || ''}_${periodeNom}.pdf`.replace(/\s+/g, '_');
      pdf.save(filename);
      toast.success('Bulletin téléchargé');
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors du téléchargement');
    } finally {
      setLoadingId(null);
    }
  };

  if (bulletinPublications.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Les bulletins seront disponibles après la publication des résultats par l'administration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bulletinPublications.map((pub: any) => (
        <Card key={pub.id} className="border-primary/20">
          <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Bulletin — {pub.periodes?.nom}</p>
                <p className="text-xs text-muted-foreground">
                  Publié le {new Date(pub.published_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Disponible
              </Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingId === pub.id}
                onClick={() => handleDownload(pub)}
              >
                {loadingId === pub.id ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1.5" />
                )}
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GraduationCap, ChevronDown } from 'lucide-react';

interface ClasseRecouvrement {
  nom: string;
  cycleNom: string;
  totalAttendu: number;
  totalPaye: number;
  effectif: number;
  taux: number;
  reste: number;
}

interface Props {
  recouvrementParNiveau: [string, ClasseRecouvrement[]][];
  tauxGlobal: number;
}

function NiveauRecouvrementGroup({ niveau, classes }: { niveau: string; classes: ClasseRecouvrement[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const totalAttendu = classes.reduce((s, c) => s + c.totalAttendu, 0);
  const totalPaye = classes.reduce((s, c) => s + c.totalPaye, 0);
  const taux = totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          <span className="font-medium text-sm">{niveau}</span>
          <Badge variant="secondary" className="text-xs">{classes.reduce((s, c) => s + c.effectif, 0)} élèves</Badge>
        </div>
        <Badge variant={taux >= 75 ? 'default' : taux >= 50 ? 'secondary' : 'destructive'}>
          {taux}%
        </Badge>
      </button>
      {isOpen && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classe</TableHead>
              <TableHead className="text-center">Effectif</TableHead>
              <TableHead className="text-right">Attendu</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Reste</TableHead>
              <TableHead className="text-center">Taux</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{c.nom}</TableCell>
                <TableCell className="text-center">{c.effectif}</TableCell>
                <TableCell className="text-right">{c.totalAttendu.toLocaleString()} GNF</TableCell>
                <TableCell className="text-right text-accent">{c.totalPaye.toLocaleString()} GNF</TableCell>
                <TableCell className="text-right text-destructive">{c.reste.toLocaleString()} GNF</TableCell>
                <TableCell className="text-center">
                  <Badge variant={c.taux >= 75 ? 'default' : c.taux >= 50 ? 'secondary' : 'destructive'}>
                    {c.taux}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function DashboardRecouvrementSection({ recouvrementParNiveau, tauxGlobal }: Props) {
  if (recouvrementParNiveau.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-5 w-5" /> Taux de recouvrement scolarité par classe
          <Badge variant={tauxGlobal >= 75 ? 'default' : tauxGlobal >= 50 ? 'secondary' : 'destructive'} className="ml-auto">
            Global : {tauxGlobal}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recouvrementParNiveau.map(([niveau, classes]) => (
          <NiveauRecouvrementGroup key={niveau} niveau={niveau} classes={classes} />
        ))}
      </CardContent>
    </Card>
  );
}

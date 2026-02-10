import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, CreditCard, BookOpen, GraduationCap, TrendingUp } from 'lucide-react';

const stats = [
  { title: 'Élèves inscrits', value: '—', icon: Users, color: 'text-primary' },
  { title: 'Nouvelles inscriptions', value: '—', icon: UserPlus, color: 'text-accent' },
  { title: 'Paiements du mois', value: '—', icon: CreditCard, color: 'text-secondary' },
  { title: 'Notes saisies', value: '—', icon: BookOpen, color: 'text-info' },
];

export default function Dashboard() {
  const { user, roles } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          Tableau de bord
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur EduGestion Pro — Rôle(s) : {roles.length > 0 ? roles.join(', ') : 'Aucun rôle assigné'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {roles.length === 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium">Aucun rôle assigné</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Contactez un administrateur pour qu'il vous attribue un rôle (Admin, Secrétaire, Service Info ou Comptable).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

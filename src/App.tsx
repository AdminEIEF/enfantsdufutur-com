import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";
import ForcePasswordChange from "@/components/ForcePasswordChange";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./pages/Landing";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inscriptions = lazy(() => import("./pages/Inscriptions"));
const Familles = lazy(() => import("./pages/Familles"));
const Eleves = lazy(() => import("./pages/Eleves"));
const Notes = lazy(() => import("./pages/Notes"));
const Bulletins = lazy(() => import("./pages/Bulletins"));
const Orientation = lazy(() => import("./pages/Orientation"));
const Paiements = lazy(() => import("./pages/Paiements"));
const Depenses = lazy(() => import("./pages/Depenses"));
const Impayes = lazy(() => import("./pages/Impayes"));
const Finances = lazy(() => import("./pages/Finances"));
const Cantine = lazy(() => import("./pages/Cantine"));
const Transport = lazy(() => import("./pages/Transport"));
const Bibliotheque = lazy(() => import("./pages/Bibliotheque"));
const Librairie = lazy(() => import("./pages/Librairie"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Reinscription = lazy(() => import("./pages/Reinscription"));
const Configuration = lazy(() => import("./pages/Configuration"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ElevePublic = lazy(() => import("./pages/ElevePublic"));
const Boutique = lazy(() => import("./pages/Boutique"));
const Tracabilite = lazy(() => import("./pages/Tracabilite"));
const DownloadPage = lazy(() => import("./pages/Download"));
const PreInscriptionPublic = lazy(() => import("./pages/PreInscriptionPublic"));
const CoursAdmin = lazy(() => import("./pages/CoursAdmin"));
const CalendrierScolaire = lazy(() => import("./pages/CalendrierScolaire"));
const EmploiDuTemps = lazy(() => import("./pages/EmploiDuTemps"));
const ParentLogin = lazy(() => import("./pages/parent/ParentLogin"));
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ParentEnfant = lazy(() => import("./pages/parent/ParentEnfant"));
const ParentNotifications = lazy(() => import("./pages/parent/ParentNotifications"));
const StudentLogin = lazy(() => import("./pages/student/StudentLogin"));
const StudentPrimaryLogin = lazy(() => import("./pages/student/StudentPrimaryLogin"));
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentCours = lazy(() => import("./pages/student/StudentCours"));
const StudentDevoirs = lazy(() => import("./pages/student/StudentDevoirs"));
const StudentEmploiDuTemps = lazy(() => import("./pages/student/StudentEmploiDuTemps"));
const StudentResultats = lazy(() => import("./pages/student/StudentResultats"));
const StudentEvaluations = lazy(() => import("./pages/student/StudentEvaluations"));
const StudentNotifications = lazy(() => import("./pages/student/StudentNotifications"));
const StudentQuizMatieres = lazy(() => import("./pages/student/StudentQuizMatieres"));
const Personnel = lazy(() => import("./pages/Personnel"));
const PreInscriptionsAdmin = lazy(() => import("./pages/PreInscriptionsAdmin"));
const EmployeeLogin = lazy(() => import("./pages/employee/EmployeeLogin"));
const EmployeeDashboard = lazy(() => import("./pages/employee/EmployeeDashboard"));
const EmployeeConges = lazy(() => import("./pages/employee/EmployeeConges"));
const EmployeePaie = lazy(() => import("./pages/employee/EmployeePaie"));
const EmployeeNotifications = lazy(() => import("./pages/employee/EmployeeNotifications"));
const EmployeeCourriers = lazy(() => import("./pages/employee/EmployeeCourriers"));
const EmployeePointage = lazy(() => import("./pages/employee/EmployeePointage"));
const EmployeeEvaluation = lazy(() => import("./pages/employee/EmployeeEvaluation"));
const EmployeePlanning = lazy(() => import("./pages/employee/EmployeePlanning"));
const AdminMonitoring = lazy(() => import("./pages/AdminMonitoring"));
const CoordinateurDashboard = lazy(() => import("./pages/CoordinateurDashboard"));
const CoordinateurDocuments = lazy(() => import("./pages/CoordinateurDocuments"));
const CoordinateurEleves = lazy(() => import("./pages/CoordinateurEleves"));
const CoordinateurPersonnel = lazy(() => import("./pages/CoordinateurPersonnel"));
const CoordinateurSecondaireDashboard = lazy(() => import("./pages/CoordinateurSecondaireDashboard"));
const CoordinateurSecondairePersonnel = lazy(() => import("./pages/CoordinateurSecondairePersonnel"));
const CoordinateurSecondaireEleves = lazy(() => import("./pages/CoordinateurSecondaireEleves"));
const MesClasses = lazy(() => import("./pages/MesClasses"));
const Robotique = lazy(() => import("./pages/Robotique"));
const Performance = lazy(() => import("./pages/Performance"));
const RobotiqueDashboard = lazy(() => import("./pages/RobotiqueDashboard"));
const PointageEleves = lazy(() => import("./pages/PointageEleves"));
const PointeurPointage = lazy(() => import("./pages/PointeurPointage"));
const SuperviseurDashboard = lazy(() => import("./pages/SuperviseurDashboard"));
const ServiceInfoDashboard = lazy(() => import("./pages/ServiceInfoDashboard"));
const Corbeille = lazy(() => import("./pages/Corbeille"));
const TresorierDashboard = lazy(() => import("./pages/TresorierDashboard"));
const TresorierGestionSalaires = lazy(() => import("./pages/TresorierGestionSalaires"));
const TresorierAvances = lazy(() => import("./pages/TresorierAvances"));
const TresorierAvancesSoutien = lazy(() => import("./pages/TresorierAvancesSoutien"));
const TresorierHistorique = lazy(() => import("./pages/TresorierHistorique"));
const StudentEcriture = lazy(() => import("./pages/student/StudentEcriture"));
const StudentCalculMental = lazy(() => import("./pages/student/StudentCalculMental"));
const StudentCultureGenerale = lazy(() => import("./pages/student/StudentCultureGenerale"));
const StudentColoriage = lazy(() => import("./pages/student/StudentColoriage"));
const StudentSerpentAlphabet = lazy(() => import("./pages/student/StudentSerpentAlphabet"));
const StudentAnglais = lazy(() => import("./pages/student/StudentAnglais"));
const StudentPyramideAdditions = lazy(() => import("./pages/student/StudentPyramideAdditions"));
const StudentCompositions = lazy(() => import("./pages/student/StudentCompositions"));
const StudentLibrairie = lazy(() => import("./pages/student/StudentLibrairie"));
const CompositionsAdmin = lazy(() => import("./pages/CompositionsAdmin"));
const GestionSessions = lazy(() => import("./pages/GestionSessions"));
const ScanEleveInfo = lazy(() => import("./pages/ScanEleveInfo"));
const CompositionGeometrie = lazy(() => import("./pages/CompositionGeometrie"));
const AdminCompositionResults = lazy(() => import("./pages/AdminCompositionResults"));
const CompositionCanvas = lazy(() => import("./pages/CompositionCanvas"));
const ComposeDessin = lazy(() => import("./pages/ComposeDessin"));
const EnveloppeGenerator = lazy(() => import("./pages/EnveloppeGenerator"));

import { ParentAuthProvider } from "@/hooks/useParentAuth";
import { StudentAuthProvider } from "@/hooks/useStudentAuth";
import { EmployeeAuthProvider } from "@/hooks/useEmployeeAuth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 60_000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// Force refetch all queries when app becomes visible (tab switch, phone unlock)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      queryClient.invalidateQueries();
    }
  });
}

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [mustChange, setMustChange] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('must_change_password').eq('user_id', user.id).single()
        .then(({ data }) => {
          setMustChange(data?.must_change_password ?? false);
        });
    } else {
      setMustChange(null);
    }
  }, [user]);

  if (loading || (user && mustChange === null)) {
    return <LazyFallback />;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (mustChange) return <ForcePasswordChange onSuccess={() => setMustChange(false)} />;
  return <AppLayout>{children}</AppLayout>;
}

function RoleBasedRedirect() {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return <LazyFallback />;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (roles.length === 1) {
    if (roles[0] === 'superviseur') return <Navigate to="/superviseur-dashboard" replace />;
    if (roles[0] === 'cantine') return <Navigate to="/cantine" replace />;
    if (roles[0] === 'boutique') return <Navigate to="/boutique" replace />;
    if (roles[0] === 'librairie') return <Navigate to="/librairie" replace />;
    if ((roles[0] as string) === 'coordinateur') return <Navigate to="/coordinateur-dashboard" replace />;
    if ((roles[0] as string) === 'coordinateur_secondaire') return <Navigate to="/coordinateur-secondaire-dashboard" replace />;
    if (roles[0] === 'robotique') return <Navigate to="/robotique-dashboard" replace />;
    if (roles[0] === 'pointeur') return <Navigate to="/pointeur-pointage" replace />;
    if (roles[0] === 'comptable') return <Navigate to="/paiements" replace />;
    if (roles[0] === 'chauffeur') return <Navigate to="/transport" replace />;
    if (roles[0] === 'surveillant') return <Navigate to="/pointage-eleves" replace />;
    if (roles[0] === 'service_info') return <Navigate to="/service-info-dashboard" replace />;
    if ((roles[0] as string) === 'tresorier') return <Navigate to="/tresorier-dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function AuthRoute() {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return <LazyFallback />;
  }
  if (user) {
    if (roles.length === 1) {
      if (roles[0] === 'superviseur') return <Navigate to="/superviseur-dashboard" replace />;
      if (roles[0] === 'cantine') return <Navigate to="/cantine" replace />;
      if (roles[0] === 'boutique') return <Navigate to="/boutique" replace />;
      if (roles[0] === 'librairie') return <Navigate to="/librairie" replace />;
      if (roles[0] === 'robotique') return <Navigate to="/robotique-dashboard" replace />;
      if (roles[0] === 'pointeur') return <Navigate to="/pointeur-pointage" replace />;
      if (roles[0] === 'comptable') return <Navigate to="/paiements" replace />;
      if (roles[0] === 'chauffeur') return <Navigate to="/transport" replace />;
      if (roles[0] === 'surveillant') return <Navigate to="/pointage-eleves" replace />;
      if (roles[0] === 'service_info') return <Navigate to="/service-info-dashboard" replace />;
      if ((roles[0] as string) === 'tresorier') return <Navigate to="/tresorier-dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <Auth />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" storageKey="lmp-theme">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UpdateBanner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/fiche-eleve/:matricule" element={<ElevePublic />} />
            <Route path="/" element={<Landing />} />
            <Route path="/pre-inscription" element={<PreInscriptionPublic />} />
            <Route path="/parent" element={<ParentAuthProvider><ParentLogin /></ParentAuthProvider>} />
            <Route path="/parent/dashboard" element={<ParentAuthProvider><ParentDashboard /></ParentAuthProvider>} />
            <Route path="/parent/enfant/:id" element={<ParentAuthProvider><ParentEnfant /></ParentAuthProvider>} />
            <Route path="/parent/notifications" element={<ParentAuthProvider><ParentNotifications /></ParentAuthProvider>} />
            <Route path="/eleve" element={<StudentAuthProvider><StudentLogin /></StudentAuthProvider>} />
            <Route path="/eleve-primaire" element={<StudentAuthProvider><StudentPrimaryLogin /></StudentAuthProvider>} />
            <Route path="/eleve/dashboard" element={<StudentAuthProvider><StudentDashboard /></StudentAuthProvider>} />
            <Route path="/eleve/cours" element={<StudentAuthProvider><StudentCours /></StudentAuthProvider>} />
            <Route path="/eleve/devoirs" element={<StudentAuthProvider><StudentDevoirs /></StudentAuthProvider>} />
            <Route path="/eleve/emploi-du-temps" element={<StudentAuthProvider><StudentEmploiDuTemps /></StudentAuthProvider>} />
            <Route path="/eleve/resultats" element={<StudentAuthProvider><StudentResultats /></StudentAuthProvider>} />
            <Route path="/eleve/evaluations" element={<StudentAuthProvider><StudentEvaluations /></StudentAuthProvider>} />
            <Route path="/eleve/notifications" element={<StudentAuthProvider><StudentNotifications /></StudentAuthProvider>} />
            <Route path="/eleve/compositions" element={<StudentAuthProvider><StudentCompositions /></StudentAuthProvider>} />
            <Route path="/eleve/librairie" element={<StudentAuthProvider><StudentLibrairie /></StudentAuthProvider>} />
            <Route path="/employe" element={<EmployeeAuthProvider><EmployeeLogin /></EmployeeAuthProvider>} />
            <Route path="/employe/dashboard" element={<EmployeeAuthProvider><EmployeeDashboard /></EmployeeAuthProvider>} />
            <Route path="/employe/conges" element={<EmployeeAuthProvider><EmployeeConges /></EmployeeAuthProvider>} />
            <Route path="/employe/paie" element={<EmployeeAuthProvider><EmployeePaie /></EmployeeAuthProvider>} />
            <Route path="/employe/notifications" element={<EmployeeAuthProvider><EmployeeNotifications /></EmployeeAuthProvider>} />
            <Route path="/employe/courriers" element={<EmployeeAuthProvider><EmployeeCourriers /></EmployeeAuthProvider>} />
            <Route path="/employe/pointage" element={<EmployeeAuthProvider><EmployeePointage /></EmployeeAuthProvider>} />
            <Route path="/employe/evaluation" element={<EmployeeAuthProvider><EmployeeEvaluation /></EmployeeAuthProvider>} />
            <Route path="/employe/planning" element={<EmployeeAuthProvider><EmployeePlanning /></EmployeeAuthProvider>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inscriptions" element={<ProtectedRoute><Inscriptions /></ProtectedRoute>} />
            <Route path="/familles" element={<ProtectedRoute><Familles /></ProtectedRoute>} />
            <Route path="/eleves" element={<ProtectedRoute><Eleves /></ProtectedRoute>} />
            <Route path="/reinscription" element={<ProtectedRoute><Reinscription /></ProtectedRoute>} />
            <Route path="/corbeille" element={<ProtectedRoute><Corbeille /></ProtectedRoute>} />
            <Route path="/pre-inscriptions" element={<ProtectedRoute><PreInscriptionsAdmin /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/bulletins" element={<ProtectedRoute><Bulletins /></ProtectedRoute>} />
            <Route path="/cours-admin" element={<ProtectedRoute><CoursAdmin /></ProtectedRoute>} />
            <Route path="/calendrier" element={<ProtectedRoute><CalendrierScolaire /></ProtectedRoute>} />
            <Route path="/emploi-du-temps" element={<ProtectedRoute><EmploiDuTemps /></ProtectedRoute>} />
            <Route path="/mes-classes" element={<ProtectedRoute><MesClasses /></ProtectedRoute>} />
            <Route path="/orientation" element={<ProtectedRoute><Orientation /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
            <Route path="/paiements" element={<ProtectedRoute><Paiements /></ProtectedRoute>} />
            <Route path="/depenses" element={<ProtectedRoute><Depenses /></ProtectedRoute>} />
            <Route path="/impayes" element={<ProtectedRoute><Impayes /></ProtectedRoute>} />
            <Route path="/finances" element={<ProtectedRoute><Finances /></ProtectedRoute>} />
            <Route path="/cantine" element={<ProtectedRoute><Cantine /></ProtectedRoute>} />
            <Route path="/transport" element={<ProtectedRoute><Transport /></ProtectedRoute>} />
            <Route path="/librairie" element={<ProtectedRoute><Librairie /></ProtectedRoute>} />
            <Route path="/bibliotheque" element={<ProtectedRoute><Bibliotheque /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/personnel" element={<ProtectedRoute><Personnel /></ProtectedRoute>} />
            <Route path="/boutique" element={<ProtectedRoute><Boutique /></ProtectedRoute>} />
            <Route path="/tracabilite" element={<ProtectedRoute><Tracabilite /></ProtectedRoute>} />
            <Route path="/supervision" element={<ProtectedRoute><AdminMonitoring /></ProtectedRoute>} />
            <Route path="/service-info-dashboard" element={<ProtectedRoute><ServiceInfoDashboard /></ProtectedRoute>} />
            <Route path="/superviseur-dashboard" element={<ProtectedRoute><SuperviseurDashboard /></ProtectedRoute>} />
            <Route path="/compositions-admin" element={<ProtectedRoute><CompositionsAdmin /></ProtectedRoute>} />
            <Route path="/resultats-compositions" element={<ProtectedRoute><AdminCompositionResults /></ProtectedRoute>} />
            <Route path="/coordinateur-dashboard" element={<ProtectedRoute><CoordinateurDashboard /></ProtectedRoute>} />
            <Route path="/coordinateur-documents" element={<ProtectedRoute><CoordinateurDocuments /></ProtectedRoute>} />
            <Route path="/coordinateur-eleves" element={<ProtectedRoute><CoordinateurEleves /></ProtectedRoute>} />
            <Route path="/coordinateur-personnel" element={<ProtectedRoute><CoordinateurPersonnel /></ProtectedRoute>} />
            <Route path="/coordinateur-secondaire-dashboard" element={<ProtectedRoute><CoordinateurSecondaireDashboard /></ProtectedRoute>} />
            <Route path="/coordinateur-secondaire-personnel" element={<ProtectedRoute><CoordinateurSecondairePersonnel /></ProtectedRoute>} />
            <Route path="/coordinateur-secondaire-eleves" element={<ProtectedRoute><CoordinateurSecondaireEleves /></ProtectedRoute>} />
            <Route path="/robotique" element={<ProtectedRoute><Robotique /></ProtectedRoute>} />
            <Route path="/robotique-dashboard" element={<ProtectedRoute><RobotiqueDashboard /></ProtectedRoute>} />
            <Route path="/pointage-eleves" element={<ProtectedRoute><PointageEleves /></ProtectedRoute>} />
            <Route path="/pointeur-pointage" element={<ProtectedRoute><PointeurPointage /></ProtectedRoute>} />
            <Route path="/tresorier-dashboard" element={<ProtectedRoute><TresorierDashboard /></ProtectedRoute>} />
            <Route path="/tresorier-salaires" element={<ProtectedRoute><TresorierGestionSalaires /></ProtectedRoute>} />
            <Route path="/tresorier-avances" element={<ProtectedRoute><TresorierAvances /></ProtectedRoute>} />
            <Route path="/tresorier-avances-soutien" element={<ProtectedRoute><TresorierAvancesSoutien /></ProtectedRoute>} />
            <Route path="/tresorier-historique" element={<ProtectedRoute><TresorierHistorique /></ProtectedRoute>} />
            <Route path="/eleve/ecriture" element={<StudentAuthProvider><StudentEcriture /></StudentAuthProvider>} />
            <Route path="/eleve/calcul" element={<StudentAuthProvider><StudentCalculMental /></StudentAuthProvider>} />
            <Route path="/eleve/culture" element={<StudentAuthProvider><StudentCultureGenerale /></StudentAuthProvider>} />
            <Route path="/eleve/coloriage" element={<StudentAuthProvider><StudentColoriage /></StudentAuthProvider>} />
            <Route path="/eleve/serpent" element={<StudentAuthProvider><StudentSerpentAlphabet /></StudentAuthProvider>} />
            <Route path="/eleve/anglais" element={<StudentAuthProvider><StudentAnglais /></StudentAuthProvider>} />
            <Route path="/eleve/pyramide" element={<StudentAuthProvider><StudentPyramideAdditions /></StudentAuthProvider>} />
            <Route path="/eleve/quiz-matieres" element={<StudentAuthProvider><StudentQuizMatieres /></StudentAuthProvider>} />
            <Route path="/scan-eleve" element={<ProtectedRoute><ScanEleveInfo /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute><GestionSessions /></ProtectedRoute>} />
            <Route path="/composition-geometrie" element={<ProtectedRoute><CompositionGeometrie /></ProtectedRoute>} />
            <Route path="/composition-canvas" element={<StudentAuthProvider><CompositionCanvas /></StudentAuthProvider>} />
            <Route path="/compose-dessin" element={<ProtectedRoute><ComposeDessin /></ProtectedRoute>} />
            <Route path="/enveloppes" element={<ProtectedRoute><EnveloppeGenerator /></ProtectedRoute>} />
            <Route path="/configuration" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;

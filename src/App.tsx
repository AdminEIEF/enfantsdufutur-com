import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inscriptions from "./pages/Inscriptions";
import Familles from "./pages/Familles";
import Eleves from "./pages/Eleves";
import Notes from "./pages/Notes";
import Bulletins from "./pages/Bulletins";
import Orientation from "./pages/Orientation";
import Paiements from "./pages/Paiements";
import Depenses from "./pages/Depenses";
import Impayes from "./pages/Impayes";
import Finances from "./pages/Finances";
import Cantine from "./pages/Cantine";
import Transport from "./pages/Transport";
import Bibliotheque from "./pages/Bibliotheque";
import Librairie from "./pages/Librairie";
import Notifications from "./pages/Notifications";
import Reinscription from "./pages/Reinscription";
import Configuration from "./pages/Configuration";
import NotFound from "./pages/NotFound";
import ElevePublic from "./pages/ElevePublic";
import Boutique from "./pages/Boutique";
import Tracabilite from "./pages/Tracabilite";
import DownloadPage from "./pages/Download";
import Landing from "./pages/Landing";
import CoursAdmin from "./pages/CoursAdmin";
import CalendrierScolaire from "./pages/CalendrierScolaire";
import ParentLogin from "./pages/parent/ParentLogin";
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentEnfant from "./pages/parent/ParentEnfant";
import { ParentAuthProvider } from "@/hooks/useParentAuth";
import { StudentAuthProvider } from "@/hooks/useStudentAuth";
import { EmployeeAuthProvider } from "@/hooks/useEmployeeAuth";
import StudentLogin from "./pages/student/StudentLogin";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentCours from "./pages/student/StudentCours";
import StudentDevoirs from "./pages/student/StudentDevoirs";
import StudentResultats from "./pages/student/StudentResultats";
import ParentNotifications from "./pages/parent/ParentNotifications";
import StudentNotifications from "./pages/student/StudentNotifications";
import Personnel from "./pages/Personnel";
import EmployeeLogin from "./pages/employee/EmployeeLogin";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeConges from "./pages/employee/EmployeeConges";
import EmployeePaie from "./pages/employee/EmployeePaie";
import EmployeeNotifications from "./pages/employee/EmployeeNotifications";
import EmployeeCourriers from "./pages/employee/EmployeeCourriers";
import EmployeePointage from "./pages/employee/EmployeePointage";
import EmployeeEvaluation from "./pages/employee/EmployeeEvaluation";
import EmployeePlanning from "./pages/employee/EmployeePlanning";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function RoleBasedRedirect() {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  // Redirect to role-specific page for single-purpose roles
  if (roles.length === 1) {
    if (roles[0] === 'cantine') return <Navigate to="/cantine" replace />;
    if (roles[0] === 'boutique') return <Navigate to="/boutique" replace />;
    if (roles[0] === 'librairie') return <Navigate to="/librairie" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function AuthRoute() {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) {
    if (roles.length === 1) {
      if (roles[0] === 'cantine') return <Navigate to="/cantine" replace />;
      if (roles[0] === 'boutique') return <Navigate to="/boutique" replace />;
      if (roles[0] === 'librairie') return <Navigate to="/librairie" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/fiche-eleve/:matricule" element={<ElevePublic />} />
            <Route path="/" element={<Landing />} />
            <Route path="/parent" element={<ParentAuthProvider><ParentLogin /></ParentAuthProvider>} />
            <Route path="/parent/dashboard" element={<ParentAuthProvider><ParentDashboard /></ParentAuthProvider>} />
            <Route path="/parent/enfant/:id" element={<ParentAuthProvider><ParentEnfant /></ParentAuthProvider>} />
            <Route path="/parent/notifications" element={<ParentAuthProvider><ParentNotifications /></ParentAuthProvider>} />
            <Route path="/eleve" element={<StudentAuthProvider><StudentLogin /></StudentAuthProvider>} />
            <Route path="/eleve/dashboard" element={<StudentAuthProvider><StudentDashboard /></StudentAuthProvider>} />
            <Route path="/eleve/cours" element={<StudentAuthProvider><StudentCours /></StudentAuthProvider>} />
            <Route path="/eleve/devoirs" element={<StudentAuthProvider><StudentDevoirs /></StudentAuthProvider>} />
            <Route path="/eleve/resultats" element={<StudentAuthProvider><StudentResultats /></StudentAuthProvider>} />
            <Route path="/eleve/notifications" element={<StudentAuthProvider><StudentNotifications /></StudentAuthProvider>} />
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
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/bulletins" element={<ProtectedRoute><Bulletins /></ProtectedRoute>} />
            <Route path="/cours-admin" element={<ProtectedRoute><CoursAdmin /></ProtectedRoute>} />
            <Route path="/calendrier" element={<ProtectedRoute><CalendrierScolaire /></ProtectedRoute>} />
            <Route path="/orientation" element={<ProtectedRoute><Orientation /></ProtectedRoute>} />
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
            <Route path="/configuration" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

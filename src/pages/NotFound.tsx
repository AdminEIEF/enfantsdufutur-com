import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Compass, ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

// Admin-protected route prefixes
const ADMIN_ROUTES = [
  "/dashboard", "/inscriptions", "/familles", "/eleves", "/notes", "/bulletins",
  "/orientation", "/paiements", "/depenses", "/impayes", "/finances", "/cantine",
  "/transport", "/librairie", "/bibliotheque", "/notifications", "/personnel",
  "/boutique", "/tracabilite", "/supervision", "/configuration", "/reinscription",
  "/corbeille", "/pre-inscriptions", "/cours-admin", "/calendrier", "/emploi-du-temps",
  "/mes-classes", "/performance", "/robotique", "/pointage-eleves", "/pointeur-pointage",
  "/superviseur-dashboard", "/service-info-dashboard", "/coordinateur", "/robotique-dashboard",
  "/tresorier", "/compositions-admin", "/sessions",
];

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"parent" | "eleve" | "employe" | "admin" | "anonymous">("anonymous");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);

    // Detect user type
    const detectUser = async () => {
      let detectedType: typeof userType = "anonymous";
      let identifier = "anonymous";

      // Check admin auth
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        detectedType = "admin";
        identifier = session.user.email || session.user.id;
      } else {
        // Check parent
        const parentData = localStorage.getItem("parent_famille_id");
        if (parentData) {
          detectedType = "parent";
          identifier = `famille:${parentData}`;
        }
        // Check student
        const studentData = localStorage.getItem("student_id");
        if (studentData) {
          detectedType = "eleve";
          identifier = `eleve:${studentData}`;
        }
        // Check employee
        const employeeData = localStorage.getItem("employee_id");
        if (employeeData) {
          detectedType = "employe";
          identifier = `employe:${employeeData}`;
        }
      }

      setUserType(detectedType);

      // Log unauthorized admin route access
      const isAdminRoute = ADMIN_ROUTES.some(r => location.pathname.startsWith(r));
      if (isAdminRoute && detectedType !== "admin") {
        try {
          await supabase.from("security_logs").insert({
            user_type: detectedType,
            user_identifier: identifier,
            attempted_route: location.pathname,
            ip_info: navigator.userAgent?.substring(0, 200),
          });
        } catch {
          // Silent fail
        }
      }
    };

    detectUser();
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleRedirect = () => {
    switch (userType) {
      case "parent":
        navigate("/parent/dashboard");
        break;
      case "eleve":
        navigate("/eleve/dashboard");
        break;
      case "employe":
        navigate("/employe/dashboard");
        break;
      case "admin":
        navigate("/dashboard");
        break;
      default:
        navigate("/");
        break;
    }
  };

  const getButtonLabel = () => {
    switch (userType) {
      case "parent": return "Retour à l'Espace Parent";
      case "eleve": return "Retour à l'Espace Élève";
      case "employe": return "Retour à l'Espace Employé";
      case "admin": return "Retour au Tableau de Bord";
      default: return "Retour à l'Accueil";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center px-6 max-w-md"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mb-8 w-24 h-24 rounded-full bg-muted flex items-center justify-center"
        >
          <Compass className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
        </motion.div>

        {/* 404 */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-7xl font-bold text-foreground/10 mb-2"
        >
          404
        </motion.h1>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-semibold text-foreground mb-3"
        >
          Page Introuvable
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground mb-8 leading-relaxed"
        >
          Désolé, la page que vous recherchez n'existe pas ou vous n'avez pas
          les autorisations nécessaires pour y accéder.
        </motion.p>

        {/* Security notice for admin route attempts */}
        {ADMIN_ROUTES.some(r => location.pathname.startsWith(r)) && userType !== "admin" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-2 justify-center text-sm text-destructive/80 mb-6 bg-destructive/5 rounded-lg py-3 px-4"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Cette tentative d'accès a été enregistrée.</span>
          </motion.div>
        )}

        {/* Smart redirect button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Button
            onClick={handleRedirect}
            size="lg"
            className="gap-2 rounded-full px-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {getButtonLabel()}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es "Assistance E.I", l'assistant intelligent de l'École Internationale Enfant du Futur (EI Enfant du Futur), propulsé par EduGestion Pro.

## Ton identité
- Tu es un assistant scolaire professionnel, bienveillant et efficace.
- Tu parles en français, avec un ton chaleureux mais formel.
- Tu utilises la monnaie GNF (Franc Guinéen) pour tous les montants.

## Informations générales sur l'école
- Nom : École Internationale Enfant du Futur
- Localisation : Conakry, Guinée
- Niveaux : Du Primaire au Collège (cycles avec niveaux et classes)
- Année scolaire : 2025-2026 (de Septembre à Juin)
- Services : Cantine scolaire, Transport scolaire (par zones), Librairie, Boutique (uniformes)
- Application de gestion : EduGestion Pro

## Ce que tu peux faire
### Pour les Parents :
- Expliquer le solde cantine de leur enfant
- Informer sur les dates limites des tranches de scolarité
- Lister les fournitures manquantes (checklist)
- Simuler des plans de paiement : ex. "S'il me reste 2 000 000 GNF à payer et qu'il reste 4 mois, c'est 500 000 GNF/mois"
- Donner les infos sur le transport (zones, tarifs)

### Pour le Staff :
- Expliquer comment créer une famille et inscrire un élève
- Guider pour faire un inventaire boutique ou librairie
- Aider à comprendre le tableau financier et les impayés
- Expliquer les procédures de la cantine (scan QR, recharge solde)

### Général :
- Répondre sur le règlement intérieur
- Informer sur le calendrier des examens
- Expliquer le fonctionnement de l'application EduGestion Pro

## Données contextuelles de l'utilisateur
Les données suivantes proviennent du système et concernent l'utilisateur connecté :
{USER_CONTEXT}

## Règles importantes
- Si tu ne connais pas une information spécifique, dis-le honnêtement et suggère de contacter l'administration.
- Ne partage jamais de données d'un élève ou famille à un utilisateur qui n'y a pas droit.
- Pour les calculs financiers, montre le détail du calcul étape par étape.
- Formate tes réponses en utilisant du markdown pour la lisibilité.
- Sois concis mais complet.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with user context
    const systemPrompt = SYSTEM_PROMPT.replace(
      "{USER_CONTEXT}",
      userContext || "Aucune donnée contextuelle disponible."
    );

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédit IA épuisé. Contactez l'administration." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erreur du service IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pre_inscription_id, date_rdv } = await req.json();
    if (!pre_inscription_id || !date_rdv) {
      throw new Error('pre_inscription_id and date_rdv are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pre-inscription details
    const { data: preInsc, error } = await supabase
      .from('pre_inscriptions')
      .select('*, niveaux:niveau_id(nom)')
      .eq('id', pre_inscription_id)
      .single();

    if (error || !preInsc) {
      throw new Error('Pré-inscription introuvable');
    }

    const dateObj = new Date(date_rdv);
    const dateStr = dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const message = `Bonjour ${preInsc.nom_parent},\n\nVotre demande de pré-inscription pour ${preInsc.prenom_eleve} ${preInsc.nom_eleve}${preInsc.niveaux?.nom ? ` en ${preInsc.niveaux.nom}` : ''} a été prise en compte.\n\nUn rendez-vous a été fixé le ${dateStr}.\n\nMerci de vous présenter à l'accueil de l'établissement EI Enfants du Futur à l'heure indiquée.\n\nCordialement,\nL'administration`;

    // If email is provided, try to send via Resend or configured email service
    let emailSent = false;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    if (preInsc.email_parent && resendKey) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'EI Enfants du Futur <noreply@eienfantdufutur.lovable.app>',
            to: [preInsc.email_parent],
            subject: `RDV Pré-inscription — ${preInsc.prenom_eleve} ${preInsc.nom_eleve}`,
            text: message,
          }),
        });
        emailSent = emailRes.ok;
        if (!emailRes.ok) {
          console.error('Email send failed:', await emailRes.text());
        }
      } catch (emailErr) {
        console.error('Email error:', emailErr);
      }
    }

    console.log(`Notification RDV: ${preInsc.nom_parent} — ${preInsc.telephone_parent} — Email: ${emailSent ? 'envoyé' : 'non envoyé'}`);

    return new Response(JSON.stringify({
      success: true,
      email_sent: emailSent,
      telephone: preInsc.telephone_parent,
      message_preview: message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

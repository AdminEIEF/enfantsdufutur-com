import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AT_API_URL = 'https://api.africastalking.com/version1/messaging';
const AT_SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';

async function sendSMS(phone: string, message: string): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get('AFRICASTALKING_API_KEY');
  const username = Deno.env.get('AFRICASTALKING_USERNAME');

  if (!apiKey || !username) {
    console.warn('Africa\'s Talking credentials not configured');
    return { sent: false, error: 'SMS credentials not configured' };
  }

  // Normalize phone number to international format (+224...)
  let normalizedPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (!normalizedPhone.startsWith('+')) {
    if (normalizedPhone.startsWith('00')) {
      normalizedPhone = '+' + normalizedPhone.slice(2);
    } else if (normalizedPhone.startsWith('6') || normalizedPhone.startsWith('3')) {
      normalizedPhone = '+224' + normalizedPhone;
    }
  }

  const isSandbox = username === 'sandbox';
  const url = isSandbox ? AT_SANDBOX_URL : AT_API_URL;

  try {
    const body = new URLSearchParams({
      username,
      to: normalizedPhone,
      message,
      from: isSandbox ? '' : 'EI-FUTUR',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    const data = await res.json();
    console.log('AT SMS response:', JSON.stringify(data));

    const recipients = data?.SMSMessageData?.Recipients;
    if (recipients && recipients.length > 0) {
      const status = recipients[0].statusCode;
      if (status === 101 || status === 100) {
        return { sent: true };
      }
      return { sent: false, error: `SMS status: ${recipients[0].status}` };
    }

    return { sent: false, error: data?.SMSMessageData?.Message || 'Unknown SMS error' };
  } catch (err) {
    console.error('SMS send error:', err);
    return { sent: false, error: err.message };
  }
}

async function sendEmail(email: string, subject: string, text: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!email || !resendKey) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EI Enfants du Futur <noreply@eienfantdufutur.lovable.app>',
        to: [email],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error('Email failed:', await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error('Email error:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pre_inscription_id, date_rdv } = await req.json();
    if (!pre_inscription_id || !date_rdv) {
      throw new Error('pre_inscription_id and date_rdv are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: preInsc, error } = await supabase
      .from('pre_inscriptions')
      .select('*, niveaux:niveau_id(nom)')
      .eq('id', pre_inscription_id)
      .single();

    if (error || !preInsc) throw new Error('Pré-inscription introuvable');

    const dateObj = new Date(date_rdv);
    const dateStr = dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const smsMessage = `EI Enfants du Futur: RDV fixé pour ${preInsc.prenom_eleve} ${preInsc.nom_eleve} le ${dateStr}. Présentez-vous à l'accueil. Cordialement.`;

    const emailMessage = `Bonjour ${preInsc.nom_parent},\n\nVotre demande de pré-inscription pour ${preInsc.prenom_eleve} ${preInsc.nom_eleve}${preInsc.niveaux?.nom ? ` en ${preInsc.niveaux.nom}` : ''} a été prise en compte.\n\nUn rendez-vous a été fixé le ${dateStr}.\n\nMerci de vous présenter à l'accueil de l'établissement EI Enfants du Futur à l'heure indiquée.\n\nCordialement,\nL'administration`;

    // Send SMS and Email in parallel
    const [smsResult, emailSent] = await Promise.all([
      sendSMS(preInsc.telephone_parent, smsMessage),
      sendEmail(
        preInsc.email_parent,
        `RDV Pré-inscription — ${preInsc.prenom_eleve} ${preInsc.nom_eleve}`,
        emailMessage,
      ),
    ]);

    console.log(`Notification RDV: ${preInsc.nom_parent} — Tel: ${preInsc.telephone_parent} (SMS: ${smsResult.sent}) — Email: ${emailSent}`);

    return new Response(JSON.stringify({
      success: true,
      sms_sent: smsResult.sent,
      sms_error: smsResult.error || null,
      email_sent: emailSent,
      telephone: preInsc.telephone_parent,
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

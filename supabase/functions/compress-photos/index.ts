import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all students with photos
    const { data: eleves, error: fetchErr } = await supabase
      .from("eleves")
      .select("id, nom, prenom, photo_url")
      .not("photo_url", "is", null)
      .is("deleted_at", null);

    if (fetchErr) throw fetchErr;

    const results: { id: string; nom: string; status: string; oldSize?: number; newSize?: number }[] = [];

    for (const eleve of eleves || []) {
      try {
        if (!eleve.photo_url) continue;

        // Download the current photo
        const response = await fetch(eleve.photo_url);
        if (!response.ok) {
          results.push({ id: eleve.id, nom: `${eleve.prenom} ${eleve.nom}`, status: "download_failed" });
          continue;
        }

        const originalBlob = await response.arrayBuffer();
        const oldSize = originalBlob.byteLength;

        // Skip if already small (< 100KB)
        if (oldSize < 100_000) {
          results.push({ id: eleve.id, nom: `${eleve.prenom} ${eleve.nom}`, status: "already_small", oldSize });
          continue;
        }

        // Use canvas-like approach via sharp-like processing
        // Since Deno edge functions don't have canvas, we'll use a simpler approach:
        // Re-upload with reduced quality using the image as-is but convert to smaller JPEG
        
        // We'll use the built-in ImageBitmap API available in Deno
        const bitmap = await createImageBitmap(new Blob([originalBlob]));
        
        // Calculate new dimensions (max 400px)
        const maxDim = 400;
        const ratio = Math.min(maxDim / bitmap.width, maxDim / bitmap.height, 1);
        const newWidth = Math.round(bitmap.width * ratio);
        const newHeight = Math.round(bitmap.height * ratio);

        // Create OffscreenCanvas for resizing
        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
        bitmap.close();

        // Convert to compressed JPEG
        const compressedBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
        const compressedBuffer = await compressedBlob.arrayBuffer();
        const newSize = compressedBuffer.byteLength;

        // Upload compressed version
        const path = `eleves/${eleve.id}/photo_compressed_${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("photos")
          .upload(path, new Uint8Array(compressedBuffer), {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadErr) {
          results.push({ id: eleve.id, nom: `${eleve.prenom} ${eleve.nom}`, status: "upload_failed" });
          continue;
        }

        // Get new signed URL
        const { data: signedData } = await supabase.storage
          .from("photos")
          .createSignedUrl(path, 31536000);

        if (signedData?.signedUrl) {
          // Update student record
          await supabase
            .from("eleves")
            .update({ photo_url: signedData.signedUrl })
            .eq("id", eleve.id);

          results.push({
            id: eleve.id,
            nom: `${eleve.prenom} ${eleve.nom}`,
            status: "compressed",
            oldSize,
            newSize,
          });
        }
      } catch (err) {
        results.push({
          id: eleve.id,
          nom: `${eleve.prenom} ${eleve.nom}`,
          status: `error: ${(err as Error).message}`,
        });
      }
    }

    const compressed = results.filter((r) => r.status === "compressed");
    const totalSaved = compressed.reduce((s, r) => s + ((r.oldSize || 0) - (r.newSize || 0)), 0);

    return new Response(
      JSON.stringify({
        total: results.length,
        compressed: compressed.length,
        skipped: results.filter((r) => r.status === "already_small").length,
        failed: results.filter((r) => r.status.includes("failed") || r.status.includes("error")).length,
        totalSavedKB: Math.round(totalSaved / 1024),
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

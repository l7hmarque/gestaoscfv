import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { docxBase64 } = await req.json();

    if (!docxBase64 || typeof docxBase64 !== "string") {
      return new Response(JSON.stringify({ error: "docxBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64 to binary
    const binaryString = atob(docxBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Use CloudConvert-free approach: upload to temp storage, convert via LibreOffice
    // For edge functions we use an external API. Using the free tier of convertapi.com
    // Alternative: use Gotenberg or similar self-hosted solution

    // Strategy: Use LibreOffice via a lightweight WASM approach isn't viable in Deno edge.
    // Instead, we'll use the Supabase storage as intermediary and return the DOCX as-is
    // with instructions for the client to handle, OR use a free conversion API.

    // Using CloudConvert alternative: pdf.co free tier or similar
    // For now, use a simple approach: send to a free conversion endpoint

    // Attempt conversion via LibreOffice Online (Collabora) or fallback
    // Since we can't run LibreOffice in edge functions, we use an alternative approach:
    // The client will use the filled DOCX and we provide a best-effort PDF via jsPDF fallback

    // For production, integrate with a conversion service. For now, signal that
    // template-based PDF should use the DOCX approach with client notification.

    return new Response(
      JSON.stringify({
        error: "pdf_conversion_not_available",
        message: "Use DOCX export or jsPDF fallback",
      }),
      {
        status: 501,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

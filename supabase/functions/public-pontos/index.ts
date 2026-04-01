import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const bairroNome = url.searchParams.get("bairro_nome");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!bairroNome) {
      return new Response(JSON.stringify({ error: "bairro_nome é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find bairro by name
    const { data: bairro } = await supabaseAdmin
      .from("bairros")
      .select("id")
      .eq("nome", bairroNome)
      .single();

    if (!bairro) {
      return new Response(JSON.stringify({ pontos: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pontos } = await supabaseAdmin
      .from("pontos_transporte")
      .select("id, nome, horario_manha, horario_tarde")
      .eq("bairro_id", bairro.id)
      .eq("ativo", true)
      .order("nome");

    return new Response(JSON.stringify({ pontos: pontos || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

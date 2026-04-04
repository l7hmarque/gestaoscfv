import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { count: totalParticipantes } = await supabase
      .from("participantes")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo");

    const { count: totalTurmas } = await supabase
      .from("turmas")
      .select("*", { count: "exact", head: true })
      .eq("ativa", true);

    const { count: totalAtendimentos } = await supabase
      .from("atendimentos")
      .select("*", { count: "exact", head: true });

    // Frequency average from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: presencas } = await supabase
      .from("presenca")
      .select("presente")
      .gte("data", thirtyDaysAgo.toISOString().split("T")[0]);

    let mediaFrequencia = 0;
    if (presencas && presencas.length > 0) {
      const presentes = presencas.filter((p: any) => p.presente).length;
      mediaFrequencia = (presentes / presencas.length) * 100;
    }

    return new Response(
      JSON.stringify({
        totalParticipantes: totalParticipantes || 0,
        totalTurmas: totalTurmas || 0,
        mediaFrequencia,
        totalAtendimentos: totalAtendimentos || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

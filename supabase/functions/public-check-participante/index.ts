import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nome_completo, data_nascimento } = await req.json();

    if (!nome_completo?.trim() || !data_nascimento) {
      return respond({ found: false });
    }

    const nomePadronizado = nome_completo.trim().toUpperCase();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabaseAdmin
      .from("participantes")
      .select(`
        id, nome_completo, data_nascimento, genero, cor_raca,
        escola, serie, periodo, endereco_rua, endereco_numero,
        endereco_bairro, bairro_id, ponto_transporte_id,
        restricao_alimentar, laudo, status,
        bairros:bairro_id(id, nome)
      `)
      .eq("nome_completo", nomePadronizado)
      .eq("data_nascimento", data_nascimento)
      .limit(1)
      .maybeSingle();

    if (error) return respond({ found: false });

    if (!data) return respond({ found: false });

    // Return participant data WITHOUT sensitive PII (no CPF, no WhatsApp, no responsável names)
    return respond({
      found: true,
      participante: {
        id: data.id,
        nome_completo: data.nome_completo,
        data_nascimento: data.data_nascimento,
        genero: data.genero,
        cor_raca: data.cor_raca,
        escola: data.escola,
        serie: data.serie,
        periodo: data.periodo,
        endereco_rua: data.endereco_rua,
        endereco_numero: data.endereco_numero,
        endereco_bairro: data.endereco_bairro,
        bairro_id: data.bairro_id,
        bairro_nome: (data as any).bairros?.nome || null,
        ponto_transporte_id: data.ponto_transporte_id,
        restricao_alimentar: data.restricao_alimentar,
        laudo: data.laudo,
        status: data.status,
      },
    });
  } catch (err) {
    return respond({ found: false });
  }
});

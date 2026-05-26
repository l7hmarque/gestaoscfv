import { createClient } from "npm:@supabase/supabase-js@2.49.4";

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

/** Remove accents from a string */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nome_completo, data_nascimento } = await req.json();

    if (!nome_completo?.trim() || !data_nascimento) {
      return respond({ found: false });
    }

    const nomePadronizado = stripAccents(nome_completo.trim().toUpperCase());

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Exact match (case-insensitive + accent-insensitive via padronizado)
    const { data, error } = await supabaseAdmin
      .from("participantes")
      .select(`
        id, nome_completo, data_nascimento, genero, cor_raca,
        escola, serie, periodo, endereco_rua, endereco_numero,
        endereco_bairro, bairro_id, ponto_transporte_id,
        restricao_alimentar, laudo, status,
        bairros:bairro_id(id, nome)
      `)
      .ilike("nome_completo", nomePadronizado)
      .eq("data_nascimento", data_nascimento)
      .limit(1)
      .maybeSingle();

    if (error) return respond({ found: false });

    if (data) {
      return respond({
        found: true,
        match_type: "exact",
        participante: buildSafeParticipante(data),
      });
    }

    // Fuzzy fallback: search by same birth date + trigram similarity
    const { data: fuzzyResults } = await supabaseAdmin.rpc("find_fuzzy_participant", {
      _nome: nomePadronizado,
      _data_nascimento: data_nascimento,
    });

    if (fuzzyResults && fuzzyResults.length > 0) {
      const best = fuzzyResults[0];
      // Fetch full participant data
      const { data: fullPart } = await supabaseAdmin
        .from("participantes")
        .select(`
          id, nome_completo, data_nascimento, genero, cor_raca,
          escola, serie, periodo, endereco_rua, endereco_numero,
          endereco_bairro, bairro_id, ponto_transporte_id,
          restricao_alimentar, laudo, status,
          bairros:bairro_id(id, nome)
        `)
        .eq("id", best.id)
        .single();

      if (fullPart) {
        return respond({
          found: true,
          match_type: "fuzzy",
          similaridade: best.sim,
          participante: buildSafeParticipante(fullPart),
        });
      }
    }

    return respond({ found: false });
  } catch (err) {
    return respond({ found: false });
  }
});

function buildSafeParticipante(data: any) {
  return {
    id: data.id,
    nome_completo: data.nome_completo,
    data_nascimento: data.data_nascimento,
    genero: data.genero,
    cor_raca: data.cor_raca,
    escola: data.escola,
    serie: data.serie,
    periodo: data.periodo,
    bairro_id: data.bairro_id,
    bairro_nome: data.bairros?.nome || null,
    ponto_transporte_id: data.ponto_transporte_id,
    status: data.status,
  };
}

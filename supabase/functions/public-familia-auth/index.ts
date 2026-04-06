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

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nome_completo, data_nascimento } = await req.json();

    if (!nome_completo?.trim() || !data_nascimento) {
      return respond({ error: "Nome e data de nascimento são obrigatórios" }, 400);
    }

    const nomePadronizado = stripAccents(nome_completo.trim().toUpperCase());

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Exact match
    const { data: exactMatch } = await supabaseAdmin
      .from("participantes")
      .select("id, nome_completo, data_nascimento, genero, foto_url, status, periodo, bairro_id, ponto_transporte_id, responsavel1_nome, responsavel2_nome, escola, serie, endereco_bairro, iniciou_em, bairros:bairro_id(id, nome), pontos_transporte:ponto_transporte_id(id, nome, horario_manha, horario_tarde, bairro_id, bairros:bairro_id(nome))")
      .ilike("nome_completo", nomePadronizado)
      .eq("data_nascimento", data_nascimento)
      .in("status", ["ativo", "pendente"])
      .limit(1)
      .maybeSingle();

    let participante = exactMatch;
    let matchType = "exact";

    // 2. Fuzzy fallback
    if (!participante) {
      const { data: fuzzyResults } = await supabaseAdmin.rpc("find_fuzzy_participant", {
        _nome: nomePadronizado,
        _data_nascimento: data_nascimento,
      });

      if (fuzzyResults && fuzzyResults.length > 0) {
        const best = fuzzyResults[0];
        const { data: fullPart } = await supabaseAdmin
          .from("participantes")
          .select("id, nome_completo, data_nascimento, genero, foto_url, status, periodo, bairro_id, ponto_transporte_id, responsavel1_nome, responsavel2_nome, escola, serie, endereco_bairro, iniciou_em, bairros:bairro_id(id, nome), pontos_transporte:ponto_transporte_id(id, nome, horario_manha, horario_tarde, bairro_id, bairros:bairro_id(nome))")
          .eq("id", best.id)
          .single();

        if (fullPart) {
          return respond({
            found: true,
            match_type: "fuzzy",
            similaridade: best.sim,
            participantes: [buildSafe(fullPart)],
            needs_confirmation: true,
          });
        }
      }
      return respond({ found: false });
    }

    // 3. Find siblings by responsavel name
    const siblings = await findSiblings(supabaseAdmin, participante);

    return respond({
      found: true,
      match_type: matchType,
      participantes: [buildSafe(participante), ...siblings.map(buildSafe)],
      needs_confirmation: false,
    });
  } catch (err) {
    return respond({ error: err.message }, 500);
  }
});

async function findSiblings(supabase: any, participante: any) {
  const respNome = participante.responsavel1_nome || participante.responsavel2_nome;
  if (!respNome) return [];

  const { data } = await supabase
    .from("participantes")
    .select("id, nome_completo, data_nascimento, genero, foto_url, status, periodo, bairro_id, ponto_transporte_id, responsavel1_nome, responsavel2_nome, escola, serie, endereco_bairro, iniciou_em, bairros:bairro_id(id, nome), pontos_transporte:ponto_transporte_id(id, nome, horario_manha, horario_tarde, bairro_id, bairros:bairro_id(nome))")
    .neq("id", participante.id)
    .in("status", ["ativo", "pendente"])
    .or(`responsavel1_nome.ilike.${respNome},responsavel2_nome.ilike.${respNome}`);

  return data || [];
}

function buildSafe(p: any) {
  return {
    id: p.id,
    nome_completo: p.nome_completo,
    data_nascimento: p.data_nascimento,
    genero: p.genero,
    foto_url: p.foto_url,
    status: p.status,
    periodo: p.periodo,
    escola: p.escola,
    serie: p.serie,
    endereco_bairro: p.endereco_bairro,
    iniciou_em: p.iniciou_em || null,
    bairro_nome: p.bairros?.nome || null,
    ponto_transporte: p.pontos_transporte ? {
      id: p.pontos_transporte.id,
      nome: p.pontos_transporte.nome,
      horario_manha: p.pontos_transporte.horario_manha,
      horario_tarde: p.pontos_transporte.horario_tarde,
      bairro_nome: p.pontos_transporte.bairros?.nome || null,
    } : null,
  };
}

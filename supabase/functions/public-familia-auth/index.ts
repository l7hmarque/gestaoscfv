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

// HMAC-signed token: base64url(JSON payload).base64url(HMAC-SHA256)
// Payload: { ids: string[], exp: number }
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}
async function issueFamiliaToken(participanteIds: string[]): Promise<string> {
  const secret = Deno.env.get("FAMILIA_TOKEN_SECRET")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // fallback so it always works
  const payload = { ids: participanteIds, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4 }; // 4h
  const payloadStr = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(payloadStr, secret);
  return `${payloadStr}.${sig}`;
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

    const userAgent = req.headers.get("user-agent") || null;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req.headers.get("cf-connecting-ip")
      || null;

    async function registrarAcesso(participantes: any[], matchType: string) {
      try {
        const principal = participantes[0];
        const { data } = await supabaseAdmin
          .from("familia_acessos")
          .insert({
            participante_id: principal?.id || null,
            participante_nome: principal?.nome_completo || null,
            participante_ids: participantes.map((p: any) => p.id),
            user_agent: userAgent,
            ip_address: ipAddress,
            match_type: matchType,
            acoes: [{ tipo: "login", em: new Date().toISOString() }],
            total_acoes: 1,
          })
          .select("id")
          .single();
        return data?.id || null;
      } catch {
        return null;
      }
    }

    // 1. Exact match
    const { data: exactMatch } = await supabaseAdmin
      .from("participantes")
      .select("id, nome_completo, data_nascimento, genero, foto_url, status, periodo, bairro_id, ponto_transporte_id, responsavel1_nome, responsavel2_nome, escola, serie, endereco_bairro, iniciou_em, bairros:bairro_id(id, nome), pontos_transporte:ponto_transporte_id(id, nome, horario_manha, horario_tarde, bairro_id, bairros:bairro_id(nome))")
      .ilike("nome_completo", nomePadronizado)
      .eq("data_nascimento", data_nascimento)
      .in("status", ["ativo", "busca_ativa"])
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
          const token = await issueFamiliaToken([fullPart.id]);
          const acesso_id = await registrarAcesso([fullPart], "fuzzy");
          return respond({
            found: true,
            match_type: "fuzzy",
            similaridade: best.sim,
            participantes: [buildSafe(fullPart)],
            needs_confirmation: true,
            token,
            acesso_id,
          });
        }
      }
      return respond({ found: false });
    }

    // 3. Find siblings by responsavel name
    const siblings = await findSiblings(supabaseAdmin, participante);

    const allIds = [participante.id, ...siblings.map((s: any) => s.id)];
    const token = await issueFamiliaToken(allIds);
    const acesso_id = await registrarAcesso([participante, ...siblings], matchType);

    return respond({
      found: true,
      match_type: matchType,
      participantes: [buildSafe(participante), ...siblings.map(buildSafe)],
      needs_confirmation: false,
      token,
      acesso_id,
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
    .in("status", ["ativo", "busca_ativa"])
    .eq("is_teste", false)
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

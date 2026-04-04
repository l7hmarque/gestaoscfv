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

/** Trim + uppercase */
function padronizar(val: string | null | undefined): string | null {
  if (!val) return null;
  const s = val.trim().toUpperCase();
  return s || null;
}

/** Keep only digits */
function apenasDigitos(val: string | null | undefined): string | null {
  if (!val) return null;
  const s = val.replace(/\D/g, "");
  return s || null;
}

const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per document

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      nome_completo, data_nascimento, genero, cor_raca,
      escola, serie, periodo, endereco_rua, endereco_numero,
      endereco_bairro, bairro_nome, ponto_transporte_id,
      responsavel1_nome, responsavel1_whatsapp,
      responsavel2_nome, responsavel2_whatsapp,
      restricao_alimentar, laudo,
      documentos,
      existing_id,
      cpf,
    } = body;

    // Validate required fields
    if (!nome_completo?.trim()) return respond({ error: "Nome completo é obrigatório" }, 400);
    if (!responsavel1_nome?.trim()) return respond({ error: "Nome do responsável é obrigatório" }, 400);
    if (!responsavel1_whatsapp?.trim()) return respond({ error: "WhatsApp do responsável é obrigatório" }, 400);

    // Validate birth date range (must be between 4 and 99 years old)
    if (data_nascimento) {
      const dob = new Date(data_nascimento);
      const now = new Date();
      const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (dob > now) return respond({ error: "Data de nascimento não pode ser futura" }, 400);
      if (age < 4 || age > 99) return respond({ error: "Idade fora da faixa atendida (4-99 anos)" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nomePadronizado = nome_completo.trim().toUpperCase();
    let resolvedExistingId = existing_id || null;
    let isAutoRematricula = false;

    // Check for duplicate by nome + data_nascimento
    if (data_nascimento) {
      const { data: dupCheck } = await supabaseAdmin
        .from("participantes")
        .select("id, nome_completo, data_nascimento")
        .eq("nome_completo", nomePadronizado)
        .eq("data_nascimento", data_nascimento)
        .limit(1)
        .maybeSingle();

      if (dupCheck) {
        if (resolvedExistingId && resolvedExistingId !== dupCheck.id) {
          return respond({ error: "Conflito: já existe participante com esse nome e data de nascimento" }, 409);
        }
        if (!resolvedExistingId) {
          resolvedExistingId = dupCheck.id;
          isAutoRematricula = true;
        }
      }
    }

    // Validate existing_id if provided explicitly
    if (resolvedExistingId && !isAutoRematricula) {
      const { data: existingPart, error: checkErr } = await supabaseAdmin
        .from("participantes")
        .select("id, nome_completo, data_nascimento")
        .eq("id", resolvedExistingId)
        .single();

      if (checkErr || !existingPart) {
        return respond({ error: "Participante não encontrado para rematrícula" }, 400);
      }

      if (
        existingPart.nome_completo !== nomePadronizado ||
        existingPart.data_nascimento !== data_nascimento
      ) {
        return respond({ error: "Dados não conferem com o cadastro existente" }, 403);
      }
    }

    // Resolve bairro_id from name
    let bairro_id = null;
    if (bairro_nome) {
      const { data: bairro } = await supabaseAdmin
        .from("bairros")
        .select("id")
        .eq("nome", bairro_nome)
        .single();
      if (bairro) bairro_id = bairro.id;
    }

    // Build standardized payload
    const payload: Record<string, unknown> = {
      nome_completo: padronizar(nome_completo)!,
      status: "pendente",
      data_nascimento: data_nascimento || null,
      genero: genero || null,
      cor_raca: cor_raca || null,
      escola: padronizar(escola),
      serie: serie || null,
      periodo: periodo || null,
      endereco_rua: padronizar(endereco_rua),
      endereco_numero: endereco_numero || null,
      endereco_bairro: padronizar(endereco_bairro),
      bairro_id: bairro_id || null,
      ponto_transporte_id: ponto_transporte_id || null,
      responsavel1_nome: padronizar(responsavel1_nome),
      responsavel1_cpf: apenasDigitos(responsavel1_cpf),
      responsavel1_whatsapp: apenasDigitos(responsavel1_whatsapp),
      responsavel2_nome: padronizar(responsavel2_nome),
      responsavel2_whatsapp: apenasDigitos(responsavel2_whatsapp),
      restricao_alimentar: restricao_alimentar || null,
      laudo: laudo || null,
      visualizado_em: null,
    };

    let participanteId: string;

    if (resolvedExistingId) {
      // Re-enrollment: UPDATE existing participant
      const { error: updateError } = await supabaseAdmin
        .from("participantes")
        .update(payload)
        .eq("id", resolvedExistingId);
      if (updateError) return respond({ error: updateError.message }, 500);
      participanteId = resolvedExistingId;

      // Remove turma links since status is now "pendente"
      await supabaseAdmin
        .from("turma_participantes")
        .delete()
        .eq("participante_id", resolvedExistingId);
    } else {
      // New enrollment: INSERT
      const { data: participante, error: insertError } = await supabaseAdmin
        .from("participantes")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) return respond({ error: insertError.message }, 500);
      participanteId = participante.id;
    }

    // Upload documents if any (with size validation)
    if (documentos && Array.isArray(documentos)) {
      for (const doc of documentos) {
        if (!doc.base64 || !doc.categoria || !doc.fileName) continue;

        // Validate base64 size (~75% of base64 length = bytes)
        const estimatedBytes = (doc.base64.length * 3) / 4;
        if (estimatedBytes > MAX_DOC_SIZE_BYTES) continue; // skip oversized files silently

        const binaryStr = atob(doc.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const storagePath = `${participanteId}/${doc.fileName}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("documentos")
          .upload(storagePath, bytes.buffer, {
            contentType: doc.contentType || "application/pdf",
          });

        if (!uploadErr) {
          await supabaseAdmin.from("participante_documentos").insert({
            participante_id: participanteId,
            categoria: doc.categoria,
            nome_arquivo: doc.fileName,
            arquivo_url: storagePath,
          });
        }
      }
    }

    return respond({ success: true, id: participanteId, rematricula: isAutoRematricula });
  } catch (err) {
    return respond({ error: err.message || "Erro interno" }, 500);
  }
});

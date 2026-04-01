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
    const body = await req.json();
    const {
      nome_completo, data_nascimento, genero, cor_raca,
      escola, serie, periodo, endereco_rua, endereco_numero,
      endereco_bairro, bairro_id, ponto_transporte_id,
      responsavel1_nome, responsavel1_cpf, responsavel1_whatsapp,
      responsavel2_nome, responsavel2_whatsapp,
      restricao_alimentar, laudo,
      documentos, // array of { base64: string, categoria: string, fileName: string, contentType: string }
    } = body;

    // Validate required fields
    if (!nome_completo?.trim()) return respond({ error: "Nome completo é obrigatório" }, 400);
    if (!responsavel1_nome?.trim()) return respond({ error: "Nome do responsável é obrigatório" }, 400);
    if (!responsavel1_whatsapp?.trim()) return respond({ error: "WhatsApp do responsável é obrigatório" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Insert participant with status pendente
    const insertPayload: Record<string, unknown> = {
      nome_completo: nome_completo.trim(),
      status: "pendente",
      data_nascimento: data_nascimento || null,
      genero: genero || null,
      cor_raca: cor_raca || null,
      escola: escola || null,
      serie: serie || null,
      periodo: periodo || null,
      endereco_rua: endereco_rua || null,
      endereco_numero: endereco_numero || null,
      endereco_bairro: endereco_bairro || null,
      bairro_id: bairro_id || null,
      ponto_transporte_id: ponto_transporte_id || null,
      responsavel1_nome: responsavel1_nome?.trim() || null,
      responsavel1_cpf: responsavel1_cpf || null,
      responsavel1_whatsapp: responsavel1_whatsapp?.trim() || null,
      responsavel2_nome: responsavel2_nome || null,
      responsavel2_whatsapp: responsavel2_whatsapp || null,
      restricao_alimentar: restricao_alimentar || null,
      laudo: laudo || null,
    };

    const { data: participante, error: insertError } = await supabaseAdmin
      .from("participantes")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) return respond({ error: insertError.message }, 500);

    // Upload documents if any
    if (documentos && Array.isArray(documentos)) {
      for (const doc of documentos) {
        if (!doc.base64 || !doc.categoria || !doc.fileName) continue;

        // Decode base64
        const binaryStr = atob(doc.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const storagePath = `${participante.id}/${doc.fileName}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("documentos")
          .upload(storagePath, bytes.buffer, {
            contentType: doc.contentType || "application/pdf",
          });

        if (!uploadErr) {
          await supabaseAdmin.from("participante_documentos").insert({
            participante_id: participante.id,
            categoria: doc.categoria,
            nome_arquivo: doc.fileName,
            arquivo_url: storagePath,
          });
        }
      }
    }

    return respond({ success: true, id: participante.id });
  } catch (err) {
    return respond({ error: err.message || "Erro interno" }, 500);
  }
});

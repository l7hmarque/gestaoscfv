import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você extrai LANÇAMENTOS de um Controle Bancário/Extrato bancário brasileiro (Banco do Brasil, Caixa, Itaú etc).

REGRAS:
1) Liste TODAS as linhas de movimentação (saídas/débitos e entradas/créditos), preservando a ORDEM de aparição (top→bottom, página por página).
2) Para cada linha retorne: ordem (1,2,3...), data (YYYY-MM-DD), descricao (texto curto da linha), valor (número decimal positivo, sempre 2 casas, NUNCA arredonde — "1.419,35" → 1419.35), nr_documento (NR.DOCUMENTO/Nº DOC se houver, só dígitos), tipo ("debito"|"credito").
3) Ignore linhas de saldo, totalizadores e cabeçalhos. Apenas movimentações reais.
4) Se houver coluna "TIPO" com D ou C, use D=debito, C=credito. Caso contrário, infira pelo sinal/contexto.
5) Mantenha a ordem cronológica do extrato (NÃO reordene).`;

const PARAMS_SCHEMA = {
  type: "object",
  properties: {
    lancamentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ordem: { type: "number" },
          data: { type: "string", description: "YYYY-MM-DD" },
          descricao: { type: "string" },
          valor: { type: "number" },
          nr_documento: { type: "string" },
          tipo: { type: "string", enum: ["debito", "credito"] },
        },
        required: ["ordem", "data", "descricao", "valor", "tipo"],
        additionalProperties: false,
      },
    },
  },
  required: ["lancamentos"],
  additionalProperties: false,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, mime_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [
      { type: "text", text: "Extraia TODOS os lançamentos do controle bancário/extrato deste documento, em ORDEM, usando a função extract_lancamentos." },
    ];

    const isPdf = (mime_type || "").toLowerCase().includes("pdf");
    if (isPdf) {
      userContent.push({
        type: "file",
        file: { filename: "extrato.pdf", file_data: `data:${mime_type};base64,${file_base64}` },
      });
    } else {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime_type};base64,${file_base64}` },
      });
    }

    const callModel = async (model: string) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: { name: "extract_lancamentos", description: "Extrai lançamentos do extrato", parameters: PARAMS_SCHEMA },
        }],
        tool_choice: { type: "function", function: { name: "extract_lancamentos" } },
      }),
    });

    let response = await callModel("google/gemini-2.5-pro");
    if (response.status === 429) response = await callModel("google/gemini-2.5-flash");

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway error ${response.status}` }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let lancamentos: any[] = [];
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        lancamentos = Array.isArray(parsed?.lancamentos) ? parsed.lancamentos : [];
      } catch (e) { console.error("Erro parse:", e); }
    }

    return new Response(JSON.stringify({ lancamentos, total: lancamentos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-controle-bancario error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
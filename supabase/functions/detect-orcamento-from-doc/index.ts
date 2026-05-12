import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você analisa MAPAS COMPARATIVOS / ORÇAMENTOS de pesquisa de preços de OSCs.

Um mapa comparativo apresenta um conjunto de itens cotados em 1 a 3 fornecedores, com o preço unitário e/ou total de cada item por fornecedor. Pode estar como tabela ou como conjunto de propostas separadas.

REGRAS:
1) Identifique o TÍTULO do orçamento (objeto da compra).
2) Liste TODOS os itens — descrição, unidade de medida (UN, KG, CX, L, etc.), quantidade.
3) Liste 1 a 3 fornecedores cotados (nome + CNPJ, se disponível).
4) Para CADA item × CADA fornecedor, retorne o preço unitário (decimal com ponto, 2 casas, NUNCA arredonde — extraia exatamente como aparece).
5) Identifique o FORNECEDOR VENCEDOR: aquele com menor preço total global. Retorne fornecedor_vencedor (nome) e cnpj_vencedor.
6) Datas em YYYY-MM-DD.`;

const PARAMS_SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Título / objeto resumido do orçamento" },
    objeto: { type: "string", description: "Descrição detalhada do objeto" },
    fornecedor_vencedor: { type: "string", description: "Nome do fornecedor com menor preço global" },
    cnpj_vencedor: { type: "string", description: "CNPJ do vencedor (14 dígitos, só números)" },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          unidade_medida: { type: "string" },
          quantidade: { type: "number" },
        },
        required: ["descricao", "quantidade"],
        additionalProperties: false,
      },
    },
    cotacoes: {
      type: "array",
      description: "Uma entrada por fornecedor cotado (1 a 3).",
      items: {
        type: "object",
        properties: {
          fornecedor_nome: { type: "string" },
          cnpj: { type: "string", description: "CNPJ só números (14 dígitos) ou vazio" },
          data_emissao: { type: "string", description: "YYYY-MM-DD" },
          data_validade: { type: "string", description: "YYYY-MM-DD" },
          precos: {
            type: "array",
            description: "Preço unitário de CADA item (mesma ordem do array 'itens'). Use null se o fornecedor não cotou aquele item.",
            items: { type: "number" },
          },
        },
        required: ["fornecedor_nome", "precos"],
        additionalProperties: false,
      },
    },
  },
  required: ["titulo", "itens", "cotacoes"],
  additionalProperties: false,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, mime_type, file_url } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [
      { type: "text", text: "Analise este mapa comparativo / orçamento. Liste todos os itens e o preço de cada fornecedor para cada item, na MESMA ORDEM. Identifique o vencedor pelo menor total global. Use a função extract_orcamento." },
    ];
    const isPdf = (mime_type || "").toLowerCase().includes("pdf");
    if (file_base64 && mime_type) {
      if (isPdf) {
        userContent.push({ type: "file", file: { filename: "orcamento.pdf", file_data: `data:${mime_type};base64,${file_base64}` } });
      } else {
        userContent.push({ type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } });
      }
    } else if (file_url) {
      const looksPdf = file_url.toLowerCase().endsWith(".pdf");
      if (looksPdf) userContent.push({ type: "file", file: { filename: "orcamento.pdf", file_url } });
      else userContent.push({ type: "image_url", image_url: { url: file_url } });
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
          function: { name: "extract_orcamento", description: "Extrai mapa comparativo / orçamento.", parameters: PARAMS_SCHEMA },
        }],
        tool_choice: { type: "function", function: { name: "extract_orcamento" } },
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
    let parsed: any = null;
    if (toolCall) {
      try { parsed = JSON.parse(toolCall.function.arguments); }
      catch (e) { console.error("Erro parse:", e); }
    }
    return new Response(JSON.stringify({ orcamento: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-orcamento error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
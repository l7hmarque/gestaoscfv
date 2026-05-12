import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você classifica um documento financeiro de uma OSC brasileira em UMA das categorias abaixo, analisando a 1ª página.

CATEGORIAS:
- "controle_bancario": extrato/controle bancário com várias linhas de movimentação (débitos/créditos), saldo, agência/conta. Bancos: BB, Caixa, Itaú, Bradesco, Santander, Sicoob etc.
- "orcamento": mapa comparativo de preços, cotação, planilha com 3 fornecedores e seus valores para os mesmos itens.
- "tributo": guia de tributo federal — DARF, GPS, GFIP/SEFIP, GRRF, INSS, PIS, COFINS, FGTS. Tem código de barras de arrecadação federal.
- "folha": folha de pagamento, holerite, recibo de pagamento de salário, contracheque.
- "despesa": qualquer outra despesa/comprovante — Nota Fiscal de produto/serviço, recibo, cupom fiscal, boleto comercial, comprovante PIX/TED.

REGRAS:
1) Retorne UMA categoria com a maior confiança.
2) Se for tributo federal mas com aparência de DARF/PIS/INSS, escolha "tributo".
3) Se houver MÚLTIPLAS movimentações em ordem cronológica com saldo, é "controle_bancario".
4) Se houver TABELA com 3 colunas de fornecedores comparando preços, é "orcamento".
5) Em caso de dúvida entre folha e despesa, prefira "folha" se tiver "FGTS/INSS descontado", "salário base", "rubricas".
`;

const PARAMS_SCHEMA = {
  type: "object",
  properties: {
    tipo: {
      type: "string",
      enum: ["controle_bancario", "orcamento", "tributo", "folha", "despesa"],
    },
    confianca: { type: "number", description: "0..1" },
    motivo: { type: "string", description: "Justificativa curta" },
  },
  required: ["tipo", "confianca"],
  additionalProperties: false,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, mime_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [
      { type: "text", text: "Classifique este documento financeiro usando a função classify_doc." },
    ];
    const isPdf = (mime_type || "").toLowerCase().includes("pdf");
    if (isPdf) {
      userContent.push({ type: "file", file: { filename: "doc.pdf", file_data: `data:${mime_type};base64,${file_base64}` } });
    } else {
      userContent.push({ type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } });
    }

    const callModel = (model: string) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          tools: [{ type: "function", function: { name: "classify_doc", description: "Classifica documento financeiro", parameters: PARAMS_SCHEMA } }],
          tool_choice: { type: "function", function: { name: "classify_doc" } },
        }),
      });

    let response = await callModel("google/gemini-2.5-flash-lite");
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
    let result: any = { tipo: "despesa", confianca: 0 };
    if (toolCall) {
      try { result = JSON.parse(toolCall.function.arguments); } catch (e) { console.error("Erro parse:", e); }
    }
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("classify-financeiro-doc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
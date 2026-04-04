import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_url, file_base64, mime_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [
      {
        type: "text",
        text: `Analise este documento fiscal/financeiro e extraia as informações. Retorne APENAS usando a função extract_despesa. Se não conseguir identificar algum campo, deixe como null.`,
      },
    ];

    if (file_base64 && mime_type) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime_type};base64,${file_base64}` },
      });
    } else if (file_url) {
      userContent.push({
        type: "image_url",
        image_url: { url: file_url },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em documentos fiscais brasileiros (NF, boletos, recibos, DARF, GPS). Extraia dados com precisão.",
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_despesa",
              description: "Extrai dados de um documento fiscal",
              parameters: {
                type: "object",
                properties: {
                  valor: { type: "number", description: "Valor total em reais" },
                  data_lancamento: { type: "string", description: "Data no formato YYYY-MM-DD" },
                  fornecedor: { type: "string", description: "Nome do fornecedor/beneficiário" },
                  cnpj_cpf: { type: "string", description: "CNPJ ou CPF do fornecedor" },
                  numero_documento: { type: "string", description: "Número da NF, recibo ou boleto" },
                  descricao: { type: "string", description: "Descrição resumida da despesa" },
                  tipo_documento: {
                    type: "string",
                    enum: ["nota_fiscal", "recibo", "cupom_fiscal", "boleto", "darf", "gps", "outro"],
                    description: "Tipo do documento",
                  },
                },
                required: ["descricao"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_despesa" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const extracted = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-despesa error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

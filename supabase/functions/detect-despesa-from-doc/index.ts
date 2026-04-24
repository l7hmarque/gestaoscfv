import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em documentos financeiros brasileiros para prestação de contas no SIT (Sistema Integrado de Transferências do TCE/PR).

Tipos de documentos que você analisa: notas fiscais, cupons fiscais, recibos, boletos, DARF, GPS, GFIP, folhas de pagamento, holerites, comprovantes de transferência bancária, contracheques.

REGRAS CRÍTICAS:
1) UM ÚNICO PDF PODE CONTER MÚLTIPLAS DESPESAS. Sempre retorne um array. Exemplos:
   - Folha de pagamento com vários funcionários → 1 despesa por funcionário
   - Conjunto de comprovantes de transferência bancária + holerites → 1 despesa por funcionário/transferência (junte o comprovante bancário com o holerite correspondente pelo nome do favorecido e valor)
   - Várias NFs no mesmo PDF → 1 despesa por NF
2) Para folhas de pagamento, cada funcionário é uma despesa cujo valor é o LÍQUIDO pago, fornecedor é o nome do funcionário, tipo_documento é "folha_pagamento" e tipo_doc_despesa SIT é 6.
3) Para comprovantes de transferência bancária pareados com holerite, use a DATA DA TRANSFERÊNCIA como data_lancamento e o NR.DOCUMENTO da transferência como numero_doc_pagamento.
4) Valores no padrão brasileiro (1.019,23) devem virar número decimal com ponto (1019.23).
5) Datas devem virar YYYY-MM-DD.
6) Se o documento mencionar "TERMO DE FOMENTO/COLABORAÇÃO Nº XXX/AAAA", extraia para sit_numero_instrumento (XXX) e sit_ano_transferencia (AAAA).`;

const PARAMS_SCHEMA = {
  type: "object",
  properties: {
    despesas: {
      type: "array",
      description: "Lista de despesas encontradas no documento (uma por funcionário/comprovante/NF).",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string", description: "Descrição resumida (ex: 'Salário Fevereiro/2026 - João Silva')" },
          valor: { type: "number", description: "Valor em reais (decimal com ponto)" },
          data_lancamento: { type: "string", description: "Data principal YYYY-MM-DD" },
          fornecedor: { type: "string", description: "Nome do favorecido/funcionário" },
          cnpj_cpf: { type: "string", description: "CPF (11 dígitos) ou CNPJ (14 dígitos), só números" },
          numero_documento: { type: "string", description: "Número do documento (NF, holerite, etc)" },
          tipo_documento: {
            type: "string",
            enum: ["nota_fiscal", "recibo", "cupom_fiscal", "boleto", "darf", "gps", "folha_pagamento", "rpa", "outro"],
          },
          // Campos SIT
          sit_tipo_doc_favorecido: { type: "string", enum: ["CPF", "CNPJ", "EXT"] },
          sit_nome_favorecido: { type: "string" },
          sit_tipo_doc_despesa: { type: "number", description: "Código SIT: 1=NF, 2=Cupom, 3=Fatura, 4=Recibo, 5=Boleto, 6=Folha Pagamento, 7=RPA, 8=DARF, 9=GPS, 10=GFIP, 20=Outros" },
          sit_numero_doc_despesa: { type: "string" },
          sit_data_doc_despesa: { type: "string", description: "YYYY-MM-DD" },
          sit_tipo_doc_pagamento: { type: "number", description: "1=Cheque, 2=OP, 3=TED/DOC/PIX, 4=Débito Aut, 5=Boleto" },
          sit_numero_doc_pagamento: { type: "string", description: "Nº do comprovante de pagamento (ex: NR.DOCUMENTO da transferência BB)" },
          sit_data_emissao_pagamento: { type: "string", description: "YYYY-MM-DD - data da transferência/pagamento" },
          sit_data_debito: { type: "string", description: "YYYY-MM-DD" },
          sit_numero_instrumento: { type: "string", description: "Nº do termo de fomento/colaboração (ex: '001')" },
          sit_ano_transferencia: { type: "number", description: "Ano do termo (ex: 2022)" },
          sit_descricao_item: { type: "string", description: "Descrição detalhada do item/serviço (até 2000 chars)" },
        },
        required: ["descricao"],
        additionalProperties: false,
      },
    },
  },
  required: ["despesas"],
  additionalProperties: false,
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
        text: "Analise TODAS as páginas (sem exceção) deste PDF — pode haver dezenas de lançamentos, NFs, holerites e comprovantes ao longo de várias páginas. Percorra página por página, do início ao fim, e extraia CADA lançamento fiscal individualmente, sem omitir nenhum. Não pare na primeira página. Use a função extract_despesas. Folhas de pagamento têm UMA despesa POR FUNCIONÁRIO; comprovantes bancários pareados com holerites também são UMA despesa por par. Se houver tabelas de lançamentos contábeis/financeiros, gere UMA despesa POR LINHA da tabela.",
      },
    ];

    const isPdf = (mime_type || "").toLowerCase().includes("pdf");
    if (file_base64 && mime_type) {
      if (isPdf) {
        // OpenAI-compatible PDF input (multi-page) — Lovable AI Gateway maps to Gemini inline_data
        userContent.push({
          type: "file",
          file: {
            filename: "documento.pdf",
            file_data: `data:${mime_type};base64,${file_base64}`,
          },
        });
      } else {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${mime_type};base64,${file_base64}` },
        });
      }
    } else if (file_url) {
      const looksPdf = file_url.toLowerCase().endsWith(".pdf");
      if (looksPdf) {
        userContent.push({
          type: "file",
          file: { filename: "documento.pdf", file_url: file_url },
        });
      } else {
        userContent.push({ type: "image_url", image_url: { url: file_url } });
      }
    }

    const callModel = async (model: string) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_despesas",
              description: "Extrai TODAS as despesas presentes no documento (pode ser mais de uma).",
              parameters: PARAMS_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_despesas" } },
      }),
    });

    let response = await callModel("google/gemini-2.5-pro");
    if (response.status === 429) {
      console.warn("[detect-despesa] Pro rate-limited, fallback to flash");
      response = await callModel("google/gemini-2.5-flash");
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Aguarde alguns instantes e tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Acesse Lovable Cloud para adicionar créditos." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let despesas: any[] = [];
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        despesas = Array.isArray(parsed?.despesas) ? parsed.despesas : [];
      } catch (e) {
        console.error("Erro parse tool call:", e);
      }
    }

    // Compatibilidade retroativa: extracted = primeira despesa
    return new Response(JSON.stringify({
      despesas,
      extracted: despesas[0] ?? null,
      total: despesas.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-despesa error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

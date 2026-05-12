import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rubricas oficiais SIT/TCE-PR (mantenha sincronizado com src/lib/rubricasOficiais.ts)
const RUBRICAS = [
  ["3.1.90.11.01", "VENCIMENTOS E SALÁRIOS"],
  ["3.1.90.11.43", "13º SALÁRIO"],
  ["3.1.90.11.45", "FÉRIAS - ABONO CONSTITUCIONAL"],
  ["3.1.90.13.01", "FGTS"],
  ["3.1.90.13.02", "CONTRIBUIÇÕES PREVIDENCIÁRIAS - INSS"],
  ["3.1.90.16.00", "OUTRAS DESPESAS VARIÁVEIS - PESSOAL CIVIL"],
  ["3.1.90.47.99", "OUTRAS OBRIGAÇÕES TRIBUTÁRIAS E CONTRIBUTIVAS (PESSOAL)"],
  ["3.1.90.49.00", "AUXÍLIO-TRANSPORTE"],
  ["3.1.90.94.00", "INDENIZAÇÕES E RESTITUIÇÕES TRABALHISTAS"],
  ["3.3.90.30.01", "COMBUSTÍVEIS E LUBRIFICANTES AUTOMOTIVOS"],
  ["3.3.90.30.07", "GÊNEROS DE ALIMENTAÇÃO"],
  ["3.3.90.30.14", "MATERIAL EDUCATIVO E ESPORTIVO"],
  ["3.3.90.30.16", "MATERIAL DE EXPEDIENTE"],
  ["3.3.90.30.22", "MATERIAL DE LIMPEZA E PRODUTOS DE HIGIENIZAÇÃO"],
  ["3.3.90.30.23", "UNIFORMES, TECIDOS E AVIAMENTOS"],
  ["3.3.90.36.15", "LOCAÇÃO DE IMÓVEIS"],
  ["3.3.90.36.26", "SERVIÇOS DOMÉSTICOS"],
  ["3.3.90.39.05", "SERVIÇOS TÉCNICOS PROFISSIONAIS"],
  ["3.3.90.39.19", "MANUTENÇÃO E CONSERVAÇÃO DE VEÍCULOS"],
  ["3.3.90.39.43", "SERVIÇOS DE ENERGIA ELÉTRICA"],
  ["3.3.90.39.44", "SERVIÇOS DE ÁGUA E ESGOTO"],
  ["3.3.90.39.69", "SEGUROS EM GERAL"],
  ["3.3.90.39.81", "SERVIÇOS BANCÁRIOS"],
  ["3.3.90.39.99", "OUTROS SERVIÇOS DE TERCEIROS, PESSOA JURÍDICA"],
  ["3.3.90.40.97", "DESPESAS DE TELEPROCESSAMENTO"],
  ["3.3.90.47.99", "OUTRAS OBRIGAÇÕES TRIBUTÁRIAS E CONTRIBUTIVAS"],
  ["4.4.90.52.52", "VEÍCULOS DE TRAÇÃO MECÂNICA"],
  ["4.4.90.52.99", "OUTROS MATERIAIS PERMANENTES"],
] as const;
const RUBRICA_CODES = RUBRICAS.map((r) => r[0]);
const RUBRICAS_TXT = RUBRICAS.map((r) => `  - ${r[0]}  ${r[1]}`).join("\n");

const SYSTEM_PROMPT = `Você é um especialista em documentos financeiros brasileiros para prestação de contas no SIT (Sistema Integrado de Transferências do TCE/PR).

Tipos de documentos que você analisa: notas fiscais, cupons fiscais, recibos, boletos, DARF, GPS, GFIP, folhas de pagamento, holerites, comprovantes de transferência bancária, contracheques.

REGRAS CRÍTICAS:
1) UM ÚNICO PDF PODE CONTER MÚLTIPLAS DESPESAS. Sempre retorne um array. Exemplos:
   - Folha de pagamento com vários funcionários → 1 despesa por funcionário
   - Conjunto de comprovantes de transferência bancária + holerites → 1 despesa por funcionário/transferência (junte o comprovante bancário com o holerite correspondente pelo nome do favorecido e valor)
   - Várias NFs no mesmo PDF → 1 despesa por NF
2) Para folhas de pagamento, cada funcionário é uma despesa cujo valor é o LÍQUIDO pago, fornecedor é o nome do funcionário, tipo_documento é "folha_pagamento" e tipo_doc_despesa SIT é 6.
3) Para comprovantes de transferência bancária pareados com holerite, use a DATA DA TRANSFERÊNCIA como data_lancamento e o NR.DOCUMENTO da transferência como numero_doc_pagamento.
3.1) REGRA OBRIGATÓRIA PARA HOLERITES/FOLHAS DE PAGAMENTO:
   - numero_documento e sit_numero_doc_despesa = "MM/AAAA" onde MM = mês ANTERIOR à data do comprovante de pagamento e AAAA = ano do pagamento. Exemplo: pagamento em 01/04/2026 → "03/2026".
   - data_lancamento e sit_data_doc_despesa = ÚLTIMO DIA do mês ANTERIOR ao mês do código. Exemplo: código "03/2026" → data 2026-02-28 (último dia de fevereiro/2026). Código "04/2026" → data 2026-03-31. Código "01/2026" → data 2025-12-31.
   - sit_data_emissao_pagamento continua sendo a data real da transferência bancária.
4) PAREAMENTO MULTI-PÁGINA (CRÍTICO — não duplique despesas):
   - Um PDF pode conter, em páginas DIFERENTES, documentos que compõem UMA MESMA despesa. Antes de listar, percorra todas as páginas e identifique os pareamentos.
   - Combinações típicas:
     a) Nota Fiscal (página A) + Boleto/Fatura COM comprovante de pagamento na mesma página (página B) → 1 despesa.
     b) Nota Fiscal (página A) + Comprovante PIX (página B), SEM boleto/fatura → 1 despesa (pagamento via PIX).
     c) Boleto/Fatura sozinho COM comprovante na mesma página, SEM NF (ex: contas de consumo, água, luz, internet) → 1 despesa.
     d) Holerite (página A) + Comprovante de transferência bancária (página B) → 1 despesa por funcionário.
   - Pareamento: use VALOR (idêntico ou muito próximo), FORNECEDOR/CNPJ, DATA de vencimento × data do pagamento, e número do documento referenciado no boleto/PIX.
   - Quando houver NF, priorize seus dados (sit_numero_doc_despesa, sit_data_doc_despesa, sit_descricao_item) e use o boleto/comprovante para sit_numero_doc_pagamento, sit_data_emissao_pagamento e sit_tipo_doc_pagamento.
   - Se o pagamento for PIX: sit_tipo_doc_pagamento = 3 (TED/DOC/PIX). NÃO marque como boleto. sit_tipo_doc_despesa segue a NF (1) quando houver.
   - Se houver boleto/fatura + comprovante mas NÃO houver NF, sit_tipo_doc_despesa = 5 (Boleto) ou 3 (Fatura), conforme o documento.
   - NUNCA gere uma despesa só com a NF e outra só com o boleto/comprovante para o mesmo valor — eles são a MESMA despesa.
5) VALORES — CRÍTICO: extraia o valor EXATAMENTE como aparece no documento, preservando todos os centavos. NUNCA arredonde, NUNCA trunque casas decimais. Padrão BRL "1.419,35" → número 1419.35 (decimal com ponto, sempre 2 casas). "151,77" → 151.77. "1.019,23" → 1019.23. Se o valor tem 2 centavos no documento, o JSON também precisa ter 2 centavos.
6) Datas devem virar YYYY-MM-DD.
7) Se o documento mencionar "TERMO DE FOMENTO/COLABORAÇÃO Nº XXX/AAAA", extraia para sit_numero_instrumento (XXX) e sit_ano_transferencia (AAAA).
8) CLASSIFIQUE CADA DESPESA EM UMA RUBRICA OFICIAL escolhendo o código mais ESPECÍFICO da lista abaixo (campo rubrica_codigo). Use apenas códigos exatos desta lista — não invente. Heurísticas: holerite/salário líquido → 3.1.90.11.01; 13º salário → 3.1.90.11.43; férias/abono → 3.1.90.11.45; FGTS → 3.1.90.13.01; INSS/GPS → 3.1.90.13.02; vale-transporte → 3.1.90.49.00; rescisão/indenização trabalhista → 3.1.90.94.00; combustível/posto → 3.3.90.30.01; alimentos/mercado/açougue → 3.3.90.30.07; material pedagógico/esportivo → 3.3.90.30.14; papelaria/expediente → 3.3.90.30.16; produtos de limpeza/higiene → 3.3.90.30.22; uniformes/tecidos → 3.3.90.30.23; aluguel de imóvel → 3.3.90.36.15; serviços domésticos (PF) → 3.3.90.36.26; serviços profissionais (contabilidade, jurídico, consultoria PJ) → 3.3.90.39.05; oficina/manutenção de veículo → 3.3.90.39.19; conta de luz → 3.3.90.39.43; conta de água/esgoto → 3.3.90.39.44; seguros (auto, predial) → 3.3.90.39.69; tarifas bancárias → 3.3.90.39.81; outros serviços PJ não classificados → 3.3.90.39.99; internet/telefonia/telecom → 3.3.90.40.97; tributos (DARF, ISS) genéricos → 3.3.90.47.99; compra de veículo → 4.4.90.52.52; equipamento/mobiliário permanente → 4.4.90.52.99.
9) ANEXOS — para CADA despesa, retorne o objeto "anexos" indicando quais papéis estão presentes nas páginas que compõem aquela despesa:
   - tem_nf: true se há Nota Fiscal/Cupom Fiscal entre as páginas dessa despesa.
   - tem_boleto: true se há Boleto/Fatura entre as páginas dessa despesa.
   - tem_comprovante: true se há comprovante de pagamento (transferência bancária, PIX, recibo de quitação) entre as páginas dessa despesa.
   - Quando boleto e comprovante aparecem JUNTOS na mesma página, marque AMBOS como true.
   - Para PIX (sem boleto): tem_nf=true (se houver NF), tem_boleto=false, tem_comprovante=true.
   - Para holerite + transferência: tem_nf=false, tem_boleto=false, tem_comprovante=true (o próprio holerite NÃO é boleto nem NF para o SIT).

10) TRIBUTOS FEDERAIS (DARF, GPS, GFIP, INSS, PIS, FGTS) — REGRAS OBRIGATÓRIAS:
   - Identifique pelo cabeçalho/descrição do documento ou pela presença de termos: "DARF", "GPS", "GFIP", "FGTS", "INSS", "PIS", "Receita Federal", "Caixa Econômica", "Guia de Recolhimento".
   - DATA DE PAGAMENTO: extraia do canto superior direito do documento (autenticação bancária / data de pagamento). Use essa data para sit_data_emissao_pagamento, sit_data_debito E sit_data_doc_despesa (tributos não têm "emissão de NF" separada). data_lancamento = mesma data.
   - sit_modalidade_compra = 8 (Tributos/Pessoal — Aquisição Direta) para QUALQUER tributo.
   - rubrica_codigo: INSS/GPS → "3.1.90.13.02"; FGTS/GFIP → "3.1.90.13.01"; PIS/COFINS/outros DARF → "3.3.90.47.99".
   - Por tributo, force os campos abaixo (sobrescrevendo o que estiver no documento se necessário):
     a) FGTS / GFIP:
        tipo_documento = "gfip"
        sit_tipo_doc_despesa = 10
        fornecedor = "CAIXA ECONOMICA FEDERAL - BRASILIA"
        sit_nome_favorecido = "CAIXA ECONOMICA FEDERAL - BRASILIA"
        cnpj_cpf = "00360305000104"
        sit_tipo_doc_favorecido = "CNPJ"
     b) INSS / GPS:
        tipo_documento = "darf"
        sit_tipo_doc_despesa = 8
        fornecedor = "MINISTERIO DA FAZENDA - ATUAL"
        sit_nome_favorecido = "MINISTERIO DA FAZENDA - ATUAL"
        cnpj_cpf = "00394460000141"
        sit_tipo_doc_favorecido = "CNPJ"
     c) PIS / COFINS / outros DARF:
        tipo_documento = "darf"
        sit_tipo_doc_despesa = 8
        fornecedor = "MINISTERIO DA FAZENDA - ATUAL"
        sit_nome_favorecido = "MINISTERIO DA FAZENDA - ATUAL"
        cnpj_cpf = "00394460000141"
        sit_tipo_doc_favorecido = "CNPJ"
   - sit_numero_doc_despesa = nº de autenticação do tributo (até 10 caracteres). Se ausente, use o código de barras truncado em 10 dígitos.
   - anexos.tem_comprovante = true (a guia paga já é o próprio comprovante).

11) MARCA-TEXTO AMARELO (modalidade Pesquisa de Preço — código 7):
   - Examine cada página em busca de regiões com fundo/realce AMARELO (highlight feito pelo usuário no leitor de PDF) cobrindo valores monetários, nomes de fornecedor, números de NF ou linhas inteiras de tabela.
   - Para CADA despesa cuja linha, valor ou bloco esteja sob marca amarela, force:
       sit_modalidade_compra = 7
       marcado_orcamento = true
   - Se a marca amarela cobre apenas UMA linha de uma tabela/folha com várias linhas, aplique somente naquela despesa — as demais linhas seguem regras normais (marcado_orcamento = false).
   - TRIBUTOS FEDERAIS (regra 10) IGNORAM a marca amarela: continuam com sit_modalidade_compra = 8 e marcado_orcamento = false.
   - Quando NÃO houver marca amarela, marcado_orcamento = false e a modalidade segue as demais regras.

RUBRICAS OFICIAIS DISPONÍVEIS:
${RUBRICAS_TXT}`;

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
          rubrica_codigo: { type: "string", enum: RUBRICA_CODES, description: "Código da rubrica oficial SIT/TCE-PR mais específica para esta despesa." },
          marcado_orcamento: { type: "boolean", description: "true quando a linha/valor desta despesa estiver coberta por marca-texto amarelo no PDF (indica modalidade 7 - Pesquisa de Preço)." },
          anexos: {
            type: "object",
            description: "Marque quais papéis (NF, boleto, comprovante de pagamento) estão presentes nas páginas dessa despesa dentro do PDF importado.",
            properties: {
              tem_nf: { type: "boolean" },
              tem_boleto: { type: "boolean" },
              tem_comprovante: { type: "boolean" },
            },
            required: ["tem_nf", "tem_boleto", "tem_comprovante"],
            additionalProperties: false,
          },
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
        text: "Analise TODAS as páginas (sem exceção) deste PDF. ANTES de listar despesas, percorra página por página e identifique os pareamentos: NF (página separada) ↔ Boleto/Fatura+Comprovante (mesma página) ou NF ↔ Comprovante PIX (sem boleto). Cada TRANSAÇÃO REAL = 1 despesa, mesmo que a evidência esteja distribuída em 2 ou 3 páginas. NUNCA duplique uma despesa criando uma entrada para a NF e outra para o boleto/comprovante do mesmo valor. Folhas de pagamento têm UMA despesa POR FUNCIONÁRIO; comprovantes bancários pareados com holerites também são UMA despesa por par. Se houver tabelas de lançamentos contábeis/financeiros, gere UMA despesa POR LINHA da tabela. Use a função extract_despesas.",
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

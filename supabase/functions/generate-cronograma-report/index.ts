import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slots, bairros, profiles, turmas, disponibilidade, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um especialista em gestão de serviços socioassistenciais (SCFV - Serviço de Convivência e Fortalecimento de Vínculos). 
Você analisa cronogramas semanais de distribuição de educadores, oficineiros e turmas pelos territórios de atendimento.
Responda SEMPRE em português do Brasil.`;

    let userPrompt = "";

    if (mode === "report") {
      userPrompt = `Analise o cronograma semanal abaixo e produza um relatório técnico detalhado.

DADOS DO CRONOGRAMA:
- Bairros: ${JSON.stringify(bairros)}
- Profissionais: ${JSON.stringify(profiles)}
- Turmas: ${JSON.stringify(turmas)}
- Slots preenchidos: ${JSON.stringify(slots)}
- Disponibilidade cadastrada: ${JSON.stringify(disponibilidade)}

PRODUZA:
1. **Resumo da distribuição atual** — quantos dias cada bairro está coberto, quais profissionais atendem onde
2. **Critérios atendidos** — mínimo de dias por bairro, rodízio de oficinas, respeito à disponibilidade
3. **Pontos fracos** — conflitos, bairros sub-atendidos, profissionais sobrecarregados
4. **Sugestões de melhoria organizacional** — redistribuições recomendadas, ajustes de carga

Formate em Markdown com seções claras.`;
    } else {
      userPrompt = `Gere uma proposta de cronograma semanal otimizado para o SCFV.

DADOS DISPONÍVEIS:
- Bairros (territórios): ${JSON.stringify(bairros)}
- Profissionais (educadores e oficineiros): ${JSON.stringify(profiles)}
- Turmas ativas: ${JSON.stringify(turmas)}
- Disponibilidade dos profissionais: ${JSON.stringify(disponibilidade)}

REGRAS:
- Cada bairro deve ter no mínimo 3 dias de atendimento
- Nenhum profissional pode estar em 2 bairros no mesmo dia/período
- Respeitar a disponibilidade cadastrada de cada profissional
- Diversificar as oficinas entre os bairros
- Dias: Seg, Ter, Qua, Qui, Sex
- Períodos: manha, tarde

RETORNE em formato JSON com a estrutura:
{
  "slots": [{ "dia_semana": "Seg", "periodo": "manha", "bairro_nome": "JARDIM IRENE", "educador_nome": "...", "oficineiro_nome": "...", "turma_nome": "...", "tipo_atividade": "..." }],
  "relatorio": "... relatório técnico em markdown explicando as escolhas ..."
}`;
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content, mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { relatorio } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Transforme este relatório de atividade do SCFV (Serviço de Convivência e Fortalecimento de Vínculos) em um texto para publicação no Instagram.

REGRAS OBRIGATÓRIAS:
- NÃO inicie com frases introdutórias como "Aqui está", "Segue o texto", "Com base no relatório", "Claro!" etc.
- Comece DIRETAMENTE com "CAIA MEDIANEIRA 🌍"
- Retorne APENAS o texto da publicação, sem explicações ou comentários antes ou depois
- Tom humanizado, atencioso e profissional
- Destaque o que foi realizado e o impacto positivo nos participantes
- Não mencione dados numéricos técnicos como "Score ELO" ou porcentagens
- Máximo 2200 caracteres
- Inclua emojis relevantes de forma equilibrada
- Finalize com 5-8 hashtags relevantes (#SCFV #ConvivênciaEFortalecimento #CRAS #AssistênciaSocial etc.)
- Linguagem acessível para público geral

DADOS DO RELATÓRIO:
- Atividade: ${relatorio.nome_atividade || "Atividade do dia"}
- Data: ${relatorio.data}
- Turmas: ${relatorio.turmas || ""}
- Educador: ${relatorio.educador || ""}
- Tipo: ${relatorio.tipo_atividade || ""}
- Participantes presentes: ${relatorio.num_participantes || 0}
- Observações: ${relatorio.observacoes || ""}
- Intervenções: ${relatorio.intervencoes || ""}
- Engajamento: ${relatorio.engajamento?.join(", ") || ""}
- Situações relevantes: ${relatorio.situacoes_relevantes?.join(", ") || ""}
- Objetivo: ${relatorio.objetivo_alcancado || ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um especialista em comunicação social para projetos comunitários. Retorne SOMENTE o texto da publicação. Nunca adicione frases introdutórias como 'Aqui está', 'Segue o texto', 'Com base no relatório'. Comece diretamente com o conteúdo solicitado. Nunca adicione explicações ou comentários após o texto." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar texto" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

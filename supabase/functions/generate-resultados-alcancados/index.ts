import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { relatorio, planejamento } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Você é um técnico do SCFV (Serviço de Convivência e Fortalecimento de Vínculos). 
Com base nos dados abaixo, gere um texto de "Resultados Alcançados" que vincule a atividade aos objetivos do SCFV (convivência, fortalecimento de vínculos, protagonismo, prevenção de situações de risco).

Regras:
- Linguagem técnica e objetiva
- Máximo 130 caracteres
- Não faça afirmações falsas ou suposições sem base nos dados
- Não inclua introduções ou explicações, retorne APENAS o texto do resultado
- Se os dados forem insuficientes, escreva "Dados insuficientes para análise"

Dados do relatório:
- Atividade: ${relatorio.nome_atividade || "N/I"}
- Tipo: ${relatorio.tipo_atividade || "N/I"}
- Objetivo alcançado: ${relatorio.objetivo_alcancado || "N/I"}
- Score ELO: ${relatorio.score_elo || "N/I"}
- Engajamento: ${(relatorio.engajamento || []).join(", ") || "N/I"}
- Intervenções: ${relatorio.intervencoes || "N/I"}
- Observações: ${relatorio.observacoes || "N/I"}
- Situações relevantes: ${(relatorio.situacoes_relevantes || []).join(", ") || "N/I"}
${planejamento ? `
Dados do planejamento vinculado:
- Título: ${planejamento.titulo || "N/I"}
- Tema: ${planejamento.tema || "N/I"}
- Objetivos: ${planejamento.objetivos || "N/I"}` : "Sem planejamento vinculado."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um analista técnico do SCFV. Responda apenas com o texto solicitado, sem formatação extra." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente." }), {
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
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const resultado = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ resultado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-resultados-alcancados error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

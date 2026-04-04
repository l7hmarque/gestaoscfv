import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { relatorio_id } = await req.json();
    if (!relatorio_id) {
      return new Response(JSON.stringify({ error: "relatorio_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    // Get relatorio
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: relatorio } = await svc
      .from("relatorios_atividade")
      .select("*, relatorio_turmas(turma_id, turmas(nome))")
      .eq("id", relatorio_id)
      .single();

    if (!relatorio) {
      return new Response(JSON.stringify({ error: "Relatório não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const turmaNames = (relatorio.relatorio_turmas || []).map((rt: any) => rt.turmas?.nome).filter(Boolean).join(", ");

    const prompt = `Você é um redator jornalístico institucional de uma OSC. Com base nos dados abaixo de um relatório de atividade do SCFV, crie uma notícia/manchete para o site da instituição.

Dados do relatório:
- Data: ${relatorio.data}
- Atividade: ${relatorio.nome_atividade || "Atividade do SCFV"}
- Turmas: ${turmaNames || "Não informado"}
- Participantes: ${relatorio.num_participantes || 0}
- Score ELO: ${relatorio.score_elo || "N/A"}
- Observações: ${relatorio.observacoes || ""}

Retorne em JSON com os campos:
- titulo (max 80 chars, chamativo)
- subtitulo (max 150 chars)
- conteudo (3-4 parágrafos, tom institucional positivo)`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "create_noticia",
            description: "Create a news article",
            parameters: {
              type: "object",
              properties: {
                titulo: { type: "string" },
                subtitulo: { type: "string" },
                conteudo: { type: "string" },
              },
              required: ["titulo", "subtitulo", "conteudo"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_noticia" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!args) {
      return new Response(JSON.stringify({ error: "Failed to generate" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile id
    const { data: profile } = await svc.from("profiles").select("id").eq("user_id", userId).single();

    const { data: noticia, error: insertErr } = await svc.from("site_noticias").insert({
      titulo: args.titulo,
      subtitulo: args.subtitulo,
      conteudo: args.conteudo,
      status: "pendente",
      autor_id: profile?.id,
      relatorio_id,
    }).select().single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(noticia), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Load config
    const { data: cfg } = await supabase
      .from("configuracoes_gerais")
      .select("chave,valor")
      .in("chave", [
        "recompute_dias_inatividade_busca_ativa",
        "recompute_dias_alerta_desligamento",
        "recompute_dias_reativacao",
      ]);
    const map: Record<string, string> = {};
    (cfg || []).forEach((c: any) => { map[c.chave] = c.valor; });
    const diasInativ = parseInt(map["recompute_dias_inatividade_busca_ativa"] || "21", 10);
    const diasAlerta = parseInt(map["recompute_dias_alerta_desligamento"] || "30", 10);
    const diasReativ = parseInt(map["recompute_dias_reativacao"] || "7", 10);

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const dateReativ = fmt(new Date(today.getTime() - diasReativ * 86400000));
    const dateInativ = fmt(new Date(today.getTime() - diasInativ * 86400000));
    const dateAlerta = fmt(new Date(today.getTime() - diasAlerta * 86400000));

    let reativados = 0, sinalizados = 0, alertados = 0;

    // Fetch all participants with last presence date
    const { data: parts } = await supabase
      .from("participantes")
      .select("id, status")
      .in("status", ["ativo", "busca_ativa"]);

    if (!parts || parts.length === 0) {
      return ok({ reativados: 0, sinalizados: 0, alertados: 0 });
    }

    // last presence (presente=true) per participante
    const ids = parts.map((p: any) => p.id);
    const ultMap: Record<string, string> = {};
    // chunk to avoid URL limit
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { data: pres } = await supabase
        .from("presenca")
        .select("participante_id, data")
        .eq("presente", true)
        .in("participante_id", chunk)
        .order("data", { ascending: false });
      (pres || []).forEach((r: any) => {
        if (!ultMap[r.participante_id] || r.data > ultMap[r.participante_id]) {
          ultMap[r.participante_id] = r.data;
        }
      });
    }

    // Process rules
    for (const p of parts) {
      const up = ultMap[p.id]; // last present date YYYY-MM-DD or undefined

      // A) Reativação: busca_ativa com presença recente
      if (p.status === "busca_ativa" && up && up >= dateReativ) {
        await supabase.from("participantes")
          .update({ status: "ativo", data_retorno: new Date().toISOString() })
          .eq("id", p.id);
        await supabase.from("audit_log").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          user_nome: "Sistema (recompute)",
          acao: "recompute_status",
          tabela: "participantes",
          registro_id: p.id,
          detalhes: `Reativado automaticamente: presença em ${up}`,
        });
        reativados++;
        continue;
      }

      // B) Sinalização: ativo sem presença há mais de diasInativ
      if (p.status === "ativo" && (!up || up < dateInativ)) {
        await supabase.from("participantes")
          .update({ status: "busca_ativa" })
          .eq("id", p.id);
        await supabase.from("audit_log").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          user_nome: "Sistema (recompute)",
          acao: "recompute_status",
          tabela: "participantes",
          registro_id: p.id,
          detalhes: `Marcado como busca ativa: sem presença há mais de ${diasInativ} dias`,
        });
        sinalizados++;
        continue;
      }

      // C) Alerta de desligamento (NÃO desliga): busca_ativa há > diasAlerta sem presença
      if (p.status === "busca_ativa" && (!up || up < dateAlerta)) {
        const dias = up ? Math.floor((today.getTime() - new Date(up).getTime()) / 86400000) : 999;
        const { error } = await supabase.from("alertas_desligamento_sugerido").insert({
          participante_id: p.id,
          dias_sem_presenca: dias,
        });
        // ignore duplicates (unique participante+sugerido_em)
        if (!error) alertados++;
      }
    }

    // Save last run info
    const resumo = JSON.stringify({ reativados, sinalizados, alertados, at: new Date().toISOString() });
    await supabase.from("configuracoes_gerais").update({ valor: new Date().toISOString() }).eq("chave", "recompute_ultima_execucao");
    await supabase.from("configuracoes_gerais").update({ valor: resumo }).eq("chave", "recompute_ultimo_resultado");

    return ok({ reativados, sinalizados, alertados });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
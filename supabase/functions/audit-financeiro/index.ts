import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mes, ano } = await req.json();
    const mesRef = `${ano}-${String(mes).padStart(2, "0")}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const [despR, catR, parR, estR] = await Promise.all([
      sb.from("despesas").select("*").eq("mes_referencia", mesRef),
      sb.from("categorias_financeiras").select("*"),
      sb.from("parcelas_financeiras").select("*"),
      sb.from("estornos").select("*").eq("mes_referencia", mesRef),
    ]);

    const despesas = despR.data || [];
    const categorias = catR.data || [];
    const parcelas = parR.data || [];
    const estornos = estR.data || [];

    const findings: Array<{ severity: "erro" | "alerta" | "sugestao"; message: string; field?: string; despesa_id?: string }> = [];

    // 1. Despesas sem comprovante
    for (const d of despesas) {
      if (!d.comprovante_url && !d.nota_url && !d.boleto_url) {
        findings.push({ severity: "alerta", message: `Despesa "${d.descricao}" sem documento comprobatório anexo.`, despesa_id: d.id, field: "comprovante_url" });
      }
      if (!d.fornecedor) {
        findings.push({ severity: "alerta", message: `Despesa "${d.descricao}" sem fornecedor informado.`, despesa_id: d.id, field: "fornecedor" });
      }
      if (!d.cnpj_cpf) {
        findings.push({ severity: "alerta", message: `Despesa "${d.descricao}" sem CNPJ/CPF do fornecedor.`, despesa_id: d.id, field: "cnpj_cpf" });
      }
      if (!d.numero_documento) {
        findings.push({ severity: "alerta", message: `Despesa "${d.descricao}" sem número de documento fiscal.`, despesa_id: d.id, field: "numero_documento" });
      }
      if (!d.categoria_id) {
        findings.push({ severity: "erro", message: `Despesa "${d.descricao}" sem categoria/rubrica vinculada.`, despesa_id: d.id, field: "categoria_id" });
      }
    }

    // 2. Duplicidades
    const seen = new Map<string, any>();
    for (const d of despesas) {
      const key = `${d.valor}-${d.data_lancamento}-${(d.fornecedor || "").toLowerCase()}`;
      if (seen.has(key)) {
        findings.push({ severity: "alerta", message: `Possível duplicidade: "${d.descricao}" tem mesmo valor, data e fornecedor que "${seen.get(key).descricao}".`, despesa_id: d.id });
      }
      seen.set(key, d);
    }

    // 3. Saldo por categoria
    const catMap = new Map(categorias.map((c: any) => [c.id, c]));
    const gastosPorCat = new Map<string, number>();
    for (const d of despesas) {
      if (d.categoria_id) {
        gastosPorCat.set(d.categoria_id, (gastosPorCat.get(d.categoria_id) || 0) + Number(d.valor));
      }
    }
    for (const [catId, gasto] of gastosPorCat) {
      const cat = catMap.get(catId);
      if (cat && Number(cat.valor_previsto) > 0 && gasto > Number(cat.valor_previsto)) {
        findings.push({
          severity: "erro",
          message: `Categoria "${cat.codigo} — ${cat.descricao}" excedeu o valor previsto: gasto R$ ${gasto.toFixed(2)} / previsto R$ ${Number(cat.valor_previsto).toFixed(2)}.`,
        });
      }
    }

    // 4. Saldo geral negativo
    const totalRecebido = parcelas.reduce((s: number, p: any) => s + Number(p.valor), 0);
    const totalDespesas = despesas.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const totalEstornos = estornos.reduce((s: number, e: any) => s + Number(e.valor), 0);
    const saldo = totalRecebido - totalDespesas + totalEstornos;
    if (saldo < 0) {
      findings.push({ severity: "erro", message: `Saldo geral negativo: R$ ${saldo.toFixed(2)}. Despesas excedem os recursos recebidos.` });
    }

    // 5. CNPJ format validation
    for (const d of despesas) {
      if (d.cnpj_cpf) {
        const digits = d.cnpj_cpf.replace(/\D/g, "");
        if (digits.length !== 11 && digits.length !== 14) {
          findings.push({ severity: "sugestao", message: `Despesa "${d.descricao}": CNPJ/CPF "${d.cnpj_cpf}" parece inválido (${digits.length} dígitos).`, despesa_id: d.id, field: "cnpj_cpf" });
        }
      }
    }

    // Summary
    const erros = findings.filter(f => f.severity === "erro").length;
    const alertas = findings.filter(f => f.severity === "alerta").length;
    const sugestoes = findings.filter(f => f.severity === "sugestao").length;

    return new Response(JSON.stringify({
      mesRef,
      totalDespesas: despesas.length,
      summary: { erros, alertas, sugestoes },
      findings,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-financeiro error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

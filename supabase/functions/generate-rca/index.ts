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

    const { data: despesas } = await sb
      .from("despesas")
      .select("*, categorias_financeiras(codigo, descricao)")
      .eq("mes_referencia", mesRef)
      .order("data_lancamento");

    if (!despesas || despesas.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma despesa encontrada neste mês.", fallback: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build CSV in SIT format
    const header = "Nº Ordem;Data;Nº Documento;Tipo;Fornecedor;CNPJ/CPF;Descrição;Valor;Código Categoria;Categoria";
    const rows = despesas.map((d: any, i: number) => {
      const cat = d.categorias_financeiras;
      return [
        i + 1,
        d.data_lancamento,
        d.numero_documento || "",
        d.tipo_documento || "nota_fiscal",
        d.fornecedor || "",
        d.cnpj_cpf || "",
        `"${(d.descricao || "").replace(/"/g, '""')}"`,
        Number(d.valor).toFixed(2).replace(".", ","),
        cat?.codigo || "",
        cat?.descricao || "",
      ].join(";");
    });

    const csv = [header, ...rows].join("\n");
    const csvBytes = new TextEncoder().encode(csv);

    const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const filename = `SysELO_RCA_${mesRef}_${ts}.csv`;
    const { error: uploadError } = await sb.storage
      .from("documentos")
      .upload(`rca/${filename}`, csvBytes, {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = await sb.storage
      .from("documentos")
      .createSignedUrl(`rca/${filename}`, 3600);

    return new Response(JSON.stringify({ url: urlData?.signedUrl, filename }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-rca error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

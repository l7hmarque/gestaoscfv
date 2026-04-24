import JSZip from "jszip";
import { saveAs } from "file-saver";
import { buildDespesaTxt, validarDespesaSitDetalhado, type SitConfig, type ErroSit } from "./sitExport";
import { supabase } from "@/integrations/supabase/client";

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

function pickExt(url: string): string {
  const m = url.split("?")[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  return m ? m[1].toLowerCase() : "pdf";
}

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Resolve a Supabase storage URL (path) into a signed/public URL we can fetch.
 */
async function resolveUrl(rawUrl: string): Promise<string> {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http")) return rawUrl;
  // path no bucket prestacao-contas
  const { data } = await supabase.storage.from("prestacao-contas").createSignedUrl(rawUrl, 600);
  return data?.signedUrl || rawUrl;
}

export interface SitPackageResult {
  txtCount: number;
  comprovantesIncluidos: number;
  comprovantesFaltantes: string[];
}

export async function gerarPacoteSit(
  despesas: any[],
  cfg: SitConfig,
  meta: { mes: string; ano: string | number }
): Promise<SitPackageResult> {
  const zip = new JSZip();

  // 1. Despesa.txt
  const txt = buildDespesaTxt(despesas, cfg);
  zip.file("Despesa.txt", txt);

  // 2. comprovantes
  const compFolder = zip.folder("comprovantes")!;
  let incluidos = 0;
  const faltantes: string[] = [];

  for (const d of despesas) {
    const url = d.comprovante_url || d.nota_url || d.boleto_url;
    const numeroDoc = (d.sit_numero_doc_despesa || d.numero_documento || d.id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, "_");
    const cnpjFav = onlyDigits(d.cnpj_cpf) || "semcnpj";
    if (!url) {
      faltantes.push(`${numeroDoc} — ${d.descricao || "(sem descrição)"}`);
      continue;
    }
    const signed = await resolveUrl(url);
    const buf = await fetchAsArrayBuffer(signed);
    if (!buf) {
      faltantes.push(`${numeroDoc} — falha ao baixar`);
      continue;
    }
    compFolder.file(`${numeroDoc}_${cnpjFav}.${pickExt(signed)}`, buf);
    incluidos++;
  }

  // 3. README.txt
  const readme = [
    `Pacote de Prestação de Contas — SIT/TCE-PR`,
    `Mês de competência: ${meta.mes}/${meta.ano}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    ``,
    `Conteúdo:`,
    `  - Despesa.txt   (${despesas.length} linhas, layout pipe-delimitado)`,
    `  - comprovantes/ (${incluidos} arquivos)`,
    ``,
    `Como importar no SIT:`,
    `  1. Acesse o portal do TCE-PR → SIT-Concedente.`,
    `  2. Menu: Prestação de Contas → Importar Despesas em Lote.`,
    `  3. Selecione o arquivo Despesa.txt deste pacote.`,
    `  4. Anexe individualmente cada comprovante na tela de detalhe da despesa.`,
    ``,
    faltantes.length
      ? `ATENÇÃO: ${faltantes.length} despesa(s) sem comprovante anexado:\r\n  - ${faltantes.join("\r\n  - ")}`
      : `Todas as despesas possuem comprovante anexado.`,
  ].join("\r\n");
  zip.file("README.txt", readme);

  const blob = await zip.generateAsync({ type: "blob" });
  const fname = `SysCFV_PrestacaoContas_SIT_${meta.ano}-${String(meta.mes).padStart(2, "0")}.zip`;
  saveAs(blob, fname);

  return { txtCount: despesas.length, comprovantesIncluidos: incluidos, comprovantesFaltantes: faltantes };
}

export function validarLote(despesas: any[], cfg: SitConfig | null): { ok: any[]; bloqueadas: { d: any; erros: ErroSit[] }[] } {
  const ok: any[] = [];
  const bloqueadas: { d: any; erros: ErroSit[] }[] = [];
  for (const d of despesas) {
    const erros = validarDespesaSitDetalhado(d, cfg);
    if (erros.length) bloqueadas.push({ d, erros });
    else ok.push(d);
  }
  return { ok, bloqueadas };
}
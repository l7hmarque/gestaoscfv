// Edge Function: sync-drive-modelos
// Sincroniza documentos institucionais do SysCFV ao Google Drive para um mês específico.
// - Garante a estrutura de pastas SysCFV_Workspace/<subpastas>
// - Para cada tipo selecionado, gera o documento via funções internas e
//   coloca/copia o arquivo na subpasta correta com versionamento (_v2, _v3...).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import XLSX from "npm:xlsx-js-style";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files";

const SUBFOLDERS = [
  "01_Modelos_Institucionais",
  "02_Relatorios_Atividade",
  "03_Planejamentos",
  "04_Listas_Presenca",
  "05_Relatorios_Mensais",
  "06_REO",
  "07_Roteiros_Equipe_Tecnica",
  "08_Cronogramas",
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type Tipo = "mensal" | "listas" | "relatorios" | "planejamentos" | "equipe_tecnica" | "reo";
type Modo = "versionar" | "sobrescrever" | "pular";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

function authHeaders(extra?: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte o Google Drive no Lovable Cloud");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

async function findFolder(name: string, parentId?: string): Promise<DriveFile | null> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${parentClause}`;
  const url = `${GATEWAY_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=1`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Drive search falhou [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return (data.files || [])[0] || null;
}

async function createFolder(name: string, parentId?: string): Promise<DriveFile> {
  const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const res = await fetch(`${GATEWAY_URL}/files?fields=id,name,mimeType`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Drive create folder falhou [${res.status}]: ${await res.text()}`);
  return await res.json();
}

async function ensureFolder(name: string, parentId?: string): Promise<DriveFile> {
  return (await findFolder(name, parentId)) || (await createFolder(name, parentId));
}

/** Lista arquivos com prefixo dado dentro de pasta. */
async function listByPrefix(prefix: string, parentId: string): Promise<{ id: string; name: string }[]> {
  const q = `'${parentId}' in parents and trashed=false and name contains '${prefix.replace(/'/g, "\\'")}'`;
  const url = `${GATEWAY_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=100`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

/** Resolve nome final segundo modo de conflito. Retorna { nome, skip } */
async function resolveNome(baseName: string, ext: string, parentId: string, modo: Modo): Promise<{ nome: string; skip: boolean; toTrash: string[] }> {
  const candidato = `${baseName}.${ext}`;
  const existentes = await listByPrefix(baseName, parentId);
  const exato = existentes.find((f) => f.name === candidato);
  if (!exato) return { nome: candidato, skip: false, toTrash: [] };
  if (modo === "pular") return { nome: candidato, skip: true, toTrash: [] };
  if (modo === "sobrescrever") return { nome: candidato, skip: false, toTrash: [exato.id] };
  // versionar: encontra maior _vN entre existentes
  const re = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_v(\\d+)\\.${ext}$`);
  let max = 1;
  existentes.forEach((f) => {
    const m = f.name.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return { nome: `${baseName}_v${max + 1}.${ext}`, skip: false, toTrash: [] };
}

async function trashFile(fileId: string): Promise<void> {
  await fetch(`${GATEWAY_URL}/files/${fileId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ trashed: true }),
  });
}

/** Upload binário (multipart) para o Drive na pasta indicada, com nome final dado.
 *  Se `targetMimeType` for um Google Apps mimeType (ex: spreadsheet/document),
 *  o Drive converte automaticamente o arquivo na importação (XLSX → Sheets, DOCX → Docs).
 */
async function uploadBytes(
  name: string,
  sourceMimeType: string,
  bytes: Uint8Array,
  parentId: string,
  targetMimeType?: string,
): Promise<string> {
  const boundary = "----LovableBoundary" + crypto.randomUUID().replace(/-/g, "");
  const metaObj: any = { name, parents: [parentId] };
  if (targetMimeType) metaObj.mimeType = targetMimeType;
  const meta = JSON.stringify(metaObj);
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: ${sourceMimeType}\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);
  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name&supportsAllDrives=true`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": `multipart/related; boundary=${boundary}` }),
    body,
  });
  if (!res.ok) throw new Error(`Drive upload falhou [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

/** Move arquivo Google nativo (Doc/Sheet) para uma pasta, removendo a raiz. */
async function moveFileToFolder(fileId: string, parentId: string): Promise<void> {
  // Descobre parents atuais
  const meta = await fetch(`${GATEWAY_URL}/files/${fileId}?fields=parents&supportsAllDrives=true`, { headers: authHeaders() });
  const cur = meta.ok ? await meta.json() : { parents: [] };
  const removeParents = (cur.parents || []).join(",");
  const url = `${GATEWAY_URL}/files/${fileId}?addParents=${parentId}${removeParents ? `&removeParents=${removeParents}` : ""}&supportsAllDrives=true&fields=id,parents`;
  const r = await fetch(url, { method: "PATCH", headers: authHeaders() });
  if (!r.ok) throw new Error(`Move falhou [${r.status}]: ${await r.text()}`);
}

async function renameFile(fileId: string, name: string): Promise<void> {
  await fetch(`${GATEWAY_URL}/files/${fileId}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
}

/** Invoca outra edge function internamente, repassando token de service. */
async function invokeFn(name: string, payload: any, authHeader: string | null): Promise<any> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader || `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${name} falhou [${res.status}]: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

function safeName(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s\-]/g, "").trim().replace(/\s+/g, "_").slice(0, 80);
}
function pad2(n: number): string { return String(n).padStart(2, "0"); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mes: number | null = body?.mes ? Number(body.mes) : null;
    const ano: number | null = body?.ano ? Number(body.ano) : null;
    const tipos: Tipo[] = Array.isArray(body?.tipos) ? body.tipos : [];
    const modo: Modo = body?.modo === "sobrescrever" || body?.modo === "pular" ? body.modo : "versionar";
    const batchSize = Math.min(Math.max(Number(body?.batchSize || 3), 1), 5);
    const cursorIn = body?.cursor && typeof body.cursor === "object" ? body.cursor : { tipoIndex: 0, offset: 0, part: 0 };
    const tipoIndex = Math.max(Number(cursorIn.tipoIndex || 0), 0);
    const offset = Math.max(Number(cursorIn.offset || 0), 0);
    const part = Math.max(Number(cursorIn.part || 0), 0);
    const authHeader = req.headers.get("Authorization");

    // 1. Estrutura de pastas: SYSCFV / {MES_UPPER} - {ANO} / <subpastas>
    const sysCfvRoot = await ensureFolder("SYSCFV");
    const mesUpper = mes ? MESES[mes - 1].toUpperCase() : null;
    const monthFolderName = mes && ano ? `${mesUpper} - ${ano}` : "GERAL";
    const root = await ensureFolder(monthFolderName, sysCfvRoot.id);
    const subs: Record<string, { id: string; url: string }> = {};
    for (const sub of SUBFOLDERS) {
      const f = await ensureFolder(sub, root.id);
      subs[sub] = { id: f.id, url: `https://drive.google.com/drive/folders/${f.id}` };
    }

    const result: any = {
      success: true,
      sysCfvRoot: { id: sysCfvRoot.id, url: `https://drive.google.com/drive/folders/${sysCfvRoot.id}` },
      root: { id: root.id, url: `https://drive.google.com/drive/folders/${root.id}` },
      mesPasta: monthFolderName,
      subfolders: subs,
      sincronizados: { mensal: null, listas: [], relatorios: [], planejamentos: [], equipe_tecnica: null, reo: null },
      erros: [] as { tipo: string; msg: string }[],
      batch: { currentTipo: tipos[tipoIndex] || null, tipoIndex, offset, part, batchSize, processed: 0 },
      hasMore: false,
      cursor: null as null | { tipoIndex: number; offset: number; part?: number },
    };

    const respond = (next?: { tipoIndex: number; offset: number; part?: number } | null) => {
      result.hasMore = !!next && next.tipoIndex < tipos.length;
      result.cursor = result.hasMore ? next : null;
      result.batch.currentTipo = tipos[tipoIndex] || null;
      return new Response(JSON.stringify({ ...result, async: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    const nextCategory = () => ({ tipoIndex: tipoIndex + 1, offset: 0, part: 0 });
    const currentTipo = tipos[tipoIndex];

    if (!mes || !ano || tipos.length === 0 || !currentTipo) {
      // Apenas garantir pastas
      return respond(null);
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const mesStr = pad2(mes);
    const dataIni = `${ano}-${mesStr}-01`;
    const dataFim = new Date(ano, mes, 0); // último dia
    const dataFimStr = `${ano}-${mesStr}-${pad2(dataFim.getDate())}`;
    const periodoLabel = `${MESES[mes - 1]}_${ano}`;

    // ===== TIPO: mensal (XLSX) =====
    if (currentTipo === "mensal") {
      try {
        const r = await invokeFn("generate-relatorio-mensal", { mes, ano }, authHeader);
        if (r?.url) {
          const buf = new Uint8Array(await (await fetch(r.url)).arrayBuffer());
          const base = `SysCFV_RelatorioMensal_${periodoLabel}`;
          const target = subs["05_Relatorios_Mensais"].id;
          const { nome, skip, toTrash } = await resolveNome(base, "gsheet", target, modo);
          if (!skip) {
            for (const id of toTrash) await trashFile(id);
            const cleanName = nome.replace(/\.gsheet$/, "");
            const fid = await uploadBytes(
              cleanName,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              buf,
              target,
              "application/vnd.google-apps.spreadsheet",
            );
            result.sincronizados.mensal = { nome: cleanName, fileId: fid, url: `https://docs.google.com/spreadsheets/d/${fid}/edit` };
          } else {
            result.sincronizados.mensal = { nome, skipped: true };
          }
        }
      } catch (e: any) { result.erros.push({ tipo: "mensal", msg: e.message }); }
      result.batch.processed = result.sincronizados.mensal ? 1 : 0;
      return respond(nextCategory());
    }

    // ===== TIPO: listas (Google Sheets, uma por turma ativa no mês) =====
    if (currentTipo === "listas") {
      try {
        // Turmas com algum relatório no mês (via relatorio_turmas) +
        // turmas com planejamento no mês (via planejamento_turmas)
        const { data: relIds } = await sb.from("relatorios_atividade")
          .select("id").gte("data", dataIni).lte("data", dataFimStr);
        const relIdsArr = (relIds || []).map((r: any) => r.id);
        const { data: plIds } = await sb.from("planejamentos")
          .select("id").gte("data_aplicacao", dataIni).lte("data_aplicacao", dataFimStr);
        const plIdsArr = (plIds || []).map((p: any) => p.id);
        const turmasSet = new Set<string>();
        if (relIdsArr.length) {
          const { data: rt } = await sb.from("relatorio_turmas").select("turma_id").in("relatorio_id", relIdsArr);
          (rt || []).forEach((r: any) => r.turma_id && turmasSet.add(r.turma_id));
        }
        if (plIdsArr.length) {
          const { data: pt } = await sb.from("planejamento_turmas").select("turma_id").in("planejamento_id", plIdsArr);
          (pt || []).forEach((r: any) => r.turma_id && turmasSet.add(r.turma_id));
        }
        const turmasIds = Array.from(turmasSet);
        const lote = turmasIds.slice(offset, offset + batchSize);
        const target = subs["04_Listas_Presenca"].id;
        for (const turmaId of lote) {
          try {
            const r = await invokeFn("generate-lista-chamada-gsheet", { turma_id: turmaId, mes, ano }, authHeader);
            const fileIdRet = r?.fileId || r?.drive_file_id;
            if (fileIdRet) {
              const { data: turma } = await sb.from("turmas").select("nome").eq("id", turmaId).maybeSingle();
              const base = `SysCFV_ListaChamada_${safeName(turma?.nome || "Turma")}_${periodoLabel}`;
              const { nome, skip, toTrash } = await resolveNome(base, "gsheet", target, modo);
              if (skip) { await trashFile(fileIdRet); result.sincronizados.listas.push({ turmaId, nome, skipped: true }); continue; }
              for (const id of toTrash) await trashFile(id);
              await renameFile(fileIdRet, nome.replace(/\.gsheet$/, ""));
              await moveFileToFolder(fileIdRet, target);
              result.sincronizados.listas.push({ turmaId, fileId: fileIdRet, nome, url: `https://docs.google.com/spreadsheets/d/${fileIdRet}/edit` });
            }
          } catch (e: any) { result.erros.push({ tipo: `lista:${turmaId}`, msg: e.message }); }
        }
        result.batch.processed = lote.length;
        result.batch.total = turmasIds.length;
        const nextOffset = offset + lote.length;
        return respond(nextOffset < turmasIds.length ? { tipoIndex, offset: nextOffset, part: 0 } : nextCategory());
      } catch (e: any) { result.erros.push({ tipo: "listas", msg: e.message }); return respond(nextCategory()); }
    }

    // ===== TIPO: relatorios (Google Docs) =====
    if (currentTipo === "relatorios") {
      try {
        const { data: rels } = await sb.from("relatorios_atividade")
          .select("id, data, nome_atividade")
          .gte("data", dataIni).lte("data", dataFimStr)
          .order("data");
        const allRels = rels || [];
        const lote = allRels.slice(offset, offset + batchSize);
        const target = subs["02_Relatorios_Atividade"].id;
        for (const rel of lote) {
          try {
            // Usa o MESMO motor do botão "Abrir no Drive" do /relatorios/:id —
            // clona o template institucional de drive_modelos e preenche placeholders.
            const r = await invokeFn(
              "drive-sync-worker",
              { action: "process_relatorio_now", origem_id: rel.id },
              authHeader,
            );
            const sourceFileId: string | undefined = r?.drive_file_id;
            if (!sourceFileId) continue;
            const base = `SysCFV_Relatorio_${rel.data}_${safeName(rel.nome_atividade || "Atividade")}`;
            const { nome, skip, toTrash } = await resolveNome(base, "gdoc", target, modo);
            if (skip) { result.sincronizados.relatorios.push({ relId: rel.id, nome, skipped: true }); continue; }
            for (const id of toTrash) await trashFile(id);
            // Cópia para a pasta institucional (mantém o original na pasta do educador,
            // que é o que o botão "Abrir no Drive" do relatório abre).
            const copyName = nome.replace(/\.gdoc$/, "");
            const copyRes = await fetch(
              `${GATEWAY_URL}/files/${sourceFileId}/copy?supportsAllDrives=true&fields=id,name`,
              {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ name: copyName, parents: [target] }),
              },
            );
            if (!copyRes.ok) throw new Error(`copy falhou [${copyRes.status}]: ${await copyRes.text()}`);
            const copyJson = await copyRes.json();
            const fileId = copyJson.id;
            // copy nem sempre respeita parents — garante movimento para a subpasta
            await moveFileToFolder(fileId, target);
            result.sincronizados.relatorios.push({ relId: rel.id, fileId, nome, url: `https://docs.google.com/document/d/${fileId}/edit` });
          } catch (e: any) { result.erros.push({ tipo: `relatorio:${rel.id}`, msg: e.message }); }
        }
        result.batch.processed = lote.length;
        result.batch.total = allRels.length;
        const nextOffset = offset + lote.length;
        return respond(nextOffset < allRels.length ? { tipoIndex, offset: nextOffset, part: 0 } : nextCategory());
      } catch (e: any) { result.erros.push({ tipo: "relatorios", msg: e.message }); return respond(nextCategory()); }
    }

    // ===== TIPO: planejamentos (Google Docs via drive_modelos.planejamento) =====
    if (currentTipo === "planejamentos") {
      try {
        const { data: pls } = await sb.from("planejamentos")
          .select("id, data_aplicacao, titulo")
          .gte("data_aplicacao", dataIni).lte("data_aplicacao", dataFimStr)
          .order("data_aplicacao");
        const allPls = pls || [];
        const lote = allPls.slice(offset, offset + batchSize);
        const target = subs["03_Planejamentos"].id;
        for (const pl of lote) {
          try {
            const r = await invokeFn(
              "drive-sync-worker",
              { action: "process_planejamento_now", origem_id: pl.id },
              authHeader,
            );
            const sourceFileId: string | undefined = r?.drive_file_id;
            if (!sourceFileId) continue;
            const base = `SysCFV_Planejamento_${pl.data_aplicacao}_${safeName(pl.titulo || "Planejamento")}`;
            const { nome, skip, toTrash } = await resolveNome(base, "gdoc", target, modo);
            if (skip) { result.sincronizados.planejamentos.push({ plId: pl.id, nome, skipped: true }); continue; }
            for (const id of toTrash) await trashFile(id);
            const copyName = nome.replace(/\.gdoc$/, "");
            const copyRes = await fetch(
              `${GATEWAY_URL}/files/${sourceFileId}/copy?supportsAllDrives=true&fields=id,name`,
              { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: copyName, parents: [target] }) },
            );
            if (!copyRes.ok) throw new Error(`copy falhou [${copyRes.status}]: ${await copyRes.text()}`);
            const copyJson = await copyRes.json();
            const fileId = copyJson.id;
            await moveFileToFolder(fileId, target);
            result.sincronizados.planejamentos.push({ plId: pl.id, fileId, nome, url: `https://docs.google.com/document/d/${fileId}/edit` });
          } catch (e: any) { result.erros.push({ tipo: `planejamento:${pl.id}`, msg: e.message }); }
        }
        result.batch.processed = lote.length;
        result.batch.total = allPls.length;
        const nextOffset = offset + lote.length;
        return respond(nextOffset < allPls.length ? { tipoIndex, offset: nextOffset, part: 0 } : nextCategory());
      } catch (e: any) { result.erros.push({ tipo: "planejamentos", msg: e.message }); return respond(nextCategory()); }
    }

    // ===== TIPO: equipe_tecnica (XLSX consolidado de atendimentos + relatos) =====
    if (currentTipo === "equipe_tecnica") {
      try {
        const [{ data: atend }, { data: relatos }] = await Promise.all([
          sb.from("atendimentos")
            .select("data_atendimento, tipo, encaminhamento, sigiloso, descricao, participantes(nome_completo), profiles:profissional_id(nome_completo)")
            .gte("data_atendimento", dataIni).lte("data_atendimento", dataFimStr)
            .order("data_atendimento"),
          sb.from("relato_equipe_tecnica")
            .select("created_at, motivo, descricao, profiles:criado_por(nome_completo), relatorios_atividade(data, nome_atividade)")
            .gte("created_at", dataIni).lte("created_at", dataFimStr + "T23:59:59")
            .order("created_at"),
        ]);

        const wb = XLSX.utils.book_new();
        const aoaA = [
          ["Data", "Tipo", "Participante", "Profissional", "Encaminhamento", "Sigiloso", "Descrição"],
          ...((atend || []).map((a: any) => [
            a.data_atendimento, a.tipo, a.participantes?.nome_completo || "—",
            a.profiles?.nome_completo || "—", a.encaminhamento || "—",
            a.sigiloso ? "Sim" : "Não", (a.descricao || "").slice(0, 500),
          ])),
        ];
        const wsA = XLSX.utils.aoa_to_sheet(aoaA);
        wsA["!cols"] = [{wch:12},{wch:22},{wch:30},{wch:24},{wch:24},{wch:8},{wch:60}];
        XLSX.utils.book_append_sheet(wb, wsA, "Atendimentos");

        const aoaR = [
          ["Data", "Atividade", "Motivo", "Autor", "Descrição"],
          ...((relatos || []).map((r: any) => [
            r.relatorios_atividade?.data || r.created_at?.slice(0, 10),
            r.relatorios_atividade?.nome_atividade || "—",
            r.motivo, r.profiles?.nome_completo || "—",
            (r.descricao || "").slice(0, 500),
          ])),
        ];
        const wsR = XLSX.utils.aoa_to_sheet(aoaR);
        wsR["!cols"] = [{wch:12},{wch:30},{wch:24},{wch:24},{wch:60}];
        XLSX.utils.book_append_sheet(wb, wsR, "Relatos Pedagógicos");

        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const target = subs["07_Roteiros_Equipe_Tecnica"].id;
        const base = `SysCFV_EquipeTecnica_${periodoLabel}`;
        const { nome, skip, toTrash } = await resolveNome(base, "gsheet", target, modo);
        if (!skip) {
          for (const id of toTrash) await trashFile(id);
          const cleanName = nome.replace(/\.gsheet$/, "");
          const fid = await uploadBytes(
            cleanName,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            new Uint8Array(buf),
            target,
            "application/vnd.google-apps.spreadsheet",
          );
          result.sincronizados.equipe_tecnica = { nome: cleanName, fileId: fid, url: `https://docs.google.com/spreadsheets/d/${fid}/edit`, atendimentos: (atend || []).length, relatos: (relatos || []).length };
        } else {
          result.sincronizados.equipe_tecnica = { nome, skipped: true };
        }
      } catch (e: any) { result.erros.push({ tipo: "equipe_tecnica", msg: e.message }); }
      result.batch.processed = result.sincronizados.equipe_tecnica ? 1 : 0;
      return respond(nextCategory());
    }

    // ===== TIPO: reo (DOCX → Google Doc + XLSX → Google Sheet) =====
    if (currentTipo === "reo") {
      try {
        const target = subs["06_REO"].id;
        // DOCX
        if (part === 0) try {
          const rDoc = await invokeFn("generate-reo", { mes, ano, formato: "docx" }, authHeader);
          if (rDoc?.url) {
            const buf = new Uint8Array(await (await fetch(rDoc.url)).arrayBuffer());
            const base = `SysCFV_REO_${periodoLabel}`;
            const { nome, skip, toTrash } = await resolveNome(base, "gdoc", target, modo);
            if (!skip) {
              for (const id of toTrash) await trashFile(id);
              const cleanName = nome.replace(/\.gdoc$/, "");
              const fid = await uploadBytes(
                cleanName,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                buf,
                target,
                "application/vnd.google-apps.document",
              );
              result.sincronizados.reo = { ...(result.sincronizados.reo || {}), doc: { nome: cleanName, fileId: fid, url: `https://docs.google.com/document/d/${fid}/edit` } };
            }
          }
        } catch (e: any) { result.erros.push({ tipo: "reo:docx", msg: e.message }); }
        if (part === 0) {
          result.batch.processed = 1;
          result.batch.total = 2;
          return respond({ tipoIndex, offset: 0, part: 1 });
        }
        // XLSX (anexo)
        if (part === 1) try {
          const rXls = await invokeFn("generate-reo", { mes, ano, formato: "xlsx" }, authHeader);
          if (rXls?.url) {
            const buf = new Uint8Array(await (await fetch(rXls.url)).arrayBuffer());
            const base = `SysCFV_REO_Anexo_${periodoLabel}`;
            const { nome, skip, toTrash } = await resolveNome(base, "gsheet", target, modo);
            if (!skip) {
              for (const id of toTrash) await trashFile(id);
              const cleanName = nome.replace(/\.gsheet$/, "");
              const fid = await uploadBytes(
                cleanName,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                buf,
                target,
                "application/vnd.google-apps.spreadsheet",
              );
              result.sincronizados.reo = { ...(result.sincronizados.reo || {}), sheet: { nome: cleanName, fileId: fid, url: `https://docs.google.com/spreadsheets/d/${fid}/edit` } };
            }
          }
        } catch (e: any) { result.erros.push({ tipo: "reo:xlsx", msg: e.message }); }
        result.batch.processed = 1;
        result.batch.total = 2;
        return respond(nextCategory());
      } catch (e: any) { result.erros.push({ tipo: "reo", msg: e.message }); return respond(nextCategory()); }
    }
    return respond(null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-drive-modelos]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
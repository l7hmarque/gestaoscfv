// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import exifr from "npm:exifr@7.1.3";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;
const GOOGLE_DOCS_API_KEY = Deno.env.get("GOOGLE_DOCS_API_KEY")!;
const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY")!;

const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD_GW = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";
const DOCS_GW = "https://connector-gateway.lovable.dev/google_docs/v1";
const SHEETS_GW = "https://connector-gateway.lovable.dev/google_sheets/v4";

const MAX_JOBS_PER_RUN = 2;
const MAX_TENTATIVAS = 5;

// Retry helper para chamadas Google: trata 429/503/5xx com backoff exponencial.
async function fetchGoogle(url: string, init: RequestInit, label: string, maxRetries = 4): Promise<Response> {
  let attempt = 0;
  let lastStatus = 0;
  let lastBody = "";
  while (attempt <= maxRetries) {
    const r = await fetch(url, init);
    if (r.ok) return r;
    lastStatus = r.status;
    if (r.status !== 429 && r.status !== 503 && r.status < 500) {
      lastBody = await r.text();
      throw new Error(`${label} ${r.status}: ${lastBody}`);
    }
    lastBody = await r.text();
    if (attempt === maxRetries) break;
    const retryAfter = Number(r.headers.get("retry-after")) || 0;
    const delay = Math.max(retryAfter * 1000, Math.min(16000, 2000 * Math.pow(2, attempt)));
    console.warn(`${label} ${r.status} — retry ${attempt + 1}/${maxRetries} em ${delay}ms`);
    await new Promise((res) => setTimeout(res, delay));
    attempt++;
  }
  throw new Error(`${label} ${lastStatus} (após ${maxRetries} retries): ${lastBody}`);
}

// =============================================================================
// Template Engine (clone-from-template + replace placeholders)
// =============================================================================
const LIKERT_RGB: Record<number, { red: number; green: number; blue: number }> = {
  1: { red: 0.753, green: 0.224, blue: 0.169 }, // #C0392B
  2: { red: 0.902, green: 0.494, blue: 0.133 }, // #E67E22
  3: { red: 0.945, green: 0.769, blue: 0.059 }, // #F1C40F
  4: { red: 0.153, green: 0.682, blue: 0.376 }, // #27AE60
  5: { red: 0.086, green: 0.627, blue: 0.522 }, // #16A085
};

async function getTemplateId(tipo: string): Promise<string> {
  const { data } = await supabase.from("drive_modelos").select("template_doc_id").eq("tipo", tipo).maybeSingle();
  if (!data?.template_doc_id) throw new Error(`Modelo '${tipo}' nao configurado em drive_modelos`);
  return data.template_doc_id as string;
}

async function cloneFromTemplate(tipo: string, parentFolderId: string, title: string): Promise<string> {
  const tplId = await getTemplateId(tipo);
  const r = await fetchGoogle(`${DRIVE_GW}/files/${tplId}/copy?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: { ...driveHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: title, parents: [parentFolderId] }),
  }, `cloneTemplate ${tipo}`);
  return (await r.json()).id;
}

async function docsBatch(docId: string, requests: any[]): Promise<any> {
  if (!requests.length) return null;
  const r = await fetchGoogle(`${DOCS_GW}/documents/${docId}:batchUpdate`, {
    method: "POST",
    headers: docsHeaders(),
    body: JSON.stringify({ requests }),
  }, "docsBatch");
  return await r.json();
}

async function getDocFull(docId: string): Promise<any> {
  const r = await fetchGoogle(`${DOCS_GW}/documents/${docId}`, { headers: docsHeaders() }, "getDoc");
  return await r.json();
}

type WalkRun = { startIndex: number; endIndex: number; content: string; tableStartLocation?: number; rowIndex?: number; columnIndex?: number };
function* walkRuns(els: any[]): Generator<WalkRun> {
  for (const el of els || []) {
    if (el.paragraph) {
      for (const e of el.paragraph.elements || []) {
        if (e.textRun) yield { startIndex: e.startIndex, endIndex: e.endIndex, content: e.textRun.content || "" };
      }
    }
    if (el.table) {
      const ts = el.startIndex;
      for (let r = 0; r < el.table.tableRows.length; r++) {
        for (let c = 0; c < el.table.tableRows[r].tableCells.length; c++) {
          const cell = el.table.tableRows[r].tableCells[c];
          for (const sub of walkRuns(cell.content)) {
            yield { ...sub, tableStartLocation: ts, rowIndex: r, columnIndex: c };
          }
        }
      }
    }
  }
}

async function replacePlaceholders(docId: string, map: Record<string, string>) {
  const reqs: any[] = [];
  for (const [k, v] of Object.entries(map)) {
    reqs.push({ replaceAllText: { containsText: { text: k, matchCase: true }, replaceText: String(v ?? "") } });
  }
  // Docs API limita ~100 requests/call; chunkar por segurança
  for (let i = 0; i < reqs.length; i += 80) {
    await docsBatch(docId, reqs.slice(i, i + 80));
  }
}

async function colorCellByToken(docId: string, token: string, nota: number) {
  const n = Math.max(1, Math.min(5, Math.round(nota)));
  const color = LIKERT_RGB[n];
  if (!color) return;
  const doc = await getDocFull(docId);
  for (const r of walkRuns(doc.body.content)) {
    if (r.tableStartLocation !== undefined && r.content.includes(token)) {
      await docsBatch(docId, [{
        updateTableCellStyle: {
          tableCellStyle: { backgroundColor: { color: { rgbColor: color } } },
          fields: "backgroundColor",
          tableRange: {
            tableCellLocation: { tableStartLocation: { index: r.tableStartLocation }, rowIndex: r.rowIndex, columnIndex: r.columnIndex },
            rowSpan: 1,
            columnSpan: 1,
          },
        },
      }]).catch((e) => console.warn("colorCell", token, e.message));
      return;
    }
  }
}

async function makeFilePublic(fileId: string) {
  await fetch(`${DRIVE_GW}/files/${fileId}/permissions`, {
    method: "POST",
    headers: { ...driveHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  }).catch(() => {});
}

async function insertImageAtToken(docId: string, token: string, driveFileId: string, widthPt = 460): Promise<boolean> {
  await makeFilePublic(driveFileId);
  const doc = await getDocFull(docId);
  for (const r of walkRuns(doc.body.content)) {
    const pos = r.content.indexOf(token);
    if (pos < 0) continue;
    const idx = r.startIndex + pos;
    try {
      await docsBatch(docId, [
        { deleteContentRange: { range: { startIndex: idx, endIndex: idx + token.length } } },
        { insertInlineImage: {
          location: { index: idx },
          uri: `https://drive.google.com/uc?export=view&id=${driveFileId}`,
          objectSize: { width: { magnitude: widthPt, unit: "PT" }, height: { magnitude: widthPt * 0.75, unit: "PT" } },
        } },
        // garante quebra de parágrafo APÓS a imagem para não empilhar/sobrepor
        { insertText: { location: { index: idx + 1 }, text: "\n" } },
      ]);
      return true;
    } catch (e) {
      console.warn("insertImage", token, (e as Error).message);
      // limpa o token mesmo sem imagem para não deixar lixo
      await replacePlaceholders(docId, { [token]: "[imagem indisponível]" });
      return false;
    }
  }
  return false;
}

// Localiza posição imediatamente APÓS um anchor de texto e insere uma tabela com cabeçalho + linhas
async function insertTableAfterAnchor(docId: string, anchor: string, header: string[], rows: string[][]) {
  if (!rows.length && !header.length) return;
  const doc = await getDocFull(docId);
  let insertIdx = -1;
  for (const el of doc.body.content || []) {
    if (!el.paragraph) continue;
    const txt = (el.paragraph.elements || []).map((e: any) => e.textRun?.content || "").join("");
    if (txt.includes(anchor)) {
      // achar índice DEPOIS do anchor: usar endIndex do parágrafo + 1 espaço de buffer
      // mas precisamos de um parágrafo vazio depois para inserir a tabela; usar parágrafo seguinte
      insertIdx = el.endIndex; // posição imediatamente após o "\n" do parágrafo
      break;
    }
  }
  if (insertIdx < 0) {
    // anchor não encontrado: ignora
    return;
  }
  const cols = (header.length || rows[0]?.length || 1);
  const totalRows = (header.length ? 1 : 0) + rows.length;
  if (totalRows < 1 || cols < 1) return;
  await docsBatch(docId, [{ insertTable: { rows: totalRows, columns: cols, location: { index: insertIdx } } }]);

  // re-busca a tabela recém-criada (primeira tabela cuja startIndex >= insertIdx)
  const doc2 = await getDocFull(docId);
  let tbl: any = null;
  for (const el of doc2.body.content || []) {
    if (el.table && el.startIndex >= insertIdx) { tbl = el; break; }
  }
  if (!tbl) return;

  const filled = header.length ? [header, ...rows] : rows;
  // inserir em ordem reversa para preservar índices
  const reqs: any[] = [];
  for (let r = filled.length - 1; r >= 0; r--) {
    const row = tbl.table.tableRows[r];
    if (!row) continue;
    for (let c = filled[r].length - 1; c >= 0; c--) {
      const cell = row.tableCells[c];
      if (!cell) continue;
      // inserir no índice do parágrafo da célula (cell.startIndex + 1 = dentro do primeiro parágrafo)
      const insIdx = cell.startIndex + 1;
      const text = String(filled[r][c] ?? "");
      if (text) reqs.push({ insertText: { location: { index: insIdx }, text } });
    }
  }
  if (reqs.length) await docsBatch(docId, reqs);

  // negrito no cabeçalho
  if (header.length) {
    const doc3 = await getDocFull(docId);
    let tbl3: any = null;
    for (const el of doc3.body.content || []) {
      if (el.table && el.startIndex >= insertIdx) { tbl3 = el; break; }
    }
    if (tbl3) {
      const headerRow = tbl3.table.tableRows[0];
      const styleReqs: any[] = [];
      for (const cell of headerRow.tableCells) {
        styleReqs.push({
          updateTextStyle: {
            range: { startIndex: cell.startIndex, endIndex: cell.endIndex - 1 },
            textStyle: { bold: true },
            fields: "bold",
          },
        });
      }
      if (styleReqs.length) await docsBatch(docId, styleReqs);
    }
  }
}

// =============================================================================
// Template fillers
// =============================================================================
function fmtDateBR(d: any): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d.length <= 10 ? d + "T12:00:00" : d) : d;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

// snake_case / SNAKE_CASE → "Title Case" (preserva acentos)
function humanize(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (_m, c) => c.toUpperCase());
}

async function fillRelatorioTemplate(docId: string, ctx: {
  rel: any; turmas: string[]; presenca: any[]; fotos: any[]; bairros: string[];
}) {
  const { rel, turmas, presenca, fotos, bairros } = ctx;

  // Mapas de checkboxes (engajamento[], situacoes_relevantes[])
  const eng: string[] = rel.engajamento || [];
  const sit: string[] = rel.situacoes_relevantes || [];
  const ENG_KEYS = ["participativo", "disperso", "boa_interacao", "intervencao"]; // 1..4
  const SIT_KEYS = ["nenhuma", "conflito", "vulnerabilidade", "encaminhamento", "comunicacao_familia"]; // 1..5
  const obj = rel.objetivo_alcancado || ""; // "alcancado"|"parcialmente"|"nao_alcancado"

  const map: Record<string, string> = {
    "{DATA}": fmtDateBR(rel.data),
    "{BAIRROS}": bairros.join(", ") || "—",
    "{PERIODO}": rel.periodo_atividade || "—",
    "{TURMAS}": turmas.join(", ") || "—",
    "{EDUCADOR}": rel.educador_nome || "—",
    "{NOME_ATIVIDADE}": rel.nome_atividade || "—",
    "{TIPO_ATIVIDADE}": (rel.tipo_atividade || []).map(humanize).join(", ") || "—",
    "{NUM_PRESENTES}": String(rel.num_participantes ?? presenca.filter((p) => p.presente).length),
    "{NUM_MATRICULADOS}": String(rel.num_matriculados ?? presenca.length),
    "{ATIVIDADES_REALIZADAS}": rel.atividades_realizadas || rel.descricao || "—",
    "{OBSERVACOES}": rel.observacoes || "—",
    "{PCT_ADESAO}": rel.pct_adesao != null ? `${rel.pct_adesao}%` : "—",
    "{INICIATIVA}": rel.iniciativa != null ? String(rel.iniciativa) : "—",
    "{AUTONOMIA}": rel.autonomia != null ? String(rel.autonomia) : "—",
    "{COLABORACAO}": rel.colaboracao != null ? String(rel.colaboracao) : "—",
    "{COMUNICACAO}": rel.comunicacao != null ? String(rel.comunicacao) : "—",
    "{RESPEITO_MUTUO}": rel.respeito_mutuo != null ? String(rel.respeito_mutuo) : "—",
    "{SCORE_ELO}": rel.score_elo != null ? String(rel.score_elo) : "—",
    "{ENG_1}": eng.includes(ENG_KEYS[0]) ? "■ " : "□ ",
    "{ENG_2}": eng.includes(ENG_KEYS[1]) ? "■ " : "□ ",
    "{ENG_3}": eng.includes(ENG_KEYS[2]) ? "■ " : "□ ",
    "{ENG_4}": eng.includes(ENG_KEYS[3]) ? "■ " : "□ ",
    "{SIT_1}": sit.includes(SIT_KEYS[0]) ? "■ " : "□ ",
    "{SIT_2}": sit.includes(SIT_KEYS[1]) ? "■ " : "□ ",
    "{SIT_3}": sit.includes(SIT_KEYS[2]) ? "■ " : "□ ",
    "{SIT_4}": sit.includes(SIT_KEYS[3]) ? "■ " : "□ ",
    "{SIT_5}": sit.includes(SIT_KEYS[4]) ? "■ " : "□ ",
    "{OBJ_ALC}": obj === "alcancado" ? "■ " : "□ ",
    "{OBJ_PAR}": obj === "parcialmente" ? "■ " : "□ ",
    "{OBJ_NAO}": obj === "nao_alcancado" ? "■ " : "□ ",
  };

  await replacePlaceholders(docId, map);

  // Cores nas células de competência
  const compTokens: [string, number | null][] = [
    ["INICIATIVA", rel.iniciativa],
    ["AUTONOMIA", rel.autonomia],
    ["COLABORAÇÃO", rel.colaboracao],
    ["COMUNICAÇÃO", rel.comunicacao],
    ["RESPEITO MÚTUO", rel.respeito_mutuo],
    ["SCORE ELO", rel.score_elo],
  ];
  for (const [tok, val] of compTokens) {
    if (val != null) await colorCellByToken(docId, tok, Number(val));
  }

  // Fotos (até 5 placeholders)
  for (let i = 0; i < 5; i++) {
    const tok = `{foto${i + 1}}`;
    const fileId = fotos[i]?.drive_file_id;
    if (fileId) {
      await insertImageAtToken(docId, tok, fileId, 460);
    } else {
      await replacePlaceholders(docId, { [tok]: "" });
    }
  }

  // ANEXO II - tabela de presença
  const presOrdered = [...presenca].sort((a, b) =>
    (a.participantes?.nome_completo || "").localeCompare(b.participantes?.nome_completo || "")
  );
  const rows = presOrdered.map((p, i) => [
    String(i + 1),
    p.participantes?.nome_completo || "—",
    p.presente ? "Presente" : (p.justificativa ? `Ausente: ${p.justificativa}` : "Ausente"),
  ]);
  if (rows.length) {
    await insertTableAfterAnchor(docId, "ANEXO II", ["Nº", "Participante", "Status"], rows);
  }
}

async function fillPlanejamentoTemplate(docId: string, ctx: { pl: any; turmas: string[] }) {
  const { pl, turmas } = ctx;
  const eixos: string[] = pl.eixos || [];
  const EIXO_KEYS = ["convivencia_social", "direito_de_ser", "participacao_social"];
  const map: Record<string, string> = {
    "{EDUCADOR}": pl.educador_nome || "—",
    "{TURMAS}": turmas.join(", ") || "—",
    "{TITULO}": pl.titulo || "—",
    "{TEMA}": pl.tema || "—",
    "{QUESTAO_GERADORA}": pl.questao_geradora || "—",
    "{OBJETIVOS}": pl.objetivos || "—",
    "{FORMA_AVALIACAO}": (pl.forma_avaliacao || []).join(", ") || "—",
    "{ROTEIRO}": pl.roteiro || "—",
    "{MATERIAIS}": pl.materiais || "—",
    "{APOIO_TECNICO}": pl.apoio_tecnico || "—",
    "{EIXO_1}": eixos.includes(EIXO_KEYS[0]) ? "■" : "☐",
    "{EIXO_2}": eixos.includes(EIXO_KEYS[1]) ? "■" : "☐",
    "{EIXO_3}": eixos.includes(EIXO_KEYS[2]) ? "■" : "☐",
  };
  await replacePlaceholders(docId, map);
}

function driveHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
  };
}
function docsHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DOCS_API_KEY,
    "Content-Type": "application/json",
  };
}
function sheetsHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
    "Content-Type": "application/json",
  };
}

function safe(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function fmtDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d.length <= 10 ? d + "T12:00:00" : d) : d;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// -----------------------------------------------------------------------------
// Pastas (com cache)
// -----------------------------------------------------------------------------
async function getCachedFolder(chave: string): Promise<string | null> {
  const { data } = await supabase.from("drive_folder_cache").select("folder_id").eq("chave", chave).maybeSingle();
  return data?.folder_id ?? null;
}
async function setCachedFolder(chave: string, folderId: string) {
  await supabase.from("drive_folder_cache").upsert({ chave, folder_id: folderId }, { onConflict: "chave" });
}

async function findFolderByName(name: string, parentId: string | null): Promise<string | null> {
  const q = parentId
    ? `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`
    : `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  const url = `${DRIVE_GW}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const res = await fetch(url, { headers: driveHeaders() });
  if (!res.ok) throw new Error(`findFolder ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string | null): Promise<string> {
  const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const res = await fetch(`${DRIVE_GW}/files?fields=id`, {
    method: "POST",
    headers: { ...driveHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createFolder ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.id;
}

async function ensureFolder(name: string, parentId: string | null, cacheKey: string): Promise<string> {
  const cached = await getCachedFolder(cacheKey);
  if (cached) return cached;
  let id = await findFolderByName(name, parentId);
  if (!id) id = await createFolder(name, parentId);
  await setCachedFolder(cacheKey, id);
  return id;
}

async function ensureRootFolder(): Promise<string> {
  return ensureFolder("SysCFV", null, "root");
}
async function ensureProfissionaisFolder(): Promise<string> {
  const root = await ensureRootFolder();
  return ensureFolder("Profissionais", root, "profissionais");
}
async function ensureFotosFolder(): Promise<string> {
  const root = await ensureRootFolder();
  return ensureFolder("Registros Fotograficos", root, "fotos_root");
}
async function ensureProfissionalSubfolder(profileId: string, nome: string, sub: "Planejamentos" | "Relatorios"): Promise<string> {
  const profsRoot = await ensureProfissionaisFolder();
  const eduSafe = safe(nome) || `educador_${profileId.slice(0, 8)}`;
  const eduFolder = await ensureFolder(eduSafe, profsRoot, `prof:${profileId}`);
  return ensureFolder(sub, eduFolder, `prof:${profileId}:${sub.toLowerCase()}`);
}
async function ensureFotoMonthFolder(yyyymm: string): Promise<string> {
  const root = await ensureFotosFolder();
  return ensureFolder(yyyymm, root, `fotos:${yyyymm}`);
}

// Pastas adicionais para os novos módulos
async function ensureProfissionalSubfolderGeneric(profileId: string, nome: string, sub: string): Promise<string> {
  const profsRoot = await ensureProfissionaisFolder();
  const eduSafe = safe(nome) || `educador_${profileId.slice(0, 8)}`;
  const eduFolder = await ensureFolder(eduSafe, profsRoot, `prof:${profileId}`);
  return ensureFolder(sub, eduFolder, `prof:${profileId}:${safe(sub).toLowerCase()}`);
}
async function ensureModuleFolder(modulo: string, sub?: string): Promise<string> {
  const root = await ensureRootFolder();
  const m = await ensureFolder(modulo, root, `mod:${safe(modulo).toLowerCase()}`);
  if (!sub) return m;
  return ensureFolder(sub, m, `mod:${safe(modulo).toLowerCase()}:${safe(sub).toLowerCase()}`);
}

// -----------------------------------------------------------------------------
// Google Sheets
// -----------------------------------------------------------------------------
async function createGoogleSheet(title: string, parentFolderId: string): Promise<string> {
  const create = await fetch(`${SHEETS_GW}/spreadsheets`, {
    method: "POST",
    headers: sheetsHeaders(),
    body: JSON.stringify({ properties: { title } }),
  });
  if (!create.ok) throw new Error(`createSheet ${create.status}: ${await create.text()}`);
  const sh = await create.json();
  const ssId = sh.spreadsheetId;
  const mv = await fetch(`${DRIVE_GW}/files/${ssId}?addParents=${parentFolderId}&removeParents=root&fields=id,parents`, {
    method: "PATCH",
    headers: { ...driveHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!mv.ok) console.warn("move sheet failed", mv.status, await mv.text());
  return ssId;
}

async function getSheetTabs(ssId: string): Promise<{ sheetId: number; title: string }[]> {
  const res = await fetch(`${SHEETS_GW}/spreadsheets/${ssId}?fields=sheets(properties(sheetId,title))`, { headers: sheetsHeaders() });
  if (!res.ok) throw new Error(`getSheet ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.sheets || []).map((s: any) => ({ sheetId: s.properties.sheetId, title: s.properties.title }));
}

async function sheetsBatchUpdate(ssId: string, requests: any[]): Promise<any> {
  if (!requests.length) return null;
  const res = await fetch(`${SHEETS_GW}/spreadsheets/${ssId}:batchUpdate`, {
    method: "POST",
    headers: sheetsHeaders(),
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`sheetsBatch ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function sheetsValuesUpdate(ssId: string, range: string, values: any[][]) {
  const res = await fetch(`${SHEETS_GW}/spreadsheets/${ssId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: sheetsHeaders(),
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`valuesUpdate ${res.status}: ${await res.text()}`);
}

// Cabeçalho institucional + grade básica em um sheet (sheetId numérico)
function buildInstitutionalSheetRequests(sheetId: number, titulo: string, subtitulo: string, headerCols: number) {
  return [
    // Mesclar A1:H1 (linha do título)
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headerCols }, mergeType: "MERGE_ALL" } },
    { mergeCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: headerCols }, mergeType: "MERGE_ALL" } },
    // Estilizar título
    { repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.15, green: 0.15, blue: 0.15 },
          horizontalAlignment: "CENTER",
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 },
        } },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)",
      } },
    { repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
          horizontalAlignment: "CENTER",
          textFormat: { italic: true, fontSize: 10 },
        } },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)",
      } },
    // Header row (linha 3)
    { repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: headerCols },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
          horizontalAlignment: "CENTER",
          borders: {
            top: { style: "SOLID" }, bottom: { style: "SOLID" }, left: { style: "SOLID" }, right: { style: "SOLID" },
          },
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,borders)",
      } },
    // Congelar 3 primeiras linhas
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 3 } }, fields: "gridProperties.frozenRowCount" } },
  ];
}

// -----------------------------------------------------------------------------
// Planilha mensal compartilhada (lista_chamada_lote / lista_frequencia_lote)
// -----------------------------------------------------------------------------
async function ensureMonthlySpreadsheet(tipo: string, anoMes: string, folderName: string, titulo: string): Promise<{ ssId: string; url: string }> {
  const { data: existing } = await supabase
    .from("drive_planilhas_mensais").select("*").eq("tipo", tipo).eq("ano_mes", anoMes).maybeSingle();
  if (existing?.drive_file_id) return { ssId: existing.drive_file_id, url: existing.drive_url };

  const folderId = await ensureModuleFolder(folderName, anoMes);
  const ssId = await createGoogleSheet(titulo, folderId);
  const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
  await supabase.from("drive_planilhas_mensais").upsert({ tipo, ano_mes: anoMes, drive_file_id: ssId, drive_url: url }, { onConflict: "tipo,ano_mes" });
  return { ssId, url };
}

async function ensureSheetTab(ssId: string, tabTitle: string): Promise<number> {
  const tabs = await getSheetTabs(ssId);
  const existing = tabs.find((t) => t.title === tabTitle);
  if (existing) {
    // limpar conteúdo existente para reescrever
    await sheetsBatchUpdate(ssId, [{ updateCells: { range: { sheetId: existing.sheetId }, fields: "userEnteredValue,userEnteredFormat" } }]);
    return existing.sheetId;
  }
  const res = await sheetsBatchUpdate(ssId, [{ addSheet: { properties: { title: tabTitle.slice(0, 99) } } }]);
  return res.replies[0].addSheet.properties.sheetId;
}

async function processListaChamadaLote(payload: any): Promise<{ drive_file_id: string; drive_url: string }> {
  const anoMes: string = payload.ano_mes;
  const turmaIds: string[] = payload.turma_ids || [];
  if (!anoMes || !turmaIds.length) throw new Error("payload invalido");

  const titulo = `SysCFV_ListaChamada_${anoMes}`;
  const { ssId, url } = await ensureMonthlySpreadsheet("lista_chamada", anoMes, "Listas de Chamada", titulo);

  for (const turmaId of turmaIds) {
    const { data: turma } = await supabase.from("turmas").select("nome, periodo").eq("id", turmaId).maybeSingle();
    if (!turma) continue;
    const { data: parts } = await supabase
      .from("turma_participantes")
      .select("participantes(id, nome_completo, status)")
      .eq("turma_id", turmaId);
    const tabName = safe(turma.nome).replace(/_/g, " ").slice(0, 99) || `Turma_${turmaId.slice(0, 6)}`;
    const sheetId = await ensureSheetTab(ssId, tabName);

    // dias do mês
    const [y, m] = anoMes.split("-").map((x) => parseInt(x, 10));
    const lastDay = new Date(y, m, 0).getDate();
    const dias = Array.from({ length: lastDay }, (_, i) => i + 1);

    const headers = ["#", "Participante", ...dias.map((d) => String(d).padStart(2, "0")), "Presenças", "%"];
    const rows = (parts || [])
      .map((p: any) => p.participantes)
      .filter((p: any) => p && p.status === "ativo")
      .sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo))
      .map((p: any, i: number) => {
        const blanks = dias.map(() => "");
        return [String(i + 1), p.nome_completo, ...blanks, "", ""];
      });

    const totalCols = headers.length;
    const all = [
      [titulo + " — " + tabName],
      [`Turma: ${turma.nome} • Período: ${turma.periodo} • ${anoMes}`],
      headers,
      ...rows,
    ];
    await sheetsValuesUpdate(ssId, `'${tabName}'!A1`, all);
    await sheetsBatchUpdate(ssId, buildInstitutionalSheetRequests(sheetId, titulo, `Turma: ${turma.nome}`, totalCols));
  }
  return { drive_file_id: ssId, drive_url: url };
}

async function processListaFrequenciaLote(payload: any): Promise<{ drive_file_id: string; drive_url: string }> {
  const anoMes: string = payload.ano_mes;
  const turmaIds: string[] = payload.turma_ids || [];
  if (!anoMes || !turmaIds.length) throw new Error("payload invalido");
  const titulo = `SysCFV_Frequencia_${anoMes}`;
  const { ssId, url } = await ensureMonthlySpreadsheet("lista_frequencia", anoMes, "Listas de Frequencia", titulo);

  const [y, m] = anoMes.split("-").map((x) => parseInt(x, 10));
  const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

  for (const turmaId of turmaIds) {
    const { data: turma } = await supabase.from("turmas").select("nome, periodo").eq("id", turmaId).maybeSingle();
    if (!turma) continue;

    const { data: parts } = await supabase
      .from("turma_participantes").select("participantes(id, nome_completo, status)").eq("turma_id", turmaId);
    const ativos = (parts || []).map((p: any) => p.participantes).filter((p: any) => p && p.status === "ativo");

    // presenças do mês para essa turma
    const { data: rels } = await supabase
      .from("relatorios_atividade")
      .select("id, data, relatorio_turmas!inner(turma_id), relatorio_presenca(participante_id, presente)")
      .gte("data", startDate).lte("data", endDate)
      .eq("relatorio_turmas.turma_id", turmaId);

    const datas = Array.from(new Set((rels || []).map((r: any) => r.data))).sort();
    const presencaMap = new Map<string, boolean>(); // `${pid}|${data}` => presente
    for (const r of (rels || []) as any[]) {
      for (const p of r.relatorio_presenca || []) {
        if (p.participante_id) presencaMap.set(`${p.participante_id}|${r.data}`, p.presente);
      }
    }

    const tabName = safe(turma.nome).replace(/_/g, " ").slice(0, 99);
    const sheetId = await ensureSheetTab(ssId, tabName);
    const headers = ["#", "Participante", ...datas.map((d) => d.slice(8) + "/" + d.slice(5, 7)), "Presenças", "Total"];
    const rows = ativos.sort((a: any, b: any) => a.nome_completo.localeCompare(b.nome_completo)).map((p: any, i: number) => {
      const cells = datas.map((d) => {
        const v = presencaMap.get(`${p.id}|${d}`);
        if (v === undefined) return "";
        return v ? "■" : "—";
      });
      const presentes = cells.filter((c) => c === "■").length;
      return [String(i + 1), p.nome_completo, ...cells, String(presentes), String(datas.length)];
    });
    const all = [
      [titulo + " — " + tabName],
      [`Turma: ${turma.nome} • Período: ${turma.periodo} • ${anoMes}`],
      headers,
      ...rows,
    ];
    await sheetsValuesUpdate(ssId, `'${tabName}'!A1`, all);
    await sheetsBatchUpdate(ssId, buildInstitutionalSheetRequests(sheetId, titulo, `Turma: ${turma.nome}`, headers.length));
  }
  return { drive_file_id: ssId, drive_url: url };
}

// -----------------------------------------------------------------------------
// Roteiros de Visita / Atendimentos (Equipe Técnica)
// -----------------------------------------------------------------------------
async function processRoteiroVisita(origemId: string): Promise<{ drive_file_id: string; drive_url: string }> {
  const { data: rt, error } = await supabase
    .from("roteiros_visita").select("*").eq("id", origemId).maybeSingle();
  if (error || !rt) throw new Error("roteiro nao encontrado");

  const { data: pts } = await supabase
    .from("roteiro_visitas")
    .select("*, participantes(nome_completo, bairros(nome))")
    .eq("roteiro_id", origemId);

  const profileId = rt.criado_por || "sem-criador";
  const { data: prof } = await supabase.from("profiles").select("nome").eq("user_id", profileId).maybeSingle();
  const nome = prof?.nome || "Equipe Técnica";

  const folderId = await ensureProfissionalSubfolderGeneric(profileId, nome, "Roteiros de Visita");
  const titulo = `SysCFV_Roteiro_${fmtDate(rt.data_visita)}_${safe(rt.titulo || "visita")}`;

  let docId = rt.drive_file_id as string | null;
  if (!docId) docId = await createGoogleDoc(titulo, folderId);

  const blocks: DocBlock[] = [
    { type: "h1", text: rt.titulo || "Roteiro de Visita" },
    { type: "kv", key: "Data", value: fmtDate(rt.data_visita) },
    ...(rt.horario_saida ? [{ type: "kv" as const, key: "Saída", value: rt.horario_saida }] : []),
    ...(rt.veiculo ? [{ type: "kv" as const, key: "Veículo", value: rt.veiculo }] : []),
    ...(rt.responsaveis?.length ? [{ type: "kv" as const, key: "Responsáveis", value: rt.responsaveis.join(", ") }] : []),
    { type: "kv", key: "Status", value: rt.status || "pendente" },
  ];
  if (rt.observacoes) { blocks.push({ type: "h2", text: "Observações" }); blocks.push({ type: "p", text: rt.observacoes }); }
  if (pts?.length) {
    blocks.push({ type: "h2", text: "Visitas planejadas" });
    for (const p of pts as any[]) {
      const bairro = p.participantes?.bairros?.nome ? ` — ${p.participantes.bairros.nome}` : "";
      blocks.push({ type: "p", text: `• ${p.participantes?.nome_completo || "Sem nome"}${bairro}${p.observacao ? ` — ${p.observacao}` : ""}` });
    }
  }
  await writeDoc(docId, blocks);
  const url = `https://docs.google.com/document/d/${docId}/edit`;
  await supabase.from("roteiros_visita").update({ drive_file_id: docId, drive_url: url }).eq("id", origemId);
  return { drive_file_id: docId, drive_url: url };
}

async function processAtendimento(origemId: string): Promise<{ drive_file_id: string; drive_url: string }> {
  const { data: at, error } = await supabase
    .from("atendimentos")
    .select("*, participantes(nome_completo)")
    .eq("id", origemId).maybeSingle();
  if (error || !at) throw new Error("atendimento nao encontrado");

  const { data: prof } = await supabase.from("profiles").select("id, user_id, nome").eq("id", at.profissional_id).maybeSingle();
  const profileId = prof?.id || at.profissional_id;
  const nome = prof?.nome || "Equipe Técnica";

  const folderId = await ensureProfissionalSubfolderGeneric(profileId, nome, "Atendimentos");
  const titulo = `SysCFV_Atendimento_${fmtDate(at.data_atendimento)}_${safe((at as any).participantes?.nome_completo || "")}_${safe(at.tipo || "geral")}`;

  let docId = at.drive_file_id as string | null;
  if (!docId) docId = await createGoogleDoc(titulo, folderId);

  const blocks: DocBlock[] = [
    { type: "h1", text: "Atendimento — Equipe Técnica" },
    { type: "kv", key: "Data", value: fmtDate(at.data_atendimento) },
    { type: "kv", key: "Profissional", value: nome },
    { type: "kv", key: "Participante", value: (at as any).participantes?.nome_completo || "—" },
    { type: "kv", key: "Tipo", value: at.tipo || "—" },
    ...(at.sigiloso ? [{ type: "kv" as const, key: "Sigiloso", value: "Sim — acesso restrito" }] : []),
  ];
  if (at.descricao) { blocks.push({ type: "h2", text: "Descrição" }); blocks.push({ type: "p", text: at.descricao }); }
  if (at.encaminhamento) { blocks.push({ type: "h2", text: "Encaminhamento" }); blocks.push({ type: "p", text: at.encaminhamento }); }
  await writeDoc(docId, blocks);
  const url = `https://docs.google.com/document/d/${docId}/edit`;
  await supabase.from("atendimentos").update({ drive_file_id: docId, drive_url: url }).eq("id", origemId);
  return { drive_file_id: docId, drive_url: url };
}

// -----------------------------------------------------------------------------
// Orçamentos (Sheets — mapa comparativo) e Prestação de Contas (Docs)
// -----------------------------------------------------------------------------
async function processOrcamento(origemId: string): Promise<{ drive_file_id: string; drive_url: string }> {
  const { data: orc, error } = await supabase.from("orcamentos").select("*").eq("id", origemId).maybeSingle();
  if (error || !orc) throw new Error("orcamento nao encontrado");

  const { data: itens } = await supabase
    .from("orcamento_itens").select("id, descricao, unidade, quantidade").eq("orcamento_id", origemId).order("created_at");
  const { data: cotacoes } = await supabase
    .from("orcamento_cotacoes").select("id, fornecedor, cnpj").eq("orcamento_id", origemId).order("created_at");
  const { data: precos } = await supabase
    .from("orcamento_precos").select("item_id, cotacao_id, preco_unitario").in("cotacao_id", (cotacoes || []).map((c: any) => c.id));

  const folderId = await ensureModuleFolder("Financeiro", "Orcamentos");
  const titulo = `SysCFV_Orcamento_${fmtDate(orc.created_at)}_${safe(orc.titulo || "orcamento")}`;

  let ssId = orc.drive_file_id as string | null;
  if (!ssId) ssId = await createGoogleSheet(titulo, folderId);

  const tabs = await getSheetTabs(ssId);
  const sheetId = tabs[0].sheetId;
  await sheetsBatchUpdate(ssId, [{ updateCells: { range: { sheetId }, fields: "userEnteredValue,userEnteredFormat" } }]);

  const headers = ["#", "Descrição", "Un.", "Qtd.", ...(cotacoes || []).map((c: any) => `${c.fornecedor}${c.cnpj ? ` (${c.cnpj})` : ""}`), "Menor preço"];
  const priceMap = new Map<string, number>();
  for (const p of (precos || []) as any[]) priceMap.set(`${p.item_id}|${p.cotacao_id}`, Number(p.preco_unitario));
  const rows = (itens || []).map((it: any, i: number) => {
    const cells = (cotacoes || []).map((c: any) => {
      const v = priceMap.get(`${it.id}|${c.id}`);
      return v != null ? v * Number(it.quantidade || 1) : "";
    });
    const numericVals = cells.filter((c) => typeof c === "number") as number[];
    const min = numericVals.length ? Math.min(...numericVals) : "";
    return [i + 1, it.descricao, it.unidade || "—", Number(it.quantidade || 1), ...cells, min];
  });
  const all = [
    [titulo],
    [`Objeto: ${orc.objeto || "—"} • Mês: ${orc.mes_referencia || "—"} • Status: ${orc.status || "—"}`],
    headers,
    ...rows,
  ];
  await sheetsValuesUpdate(ssId, `A1`, all);
  await sheetsBatchUpdate(ssId, buildInstitutionalSheetRequests(sheetId, titulo, orc.titulo || "", headers.length));

  const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
  await supabase.from("orcamentos").update({ drive_file_id: ssId, drive_url: url }).eq("id", origemId);
  return { drive_file_id: ssId, drive_url: url };
}

async function processPrestacaoContas(origemId: string): Promise<{ drive_file_id: string; drive_url: string }> {
  const { data: pc, error } = await supabase
    .from("documentos_prestacao_contas").select("*").eq("id", origemId).maybeSingle();
  if (error || !pc) throw new Error("prestacao nao encontrada");

  const folderId = await ensureModuleFolder("Financeiro", "Prestacao de Contas");
  const titulo = `SysCFV_Prestacao_${fmtDate(pc.created_at)}_${safe(pc.titulo || "documento")}`;

  let docId = pc.drive_file_id as string | null;
  if (!docId) docId = await createGoogleDoc(titulo, folderId);

  const blocks: DocBlock[] = [
    { type: "h1", text: pc.titulo || "Documento de Prestação" },
    { type: "kv", key: "Categoria", value: pc.categoria || "—" },
    ...(pc.versao ? [{ type: "kv" as const, key: "Versão", value: String(pc.versao) }] : []),
    ...(pc.vigencia_inicio ? [{ type: "kv" as const, key: "Vigência Início", value: fmtDate(pc.vigencia_inicio) }] : []),
    ...(pc.vigencia_fim ? [{ type: "kv" as const, key: "Vigência Fim", value: fmtDate(pc.vigencia_fim) }] : []),
  ];
  if (pc.descricao) { blocks.push({ type: "h2", text: "Descrição" }); blocks.push({ type: "p", text: pc.descricao }); }
  if (pc.arquivo_url) { blocks.push({ type: "h2", text: "Arquivo Original" }); blocks.push({ type: "p", text: pc.arquivo_url }); }
  await writeDoc(docId, blocks);
  const url = `https://docs.google.com/document/d/${docId}/edit`;
  await supabase.from("documentos_prestacao_contas").update({ drive_file_id: docId, drive_url: url }).eq("id", origemId);
  return { drive_file_id: docId, drive_url: url };
}

// -----------------------------------------------------------------------------
// Google Docs
// -----------------------------------------------------------------------------
type DocBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; text: string; bold?: boolean }
  | { type: "kv"; key: string; value: string };

async function createGoogleDoc(title: string, parentFolderId: string): Promise<string> {
  const create = await fetch(`${DOCS_GW}/documents`, {
    method: "POST",
    headers: docsHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!create.ok) throw new Error(`createDoc ${create.status}: ${await create.text()}`);
  const doc = await create.json();
  const docId = doc.documentId;

  // Move to folder
  const mv = await fetch(`${DRIVE_GW}/files/${docId}?addParents=${parentFolderId}&removeParents=root&fields=id,parents`, {
    method: "PATCH",
    headers: { ...driveHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!mv.ok) console.warn("move doc failed", mv.status, await mv.text());
  return docId;
}

async function getDocLength(docId: string): Promise<number> {
  const res = await fetch(`${DOCS_GW}/documents/${docId}`, { headers: docsHeaders() });
  if (!res.ok) throw new Error(`getDoc ${res.status}`);
  const j = await res.json();
  const content = j.body?.content || [];
  let endIndex = 1;
  for (const el of content) if (el.endIndex && el.endIndex > endIndex) endIndex = el.endIndex;
  return endIndex;
}

function blocksToRequests(blocks: DocBlock[]): { requests: any[] } {
  const requests: any[] = [];
  let idx = 1;
  for (const b of blocks) {
    const text = (() => {
      if (b.type === "kv") return `${b.key}: ${b.value}\n`;
      return ((b as any).text || "") + "\n";
    })();
    if (!text.trim()) {
      // ainda inserimos para preservar parágrafo? skip
      continue;
    }
    const start = idx;
    requests.push({ insertText: { location: { index: start }, text } });
    const end = start + text.length;

    if (b.type === "h1" || b.type === "h2") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: b.type === "h1" ? "HEADING_1" : "HEADING_2" },
          fields: "namedStyleType",
        },
      });
    }
    if (b.type === "kv") {
      // bold do "key:"
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: start + b.key.length + 1 },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }
    if (b.type === "p" && b.bold) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }
    idx = end;
  }
  return { requests };
}

async function writeDoc(docId: string, blocks: DocBlock[]) {
  // limpar conteúdo existente, se houver
  const len = await getDocLength(docId);
  const requests: any[] = [];
  if (len > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: len - 1 } } });
  }
  const body = blocksToRequests(blocks);
  requests.push(...body.requests);

  const res = await fetch(`${DOCS_GW}/documents/${docId}:batchUpdate`, {
    method: "POST",
    headers: docsHeaders(),
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`batchUpdate ${res.status}: ${await res.text()}`);
}

// -----------------------------------------------------------------------------
// Conteúdo dos docs
// -----------------------------------------------------------------------------
function relatorioToBlocks(rel: any, turmas: string[], presenca: any[], fotos: any[]): DocBlock[] {
  const blocks: DocBlock[] = [];
  blocks.push({ type: "h1", text: rel.nome_atividade || "Relatório de Atividade" });
  blocks.push({ type: "kv", key: "Data", value: fmtDate(rel.data) });
  if (rel.educador_nome) blocks.push({ type: "kv", key: "Educador(a)", value: rel.educador_nome });
  if (turmas.length) blocks.push({ type: "kv", key: "Turma(s)", value: turmas.join(", ") });
  if (rel.periodo_atividade) blocks.push({ type: "kv", key: "Período", value: rel.periodo_atividade });
  if (rel.tipo_atividade?.length) blocks.push({ type: "kv", key: "Tipo", value: rel.tipo_atividade.join(", ") });

  blocks.push({ type: "h2", text: "Indicadores" });
  blocks.push({ type: "kv", key: "Score ELO", value: rel.score_elo != null ? String(rel.score_elo) : "—" });
  blocks.push({ type: "kv", key: "Adesão", value: rel.pct_adesao != null ? `${rel.pct_adesao}%` : "—" });
  blocks.push({ type: "kv", key: "Participantes / Matriculados", value: `${rel.num_participantes ?? 0} / ${rel.num_matriculados ?? 0}` });

  if (rel.observacoes) {
    blocks.push({ type: "h2", text: "Observações" });
    blocks.push({ type: "p", text: rel.observacoes });
  }
  if (rel.intervencoes) {
    blocks.push({ type: "h2", text: "Intervenções" });
    blocks.push({ type: "p", text: rel.intervencoes });
  }
  if (rel.analise_ia) {
    blocks.push({ type: "h2", text: "Resultados Alcançados" });
    blocks.push({ type: "p", text: rel.analise_ia });
  }

  if (presenca?.length) {
    blocks.push({ type: "h2", text: "Presença" });
    const pres = presenca.filter((p) => p.presente).length;
    const aus = presenca.length - pres;
    blocks.push({ type: "kv", key: "Presentes / Ausentes", value: `${pres} / ${aus}` });
    for (const p of presenca) {
      const nome = p.participantes?.nome_completo || "—";
      blocks.push({ type: "p", text: `${p.presente ? "■" : "□"} ${nome}${p.justificativa ? ` (${p.justificativa})` : ""}` });
    }
  }

  if (fotos?.length) {
    blocks.push({ type: "h2", text: "Registros Fotográficos" });
    blocks.push({ type: "p", text: `${fotos.length} foto(s) sincronizada(s) na pasta "Registros Fotograficos" do Drive.` });
    for (const f of fotos) {
      if (f.drive_url) blocks.push({ type: "p", text: `• ${f.drive_url}` });
    }
  }

  return blocks;
}

function planejamentoToBlocks(pl: any, turmas: string[]): DocBlock[] {
  const blocks: DocBlock[] = [];
  blocks.push({ type: "h1", text: pl.titulo || "Planejamento" });
  if (pl.data_aplicacao) blocks.push({ type: "kv", key: "Data de Aplicação", value: fmtDate(pl.data_aplicacao) });
  if (pl.educador_nome) blocks.push({ type: "kv", key: "Educador(a)", value: pl.educador_nome });
  if (turmas.length) blocks.push({ type: "kv", key: "Turma(s)", value: turmas.join(", ") });
  if (pl.tema) { blocks.push({ type: "h2", text: "Tema / Demanda" }); blocks.push({ type: "p", text: pl.tema }); }
  if (pl.questao_geradora) { blocks.push({ type: "h2", text: "Questão Geradora" }); blocks.push({ type: "p", text: pl.questao_geradora }); }
  if (pl.objetivos) { blocks.push({ type: "h2", text: "Objetivos" }); blocks.push({ type: "p", text: pl.objetivos }); }
  if (pl.roteiro) { blocks.push({ type: "h2", text: "Roteiro" }); blocks.push({ type: "p", text: pl.roteiro }); }
  if (pl.materiais) { blocks.push({ type: "h2", text: "Materiais" }); blocks.push({ type: "p", text: pl.materiais }); }
  if (pl.apoio_tecnico) { blocks.push({ type: "h2", text: "Apoio Técnico" }); blocks.push({ type: "p", text: pl.apoio_tecnico }); }
  if (pl.forma_avaliacao?.length) blocks.push({ type: "kv", key: "Forma de Avaliação", value: pl.forma_avaliacao.join(", ") });
  return blocks;
}

// -----------------------------------------------------------------------------
// Foto: EXIF + watermark + upload
// -----------------------------------------------------------------------------
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`, {
      headers: { "User-Agent": "SysCFV/1.0 (institutional)" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address || {};
    const parts = [a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state].filter(Boolean);
    return parts.length ? parts.join(", ") : (j.display_name || null);
  } catch { return null; }
}

async function applyWatermark(imgBytes: Uint8Array, lines: string[]): Promise<Uint8Array> {
  const img = await Image.decode(imgBytes);
  const w = img.width;
  const h = img.height;
  const bandH = Math.max(40, Math.round(h * 0.07));
  const fontSize = Math.max(14, Math.round(bandH * 0.32));

  // faixa preta semitransparente no rodapé
  const band = new Image(w, bandH).fill(0x000000a6);
  img.composite(band, 0, h - bandH);

  // texto
  let y = h - bandH + Math.round(bandH * 0.18);
  for (const ln of lines) {
    if (!ln) continue;
    try {
      const txt = await Image.renderText(
        await (await fetch("https://deno.land/x/imagescript@1.2.17/tests/fixtures/Roboto-Regular.ttf")).arrayBuffer().then((a) => new Uint8Array(a)),
        fontSize,
        ln,
        0xffffffff,
      );
      img.composite(txt, 16, y);
      y += fontSize + 4;
    } catch (e) {
      console.warn("renderText fail", e);
    }
  }
  return await img.encodeJPEG(85);
}

async function uploadToDrive(name: string, mime: string, bytes: Uint8Array, parentFolderId: string): Promise<{ id: string; url: string }> {
  const boundary = "syscfv_" + crypto.randomUUID();
  const meta = JSON.stringify({ name, parents: [parentFolderId] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await fetch(`${DRIVE_UPLOAD_GW}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { ...driveHeaders(), "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { id: j.id, url: j.webViewLink || `https://drive.google.com/file/d/${j.id}/view` };
}

// -----------------------------------------------------------------------------
// Processadores por tipo
// -----------------------------------------------------------------------------
async function processRelatorio(origemId: string): Promise<{ drive_file_id: string; drive_url: string }> {
  const { data: rel, error } = await supabase
    .from("relatorios_atividade")
    .select("*, profiles!relatorios_atividade_educador_id_fkey(id,nome)")
    .eq("id", origemId).maybeSingle();
  if (error || !rel) throw new Error("relatorio nao encontrado");

  const educadorNome = rel.profiles?.nome || "Sem Educador";
  const educadorId = rel.profiles?.id || rel.educador_id || "sem-educador";

  const { data: turmasJoin } = await supabase
    .from("relatorio_turmas").select("turmas(nome, bairros(nome))").eq("relatorio_id", origemId);
  const turmas = (turmasJoin || []).map((t: any) => t.turmas?.nome).filter(Boolean);
  const bairros = Array.from(new Set((turmasJoin || []).map((t: any) => t.turmas?.bairros?.nome).filter(Boolean))) as string[];

  const { data: presenca } = await supabase
    .from("relatorio_presenca")
    .select("presente, justificativa, participantes(nome_completo)")
    .eq("relatorio_id", origemId);

  const { data: fotos } = await supabase
    .from("relatorio_fotos").select("drive_url, drive_file_id").eq("relatorio_id", origemId);

  const folderId = await ensureProfissionalSubfolder(educadorId, educadorNome, "Relatorios");
  const titulo = `SysCFV_Relatorio_${fmtDate(rel.data)}_${safe(rel.nome_atividade || "atividade")}_${safe(educadorNome)}`;

  let docId = rel.drive_file_id as string | null;
  if (!docId) {
    // Cópia do template — preserva layout (legenda, fotos, ANEXO I/II, competências)
    docId = await cloneFromTemplate("relatorio", folderId, titulo);
  } else {
    // Reuso: limpa e recria a partir do template (drop + clone novo)
    await fetch(`${DRIVE_GW}/files/${docId}`, { method: "DELETE", headers: driveHeaders() }).catch(() => {});
    docId = await cloneFromTemplate("relatorio", folderId, titulo);
  }
  await fillRelatorioTemplate(docId, {
    rel: { ...rel, educador_nome: educadorNome },
    turmas,
    presenca: presenca || [],
    fotos: fotos || [],
    bairros,
  });
  const url = `https://docs.google.com/document/d/${docId}/edit`;
  await supabase.from("relatorios_atividade").update({ drive_file_id: docId, drive_url: url }).eq("id", origemId);
  return { drive_file_id: docId, drive_url: url };
}

async function processPlanejamento(origemId: string): Promise<{ drive_file_id: string; drive_url: string }> {
  const { data: pl, error } = await supabase
    .from("planejamentos")
    .select("*, profiles!planejamentos_educador_id_fkey(id,nome)")
    .eq("id", origemId).maybeSingle();
  if (error || !pl) throw new Error("planejamento nao encontrado");

  const educadorNome = pl.profiles?.nome || "Sem Educador";
  const educadorId = pl.profiles?.id || pl.educador_id || "sem-educador";

  const { data: turmasJoin } = await supabase
    .from("planejamento_turmas").select("turmas(nome)").eq("planejamento_id", origemId);
  const turmas = (turmasJoin || []).map((t: any) => t.turmas?.nome).filter(Boolean);

  const folderId = await ensureProfissionalSubfolder(educadorId, educadorNome, "Planejamentos");
  const dataRef = pl.data_aplicacao || new Date().toISOString().slice(0, 10);
  const titulo = `SysCFV_Planejamento_${fmtDate(dataRef)}_${safe(pl.titulo || "planejamento")}_${safe(educadorNome)}`;

  let docId = pl.drive_file_id as string | null;
  if (!docId) {
    docId = await cloneFromTemplate("planejamento", folderId, titulo);
  } else {
    await fetch(`${DRIVE_GW}/files/${docId}`, { method: "DELETE", headers: driveHeaders() }).catch(() => {});
    docId = await cloneFromTemplate("planejamento", folderId, titulo);
  }
  await fillPlanejamentoTemplate(docId, { pl: { ...pl, educador_nome: educadorNome }, turmas });
  const url = `https://docs.google.com/document/d/${docId}/edit`;
  await supabase.from("planejamentos").update({ drive_file_id: docId, drive_url: url }).eq("id", origemId);
  return { drive_file_id: docId, drive_url: url };
}

async function processFoto(origemId: string): Promise<{ drive_file_id: string; drive_url: string }> {
  const { data: foto, error } = await supabase
    .from("relatorio_fotos").select("*").eq("id", origemId).maybeSingle();
  if (error || !foto) throw new Error("foto nao encontrada");
  if (foto.drive_file_id) return { drive_file_id: foto.drive_file_id, drive_url: foto.drive_url };

  const { data: rel } = await supabase
    .from("relatorios_atividade")
    .select("data, nome_atividade, educador_id, profiles!relatorios_atividade_educador_id_fkey(nome)")
    .eq("id", foto.relatorio_id).maybeSingle();
  const educadorNome = (rel as any)?.profiles?.nome || "Sem Educador";
  const dataRel = (rel as any)?.data || new Date().toISOString().slice(0, 10);

  const { data: turmasJoin } = await supabase
    .from("relatorio_turmas").select("turmas(nome)").eq("relatorio_id", foto.relatorio_id);
  const turmaNome = (turmasJoin || []).map((t: any) => t.turmas?.nome).filter(Boolean).join(", ") || "sem_turma";

  // baixar foto
  const photoRes = await fetch(foto.foto_url);
  if (!photoRes.ok) throw new Error(`download foto ${photoRes.status}`);
  const original = new Uint8Array(await photoRes.arrayBuffer());

  // EXIF
  let exif: any = null;
  try { exif = await exifr.parse(original, { gps: true }); } catch (e) { console.warn("exif fail", e); }
  const lat = exif?.latitude;
  const lon = exif?.longitude;
  const dateOriginal = exif?.DateTimeOriginal || exif?.CreateDate;

  // local
  let local: string | null = null;
  if (typeof lat === "number" && typeof lon === "number") {
    local = await reverseGeocode(lat, lon);
    await new Promise((r) => setTimeout(r, 1100)); // respeitar Nominatim 1 req/s
  }

  // hash veracidade
  const hashFull = await sha256Hex(
    new TextEncoder().encode(
      `${origemId}|${foto.relatorio_id}|${dataRel}|${original.length}|${exif ? JSON.stringify({ lat, lon, dateOriginal }) : ""}`,
    ),
  );
  const hashShort = hashFull.slice(0, 16);

  // watermark
  const dt = dateOriginal ? new Date(dateOriginal) : new Date(dataRel + "T12:00:00");
  const dtStr = `${fmtDate(dt)} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  const lines = [
    `SysCFV • ${educadorNome} • ${turmaNome}`,
    `${local || "Local nao identificado"} • ${dtStr}${typeof lat === "number" ? ` • ${lat.toFixed(5)},${lon!.toFixed(5)}` : ""}`,
    `Codigo de veracidade: ${hashShort}`,
  ];

  let finalBytes = original;
  try { finalBytes = await applyWatermark(original, lines); } catch (e) {
    console.warn("watermark falhou, subindo original:", e);
  }

  // pasta mês
  const yyyymm = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  const folderId = await ensureFotoMonthFolder(yyyymm);
  const hh = String(dt.getHours()).padStart(2, "0") + String(dt.getMinutes()).padStart(2, "0") + String(dt.getSeconds()).padStart(2, "0");
  const name = `SysCFV_Foto_${fmtDate(dt)}_${safe(educadorNome)}_${safe(turmaNome)}_${hh}_${hashShort.slice(0, 8)}.jpg`;

  const up = await uploadToDrive(name, "image/jpeg", finalBytes, folderId);
  await supabase.from("relatorio_fotos").update({
    drive_file_id: up.id,
    drive_url: up.url,
    veracidade_hash: hashShort,
    exif_metadata: { latitude: lat ?? null, longitude: lon ?? null, dateOriginal: dateOriginal ?? null, local: local ?? null },
  }).eq("id", origemId);

  return { drive_file_id: up.id, drive_url: up.url };
}

// -----------------------------------------------------------------------------
// Loop principal
// -----------------------------------------------------------------------------
async function fixTemplateFotos(): Promise<{ docs: number; tabelasRemovidas: number }> {
  const { data: modelos } = await supabase
    .from("drive_modelos")
    .select("tipo, template_doc_id")
    .eq("tipo", "relatorio");
  let tabelasRemovidas = 0;
  let docs = 0;
  for (const m of modelos || []) {
    const docId = m.template_doc_id;
    if (!docId) continue;
    docs++;
    // loop até não achar mais tabela com {fotoN}
    for (let pass = 0; pass < 5; pass++) {
      const doc = await getDocFull(docId);
      const target = (doc.body.content || []).find((el: any) => {
        if (!el.table) return false;
        const t = JSON.stringify(el.table);
        return /\{foto[1-5]\}/.test(t);
      });
      if (!target) break;
      const start = target.startIndex;
      const end = target.endIndex;
      // delete a tabela inteira; depois insere 5 parágrafos com tokens
      await docsBatch(docId, [
        { deleteContentRange: { range: { startIndex: start, endIndex: end } } },
      ]);
      // após deletar, posição atual = start; insere texto com 5 linhas
      const txt = "{foto1}\n{foto2}\n{foto3}\n{foto4}\n{foto5}\n";
      await docsBatch(docId, [
        { insertText: { location: { index: start }, text: txt } },
      ]);
      tabelasRemovidas++;
    }
  }
  return { docs, tabelasRemovidas };
}

async function processQueue(): Promise<{ processed: number; errors: number }> {
  const { data: jobs, error } = await supabase
    .from("drive_sync_queue")
    .select("*")
    .in("status", ["pendente", "erro"])
    .lt("tentativas", MAX_TENTATIVAS)
    .order("created_at", { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (error) throw error;
  let processed = 0;
  let errors = 0;

  for (const job of jobs || []) {
    await supabase.from("drive_sync_queue").update({ status: "processando", tentativas: job.tentativas + 1, ultimo_erro: null }).eq("id", job.id);
    try {
      let result: { drive_file_id: string; drive_url: string };
      if (job.tipo === "relatorio") result = await processRelatorio(job.origem_id);
      else if (job.tipo === "planejamento") result = await processPlanejamento(job.origem_id);
      else if (job.tipo === "foto") result = await processFoto(job.origem_id);
      else if (job.tipo === "roteiro_visita") result = await processRoteiroVisita(job.origem_id);
      else if (job.tipo === "atendimento") result = await processAtendimento(job.origem_id);
      else if (job.tipo === "orcamento") result = await processOrcamento(job.origem_id);
      else if (job.tipo === "prestacao_contas") result = await processPrestacaoContas(job.origem_id);
      else if (job.tipo === "lista_chamada_lote") result = await processListaChamadaLote(job.payload || {});
      else if (job.tipo === "lista_frequencia_lote") result = await processListaFrequenciaLote(job.payload || {});
      else throw new Error(`tipo invalido: ${job.tipo}`);

      await supabase.from("drive_sync_queue").update({
        status: "sincronizado",
        drive_file_id: result.drive_file_id,
        drive_url: result.drive_url,
        synced_at: new Date().toISOString(),
      }).eq("id", job.id);
      processed++;
    } catch (e: any) {
      console.error(`Job ${job.id} (${job.tipo}/${job.origem_id}) falhou:`, e);
      await supabase.from("drive_sync_queue").update({
        status: "erro",
        ultimo_erro: String(e?.message || e).slice(0, 1000),
      }).eq("id", job.id);
      errors++;
    }
  }
  return { processed, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY || !GOOGLE_DOCS_API_KEY) {
      throw new Error("Credenciais Lovable/Google nao configuradas");
    }
    let action: string | null = null;
    try {
      const body = await req.clone().json();
      action = body?.action || null;
    } catch { /* sem body */ }
    if (action === "fix_template_fotos") {
      const out = await fixTemplateFotos();
      return new Response(JSON.stringify({ ok: true, ...out }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "process_relatorio_now") {
      const body = await req.clone().json().catch(() => ({}));
      const origemId: string | undefined = body?.origem_id || body?.relatorio_id;
      if (!origemId) {
        return new Response(JSON.stringify({ ok: false, error: "origem_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const out = await processRelatorio(origemId);
        // refletir na fila para que o badge "Abrir no Drive" também atualize
        await supabase.from("drive_sync_queue").upsert({
          tipo: "relatorio",
          origem_id: origemId,
          status: "sincronizado",
          drive_file_id: out.drive_file_id,
          drive_url: out.drive_url,
          synced_at: new Date().toISOString(),
          ultimo_erro: null,
        }, { onConflict: "tipo,origem_id" });
        return new Response(JSON.stringify({ ok: true, ...out }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (action === "process_planejamento_now") {
      const body = await req.clone().json().catch(() => ({}));
      const origemId: string | undefined = body?.origem_id || body?.planejamento_id;
      if (!origemId) {
        return new Response(JSON.stringify({ ok: false, error: "origem_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const out = await processPlanejamento(origemId);
        await supabase.from("drive_sync_queue").upsert({
          tipo: "planejamento",
          origem_id: origemId,
          status: "sincronizado",
          drive_file_id: out.drive_file_id,
          drive_url: out.drive_url,
          synced_at: new Date().toISOString(),
          ultimo_erro: null,
        }, { onConflict: "tipo,origem_id" });
        return new Response(JSON.stringify({ ok: true, ...out }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // Processa em background para evitar IDLE_TIMEOUT (150s) na invocação manual.
    // @ts-ignore EdgeRuntime exists in supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil((async () => {
        try {
          await processQueue();
          // Se ainda há jobs pendentes, encadeia uma nova invocação para drenar a fila.
          const { count } = await supabase
            .from("drive_sync_queue")
            .select("id", { count: "exact", head: true })
            .in("status", ["pendente", "erro"])
            .lt("tentativas", MAX_TENTATIVAS);
          if ((count || 0) > 0) {
            await new Promise((r) => setTimeout(r, 4000));
            await fetch(`${SUPABASE_URL}/functions/v1/drive-sync-worker`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({ chained: true }),
            }).catch((e) => console.warn("chain invoke", e));
          }
        } catch (e) { console.error("bg processQueue", e); }
      })());
      return new Response(JSON.stringify({ ok: true, queued: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await processQueue();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("worker error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
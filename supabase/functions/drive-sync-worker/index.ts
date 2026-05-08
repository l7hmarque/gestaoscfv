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

const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD_GW = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";
const DOCS_GW = "https://connector-gateway.lovable.dev/google_docs/v1";

const MAX_JOBS_PER_RUN = 8;
const MAX_TENTATIVAS = 5;

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
    .from("relatorio_turmas").select("turmas(nome)").eq("relatorio_id", origemId);
  const turmas = (turmasJoin || []).map((t: any) => t.turmas?.nome).filter(Boolean);

  const { data: presenca } = await supabase
    .from("relatorio_presenca")
    .select("presente, justificativa, participantes(nome_completo)")
    .eq("relatorio_id", origemId);

  const { data: fotos } = await supabase
    .from("relatorio_fotos").select("drive_url").eq("relatorio_id", origemId);

  const folderId = await ensureProfissionalSubfolder(educadorId, educadorNome, "Relatorios");
  const titulo = `SysCFV_Relatorio_${fmtDate(rel.data)}_${safe(rel.nome_atividade || "atividade")}_${safe(educadorNome)}`;

  let docId = rel.drive_file_id as string | null;
  if (!docId) {
    docId = await createGoogleDoc(titulo, folderId);
  }
  await writeDoc(docId, relatorioToBlocks(
    { ...rel, educador_nome: educadorNome }, turmas, presenca || [], fotos || [],
  ));
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
  if (!docId) docId = await createGoogleDoc(titulo, folderId);
  await writeDoc(docId, planejamentoToBlocks({ ...pl, educador_nome: educadorNome }, turmas));
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
// Edge Function: upload-registro-fotografico
// Recebe N fotos (base64), envia ao Google Drive em pasta MMM-AAAA dentro de
// "SysCFV - Registros Fotograficos", grava na tabela registros_fotograficos
// e cria 1 post no feed (carrossel) com todas as fotos enviadas.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files";
const ROOT_FOLDER_NAME = "SysCFV - Registros Fotograficos";
const MESES_ABREV = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function authHeaders(extra?: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte o Google Drive");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${parentClause}`;
  const url = `${GATEWAY_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Drive search falhou [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return (data.files || [])[0]?.id || null;
}

async function createFolder(name: string, parentId?: string): Promise<string> {
  const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const res = await fetch(`${GATEWAY_URL}/files?fields=id`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Drive create folder falhou [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

async function ensureFolderCached(supabase: any, chave: string, name: string, parentId?: string): Promise<string> {
  const { data: cached } = await supabase.from("drive_folder_cache").select("folder_id").eq("chave", chave).maybeSingle();
  if (cached?.folder_id) return cached.folder_id;
  let id = await findFolder(name, parentId);
  if (!id) id = await createFolder(name, parentId);
  await supabase.from("drive_folder_cache").upsert({ chave, folder_id: id }, { onConflict: "chave" });
  return id;
}

async function uploadBytes(name: string, mime: string, bytes: Uint8Array, parentId: string): Promise<{ id: string; webViewLink: string }> {
  const boundary = "----LovableBoundary" + crypto.randomUUID().replace(/-/g, "");
  const meta = JSON.stringify({ name, parents: [parentId] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);
  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,webViewLink,webContentLink&supportsAllDrives=true`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": `multipart/related; boundary=${boundary}` }),
    body,
  });
  if (!res.ok) throw new Error(`Drive upload falhou [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  // Torna o arquivo público (link compartilhável)
  await fetch(`${GATEWAY_URL}/files/${data.id}/permissions?supportsAllDrives=true`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  }).catch(() => {});
  return { id: data.id, webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view` };
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function extFromMime(m: string): string {
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("heic")) return "heic";
  return "jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile) return new Response(JSON.stringify({ error: "Perfil não encontrado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const fotos: Array<{ base64: string; mime: string; tamanho?: number }> = body.fotos || [];
    const descricao: string = (body.descricao || "").toString().slice(0, 280);
    const relatorio_id: string | null = body.relatorio_id || null;
    const turma_id: string | null = body.turma_id || null;
    const profissionais_marcados: string[] = Array.isArray(body.profissionais_marcados) ? body.profissionais_marcados : [];

    if (!Array.isArray(fotos) || fotos.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma foto enviada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (fotos.length > 10) {
      return new Response(JSON.stringify({ error: "Máximo de 10 fotos por envio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Estrutura de pastas
    const rootId = await ensureFolderCached(supabase, `regfotos:root`, ROOT_FOLDER_NAME);
    const now = new Date();
    const mesAbrev = MESES_ABREV[now.getMonth()];
    const ano = now.getFullYear();
    const aa = String(ano).slice(-2);
    const monthFolderName = `${mesAbrev}-${ano}`;
    const mes_ref = `${mesAbrev.toLowerCase()}-${ano}`;
    const monthFolderId = await ensureFolderCached(supabase, `regfotos:${monthFolderName}`, monthFolderName, rootId);

    const inserted: any[] = [];
    const fotoUrls: string[] = [];

    for (const f of fotos) {
      // próxima sequência
      const { data: seqData, error: seqErr } = await supabase.rpc("next_regfoto_seq", { _mes_ref: mes_ref });
      if (seqErr) throw new Error(`Sequência falhou: ${seqErr.message}`);
      const seq = seqData as number;
      const ext = extFromMime(f.mime);
      const nome_arquivo = `registrosFotograficos_${mesAbrev.toLowerCase()}-${aa}_${seq}.${ext}`;

      const bytes = decodeBase64(f.base64);
      const up = await uploadBytes(nome_arquivo, f.mime || "image/jpeg", bytes, monthFolderId);
      const arquivo_url = `https://drive.google.com/uc?export=view&id=${up.id}`;

      const { data: row, error: insErr } = await supabase.from("registros_fotograficos").insert({
        autor_id: profile.id,
        arquivo_url,
        drive_file_id: up.id,
        drive_folder_id: monthFolderId,
        nome_arquivo,
        mes_ref,
        seq,
        descricao: descricao || null,
        relatorio_id,
        turma_id,
        profissionais_marcados,
        tamanho_bytes: f.tamanho || bytes.length,
      }).select().single();
      if (insErr) throw new Error(`Insert falhou: ${insErr.message}`);
      inserted.push(row);
      fotoUrls.push(arquivo_url);
    }

    // 2. Criar 1 post no feed em carrossel
    const conteudoPost = descricao || "Novo registro fotográfico";
    const { data: post, error: postErr } = await supabase.from("feed_posts").insert({
      autor_id: profile.id,
      conteudo: conteudoPost,
      tipo: "manual",
      mencoes: profissionais_marcados,
    }).select().single();

    if (!postErr && post) {
      const fotosRows = fotoUrls.map((url, ordem) => ({ feed_post_id: post.id, foto_url: url, ordem }));
      await supabase.from("feed_fotos").insert(fotosRows);
      await supabase.from("registros_fotograficos")
        .update({ feed_post_id: post.id })
        .in("id", inserted.map((r) => r.id));
    }

    return new Response(JSON.stringify({
      success: true,
      registros: inserted,
      feed_post_id: post?.id || null,
      pasta: monthFolderName,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("upload-registro-fotografico erro:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
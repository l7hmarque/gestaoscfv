// @ts-nocheck
// Edge Function genérica: recebe um arquivo (base64) e tenta subir ao Google Drive
// na pasta SYSCFV/RelatoriosOficiais/{categoria}. XLSX é convertido em Google Sheet,
// PDF é mantido como PDF, DOCX vira Google Doc.
// Retorna { url } em sucesso ou { url: null, error } quando o Drive não está
// configurado — o cliente continua tendo o arquivo local.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD_GW = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";

const MIME_GSHEET = "application/vnd.google-apps.spreadsheet";
const MIME_GDOC = "application/vnd.google-apps.document";

function targetMime(sourceMime: string): string {
  if (sourceMime.includes("spreadsheet")) return MIME_GSHEET;
  if (sourceMime.includes("wordprocessing") || sourceMime.includes("msword")) return MIME_GDOC;
  return sourceMime; // PDF, etc. mantém
}

async function ensureFolderPath(parts: string[], driveKey: string, lovableKey: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": "application/json" };
  let parent: string | null = null;
  for (const name of parts) {
    const pq = parent ? ` and '${parent}' in parents` : "";
    const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${pq}`;
    const r = await fetch(`${DRIVE_GW}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true`, { headers });
    if (!r.ok) return null;
    let id: string | null = (await r.json()).files?.[0]?.id || null;
    if (!id) {
      const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
      if (parent) body.parents = [parent];
      const cr = await fetch(`${DRIVE_GW}/files?fields=id&supportsAllDrives=true`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!cr.ok) return null;
      id = (await cr.json()).id;
    }
    parent = id;
  }
  return parent;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const driveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!lovableKey || !driveKey) {
      return new Response(JSON.stringify({ url: null, error: "Google Drive não está conectado neste projeto." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { filename, mimeType, contentBase64, categoria } = await req.json();
    if (!filename || !mimeType || !contentBase64) {
      return new Response(JSON.stringify({ url: null, error: "Parâmetros ausentes." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const folderId = await ensureFolderPath(["SYSCFV", "RelatoriosOficiais", String(categoria || "Geral")], driveKey, lovableKey);

    const bytes = b64ToBytes(contentBase64);
    const metadata: any = { name: filename, mimeType: targetMime(mimeType) };
    if (folderId) metadata.parents = [folderId];
    const boundary = "----syscfvup" + Math.random().toString(36).slice(2);
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + bytes.length + tail.length);
    body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);

    const r = await fetch(`${DRIVE_UPLOAD_GW}/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ url: null, error: `Falha no upload: [${r.status}] ${t.slice(0, 200)}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await r.json();
    await fetch(`${DRIVE_GW}/files/${j.id}/permissions?supportsAllDrives=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }).catch(() => {});
    const url = j.webViewLink || `https://drive.google.com/file/d/${j.id}/view`;
    return new Response(JSON.stringify({ url, id: j.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ url: null, error: String((e as any)?.message || e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
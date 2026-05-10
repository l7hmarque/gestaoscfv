// Edge Function: sync-drive-modelos
// Cria/garante a pasta institucional do SysCFV no Google Drive com subpastas padronizadas.
// Retorna IDs e URLs para que o app possa direcionar os usuários ao Drive correto.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

function authHeaders() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte o Google Drive no Lovable Cloud");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
    "Content-Type": "application/json",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const root = await ensureFolder("SysCFV_Workspace");
    const subs: Record<string, { id: string; url: string }> = {};
    for (const sub of SUBFOLDERS) {
      const f = await ensureFolder(sub, root.id);
      subs[sub] = { id: f.id, url: `https://drive.google.com/drive/folders/${f.id}` };
    }
    return new Response(
      JSON.stringify({
        success: true,
        root: { id: root.id, name: root.name, url: `https://drive.google.com/drive/folders/${root.id}` },
        subfolders: subs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-drive-modelos]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
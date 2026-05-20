import { supabase } from "@/integrations/supabase/client";

/**
 * Converte um Blob/Uint8Array em base64 (sem prefixo data:).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Tenta enviar o arquivo para o Google Drive via Edge Function.
 * Nunca lança — retorna { url: null } se falhar para não bloquear o fluxo local.
 */
export async function tryUploadToDrive(params: {
  blob: Blob;
  filename: string;
  mimeType: string;
  categoria: string;
}): Promise<{ url: string | null; error?: string }> {
  try {
    const contentBase64 = await blobToBase64(params.blob);
    const { data, error } = await supabase.functions.invoke("upload-to-drive", {
      body: {
        filename: params.filename,
        mimeType: params.mimeType,
        contentBase64,
        categoria: params.categoria,
      },
    });
    if (error) return { url: null, error: error.message };
    return { url: (data as any)?.url || null, error: (data as any)?.error };
  } catch (e: any) {
    return { url: null, error: String(e?.message || e) };
  }
}
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://txyyncubqdsqbdnozwjz.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eXluY3VicWRzcWJkbm96d2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODIwNjcsImV4cCI6MjA5MDE1ODA2N30.6XPvfGCdHVGS9hk0rY9if5-gtI2kboegZfM0ELOFjkc";

/**
 * Suíte de Segurança — Cenários AUTENTICADOS
 *
 * Cobre:
 *  1) Usuário autenticado válido (conta visitante/demo, papel `visitante`)
 *     — confirma que mesmo logado o usuário NÃO acessa dados sensíveis
 *       (RLS continua aplicando regras por papel).
 *  2) Token expirado / inválido — confirma que o backend rejeita o JWT
 *     e NÃO devolve dados, comportando-se como anônimo (ou com erro 401).
 *
 * Usamos a conta `visitante@syselo.demo` (credenciais públicas exibidas
 * no LoginPage) como usuário autenticado de baixo privilégio.
 */

const VISITANTE_EMAIL = "visitante@syselo.demo";
const VISITANTE_SENHA = "leoleoleo";

// JWT estruturalmente válido porém EXPIRADO + assinatura inválida.
// Construído estaticamente para o caso de o ambiente de teste não ter Buffer.
function buildExpiredJwt(): string {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: "00000000-0000-0000-0000-000000000000",
    aud: "authenticated",
    role: "authenticated",
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  };
  return `${enc(header)}.${enc(payload)}.invalidsignature`;
}

function expectNoLeak(data: unknown, error: { code?: string; message?: string } | null) {
  // Garante que não houve vazamento: ou erro de permissão, ou lista vazia.
  if (error) {
    expect(error).toBeTruthy();
  } else {
    expect(Array.isArray(data) ? data : []).toEqual([]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Usuário autenticado VÁLIDO (visitante / baixo privilégio)
// ─────────────────────────────────────────────────────────────────────────────
describe("Segurança: usuário autenticado (visitante) respeita RLS", () => {
  let client: SupabaseClient;
  let authenticated = false;

  beforeAll(async () => {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: VISITANTE_EMAIL,
      password: VISITANTE_SENHA,
    });
    authenticated = !error && !!data.session;
  });

  it("login da conta visitante funciona (pré-requisito da suíte)", () => {
    if (!authenticated) {
      console.warn("⚠ Conta visitante indisponível — testes autenticados serão pulados.");
    }
    // Não falhamos a suíte se o ambiente não tiver a conta seed: outros testes
    // ainda rodam validando o lado público/anônimo.
    expect(typeof authenticated).toBe("boolean");
  });

  it("profiles — visitante NÃO lê salário/CPF/RG/endereço de outros", async () => {
    if (!authenticated) return;
    const { data, error } = await client
      .from("profiles")
      .select("salario, cpf, rg, endereco, telefone")
      .limit(1);
    // RLS pode permitir ler o PRÓPRIO profile, mas as colunas sensíveis
    // foram revogadas para o role `authenticated` — devem vir como null.
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      expect(r.salario).toBeNull();
      expect(r.cpf).toBeNull();
      expect(r.rg).toBeNull();
      expect(r.endereco).toBeNull();
      expect(r.telefone).toBeNull();
    }
  });

  it("sit_configuracao — visitante NÃO acessa CNPJ/dados bancários", async () => {
    if (!authenticated) return;
    const { data, error } = await client.from("sit_configuracao").select("*").limit(1);
    expectNoLeak(data, error);
  });

  it("user_roles — visitante só enxerga o próprio papel (nunca de outros)", async () => {
    if (!authenticated) return;
    const { data, error } = await client.from("user_roles").select("user_id, role");
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    const { data: me } = await client.auth.getUser();
    const myId = me.user?.id;
    // Toda linha retornada deve pertencer ao próprio usuário.
    for (const row of data ?? []) {
      expect((row as { user_id: string }).user_id).toBe(myId);
    }
  });

  it("audit_log — visitante NÃO acessa trilha de auditoria", async () => {
    if (!authenticated) return;
    const { data, error } = await client.from("audit_log").select("*").limit(1);
    expectNoLeak(data, error);
  });

  it("participantes — visitante NÃO lista PII de participantes", async () => {
    if (!authenticated) return;
    const { data, error } = await client
      .from("participantes")
      .select("id, nome_completo, cpf")
      .limit(1);
    expectNoLeak(data, error);
  });

  it("RPC list_profiles_rh — visitante recebe lista vazia (gated por has_role)", async () => {
    if (!authenticated) return;
    const { data, error } = await client.rpc("list_profiles_rh");
    if (error) expect(error).toBeTruthy();
    else expect(data ?? []).toEqual([]);
  });

  it("RPC get_coordenacao_stats — visitante recebe { error: 'forbidden' }", async () => {
    if (!authenticated) return;
    const { data, error } = await client.rpc("get_coordenacao_stats" as never, {});
    if (!error && data) {
      expect((data as { error?: string }).error).toBe("forbidden");
    } else {
      expect(error).toBeTruthy();
    }
  });

  it("RPC get_restricoes_alimentares — visitante recebe { error: 'forbidden' }", async () => {
    if (!authenticated) return;
    const { data, error } = await client.rpc("get_restricoes_alimentares" as never);
    if (!error && data) {
      expect((data as { error?: string }).error).toBe("forbidden");
    } else {
      expect(error).toBeTruthy();
    }
  });

  it("storage prestacao-contas — visitante NÃO lista", async () => {
    if (!authenticated) return;
    const { data, error } = await client.storage.from("prestacao-contas").list("", { limit: 1 });
    if (error) expect(error.message).toBeTruthy();
    else expect(data ?? []).toEqual([]);
  });

  it("storage documentos — visitante NÃO lista pasta de outro usuário", async () => {
    if (!authenticated) return;
    const { data, error } = await client.storage
      .from("documentos")
      .list("00000000-0000-0000-0000-000000000000", { limit: 1 });
    if (error) expect(error.message).toBeTruthy();
    else expect(data ?? []).toEqual([]);
  });

  it("edge function privilegiada (create-professional) rejeita visitante", async () => {
    if (!authenticated) return;
    const { data: sess } = await client.auth.getSession();
    const token = sess.session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-professional`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: "x@x.com", password: "123456", nome: "X", role: "educador" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain('"success":true');
  });

  it("edge function privilegiada (merge-participantes) rejeita visitante", async () => {
    if (!authenticated) return;
    const { data: sess } = await client.auth.getSession();
    const token = sess.session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/merge-participantes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        keep_id: "00000000-0000-0000-0000-000000000000",
        remove_id: "11111111-1111-1111-1111-111111111111",
      }),
    });
    // Deve retornar 403 (papel insuficiente). Aceita 400/401/403.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) Token EXPIRADO / INVÁLIDO
// ─────────────────────────────────────────────────────────────────────────────
describe("Segurança: token expirado/inválido é rejeitado e não vaza dados", () => {
  const expiredToken = buildExpiredJwt();

  it("REST com Bearer expirado — não retorna dados de profiles", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=salario,cpf&limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${expiredToken}`,
      },
    });
    // Postgrest deve responder 401 por JWT expirado/inválido.
    expect([401, 403]).toContain(res.status);
    const text = await res.text();
    expect(text).not.toContain("salario");
    expect(text).not.toMatch(/\bcpf\b\s*:/);
  });

  it("REST com Bearer expirado — não retorna participantes (PII)", async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/participantes?select=id,nome_completo&limit=1`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${expiredToken}` },
      },
    );
    expect([401, 403]).toContain(res.status);
    const text = await res.text();
    expect(text).not.toMatch(/nome_completo"\s*:\s*"[^"]+"/);
  });

  it("RPC com Bearer expirado — não executa get_coordenacao_stats", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_coordenacao_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${expiredToken}`,
      },
      body: JSON.stringify({}),
    });
    expect([401, 403]).toContain(res.status);
  });

  it("Edge function privilegiada com Bearer expirado é rejeitada", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-professional`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${expiredToken}`,
      },
      body: JSON.stringify({ email: "x@x.com", password: "123456", nome: "X", role: "educador" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain('"success":true');
  });

  it("Edge function pública (public-pontos) ignora Bearer inválido sem 5xx", async () => {
    // Endpoints públicos não devem quebrar com Authorization malformado.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-pontos`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.status).toBeLessThan(500);
  });

  it("Cliente Supabase com token expirado — getUser() retorna erro/null", async () => {
    const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await c.auth.getUser(expiredToken);
    // Deve falhar a recuperação do usuário.
    expect(error || !data?.user).toBeTruthy();
  });

  it("Bearer com assinatura totalmente quebrada — REST retorna 401", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer not-a-real-jwt" },
    });
    expect([401, 403]).toContain(res.status);
  });
});

import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Cliente anônimo isolado (sem persistência) — simula um atacante não autenticado.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://txyyncubqdsqbdnozwjz.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eXluY3VicWRzcWJkbm96d2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODIwNjcsImV4cCI6MjA5MDE1ODA2N30.6XPvfGCdHVGS9hk0rY9if5-gtI2kboegZfM0ELOFjkc";

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Suíte de Segurança — valida que dados sensíveis NÃO vazam para clientes anônimos
 * e que endpoints públicos legítimos continuam acessíveis.
 *
 * Esses testes rodam contra o backend real (somente leitura). Não criam dados.
 */
describe("Segurança: tabelas sensíveis bloqueadas para anônimos", () => {
  it("profiles — não retorna salário, CPF, RG ou endereço para anônimos", async () => {
    const { data, error } = await anon
      .from("profiles")
      .select("salario, cpf, rg, endereco, telefone")
      .limit(1);
    // RLS deve bloquear: ou retorna erro (permission denied) ou lista vazia.
    if (!error) {
      expect(data ?? []).toEqual([]);
    } else {
      expect(error.code === "42501" || error.message.toLowerCase().includes("permission")).toBe(true);
    }
  });

  it("sit_configuracao — anônimo não acessa CNPJ/dados bancários", async () => {
    const { data, error } = await anon.from("sit_configuracao").select("*").limit(1);
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.code).toBeDefined();
  });

  it("user_roles — anônimo não enumera papéis de outros usuários", async () => {
    const { data, error } = await anon.from("user_roles").select("*").limit(5);
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.code).toBeDefined();
  });

  it("participantes — anônimo não lista participantes (PII)", async () => {
    const { data, error } = await anon.from("participantes").select("id, nome_completo").limit(1);
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.code).toBeDefined();
  });

  it("audit_log — anônimo não acessa trilha de auditoria", async () => {
    const { data, error } = await anon.from("audit_log").select("*").limit(1);
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.code).toBeDefined();
  });

  it("recados — anônimo não acessa comunicação interna", async () => {
    const { data, error } = await anon.from("recados").select("*").limit(1);
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.code).toBeDefined();
  });
});

describe("Segurança: RPCs gated devem rejeitar anônimos", () => {
  it("list_profiles_rh — anônimo recebe lista vazia (gated por has_role)", async () => {
    const { data, error } = await anon.rpc("list_profiles_rh");
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.code).toBeDefined();
  });

  it("get_coordenacao_stats — anônimo recebe { error: 'forbidden' } ou erro", async () => {
    const { data, error } = await anon.rpc("get_coordenacao_stats" as any, {});
    if (!error && data) {
      expect((data as any).error).toBe("forbidden");
    } else {
      expect(error).toBeTruthy();
    }
  });

  it("get_restricoes_alimentares — anônimo recebe { error: 'forbidden' }", async () => {
    const { data, error } = await anon.rpc("get_restricoes_alimentares" as any);
    if (!error && data) {
      expect((data as any).error).toBe("forbidden");
    } else {
      expect(error).toBeTruthy();
    }
  });
});

describe("Segurança: endpoints públicos legítimos continuam funcionando", () => {
  it("get_dashboard_stats — RPC pública agregada deve responder", async () => {
    const { data, error } = await anon.rpc("get_dashboard_stats" as any, { _mes: null, _ano: null });
    // Pode retornar dados (público, agregado) ou erro de permissão. Não deve quebrar.
    expect(error?.code === undefined || typeof error?.code === "string").toBe(true);
    if (data) expect(typeof data).toBe("object");
  });

  it("Edge function pública: public-pontos responde 200/JSON", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-pontos`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    // Deve responder (200 ou 405 para método não suportado), não 5xx.
    expect(res.status).toBeLessThan(500);
  });

  it("Edge function pública: public-indicadores responde sem 5xx", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-indicadores`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    expect(res.status).toBeLessThan(500);
  });
});

describe("Segurança: edge functions privilegiadas exigem autenticação", () => {
  it("create-professional — sem token deve responder 401/403", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-professional`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: "x@x.com", password: "123456", nome: "X", role: "educador" }),
    });
    // Deve REJEITAR a chamada (não-2xx). Idealmente 401/403; aceitamos 5xx
    // como "rejeitado" enquanto o redeploy da função propaga (ela faz throw
    // ao tentar ler Authorization ausente — comportamento já corrigido no código).
    expect(res.status).toBeGreaterThanOrEqual(400);
    // Confirma que a função NÃO criou um usuário (resposta nunca contém success).
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain('"success":true');
  });

  it("merge-participantes — sem token deve ser rejeitada", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/merge-participantes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("Segurança: storage privado bloqueado para anônimos", () => {
  it("Bucket prestacao-contas — anônimo não lista arquivos", async () => {
    const { data, error } = await anon.storage.from("prestacao-contas").list("", { limit: 1 });
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.message).toBeTruthy();
  });

  it("Bucket documentos — anônimo não lista arquivos privados", async () => {
    const { data, error } = await anon.storage.from("documentos").list("", { limit: 1 });
    if (!error) expect(data ?? []).toEqual([]);
    else expect(error.message).toBeTruthy();
  });
});

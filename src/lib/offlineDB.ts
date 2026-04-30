import { openDB, type IDBPDatabase } from "idb";

/**
 * Banco IndexedDB para suporte offline da página de transporte.
 * - transporte_pendentes: fila de marcações de embarque feitas sem internet.
 * - transporte_snapshot: snapshot do dia (pontos, participantes, check-ins do servidor)
 *   para que o motorista consiga abrir a página mesmo sem rede depois.
 */

const DB_NAME = "syscfv-offline";
const DB_VERSION = 1;

export type PendenteStatus = "pendente" | "enviando" | "erro";

export interface PendenteEmbarque {
  id_local: string; // uuid local
  participante_id: string;
  data: string; // YYYY-MM-DD
  periodo: "manha" | "tarde";
  embarcou: boolean;
  embarcou_em: string; // ISO
  criado_em: string;
  tentativas: number;
  status: PendenteStatus;
  ultimo_erro?: string;
}

export interface SnapshotDia {
  data: string;
  salvo_em: string;
  pontos: any[];
  bairros: any[];
  participantes: { id: string; nome_completo: string; periodo: string; ponto_transporte_id: string | null }[];
  checkins: any[];
}

let _dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("transporte_pendentes")) {
          const s = db.createObjectStore("transporte_pendentes", { keyPath: "id_local" });
          s.createIndex("status", "status");
          s.createIndex("criado_em", "criado_em");
        }
        if (!db.objectStoreNames.contains("transporte_snapshot")) {
          db.createObjectStore("transporte_snapshot", { keyPath: "data" });
        }
      },
    });
  }
  return _dbPromise;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return "loc-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ========= Fila de pendentes =========

export async function enfileirarEmbarque(input: {
  participante_id: string;
  data: string;
  periodo: "manha" | "tarde";
  embarcou: boolean;
}): Promise<PendenteEmbarque> {
  const db = await getDB();
  const item: PendenteEmbarque = {
    id_local: uuid(),
    participante_id: input.participante_id,
    data: input.data,
    periodo: input.periodo,
    embarcou: input.embarcou,
    embarcou_em: new Date().toISOString(),
    criado_em: new Date().toISOString(),
    tentativas: 0,
    status: "pendente",
  };
  await db.put("transporte_pendentes", item);
  return item;
}

export async function listarPendentes(): Promise<PendenteEmbarque[]> {
  const db = await getDB();
  const all = await db.getAll("transporte_pendentes");
  return (all as PendenteEmbarque[]).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

export async function atualizarPendente(p: PendenteEmbarque) {
  const db = await getDB();
  await db.put("transporte_pendentes", p);
}

export async function removerPendente(id_local: string) {
  const db = await getDB();
  await db.delete("transporte_pendentes", id_local);
}

// ========= Snapshot do dia =========

export async function salvarSnapshot(snap: SnapshotDia) {
  const db = await getDB();
  await db.put("transporte_snapshot", snap);
}

export async function carregarSnapshot(data: string): Promise<SnapshotDia | undefined> {
  const db = await getDB();
  return (await db.get("transporte_snapshot", data)) as SnapshotDia | undefined;
}
import { TABLE_KINDS, type ScopeConfig, type TableKind } from "@/api/types";

export const TABLE_KIND_LABEL: Record<TableKind | "OTHER", string> = {
  MANAGED: "Tabela gerenciada",
  EXTERNAL: "Tabela externa",
  VIEW: "View",
  MATERIALIZED_VIEW: "View materializada",
  STREAMING_TABLE: "Streaming table",
  FOREIGN: "Tabela estrangeira",
  OTHER: "Outro",
};

/** Formatos sempre oferecidos, além dos que a descoberta encontrou. */
export const COMMON_FORMATS = ["DELTA", "PARQUET", "CSV", "JSON"];

/** Nomes próprios de formato; siglas (CSV, JSON, ORC...) ficam como vêm. */
export const FORMAT_LABEL: Record<string, string> = { DELTA: "Delta", PARQUET: "Parquet", ICEBERG: "Iceberg", AVRO: "Avro", TEXT: "Texto" };

/** Chave da seleção, como o backend a usa nas rotas: `catalogo` ou `catalogo.schema`. */
export function ruleKey(rule: Pick<ScopeConfig, "catalog" | "schema">): string {
  return rule.schema ? `${rule.catalog}.${rule.schema}` : rule.catalog;
}

/** Tipo do objeto como o filtro o enxerga (clones rasos contam como a tabela de base). */
export function kindOf(tableType: string | null): TableKind | null {
  const raw = (tableType ?? "").toUpperCase();
  const base = raw === "MANAGED_SHALLOW_CLONE" ? "MANAGED" : raw === "EXTERNAL_SHALLOW_CLONE" ? "EXTERNAL" : raw;
  return (TABLE_KINDS as readonly string[]).includes(base) ? (base as TableKind) : null;
}

/** Prévia, na tela, dos filtros de tipo e formato (quem decide é o backend). O formato só filtra
 *  objetos que têm formato: views não têm. */
export function passesFilters(rule: Pick<ScopeConfig, "table_types" | "formats">, tableType: string | null, dataFormat: string | null): boolean {
  if (rule.table_types) {
    const kind = kindOf(tableType);
    if (!kind || !rule.table_types.includes(kind)) return false;
  }
  if (rule.formats && dataFormat) return rule.formats.includes(dataFormat.toUpperCase());
  return true;
}

/** "Catálogo inteiro", "Schema inteiro" ou "3 tabelas", e o que filtra. */
export function describeRule(rule: ScopeConfig): string {
  const reach = rule.tables ? `${rule.tables.length} tabela(s) escolhida(s)` : rule.schema ? "Schema inteiro" : "Catálogo inteiro";
  const parts = [reach];
  if (rule.table_types) parts.push(rule.table_types.map((kind) => TABLE_KIND_LABEL[kind]).join(", "));
  if (rule.formats) parts.push(`formato ${rule.formats.join(", ")}`);
  if (rule.exclude.length) parts.push(`${rule.exclude.length} exceção(ões)`);
  return parts.join(" · ");
}

export function describeTypes(types: Partial<Record<string, number>>): string {
  return Object.entries(types)
    .filter(([, count]) => count)
    .map(([kind, count]) => `${count} ${TABLE_KIND_LABEL[kind as TableKind | "OTHER"] ?? kind}`)
    .join(" · ");
}

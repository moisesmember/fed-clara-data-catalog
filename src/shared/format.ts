const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const number = new Intl.NumberFormat("pt-BR");

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
/** Cada unidade e quantas da anterior cabem nela (a partir de minutos). */
const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["hour", 60],
  ["day", 24],
  ["week", 7],
  ["month", 4.35],
  ["year", 12],
];

/** "há 5 minutos", "ontem", "há 3 semanas"; abaixo de um minuto, "agora". */
export function formatRelative(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  let amount = (date.getTime() - now.getTime()) / 60_000;
  if (Math.abs(amount) < 1) return "agora";
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  for (const [step, size] of RELATIVE_STEPS) {
    if (Math.abs(amount) < size) break;
    amount /= size;
    unit = step;
  }
  return relative.format(Math.round(amount), unit);
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

export function formatInteger(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : number.format(value);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return seconds < 60 ? `${formatNumber(seconds)} s` : `${formatNumber(seconds / 60)} min`;
}

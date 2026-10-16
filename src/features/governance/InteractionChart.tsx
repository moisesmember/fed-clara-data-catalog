import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { GovernanceDay } from "@/api/types";
import { formatInteger } from "@/shared/format";

/** Séries na ordem fixa da paleta categórica (validada para linhas, claro e escuro). A cor segue a
 *  série, nunca a posição: filtrar o período não repinta nada. */
export const INTERACTION_SERIES = [
  { key: "searches", label: "Buscas", color: "var(--series-1)" },
  { key: "questions", label: "Perguntas", color: "var(--series-2)" },
  { key: "card_views", label: "Fichas abertas", color: "var(--series-3)" },
  { key: "unanswered", label: "Sem resposta", color: "var(--series-4)" },
] as const satisfies readonly { key: keyof GovernanceDay; label: string; color: string }[];

const PLOT_HEIGHT = 200;
const AXIS_BAND = 28;
const MARGIN = { top: 12, left: 44 };
const LABEL_GUTTER = 112;
const MIN_LABEL_GAP = 14;

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Frequência de interação por dia. Uma escala só (todas as séries contam eventos). */
export function InteractionChart({ days }: { days: GovernanceDay[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(720);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const max = niceMax(Math.max(1, ...days.flatMap((day) => INTERACTION_SERIES.map((series) => day[series.key]))));
  const y = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;

  // Rótulos no fim das linhas só se não colidirem; senão, legenda e tooltip bastam.
  const last = days[days.length - 1];
  const endPoints = last ? INTERACTION_SERIES.map((series) => ({ ...series, value: last[series.key], y: y(last[series.key]) })) : [];
  const sortedEnds = [...endPoints].sort((a, b) => a.y - b.y);
  const endLabels = width >= 520 && sortedEnds.every((point, index) => index === 0 || point.y - sortedEnds[index - 1]!.y >= MIN_LABEL_GAP);
  const right = endLabels ? LABEL_GUTTER : 16;
  const plotWidth = width - MARGIN.left - right;
  const x = (index: number) => MARGIN.left + (days.length <= 1 ? plotWidth / 2 : (index / (days.length - 1)) * plotWidth);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * max);
  const xTicks = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])].filter((index) => index >= 0);

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.min(days.length - 1, Math.max(0, Math.round(ratio * (days.length - 1)))));
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      setActive((current) => Math.min(days.length - 1, Math.max(0, (current ?? (step > 0 ? -1 : days.length)) + step)));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };
  const activeDay = active === null ? null : days[active];

  return (
    <div className="viz" ref={wrapRef}>
      <ul className="viz-legend" aria-label="Legenda">
        {INTERACTION_SERIES.map((series) => (
          <li key={series.key}>
            <span className="viz-key viz-key--line" style={{ background: series.color }} aria-hidden="true" />
            {series.label}
          </li>
        ))}
      </ul>
      <svg
        width={width}
        height={MARGIN.top + PLOT_HEIGHT + AXIS_BAND}
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="viz-svg"
      >
        <title id={titleId}>Interações por dia. Use as setas para percorrer os dias; os valores também estão na tabela abaixo.</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="viz-grid" x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(tick)} y2={y(tick)} />
            <text className="viz-tick" x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
              {compact.format(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((index) => (
          <text key={index} className="viz-tick" x={x(index)} y={MARGIN.top + PLOT_HEIGHT + 18}
            textAnchor={days.length > 1 && index === 0 ? "start" : days.length > 1 && index === days.length - 1 ? "end" : "middle"}>
            {shortDate.format(new Date(days[index]!.day))}
          </text>
        ))}
        {INTERACTION_SERIES.map((series) => (
          <polyline
            key={series.key}
            className="viz-line"
            points={days.map((day, index) => `${x(index)},${y(day[series.key])}`).join(" ")}
            stroke={series.color}
          />
        ))}
        {endPoints.map((point) => (
          <circle key={point.key} className="viz-dot" cx={x(days.length - 1)} cy={point.y} r={4} fill={point.color} />
        ))}
        {endLabels
          ? endPoints.map((point) => (
              <text key={point.key} className="viz-end-label" x={x(days.length - 1) + 10} y={point.y} dy="0.32em">
                <tspan className="viz-end-value">{formatInteger(point.value)}</tspan> {point.label}
              </text>
            ))
          : null}
        {activeDay ? (
          <g aria-hidden="true">
            <line className="viz-crosshair" x1={x(active!)} x2={x(active!)} y1={MARGIN.top} y2={MARGIN.top + PLOT_HEIGHT} />
            {INTERACTION_SERIES.map((series) => (
              <circle key={series.key} className="viz-dot" cx={x(active!)} cy={y(activeDay[series.key])} r={4} fill={series.color} />
            ))}
          </g>
        ) : null}
        <rect
          className="viz-hit"
          x={MARGIN.left}
          y={MARGIN.top}
          width={Math.max(1, plotWidth)}
          height={PLOT_HEIGHT}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
        />
      </svg>
      {activeDay ? (
        <div
          className="viz-tooltip"
          role="status"
          style={{ left: Math.min(x(active!) + 12, width - 190), top: MARGIN.top }}
        >
          <div className="viz-tooltip__title">{longDate.format(new Date(activeDay.day))}</div>
          {INTERACTION_SERIES.map((series) => (
            <div key={series.key} className="viz-tooltip__row">
              <span className="viz-key viz-key--line" style={{ background: series.color }} aria-hidden="true" />
              <strong>{formatInteger(activeDay[series.key])}</strong>
              <span className="muted">{series.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

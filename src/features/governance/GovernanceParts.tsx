import { Link } from "react-router";

import { QUALITY_LEVELS, type GovernanceAsset, type GovernanceGroup, type QualityLevel } from "@/api/types";
import { useSession } from "@/core/auth/SessionProvider";
import { formatInteger, formatNumber } from "@/shared/format";
import { Badge } from "@/shared/ui/primitives";
import { EmptyState } from "@/shared/ui/states";

/** Nível de catalogação: cor de situação SEMPRE acompanhada de ícone e rótulo. */
export const LEVEL: Record<QualityLevel, { label: string; icon: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  well: { label: "Bem catalogado", icon: "✓", tone: "success" },
  partial: { label: "Parcial", icon: "◐", tone: "warning" },
  poor: { label: "Pouco catalogado", icon: "!", tone: "danger" },
  uncataloged: { label: "Sem ficha", icon: "○", tone: "neutral" },
};

export function LevelBadge({ level }: { level: QualityLevel }) {
  const { label, icon, tone } = LEVEL[level];
  return (
    <Badge tone={tone}>
      <span aria-hidden="true">{icon}</span> {label}
    </Badge>
  );
}

function pct(part: number, whole: number): string {
  return whole ? `${formatNumber((100 * part) / whole)}%` : "—";
}

/** Parte do todo: uma barra empilhada, segmentos separados por 2px de superfície. */
export function QualityBar({ levels, compact = false }: { levels: Record<QualityLevel, number>; compact?: boolean }) {
  const total = QUALITY_LEVELS.reduce((sum, level) => sum + levels[level], 0);
  if (!total) return <span className="muted small">—</span>;
  const description = QUALITY_LEVELS.map((level) => `${LEVEL[level].label}: ${levels[level]}`).join("; ");
  return (
    <div className={`quality-bar${compact ? " quality-bar--compact" : ""}`} role="img" aria-label={description} title={description}>
      {QUALITY_LEVELS.filter((level) => levels[level] > 0).map((level) => (
        <span key={level} className={`quality-bar__segment quality-bar__segment--${level}`} style={{ flexGrow: levels[level] }} />
      ))}
    </div>
  );
}

export function QualityLegend({ levels }: { levels: Record<QualityLevel, number> }) {
  const total = QUALITY_LEVELS.reduce((sum, level) => sum + levels[level], 0);
  return (
    <ul className="viz-legend viz-legend--stacked">
      {QUALITY_LEVELS.map((level) => (
        <li key={level}>
          <span className={`viz-key quality-key--${level}`} aria-hidden="true" />
          <span>
            <strong>{formatInteger(levels[level])}</strong> <span className="muted">({pct(levels[level], total)})</span> {LEVEL[level].label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Pontuação 0–100: a trilha é um tom claro da mesma cor do preenchimento. */
export function ScoreMeter({ score, level }: { score: number; level: QualityLevel }) {
  return (
    <span className="score">
      <span className={`score-meter score-meter--${level}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Pontuação de catalogação">
        <span className="score-meter__fill" style={{ width: `${score}%` }} />
      </span>
      <span className="score__value">{score}</span>
    </span>
  );
}

/** Barra de magnitude (uma cor só) com o valor ao lado, para listas ordenadas. */
export function MagnitudeBar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="magnitude" title={label}>
      <span className="magnitude__track" aria-hidden="true">
        <span className="magnitude__fill" style={{ width: max ? `${(100 * value) / max}%` : 0 }} />
      </span>
      <span className="magnitude__value">{formatInteger(value)}</span>
    </span>
  );
}

function AssetName({ asset }: { asset: GovernanceAsset }) {
  const { permissions } = useSession();
  // Sem nome de negócio (ativo ainda sem ficha), o nome técnico é o próprio título.
  const hasBusinessName = asset.name !== asset.fqn.split(".").pop();
  const title = hasBusinessName ? asset.name : <code>{asset.fqn}</code>;
  return (
    <div className="asset-name">
      {permissions.can("read_metadata", asset.domain) ? <Link to={`/ativos/${asset.asset_id}`}>{title}</Link> : <span>{title}</span>}
      {hasBusinessName ? <code className="xsmall muted">{asset.fqn}</code> : null}
    </div>
  );
}

export function GapList({ gaps, labels }: { gaps: string[]; labels: Record<string, string> }) {
  if (!gaps.length) return <span className="xsmall muted">Nenhuma lacuna</span>;
  return (
    <span className="cluster gap-list">
      {gaps.map((gap) => (
        <Badge key={gap} tone="neutral">
          {labels[gap] ?? gap}
        </Badge>
      ))}
    </span>
  );
}

type Variant = "demand" | "quality";

/** Lista ordenada de ativos. `demand`: barra de procura; `quality`: pontuação e lacunas. */
export function AssetRanking({
  assets,
  variant,
  gapLabels,
  empty,
}: {
  assets: GovernanceAsset[];
  variant: Variant;
  gapLabels: Record<string, string>;
  empty: string;
}) {
  if (!assets.length) return <EmptyState title={empty} />;
  const maxDemand = Math.max(1, ...assets.map((asset) => asset.demand));
  return (
    <ol className="ranking">
      {assets.map((asset) => (
        <li key={asset.asset_id} className="ranking__item">
          <AssetName asset={asset} />
          {variant === "demand" ? (
            <div className="ranking__metric">
              <MagnitudeBar value={asset.demand} max={maxDemand} label={`${asset.card_views} fichas abertas, ${asset.citations} citações`} />
              <span className="xsmall muted">
                {formatInteger(asset.card_views)} aberturas · {formatInteger(asset.citations)} citações · {formatInteger(asset.search_hits)} na busca
              </span>
            </div>
          ) : (
            <div className="ranking__metric">
              <span className="cluster">
                <ScoreMeter score={asset.score} level={asset.level} />
                <LevelBadge level={asset.level} />
              </span>
              <GapList gaps={asset.gaps} labels={gapLabels} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function PriorityTable({ assets, gapLabels }: { assets: GovernanceAsset[]; gapLabels: Record<string, string> }) {
  if (!assets.length) {
    return <EmptyState title="Nenhuma prioridade no período">Os ativos procurados estão bem catalogados.</EmptyState>;
  }
  return (
    <div className="ui-table-wrap">
      <table className="ui-table governance-table">
        <thead>
          <tr>
            <th scope="col">Ativo</th>
            <th scope="col">Domínio</th>
            <th scope="col" className="num">Procura</th>
            <th scope="col">Catalogação</th>
            <th scope="col">O que falta</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.asset_id}>
              <td>
                <AssetName asset={asset} />
              </td>
              <td className="small">{asset.domain}</td>
              <td className="num">{formatInteger(asset.demand)}</td>
              <td>
                <ScoreMeter score={asset.score} level={asset.level} />
              </td>
              <td>
                <GapList gaps={asset.gaps} labels={gapLabels} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Thresholds = { well: number; partial: number };

export function GroupTable({ groups, dimension, thresholds }: { groups: GovernanceGroup[]; dimension: string; thresholds: Thresholds }) {
  if (!groups.length) return <EmptyState title="Nenhum ativo no escopo" />;
  return (
    <div className="ui-table-wrap">
      <table className="ui-table governance-table">
        <thead>
          <tr>
            <th scope="col">{dimension}</th>
            <th scope="col" className="num">Ativos</th>
            <th scope="col">Com ficha</th>
            <th scope="col" className="num">Certificadas</th>
            <th scope="col">Pontuação média</th>
            <th scope="col">Distribuição</th>
            <th scope="col" className="num">Procura</th>
            <th scope="col" className="num">Na busca</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.key}>
              <th scope="row" className="governance-table__label">
                {group.label}
                {group.label !== group.key ? <code className="xsmall muted">{group.key}</code> : null}
              </th>
              <td className="num">{formatInteger(group.assets)}</td>
              <td>
                <MagnitudeBar value={group.published} max={group.assets} label={`${formatNumber(group.published_pct)}% com ficha publicada`} />
                <span className="xsmall muted">{formatNumber(group.published_pct)}%</span>
              </td>
              <td className="num">{formatInteger(group.certified)}</td>
              <td>
                <ScoreMeter score={Math.round(group.avg_score)} level={levelOf(group.avg_score, group.published, thresholds)} />
              </td>
              <td>
                <QualityBar levels={group.levels} compact />
              </td>
              <td className="num">{formatInteger(group.demand)}</td>
              <td className="num">{formatInteger(group.search_hits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Colore a média do grupo com os limites informados pelo backend. */
function levelOf(score: number, published: number, thresholds: Thresholds): QualityLevel {
  if (!published) return "uncataloged";
  return score >= thresholds.well ? "well" : score >= thresholds.partial ? "partial" : "poor";
}

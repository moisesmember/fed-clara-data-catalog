import { useState } from "react";

import type { GovernanceDashboard } from "@/api/types";
import { formatInteger, formatNumber } from "@/shared/format";
import { Disclosure, PageHeader, Panel, Segmented, Tabs } from "@/shared/ui/primitives";
import { EmptyState, QueryView } from "@/shared/ui/states";

import { AssetRanking, GroupTable, LEVEL, LevelBadge, MagnitudeBar, PriorityTable, QualityBar, QualityLegend } from "./GovernanceParts";
import { INTERACTION_SERIES, InteractionChart } from "./InteractionChart";
import { useGovernanceDashboard } from "./hooks";
import "./governance.css";

const PERIODS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function percent(value: number | null): string {
  return value === null ? "—" : `${formatNumber(value)}%`;
}

/** Painel de governança: procura × qualidade de catalogação, para decidir onde curar primeiro. */
export function GovernancePage() {
  const [period, setPeriod] = useState<Period>("30");
  const dashboard = useGovernanceDashboard(Number(period));

  return (
    <>
      <PageHeader
        eyebrow="Governança"
        title="Painel de governança"
        subtitle="O que é procurado, o que está bem documentado e onde a curadoria rende mais."
        actions={<Segmented label="Período" value={period} onChange={setPeriod} options={[...PERIODS]} />}
      />
      <QueryView query={dashboard} skeletonLines={8}>
        {(data) => (
          <div className={`stack governance${dashboard.isPlaceholderData ? " governance--refreshing" : ""}`} aria-busy={dashboard.isFetching}>
            <Dashboard data={data} />
          </div>
        )}
      </QueryView>
    </>
  );
}

function Dashboard({ data }: { data: GovernanceDashboard }) {
  const [groupBy, setGroupBy] = useState<"source" | "domain">("source");
  const { summary, methodology } = data;
  const gapLabels = Object.fromEntries(methodology.criteria.map((criterion) => [criterion.key, criterion.label]));
  const interactions = summary.searches + summary.questions + summary.card_views;
  const maxGap = Math.max(1, ...data.gaps.map((gap) => gap.assets));

  return (
    <>
      <p className="small muted">
        {data.scope.all_domains ? "Todos os domínios" : `Domínios: ${data.scope.domains.join(", ")}`} · de {shortDate.format(new Date(data.period.since))} a{" "}
        {shortDate.format(new Date(data.period.until))}
      </p>

      <section aria-labelledby="kpi-catalogo" className="stack-sm">
        <h2 id="kpi-catalogo" className="governance__section-title">Saúde do catálogo</h2>
        <div className="kpis">
          <Kpi label="Ativos no escopo" value={formatInteger(summary.assets)} hint={summary.assets_missing ? `${formatInteger(summary.assets_missing)} ausentes na origem` : undefined} />
          <Kpi label="Com ficha publicada" value={percent(summary.published_pct)} hint={`${formatInteger(summary.published)} de ${formatInteger(summary.assets)}`} />
          <Kpi label="Fichas certificadas" value={percent(summary.certified_pct)} hint={`${formatInteger(summary.certified)} das publicadas`} />
          <Kpi label="Pontuação média" value={summary.avg_score === null ? "—" : `${formatNumber(summary.avg_score)}/100`}
            hint={summary.avg_score_published === null ? undefined : `${formatNumber(summary.avg_score_published)} entre as publicadas`} />
          <Kpi label="Pendências abertas" value={formatInteger(summary.open_pendencies)} />
        </div>
      </section>

      <section aria-labelledby="kpi-uso" className="stack-sm">
        <h2 id="kpi-uso" className="governance__section-title">Uso no período</h2>
        <div className="kpis">
          <Kpi label="Interações" value={formatInteger(interactions)} hint="buscas + perguntas + fichas abertas" />
          <Kpi label="Fichas abertas" value={formatInteger(summary.card_views)} />
          <Kpi label="Sem resposta" value={percent(summary.unanswered_pct)} hint={`${formatInteger(summary.unanswered)} buscas ou perguntas`} />
          <Kpi label="Ativos procurados" value={formatInteger(summary.assets_with_demand)} />
          <Kpi label="Publicadas sem procura" value={formatInteger(summary.published_without_demand)} />
        </div>
      </section>

      <Panel title="Frequência de interação">
        {interactions + summary.unanswered === 0 ? (
          <EmptyState title="Sem interações no período">As contagens começam a ser registradas quando alguém busca, pergunta ou abre uma ficha.</EmptyState>
        ) : (
          <div className="stack-sm">
            <InteractionChart days={data.timeline} />
            {!data.scope.all_domains ? (
              <p className="xsmall muted">Buscas, perguntas e sem resposta são da plataforma inteira; fichas abertas, só dos seus domínios.</p>
            ) : null}
            <Disclosure summary="Ver dados em tabela">
              <TimelineTable data={data} />
            </Disclosure>
          </div>
        )}
      </Panel>

      <div className="grid-2">
        <Panel title="Situação da catalogação">
          <div className="stack-sm">
            <QualityBar levels={data.quality_distribution} />
            <QualityLegend levels={data.quality_distribution} />
          </div>
        </Panel>
        <Panel title="Lacunas mais comuns">
          {data.gaps.length === 0 ? (
            <EmptyState title="Nenhuma lacuna" />
          ) : (
            <ul className="gap-bars">
              {data.gaps.map((gap) => (
                <li key={gap.key}>
                  <span className="small">{gap.label}</span>
                  <MagnitudeBar value={gap.assets} max={maxGap} label={`${gap.assets} ativos`} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Prioridades de curadoria">
        <p className="xsmall muted governance__hint">Procurados e ainda abaixo de “{LEVEL.well.label.toLowerCase()}”: cada melhoria aqui atinge mais gente.</p>
        <PriorityTable assets={data.curation_priorities} gapLabels={gapLabels} />
      </Panel>

      <div className="governance__pair">
        <Panel title="Mais procuradas">
          <AssetRanking assets={data.most_demanded} variant="demand" gapLabels={gapLabels} empty="Nenhuma ficha procurada no período" />
        </Panel>
        <Panel title="Menos procuradas">
          <p className="xsmall muted governance__hint">Fichas publicadas com pouca ou nenhuma procura: divulgar, revisar nome e sinônimos ou avaliar aposentadoria.</p>
          <AssetRanking assets={data.least_demanded} variant="demand" gapLabels={gapLabels} empty="Nenhuma ficha publicada" />
        </Panel>
      </div>

      <div className="governance__pair">
        <Panel title="Bem catalogadas">
          <AssetRanking assets={data.best_cataloged} variant="quality" gapLabels={gapLabels} empty="Nenhuma ficha publicada" />
        </Panel>
        <Panel title="Pouco catalogadas">
          <AssetRanking assets={data.poorly_cataloged} variant="quality" gapLabels={gapLabels} empty="Nenhum ativo no escopo" />
        </Panel>
      </div>

      <Panel
        title="Por fonte e domínio"
        actions={
          <Tabs
            label="Agrupar por"
            value={groupBy}
            onChange={setGroupBy}
            tabs={[
              { value: "source", label: "Fontes de dados" },
              { value: "domain", label: "Domínios" },
            ]}
          />
        }
      >
        <GroupTable groups={groupBy === "source" ? data.by_source : data.by_domain} dimension={groupBy === "source" ? "Fonte" : "Domínio"}
          thresholds={methodology.thresholds} />
      </Panel>

      <Disclosure summary="Como os indicadores são calculados">
        <div className="stack-sm small">
          <p>
            <strong>Pontuação de catalogação (0–100).</strong> Soma dos critérios atendidos. Sem ficha publicada, a pontuação é 0: o consumidor não encontra o
            ativo.
          </p>
          <ul>
            {methodology.criteria.map((criterion) => (
              <li key={criterion.key}>
                {criterion.label}: <strong>{criterion.weight}</strong> pontos
              </li>
            ))}
          </ul>
          <p>
            Níveis: <LevelBadge level="well" /> a partir de {methodology.thresholds.well}; <LevelBadge level="partial" /> a partir de{" "}
            {methodology.thresholds.partial}; <LevelBadge level="poor" /> abaixo disso.
          </p>
          <p>
            <strong>Procura:</strong> {methodology.demand}.
          </p>
          <p>
            <strong>Privacidade:</strong> {methodology.privacy}. Retenção de {formatInteger(methodology.retention_days)} dias; dias contados no fuso{" "}
            {methodology.timezone}.
          </p>
        </div>
      </Disclosure>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {hint ? <span className="xsmall muted">{hint}</span> : null}
    </div>
  );
}

function TimelineTable({ data }: { data: GovernanceDashboard }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table governance-table">
        <thead>
          <tr>
            <th scope="col">Dia</th>
            {INTERACTION_SERIES.map((series) => (
              <th key={series.key} scope="col" className="num">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.timeline.map((day) => (
            <tr key={day.day}>
              <th scope="row">{shortDate.format(new Date(day.day))}</th>
              {INTERACTION_SERIES.map((series) => (
                <td key={series.key} className="num">
                  {formatInteger(day[series.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

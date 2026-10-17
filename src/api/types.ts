/** Contratos da API do Clara. Enums são declarados como constantes para que o teste de contrato
 *  compare os valores com o `openapi.json` real do backend. */

export const VISIBILITIES = ["internal", "domain", "restricted"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const TRUST_STATUSES = ["not_validated", "certified", "with_caveats"] as const;
export type TrustStatus = (typeof TRUST_STATUSES)[number];

export const REVIEW_DECISIONS = ["approve", "request_changes", "regenerate", "reject"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const CHANGE_KINDS = ["substantive", "editorial"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export const CLAIM_STATUSES = ["supported", "suggested", "unknown"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type EditorialStatus = "draft" | "in_review" | "published" | "retired";
export type TaskStatus =
  | "open"
  | "generating"
  | "awaiting_review"
  | "approved"
  | "published"
  | "publication_blocked"
  | "rejected"
  | "failed"
  | "superseded";
export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "dead" | "cancelled";
export type SearchMode = "text" | "hybrid";

// ---------- Sessão ----------
export interface MeResponse {
  subject: string;
  bindings: [string, string, string][];
}

// ---------- Busca e RAG ----------
export interface SearchHit {
  asset_id: number;
  card_id: number;
  publication_id: number;
  chunk_id: number;
  score: number;
  fqn: string;
  business_name: string;
  domain: string;
  visibility: Visibility;
  trust_status: TrustStatus;
  revision_no: number;
  asset_version_no: number;
  review_required: boolean;
  branches: string[];
  /** Campos de exibição; podem faltar em versões anteriores da API. */
  owner?: string;
  subject?: string;
  /** Resumo em linguagem simples ou, na falta dele, a descrição de negócio. */
  summary?: string;
}

export interface SearchResponse {
  cache_hit: boolean;
  /** Expressões do glossário reconhecidas na busca (ex.: "dinheiro que entrou"). */
  expanded_terms: string[];
  /** Termos do catálogo acrescentados por elas (ex.: "faturamento"). */
  added_terms: string[];
  results: SearchHit[];
}

export interface Citation {
  context_id: string;
  asset_id: number;
  fqn: string;
  publication_revision: number;
  asset_version: number;
  trust_status: TrustStatus;
}

/** Ficha sugerida em redirecionamento (pedido de valor) ou esclarecimento (pergunta vaga). */
export interface AnswerSuggestion {
  asset_id: number;
  fqn: string;
  business_name: string;
  owner: string;
  subject: string;
  domain: string;
  trust_status: TrustStatus;
}

export interface AskResponse {
  status: "ok" | "no_evidence" | "out_of_scope" | "clarify" | null;
  suggestions: AnswerSuggestion[];
  expanded_terms: string[];
  intent: "discovery" | "value_request" | null;
  answer: string | null;
  evidence_status: "supported" | "partial" | "none" | null;
  citations: Citation[];
  degraded: string[];
  mode: SearchMode;
  metrics: { wall_ms: number; llm_calls: number; docs_retrieved: number; context_chars: number };
}

// ---------- Fichas ----------
export interface PersonalDataSignal {
  column: string;
  category: string;
  rationale: string;
  evidence_refs: string[];
}

export interface CardColumn {
  name: string;
  data_type: string;
  meaning: string | null;
  meaning_status: ClaimStatus;
}

export interface CardContent {
  fqn: string;
  object_type: string;
  source_id: string;
  domain: string;
  owner: string;
  asset_version_no: number;
  business_name: string;
  business_description: string;
  /** Ausentes em fichas publicadas antes do contrato v2. */
  plain_language_summary?: string;
  example_questions?: string[];
  subject: string;
  synonyms: string[];
  granularity: { text: string; status: ClaimStatus };
  possible_uses: string[];
  limitations: string[];
  personal_data_signals: PersonalDataSignal[];
  columns: CardColumn[];
}

export interface PublishedCard {
  asset_id: number;
  editorial_status: EditorialStatus;
  trust_status: TrustStatus;
  trust_notes: string | null;
  visibility: Visibility;
  review_required: boolean;
  publication_revision: number;
  asset_version: number;
  published_at: string;
  content: CardContent;
}

// ---------- Curadoria ----------
export interface Claim {
  text: string;
  status: ClaimStatus;
  evidence_refs: string[];
}

export interface ColumnNote {
  column: string;
  meaning: Claim;
}

export interface DraftContent {
  business_name: Claim;
  business_description: Claim;
  domain: Claim;
  subject: Claim;
  synonyms: string[];
  granularity: Claim;
  possible_uses: Claim[];
  limitations: Claim[];
  personal_data_signals: PersonalDataSignal[];
  owner_questions: string[];
  column_notes: ColumnNote[];
  plain_language_summary: string;
  example_questions: string[];
}

export interface ValidationIssue {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  path: string | null;
}

export interface Pendency {
  id?: number;
  code: string;
  message: string;
  blocking: boolean;
}

/** Tipos de evidência gravados pela sincronização (o backend pode acrescentar outros). */
export type EvidenceKind = "table_comment" | "column_comment" | "catalog_comment" | "schema_comment" | "column_schema" | "document";

export interface Evidence {
  id: number;
  kind: EvidenceKind | (string & {});
  ref: string;
  text: string;
  untrusted: boolean;
}

export interface TaskSummary {
  id: number;
  asset_id: number;
  fqn: string;
  kind: string;
  status: TaskStatus;
  domain: string;
  draft_revision: number;
  updated_at: string;
}

export interface TaskDetail {
  id: number;
  asset_id: number;
  asset_version_id: number;
  kind: string;
  status: TaskStatus;
  domain: string;
  draft_revision: number;
  regenerations: number;
  review_rounds: number;
  last_error: string | null;
  human_wait_ms: number;
  draft: {
    id: number;
    revision: number;
    origin: "ai" | "human";
    content: DraftContent;
    issues: ValidationIssue[];
    evidence_map: Record<string, number>;
    model: string | null;
    prompt_version: string | null;
    contract_version: string;
  } | null;
  evidences: Evidence[];
  open_pendencies: Pendency[];
  decisions: { id: number; decision: ReviewDecision; approver: string; draft_revision: number; created_at: string }[];
}

export interface ReviewSubmission {
  decision: ReviewDecision;
  expected_draft_revision: number;
  expected_asset_version_id: number;
  edits?: DraftContent;
  confirmed_owner?: string;
  visibility?: Visibility;
  limitations_none_known?: boolean;
  change_kind?: ChangeKind;
  notes?: string;
  publish?: boolean;
}

export interface ReviewAccepted {
  job_id: number;
  decision_id: string;
}

// ---------- Ativos ----------
export interface AssetSummary {
  id: number;
  source_id: string;
  fqn: string;
  object_type: string;
  domain: string;
  status: string;
  version_no: number | null;
  editorial_status: EditorialStatus | null;
  trust_status: TrustStatus | null;
}

export interface AssetDetail {
  id: number;
  source_id: string;
  identity_key: string;
  fqn: string;
  object_type: string;
  domain: string;
  status: string;
  missing_runs: number;
  current_version: { id: number; version_no: number; content_hash: string; collected_at: string } | null;
  card: {
    editorial_status: EditorialStatus;
    trust_status: TrustStatus;
    visibility: Visibility;
    review_required: boolean;
    lock_version: number;
  } | null;
  open_pendencies: Pendency[];
  latest_task: { id: number; status: TaskStatus; kind: string } | null;
}

export type VersionDiff = { kind: "created" } | ({ kind: "changed" } & Record<string, unknown>);

export interface AssetVersionSummary {
  id: number;
  version_no: number;
  content_hash: string;
  diff: VersionDiff;
  collected_at: string;
  sync_run_id: number | null;
}

export interface AssetVersionDetail {
  id: number;
  version_no: number;
  description: string | null;
  diff: VersionDiff;
  columns: { position: number; name: string; data_type: string; description: string | null }[];
}

// ---------- Fontes ----------
export const SOURCE_ENVIRONMENTS = ["lab", "dev", "prod"] as const;
export type SourceEnvironment = (typeof SOURCE_ENVIRONMENTS)[number];

export const SOURCE_KINDS = ["databricks_sql", "file"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const AUTH_METHODS = ["oauth_m2m", "pat", "none"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

/** Tipos de objeto na origem que a seleção filtra (`TableKind` no backend). */
export const TABLE_KINDS = ["MANAGED", "EXTERNAL", "VIEW", "MATERIALIZED_VIEW", "STREAMING_TABLE", "FOREIGN"] as const;
export type TableKind = (typeof TABLE_KINDS)[number];

/** Uma seleção (ADR 0015 do backend): catálogo inteiro (`schema` nulo), schema inteiro ou
 *  tabelas escolhidas (`tables`). Catálogo/schema inteiros acompanham a origem. `null` em
 *  `table_types`/`formats` = todos. A seleção do schema vence a do catálogo. */
export interface ScopeConfig {
  catalog: string;
  schema: string | null;
  tables: string[] | null;
  exclude: string[];
  table_types: TableKind[] | null;
  formats: string[] | null;
  domain: string;
}

/** Seleção enviada ao backend: campos ausentes assumem o padrão (tudo). */
export type ScopeInput = Pick<ScopeConfig, "catalog" | "domain"> & Partial<Omit<ScopeConfig, "catalog" | "domain">>;

/** `PATCH` de uma seleção: só os campos presentes mudam; `tables: null` volta ao schema inteiro. */
export type ScopeChanges = Partial<Pick<ScopeConfig, "domain" | "tables" | "exclude" | "table_types" | "formats">>;

export interface Warehouse {
  id: string;
  name: string | null;
  state: string | null;
  size: string | null;
  type: string | null;
  serverless: boolean;
  http_path: string;
}

/** Última listagem de SQL Warehouses do workspace (job `source.connect`). */
export interface WarehouseListing {
  listed_at: string;
  items: Warehouse[];
  error: string | null;
}

/** Corpo de `POST /sources` (`SourceConfig`). O mesmo `id` substitui a configuração existente. */
export interface SourceInput {
  id: string;
  name: string;
  environment: SourceEnvironment;
  kind: SourceKind;
  host?: string;
  /** Opcional: sem ele, a Clara lista os SQL Warehouses e adota o único, se houver só um. */
  http_path?: string;
  auth_method: AuthMethod;
  /** Referência ao segredo (ex.: `env:DBX_VENDAS`), nunca o segredo. */
  credential_ref?: string;
  scopes: ScopeInput[];
  schedule_time?: string;
  owner: string;
}

/** Resposta do cadastro: jobs que a Clara já enfileirou (`connect`, ou `test` + `discover`). */
export interface SourceCreated {
  id: string;
  jobs: Partial<Record<"connect" | "test" | "discover", number>>;
}

export interface CapabilityStep {
  name: string;
  ok: boolean;
  detail: string | null;
  scope?: string;
  tables?: number;
  catalog?: string;
  metastore_id?: string | null;
}

export interface CapabilityReport {
  ok: boolean;
  steps: CapabilityStep[];
  checked_at?: string;
  metastore_id?: string | null;
}

export interface SourceSummary {
  id: string;
  name: string;
  environment: string;
  kind: "databricks_sql" | "file";
  host: string | null;
  http_path: string | null;
  warehouses: WarehouseListing | null;
  auth_method: string;
  scopes: ScopeConfig[];
  schedule_time: string | null;
  schedule_tz: string;
  owner: string;
  status: "active" | "paused" | "error";
  metastore_id: string | null;
  last_capability_check: CapabilityReport | null;
}

/** Schema visto pela última descoberta. `rule` é a seleção configurada exatamente neste schema;
 *  `owner` é a chave da seleção que decide aqui (a do schema ou a do catálogo); `selected` conta
 *  os objetos descobertos que ela inclui. Comentários vêm da origem (não confiáveis). */
export interface DiscoveredSchema {
  schema: string;
  comment: string | null;
  tables: number;
  types: Partial<Record<TableKind | "OTHER", number>>;
  formats: Record<string, number>;
  rule: ScopeConfig | null;
  owner: string | null;
  domain: string | null;
  selected: number;
}

export interface DiscoveredCatalog {
  catalog: string;
  comment: string | null;
  rule: ScopeConfig | null;
  schemas: DiscoveredSchema[];
}

/** Seleção configurada. `visible`: true = a credencial vê; false = não vista na última descoberta;
 *  null = catálogo fora da descoberta. */
export interface ConfiguredRule extends ScopeConfig {
  key: string;
  visible: boolean | null;
}

export interface ScopesOverview {
  source_id: string;
  http_path: string | null;
  warehouses: WarehouseListing | null;
  discovered_at: string | null;
  discovery_truncated: boolean;
  objects_truncated: boolean;
  discovery_errors: { catalog: string; error: string }[];
  catalogs: DiscoveredCatalog[];
  rules: ConfiguredRule[];
}

export interface DiscoveredObject {
  name: string;
  table_type: string | null;
  data_format: string | null;
  selected: boolean;
}

export interface DiscoveredObjects {
  catalog: string;
  schema: string;
  owner: string | null;
  objects: DiscoveredObject[];
}

export interface WarehouseSelected {
  warehouse: Warehouse;
  jobs: Partial<Record<"test" | "discover", number>>;
}

export interface ScopeAdded {
  scope: string;
  domain: string;
  sync_job_id: number | null;
  note: string | null;
}

export interface SyncRun {
  id: number;
  source_id: string;
  scope_key: string;
  trigger: string;
  status: string;
  coverage: string;
  counts: Record<string, number>;
  errors: string[];
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

// ---------- Operações ----------
export interface JobAccepted {
  job_id: number;
}

/** Edição de ficha: `existing` indica que já havia revisão em andamento (sem novo job). */
export interface CardEditAccepted {
  task_id: number;
  job_id: number | null;
  existing: boolean;
}

export interface Job {
  id: number;
  kind: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  cancel_requested: boolean;
}

export interface AuditEvent {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  domain: string | null;
  correlation_id: string | null;
  details: Record<string, unknown>;
}

export interface GraphRunStats {
  graph: "curation" | "answer";
  status: string;
  count: number;
  p50_ms: number | null;
  p95_ms: number | null;
  llm_calls: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  est_cost_usd: number | null;
  avg_checkpoint_bytes: number | null;
  avg_context_chars: number | null;
}

export interface GraphMetrics {
  note: string;
  runs: GraphRunStats[];
  human_wait_ms: { avg: number | null; max: number | null } | null;
  search_cache: { hits: number; misses: number; scope: string };
}

// ---------- Descoberta guiada ----------
export interface BrowseCard {
  asset_id: number;
  business_name: string;
  fqn: string;
  summary: string;
  trust_status: TrustStatus;
}

export interface BrowseResponse {
  domains: {
    domain: string;
    card_count: number;
    example_questions: string[];
    subjects: { subject: string; cards: BrowseCard[] }[];
  }[];
}

export interface SuggestionItem {
  label: string;
  kind: "card" | "synonym" | "glossary";
  asset_id: number | null;
}

export interface GlossaryTerm {
  id: number;
  domain: string;
  term: string;
  expansions: string[];
  created_by: string;
  updated_at: string;
  can_manage: boolean;
}

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

/** Termo proposto pela IA a partir só do conteúdo publicado; vale depois que um curador aceita. */
export interface GlossarySuggestion {
  id: number;
  domain: string;
  term: string;
  expansions: string[];
  rationale: string;
  demand: number;
  status: SuggestionStatus;
  model: string;
  prompt_version: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

export interface UnansweredQuery {
  query: string;
  occurrences: number;
  last_seen: string;
  kinds: string[];
}

export interface HelpRequest {
  id: number;
  created_at: string;
  requester: string;
  question: string;
  asset_id: number | null;
  domains: string[];
  status: "open" | "resolved";
  resolution_note: string | null;
  resolved_by: string | null;
}

export interface Page {
  page: number;
  pageSize: number;
}

/* ---------------- Painel de governança (ADR 0014 do backend) ---------------- */

/** Nível de catalogação: bem (>= 80), parcial (>= 50), pouco (< 50) ou sem ficha publicada. */
export type QualityLevel = "well" | "partial" | "poor" | "uncataloged";
export const QUALITY_LEVELS: readonly QualityLevel[] = ["well", "partial", "poor", "uncataloged"];

export interface GovernanceAsset {
  asset_id: number;
  fqn: string;
  name: string;
  domain: string;
  source_id: string;
  published: boolean;
  trust_status: TrustStatus | null;
  score: number;
  level: QualityLevel;
  /** Chaves dos critérios não atendidos (ver `methodology.criteria`). */
  gaps: string[];
  /** Fichas abertas + citações em respostas. */
  demand: number;
  card_views: number;
  citations: number;
  search_hits: number;
  priority?: number;
}

export interface GovernanceGroup {
  key: string;
  label: string;
  assets: number;
  published: number;
  published_pct: number;
  certified: number;
  avg_score: number;
  levels: Record<QualityLevel, number>;
  demand: number;
  search_hits: number;
}

export interface GovernanceDay {
  day: string;
  searches: number;
  questions: number;
  card_views: number;
  unanswered: number;
}

export interface GovernanceDashboard {
  period: { days: number; since: string; until: string };
  scope: { all_domains: boolean; domains: string[] };
  summary: {
    assets: number;
    assets_missing: number;
    published: number;
    published_pct: number | null;
    certified: number;
    certified_pct: number | null;
    avg_score: number | null;
    avg_score_published: number | null;
    open_pendencies: number;
    searches: number;
    questions: number;
    card_views: number;
    unanswered: number;
    unanswered_pct: number | null;
    assets_with_demand: number;
    published_without_demand: number;
  };
  timeline: GovernanceDay[];
  quality_distribution: Record<QualityLevel, number>;
  most_demanded: GovernanceAsset[];
  least_demanded: GovernanceAsset[];
  best_cataloged: GovernanceAsset[];
  poorly_cataloged: GovernanceAsset[];
  curation_priorities: GovernanceAsset[];
  gaps: { key: string; label: string; assets: number }[];
  by_source: GovernanceGroup[];
  by_domain: GovernanceGroup[];
  methodology: {
    criteria: { key: string; label: string; weight: number }[];
    thresholds: { well: number; partial: number };
    demand: string;
    privacy: string;
    retention_days: number;
    timezone: string;
  };
}

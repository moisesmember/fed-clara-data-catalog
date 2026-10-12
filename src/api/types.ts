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

export interface Evidence {
  id: number;
  kind: string;
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
export interface ScopeConfig {
  catalog: string;
  schema: string;
  domain: string;
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
  auth_method: string;
  scopes: ScopeConfig[];
  schedule_time: string | null;
  schedule_tz: string;
  owner: string;
  status: "active" | "paused" | "error";
  metastore_id: string | null;
  last_capability_check: CapabilityReport | null;
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

export type OrderStatus =
  | "AWAITING_EVIDENCE"
  | "INSPECTING"
  | "INSUFFICIENT_EVIDENCE"
  | "HELD"
  | "RELEASED";

export type EventTone = "neutral" | "info" | "warning" | "danger" | "success";
export type Orchestrator = "dashboard" | "hermes";

export interface ManifestItem {
  sku: string;
  label: string;
  quantity: number;
  color?: string;
  condition?: string;
}

export interface ObservedItem {
  sku: string;
  label: string;
  quantity: number;
  color?: string;
  condition?: string;
  confidence: number;
}

export interface Observation {
  summary: string;
  evidenceConfidence: number;
  items: ObservedItem[];
  notes: string[];
  model: string;
  latencyMs: number;
}

export type DiscrepancyType =
  | "MISSING_ITEM"
  | "UNEXPECTED_ITEM"
  | "QUANTITY_MISMATCH"
  | "ATTRIBUTE_MISMATCH"
  | "CONDITION_MISMATCH";

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  sku: string;
  label: string;
  expected: string;
  observed: string;
  severity: "warning" | "critical";
}

export interface Evidence {
  id: string;
  imageUrl: string;
  source: "fixture" | "upload" | "video";
  capturedAt: string;
  digest: string;
  fixture?: FixtureId;
  mediaType?: "image" | "video";
  frameCount?: number;
}

export interface EvidenceRecord {
  id: string;
  sequence: number;
  evidence: Evidence;
  observation: Observation;
  decision: "HELD" | "RELEASED" | "INSUFFICIENT_EVIDENCE";
  discrepancies: Discrepancy[];
  ledgerHash: string;
}

export interface OperationEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  actor: "operator" | "hermes" | "vision" | "policy" | "system";
  tone: EventTone;
}

export interface LedgerEntry {
  sequence: number;
  timestamp: string;
  event: string;
  payloadDigest: string;
  previousHash: string;
  hash: string;
}

export type AutomatedActionType =
  | "HOLD_ORDER"
  | "CREATE_CORRECTION_TASK"
  | "NOTIFY_OPERATOR"
  | "RELEASE_ORDER"
  | "UPDATE_INVENTORY";

export interface AutomatedAction {
  id: string;
  type: AutomatedActionType;
  status: "executed";
  label: string;
  target: string;
  receipt: string;
  timestamp: string;
}

export interface OperationProtocol {
  id: string;
  name: string;
  version: string;
  domain: string;
  objective: string;
  valueAtRisk: number;
  currency: string;
}

export interface OperationDefinition {
  operationId: string;
  station: string;
  destination: string;
  protocol: OperationProtocol;
  manifest: ManifestItem[];
}

export interface CorrectionStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface RepairDirective {
  id: string;
  title: string;
  summary: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string;
  steps: CorrectionStep[];
}

export interface OperationMetrics {
  autonomousActions: number;
  preventedErrors: number;
  valueProtected: number;
}

export interface OrderState {
  id: string;
  station: string;
  destination: string;
  status: OrderStatus;
  revision: number;
  protocol: OperationProtocol;
  manifest: ManifestItem[];
  evidence?: Evidence;
  observation?: Observation;
  discrepancies: Discrepancy[];
  repair?: RepairDirective;
  metrics: OperationMetrics;
  events: OperationEvent[];
  actions: AutomatedAction[];
  ledger: LedgerEntry[];
  evidenceHistory: EvidenceRecord[];
  releasedAt?: string;
}

export type FixtureId =
  | "mismatch"
  | "corrected"
  | "unclear"
  | "mismatch-angle"
  | "corrected-angle"
  | "damaged"
  | "replacement";

export interface RuntimeInfo {
  mode: "demo" | "huggingface" | "custom";
  visionModel: string;
  hermesMcp: boolean;
  mcpTools: number;
  actionAdapter: "local" | "webhook";
  serverTime: string;
}

export interface ProtocolTemplate extends OperationDefinition {
  invariantCount: number;
  demoReady: boolean;
}

export interface InspectResponse {
  state: OrderState;
  decision: "HELD" | "RELEASED" | "INSUFFICIENT_EVIDENCE";
}

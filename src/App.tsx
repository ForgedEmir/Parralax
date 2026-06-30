import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  CircleDollarSign,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Upload,
  Video,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { FixtureId, OrderState, OrderStatus } from "../shared/types";
import { useParallax } from "./api";
import { MissionBrief } from "./MissionBrief";
import { SimpleExperience } from "./SimpleExperience";

const wait = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

async function extractVideoFrames(file: File, count = 4): Promise<File[]> {
  const video = document.createElement("video");
  const source = URL.createObjectURL(file);
  video.src = source;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Unable to read this video."));
  });

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0) {
    URL.revokeObjectURL(source);
    throw new Error("The video duration could not be determined.");
  }

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Video frame extraction is unavailable.");

  const frames: File[] = [];
  for (let index = 0; index < count; index += 1) {
    video.currentTime = duration * ((index + 1) / (count + 1));
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Frame extraction failed.")), "image/jpeg", 0.88),
    );
    frames.push(new File([blob], `video-frame-${index + 1}.jpg`, { type: "image/jpeg" }));
  }
  URL.revokeObjectURL(source);
  return frames;
}

const statusCopy: Record<OrderStatus, { label: string; detail: string }> = {
  AWAITING_EVIDENCE: { label: "Ready to verify", detail: "Waiting for a photo of the completed work" },
  INSPECTING: { label: "Checking reality", detail: "The vision model is reading the evidence" },
  INSUFFICIENT_EVIDENCE: { label: "New photo needed", detail: "PARALLAX will not guess" },
  HELD: { label: "Workflow stopped", detail: "A real-world error must be corrected" },
  RELEASED: { label: "Safe to continue", detail: "The correction is visually proven" },
};

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}
function StatusMark({ status }: { status: OrderStatus }) {
  const Icon =
    status === "RELEASED"
      ? CheckCircle2
      : status === "HELD"
        ? LockKeyhole
        : status === "INSPECTING"
          ? LoaderCircle
          : status === "INSUFFICIENT_EVIDENCE"
            ? CircleAlert
            : ScanLine;
  return <Icon className={status === "INSPECTING" ? "spin" : ""} size={18} />;
}

function Header({
  connected,
  mode,
  agentLinked,
  mcpTools,
  visionModel,
}: {
  connected: boolean;
  mode?: string;
  agentLinked: boolean;
  mcpTools?: number;
  visionModel?: string;
}) {
  const modelLabel =
    mode === "demo"
      ? "Verified replay"
      : visionModel?.split("/").at(-1)?.replace("-Reasoning", "") ?? "Vision live";
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="PARALLAX dashboard">
        <span className="brand-mark"><ScanLine size={17} /></span>
        <span>PARALLAX</span>
        <span className="brand-sub">Reality reconciliation</span>
      </a>
      <div className="runtime-strip">
        <span className={"connection-dot " + (connected ? "online" : "")} />
        <span>{connected ? "Live" : "Reconnecting"}</span>
        <span className="divider" />
        <span>{modelLabel}</span>
        <span className="divider" />
        <span>{agentLinked ? "Hermes signed" : "Hermes ready"} / {mcpTools ?? 7} tools</span>
      </div>
    </header>
  );
}

function AutonomyStrip({ order }: { order: OrderState }) {
  const hasHermesProof = order.events.some((entry) => entry.actor === "hermes");
  const protectedValue = order.metrics.valueProtected || order.protocol.valueAtRisk;
  const instruments = [
    {
      index: "01",
      icon: Workflow,
      label: `Active protocol / ${order.protocol.domain}`,
      value: order.protocol.name,
      className: "protocol-cell",
    },
    {
      index: "02",
      icon: CircleDollarSign,
      label: order.metrics.valueProtected ? "Value protected" : "Value at risk",
      value: formatMoney(protectedValue, order.protocol.currency),
      className: "",
    },
    {
      index: "03",
      icon: Bot,
      label: "Autonomous actions",
      value: String(order.metrics.autonomousActions).padStart(2, "0"),
      className: "",
    },
    {
      index: "04",
      icon: Fingerprint,
      label: "Agent provenance",
      value: hasHermesProof ? "Hermes signed" : "Awaiting Hermes",
      className: `agent-cell ${hasHermesProof ? "verified" : ""}`,
    },
  ];

  return (
    <section className="autonomy-strip">
      {instruments.map((instrument, index) => {
        const Icon = instrument.icon;
        return (
          <motion.div
            className={`autonomy-cell ${instrument.className}`}
            key={instrument.index}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
          >
            <span className="instrument-index">{instrument.index}</span>
            <Icon size={17} />
            <div>
              <span>{instrument.label}</span>
              <strong>{instrument.value}</strong>
            </div>
          </motion.div>
        );
      })}
    </section>
  );
}
function EvidenceViewport({ order }: { order: OrderState }) {
  const verdictCode =
    order.status === "RELEASED"
      ? "PASS"
      : order.status === "HELD"
        ? "BLOCK"
        : order.status === "INSUFFICIENT_EVIDENCE"
          ? "RETAKE"
          : order.status === "INSPECTING"
            ? "SCAN"
            : "ARMED";
  return (
    <section className={`evidence-viewport status-${order.status.toLowerCase()}`}>
      <div className="viewport-bar">
        <span><Camera size={14} /> Evidence / camera 04</span>
        <span>{order.evidence ? new Date(order.evidence.capturedAt).toLocaleTimeString() : "Standby"}</span>
      </div>
      <div className="evidence-frame">
        <AnimatePresence mode="wait">
          {order.evidence ? (
            <motion.img
              key={order.evidence.id}
              src={order.evidence.imageUrl}
              alt="Captured package evidence"
              initial={{ opacity: 0, scale: 1.025, clipPath: "inset(0 100% 0 0)" }}
              animate={{ opacity: 1, scale: 1, clipPath: "inset(0 0% 0 0)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : (
            <motion.div className="empty-evidence" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ScanLine size={46} />
              <span>CAMERA READY</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="frame-corner top-left" />
        <div className="frame-corner top-right" />
        <div className="frame-corner bottom-left" />
        <div className="frame-corner bottom-right" />
        {order.status === "INSPECTING" && (
          <motion.div
            className="scan-beam"
            initial={{ top: "4%" }}
            animate={{ top: "94%" }}
            transition={{ duration: 1.25, repeat: Infinity, repeatType: "reverse" }}
          />
        )}
        <AnimatePresence mode="wait">
          <motion.div
            className="evidence-status"
            key={order.status}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ type: "spring", stiffness: 330, damping: 30 }}
          >
            <span className="verdict-code">{verdictCode}</span>
            <StatusMark status={order.status} />
            <div>
              <strong>{statusCopy[order.status].label}</strong>
              <span>{statusCopy[order.status].detail}</span>
            </div>
          </motion.div>
        </AnimatePresence>
        <motion.div
          className="state-outline"
          key={`outline-${order.status}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        {order.observation && (
          <div className="confidence-meter">
            <span>Evidence confidence</span>
            <strong>{Math.round(order.observation.evidenceConfidence * 100)}%</strong>
          </div>
        )}
      </div>
      {order.observation && (
        <motion.div className="observation-rail" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          <span className="observation-label">Visible facts</span>
          <div className="observation-items">
            {order.observation.items.map((item) => (
              <span key={item.sku}>
                <i style={{ backgroundColor: item.color ?? "#8f948a" }} />
                {item.quantity}x {item.label}
                <small>{Math.round(item.confidence * 100)}</small>
              </span>
            ))}
            {!order.observation.items.length && <span>No reliable object match</span>}
          </div>
        </motion.div>
      )}
      <div className="evidence-footer">
        <span><Fingerprint size={13} /> {order.evidence ? shortHash(order.evidence.digest) : "No digest"}</span>
        <span>{order.evidence?.source === "fixture" ? "Fixture declared" : "Live capture"}</span>
      </div>
    </section>
  );
}

function Manifest({ order }: { order: OrderState }) {
  return (
    <section className="panel manifest-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Expected result</span>
          <h2>What must be true</h2>
        </div>
        <span className="counter">{order.manifest.length}</span>
      </div>
      <div className="manifest-list">
        {order.manifest.map((item) => {
          const discrepancy = order.discrepancies.find((entry) => entry.sku === item.sku);
          const observed = order.observation?.items.find((entry) => entry.sku === item.sku);
          const passed = order.status === "RELEASED" || (observed && !discrepancy);
          return (
            <motion.div layout className={`manifest-row ${discrepancy ? "failed" : passed ? "passed" : ""}`} key={item.sku}>
              <span className="item-state">
                {discrepancy ? <X size={15} /> : passed ? <Check size={15} /> : <span />}
              </span>
              <div className="item-copy">
                <strong>{item.label}</strong>
                <span>{item.sku}</span>
              </div>
              <div className="item-expectation">
                <strong>{item.quantity}x</strong>
                <span className="color-swatch" style={{ backgroundColor: item.color }} title={item.color} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Decision({ order }: { order: OrderState }) {
  const outcome =
    order.status === "RELEASED"
      ? { code: "PASS", detail: "Every invariant is supported by evidence." }
      : order.status === "HELD"
        ? { code: "BLOCK", detail: `${order.discrepancies.length} violations require repair.` }
        : order.status === "INSUFFICIENT_EVIDENCE"
          ? { code: "RETAKE", detail: "Confidence is below the release threshold." }
          : { code: "ARMED", detail: "Policy is waiting for structured evidence." };
  return (
    <section className={`panel decision-panel decision-${order.status.toLowerCase()}`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Automated safety gate</span>
          <h2>What PARALLAX decided</h2>
        </div>
        <ShieldCheck size={19} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          className="policy-verdict"
          key={outcome.code}
          initial={{ opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          <span>Policy outcome</span>
          <strong>{outcome.code}</strong>
          <small>{outcome.detail}</small>
        </motion.div>
      </AnimatePresence>
      {order.discrepancies.length > 0 ? (
        <div className="discrepancy-list">
          {order.discrepancies.map((item) => (
            <motion.div
              key={item.id}
              className="discrepancy"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <CircleAlert size={16} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.expected} / observed {item.observed}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className={`decision-empty ${order.status === "RELEASED" ? "success" : ""}`}>
          {order.status === "RELEASED" ? <PackageCheck size={28} /> : <Activity size={28} />}
          <strong>{order.status === "RELEASED" ? "All invariants pass" : "No violations recorded"}</strong>
          <span>{order.observation?.summary ?? "Waiting for structured evidence."}</span>
        </div>
      )}
    </section>
  );
}

function RepairPanel({ order }: { order: OrderState }) {
  if (!order.repair) return null;
  return (
    <motion.section
      className="panel repair-panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">Action assigned by Hermes</span>
          <h2>How the error is fixed</h2>
        </div>
        <span className={"repair-state " + order.repair.status.toLowerCase()}>
          {order.repair.status}
        </span>
      </div>
      <div className="repair-summary">{order.repair.summary}</div>
      <div className="repair-steps">
        {order.repair.steps.map((step, index) => (
          <motion.div
            className={step.completed ? "completed" : ""}
            key={step.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <small>0{index + 1}</small>
            {step.completed ? <Check size={15} /> : <Wrench size={15} />}
            <span>{step.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
function ProofFlow({ order }: { order: OrderState }) {
  const inspected = Boolean(order.observation);
  const passed = inspected ? order.manifest.length - order.discrepancies.length : 0;
  const latestAction = order.actions[0];
  const stages = [
    {
      label: "Photo checked",
      value: inspected
        ? `${order.observation?.items.length ?? 0} visible facts / ${Math.round((order.observation?.evidenceConfidence ?? 0) * 100)}%`
        : "Waiting for evidence",
      icon: Camera,
      active: inspected,
    },
    {
      label: "Facts compared",
      value: inspected ? `${passed}/${order.manifest.length} rules pass` : `${order.manifest.length} rules armed`,
      icon: Workflow,
      active: inspected,
    },
    {
      label: "Rule applied",
      value: order.status === "HELD" ? "Block + repair" : order.status === "RELEASED" ? "Release authorized" : "No decision",
      icon: ShieldCheck,
      active: order.status === "HELD" || order.status === "RELEASED",
    },
    {
      label: "Systems updated",
      value: latestAction ? latestAction.label : "No side effect",
      icon: ReceiptText,
      active: Boolean(latestAction),
    },
  ];
  const activeStages = stages.filter((stage) => stage.active).length;

  return (
    <section className="proof-section">
      <div className="proof-heading">
        <div>
          <span className="eyebrow">Why the action was safe</span>
          <h2>Evidence before execution</h2>
        </div>
        <span className="proof-state"><Fingerprint size={14} /> {order.ledger.length} chained records</span>
      </div>
      <div className="proof-layout">
        <div className="proof-flow">
          <motion.span
            className="proof-progress"
            initial={false}
            animate={{ scaleX: Math.max(activeStages / stages.length, 0.03) }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
          />
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div className="proof-step-wrap" key={stage.label}>
                <motion.div
                  className={`proof-step ${stage.active ? "active" : ""}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.28 }}
                >
                  <small>0{index + 1}</small>
                  <Icon size={17} />
                  <span>{stage.label}</span>
                  <strong>{stage.value}</strong>
                </motion.div>
                {index < stages.length - 1 && <ArrowRight className="proof-arrow" size={16} />}
              </div>
            );
          })}
        </div>
        <div className="receipt-list">
          <div className="receipt-title"><ReceiptText size={15} /><span>Actions executed by Hermes</span></div>
          {order.actions.length ? order.actions.slice(0, 3).map((action, index) => (
            <motion.div
              className="receipt-row"
              key={action.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.035 }}
            >
              <CheckCircle2 size={14} />
              <div><strong>{action.target}</strong><span>{action.label}</span></div>
              <code>{action.receipt}</code>
            </motion.div>
          )) : <div className="receipt-empty">Receipts appear only after policy authorizes a side effect.</div>}
          {order.actions.length > 3 && <div className="receipt-more">+{order.actions.length - 3} secured receipts in ledger</div>}
        </div>
      </div>
    </section>
  );
}

function Timeline({ order }: { order: OrderState }) {
  return (
    <section className="timeline-section">
      <div className="timeline-title">
        <div>
          <span className="eyebrow">Live operation</span>
          <h2>What happened</h2>
        </div>
        <div className="ledger-state"><FileCheck2 size={15} /> Ledger verified / {order.ledger.length} entries</div>
      </div>
      <div className="timeline-list">
        {order.events.slice(0, 5).map((entry, index) => (
          <motion.article
            className={`timeline-event tone-${entry.tone}`}
            key={entry.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <motion.span className="event-node" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.035, type: "spring" }} />
            <time>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
            <div>
              <strong>{entry.title}</strong>
              <span>{entry.detail}</span>
            </div>
            <span className="actor">{entry.actor}</span>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function CaptureDialog({ onClose }: { onClose: () => void }) {
  const captureUrl = `${window.location.origin}/capture`;
  return (
    <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="capture-dialog" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" onClick={onClose} title="Close"><X size={18} /></button>
        <Smartphone size={22} />
        <span className="eyebrow">Mobile capture</span>
        <QRCodeSVG value={captureUrl} size={176} bgColor="#f3f3ed" fgColor="#141712" />
        <a href={captureUrl}>Open capture <ExternalLink size={14} /></a>
      </motion.div>
    </motion.div>
  );
}

function Dashboard() {
  const parallax = useParallax();
  const [busy, setBusy] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const replayStopped = useRef(false);

  useEffect(() => () => { replayStopped.current = true; }, []);

  if (!parallax.order) {
    return <div className="boot-screen"><LoaderCircle className="spin" /> Initializing PARALLAX</div>;
  }

  const activeTemplate = parallax.protocols.find(
    (item) => item.protocol.id === parallax.order?.protocol.id,
  );
  const demoReady = activeTemplate?.demoReady ?? false;

  const switchProtocol = async (protocolId: string) => {
    if (protocolId === parallax.order?.protocol.id) return;
    replayStopped.current = true;
    setBusy(true);
    try { await parallax.compileProtocol(protocolId); } finally { setBusy(false); }
  };

  const runFixture = async (fixture: FixtureId) => {
    setBusy(true);
    try { await parallax.inspectFixture(fixture); } finally { setBusy(false); }
  };

  const advanceSimple = async () => {
    if (parallax.order!.status === "RELEASED") {
      setBusy(true);
      try { await parallax.compileProtocol(parallax.order!.protocol.id); } finally { setBusy(false); }
      return;
    }
    if (parallax.order!.status === "AWAITING_EVIDENCE") {
      await runFixture("mismatch");
      return;
    }
    await runFixture("corrected");
  };

  const replay = async () => {
    replayStopped.current = false;
    setBusy(true);
    try {
      await parallax.compileProtocol(parallax.order!.protocol.id);
      await wait(450);
      await parallax.inspectFixture("mismatch");
      await wait(1500);
      if (!replayStopped.current) await parallax.inspectFixture("corrected");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Header connected={parallax.connected} mode={parallax.runtime?.mode} agentLinked={parallax.order.events.some((entry) => entry.actor === "hermes")} mcpTools={parallax.runtime?.mcpTools} visionModel={parallax.runtime?.visionModel} />
      <SimpleExperience
        order={parallax.order}
        protocols={parallax.protocols}
        busy={busy}
        onProtocolChange={(protocolId) => void switchProtocol(protocolId)}
        onAdvance={() => void advanceSimple()}
        onCapture={() => setShowCapture(true)}
        onInspectFixture={(fixture) => void runFixture(fixture)}
      />
      {parallax.error && <div className="error-banner"><CircleAlert size={16} /><span>{parallax.error}</span><button onClick={parallax.clearError}><X size={15} /></button></div>}
      <details className="technical-details">
        <summary>
          <span><Fingerprint size={16} /> Technical proof</span>
          <small>Open the policy, MCP actions and tamper-evident ledger</small>
          <ArrowRight className="tech-arrow" size={18} />
        </summary>
      <div className="operation-bar">
        <div>
          <span className="eyebrow">Operation</span>
          <h1>{parallax.order.id}</h1>
        </div>
        <div className="operation-context">
          <label className="protocol-select">
            <Workflow size={15} />
            <span>Protocol</span>
            <select
              value={parallax.order.protocol.id}
              disabled={busy}
              onChange={(event) => void switchProtocol(event.target.value)}
            >
              {parallax.protocols.map((template) => (
                <option value={template.protocol.id} key={template.protocol.id}>
                  {template.protocol.name}{template.demoReady ? " / visual demo" : " / compiler"}
                </option>
              ))}
            </select>
          </label>
          <div className="operation-meta"><span>{parallax.order.station}</span><span>{parallax.order.destination}</span><span>REV {String(parallax.order.revision).padStart(2, "0")}</span></div>
        </div>

      </div>
      <MissionBrief
        order={parallax.order}
        busy={busy}
        demoReady={demoReady}
        visionModel={parallax.runtime?.visionModel}
        onReplay={replay}
        onCapture={() => setShowCapture(true)}
        onReset={() => void parallax.compileProtocol(parallax.order!.protocol.id)}
      />
      <main>
        <div className="workspace-grid">
          <EvidenceViewport order={parallax.order} />
          <aside className="control-column">
            <Manifest order={parallax.order} />
            <Decision order={parallax.order} />
            <RepairPanel order={parallax.order} />
            <div className="fixture-controls">
              <span>Demo controls</span>
              <button disabled={busy || !demoReady} onClick={() => runFixture("mismatch")}>Show error</button>
              <button disabled={busy || !demoReady} onClick={() => runFixture("unclear")}>Unclear photo</button>
              <button disabled={busy || !demoReady} onClick={() => runFixture("corrected")}>Show correction</button>
            </div>
          </aside>
        </div>
        <ProofFlow order={parallax.order} />
        <AutonomyStrip order={parallax.order} />
        <Timeline order={parallax.order} />
      </main>
      </details>
      <AnimatePresence>{showCapture && <CaptureDialog onClose={() => setShowCapture(false)} />}</AnimatePresence>
    </div>
  );
}

function MobileCapture() {
  const parallax = useParallax();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [videoPreview, setVideoPreview] = useState<string>();
  const [videoFrames, setVideoFrames] = useState<File[]>([]);
  const [framePreviews, setFramePreviews] = useState<string[]>([]);
  const [videoError, setVideoError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    framePreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [videoPreview, framePreviews]);
  const liveEnabled = Boolean(parallax.runtime && parallax.runtime.mode !== "demo");
  const evidencePreview = preview ?? parallax.order?.evidence?.imageUrl;

  const chooseFile = (next?: File) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : undefined);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try { await parallax.inspectUpload(file); } finally { setBusy(false); }
  };

  const useAsReference = async () => {
    if (!file) return;
    setBusy(true);
    try { await parallax.learnReference(file); } finally { setBusy(false); }
  };

  const chooseVideo = async (next?: File) => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    framePreviews.forEach((url) => URL.revokeObjectURL(url));
    setVideoPreview(next ? URL.createObjectURL(next) : undefined);
    setVideoFrames([]);
    setFramePreviews([]);
    setVideoError(undefined);
    if (!next) return;
    setBusy(true);
    try {
      const frames = await extractVideoFrames(next, 4);
      setVideoFrames(frames);
      setFramePreviews(frames.map((frame) => URL.createObjectURL(frame)));
    } catch (reason) {
      setVideoError(reason instanceof Error ? reason.message : "Video extraction failed.");
    } finally {
      setBusy(false);
    }
  };

  const uploadVideo = async () => {
    if (videoFrames.length < 3) return;
    setBusy(true);
    try { await parallax.inspectBurst(videoFrames); } finally { setBusy(false); }
  };

  const fixture = async (id: FixtureId) => {
    setBusy(true);
    try { await parallax.inspectFixture(id); } finally { setBusy(false); }
  };

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <a href="/" className="icon-button" title="Back to dashboard"><ArrowLeft size={19} /></a>
        <strong>PARALLAX / CAPTURE</strong>
        <span className={`connection-dot ${parallax.connected ? "online" : ""}`} />
      </header>
      <main className="mobile-main">
        <section className="mobile-order">
          <span className="eyebrow">Active operation</span>
          <h1>{parallax.order?.id ?? "Loading"}</h1>
          <span>{parallax.order?.protocol.name} / {parallax.order?.station}</span>
        </section>
        <section className="mobile-manifest">
          {parallax.order?.manifest.map((item) => <div key={item.sku}><Check size={14} /><span>{item.quantity}x {item.label}</span><small>{item.color}</small></div>)}
        </section>
        <section className="capture-frame">
          {evidencePreview ? <img src={evidencePreview} alt="Evidence preview" /> : <div><Camera size={42} /><span>NO CAPTURE</span></div>}
        </section>
        <label className="capture-button">
          <Camera size={19} /> Take evidence photo
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
        <button className="primary-button mobile-submit" disabled={!file || !liveEnabled || busy} onClick={upload}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />} Analyze photo
        </button>
        <button className="capture-button mobile-submit" disabled={!file || !liveEnabled || busy} onClick={useAsReference}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />} Set as new reference scenario
        </button>

        <section className="video-evidence">
          <div className="video-heading">
            <Video size={18} />
            <div><strong>Multi-frame video proof</strong><span>Four angles extracted from one short clip</span></div>
          </div>
          {videoPreview && <video src={videoPreview} controls muted playsInline />}
          {framePreviews.length > 0 && (
            <div className="frame-preview-strip">
              {framePreviews.map((url, index) => <img src={url} alt={`Extracted frame ${index + 1}`} key={url} />)}
            </div>
          )}
          <label className="capture-button video-capture-button">
            <Video size={19} /> Record or choose a short video
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              capture="environment"
              onChange={(event) => void chooseVideo(event.target.files?.[0])}
            />
          </label>
          <button className="primary-button mobile-submit" disabled={videoFrames.length < 3 || !liveEnabled || busy} onClick={uploadVideo}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <Video size={18} />} Analyze {videoFrames.length || 4} frames
          </button>
          {videoError && <div className="mobile-error">{videoError}</div>}
        </section>
        {!liveEnabled && <div className="mode-notice"><CircleAlert size={16} /><span>Live vision offline / add NVIDIA or HF credentials</span></div>}
        <section className="mobile-fixtures">
          <span className="eyebrow">Verified fixture replay</span>
          <button disabled={busy} onClick={() => fixture("mismatch")}>Load mismatch</button>
          <button disabled={busy} onClick={() => fixture("corrected")}>Load correction</button>
        </section>
        {parallax.order?.observation && (
          <motion.section
            className={`mobile-result result-${parallax.order.status.toLowerCase()}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <StatusMark status={parallax.order.status} />
            <div>
              <strong>{statusCopy[parallax.order.status].label}</strong>
              <span>{parallax.order.observation.summary}</span>
            </div>
            <small>{Math.round(parallax.order.observation.evidenceConfidence * 100)}%</small>
          </motion.section>
        )}        {parallax.order?.repair?.status === "OPEN" && (
          <section className="mobile-repair">
            <span className="eyebrow">Correction directive</span>
            {parallax.order.repair.steps.map((step) => (
              <div key={step.id}><Wrench size={14} /><span>{step.label}</span></div>
            ))}
          </section>
        )}
        {parallax.error && <div className="mobile-error">{parallax.error}</div>}
      </main>
    </div>
  );
}

export default function App() {
  const isCapture = useMemo(() => window.location.pathname.startsWith("/capture"), []);
  return isCapture ? <MobileCapture /> : <Dashboard />;
}

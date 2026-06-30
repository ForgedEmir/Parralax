import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  Play,
  RefreshCw,
  Smartphone,
  Wrench,
  X,
} from "lucide-react";
import type { FixtureId, OrderState, ProtocolTemplate } from "../shared/types";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function shortHash(value: string) {
  return value.slice(0, 8) + "..." + value.slice(-6);
}

const actionCopy = {
  HOLD_ORDER: "Shipment paused",
  CREATE_CORRECTION_TASK: "Repair task created",
  NOTIFY_OPERATOR: "Operator notified",
  RELEASE_ORDER: "Workflow released",
  UPDATE_INVENTORY: "Inventory updated",
} as const;

const evidenceCatalog: Record<
  string,
  Array<{ fixture: FixtureId; angle: string; label: string; outcome: "BLOCK" | "PASS"; image: string }>
> = {
  "fulfillment-packout-v1": [
    { fixture: "mismatch", angle: "ANGLE A / TOP", label: "Wrong mug + missing card", outcome: "BLOCK", image: "/evidence/package-mismatch.png" },
    { fixture: "corrected", angle: "ANGLE A / TOP", label: "Corrected arrangement", outcome: "PASS", image: "/evidence/package-corrected.png" },
    { fixture: "mismatch-angle", angle: "ANGLE B / 35 DEG", label: "Same errors, new viewpoint", outcome: "BLOCK", image: "/evidence/warehouse-angle-b-mismatch.webp" },
    { fixture: "corrected-angle", angle: "ANGLE B / 35 DEG", label: "Repositioned correction", outcome: "PASS", image: "/evidence/warehouse-angle-b-corrected.webp" },
    { fixture: "damaged", angle: "ANGLE C / DAMAGE", label: "Complete but cracked product", outcome: "BLOCK", image: "/evidence/warehouse-damaged.webp" },
    { fixture: "replacement", angle: "ANGLE C / RECHECK", label: "Intact replacement proven", outcome: "PASS", image: "/evidence/warehouse-replacement.webp" },
  ],
  "field-service-closeout-v1": [
    { fixture: "mismatch", angle: "ANGLE A / FRONT", label: "Closeout controls absent", outcome: "BLOCK", image: "/evidence/hvac-mismatch.png" },
    { fixture: "corrected", angle: "ANGLE A / FRONT", label: "Controls installed", outcome: "PASS", image: "/evidence/hvac-corrected.png" },
    { fixture: "mismatch-angle", angle: "ANGLE B / RIGHT", label: "Same cabinet, side view", outcome: "BLOCK", image: "/evidence/hvac-angle-b-mismatch.webp" },
    { fixture: "corrected-angle", angle: "ANGLE B / RIGHT", label: "Seal and label visible", outcome: "PASS", image: "/evidence/hvac-angle-b-corrected.webp" },
  ],
  "retail-planogram-v1": [
    { fixture: "mismatch", angle: "ANGLE A / FRONT", label: "Missing can + promo tag", outcome: "BLOCK", image: "/evidence/retail-angle-a-mismatch.webp" },
    { fixture: "corrected", angle: "ANGLE A / FRONT", label: "All facings restored", outcome: "PASS", image: "/evidence/retail-angle-a-corrected.webp" },
    { fixture: "mismatch-angle", angle: "ANGLE B / OBLIQUE", label: "Missing water + promo tag", outcome: "BLOCK", image: "/evidence/retail-angle-b-mismatch.webp" },
    { fixture: "corrected-angle", angle: "ANGLE B / OBLIQUE", label: "Different spacing, same rules", outcome: "PASS", image: "/evidence/retail-angle-b-corrected.webp" },
  ],
};

export function SimpleExperience({
  order,
  protocols,
  busy,
  onProtocolChange,
  onAdvance,
  onCapture,
  onInspectFixture,
}: {
  order: OrderState;
  protocols: ProtocolTemplate[];
  busy: boolean;
  onProtocolChange: (protocolId: string) => void;
  onAdvance: () => void;
  onCapture: () => void;
  onInspectFixture: (fixture: FixtureId) => void;
}) {
  const isWarehouse = order.protocol.domain === "Warehouse";
  const isFieldService = order.protocol.domain === "Field service";
  const protectedValue = order.metrics.valueProtected || order.protocol.valueAtRisk;
  const observed = order.observation?.items ?? [];
  const evidenceSamples = evidenceCatalog[order.protocol.id] ?? [];

  const story =
    order.status === "AWAITING_EVIDENCE"
      ? {
          eyebrow: "A REAL-WORLD ACTION IS WAITING",
          title: isWarehouse
            ? "This order is about to ship. Is the box correct?"
            : isFieldService
              ? "This maintenance visit is about to close. Is the work complete?"
              : "This operation is about to complete. Does reality match the plan?",
          detail:
            "PARALLAX must compare one photo with the expected result before Hermes is allowed to continue.",
          verdict: "WAITING",
          verdictDetail: "Nothing has been approved yet.",
          button: isWarehouse ? "Check this package" : "Check this work",
        }
      : order.status === "INSPECTING"
        ? {
            eyebrow: "CAMERA EVIDENCE IS BEING READ",
            title: "The vision model is checking what is really there.",
            detail: "No business action can run while the evidence is being analyzed.",
            verdict: "CHECKING",
            verdictDetail: "Reading objects, labels and quantities.",
            button: "Checking evidence",
          }
        : order.status === "INSUFFICIENT_EVIDENCE"
          ? {
              eyebrow: "THE AGENT REFUSED TO GUESS",
              title: "This photo is not clear enough to prove the work.",
              detail: "The workflow remains stopped until a better photo is provided.",
              verdict: "NEW PHOTO",
              verdictDetail: "Confidence is below the safe threshold.",
              button: "Show a clear photo",
            }
          : order.status === "HELD"
            ? {
                eyebrow: "THE ERROR WAS CAUGHT IN TIME",
                title: isWarehouse
                  ? "No. The box is wrong, so shipping is stopped."
                  : "No. The work is incomplete, so closeout is stopped.",
                detail:
                  "Hermes has already paused the workflow, notified the operator and created the exact repair task.",
                verdict: "STOP",
                verdictDetail: order.discrepancies.length + " real-world errors must be fixed.",
                button: "Show the corrected result",
              }
            : {
                eyebrow: "THE CORRECTION IS PROVEN",
                title: isWarehouse
                  ? "Yes. The box is now correct and shipping can continue."
                  : "Yes. The work is now complete and the visit can close.",
                detail:
                  "A fresh photo now matches every expected item. Hermes safely completed the business workflow.",
                verdict: "CONTINUE",
                verdictDetail: "Every required fact is visually proven.",
                button: "Restart the demo",
              };

  const tone =
    order.status === "HELD"
      ? "danger"
      : order.status === "RELEASED"
        ? "success"
        : order.status === "INSUFFICIENT_EVIDENCE"
          ? "warning"
          : "neutral";

  return (
    <main className={"simple-experience simple-" + tone}>
      <div className="simple-toolbar">
        <div className="simple-operation">
          <span>{order.id}</span>
          <strong>{order.protocol.name}</strong>
          <small>{order.station} / {order.destination}</small>
        </div>
        <label className="simple-protocol">
          <span>Demo scenario</span>
          <select
            value={order.protocol.id}
            disabled={busy}
            onChange={(event) => onProtocolChange(event.target.value)}
          >
            {protocols.filter((item) => item.demoReady).map((item) => (
              <option value={item.protocol.id} key={item.protocol.id}>
                {item.protocol.domain}: {item.protocol.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="simple-intro">
        <AnimatePresence mode="wait">
          <motion.div
            key={story.title}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            <span className="simple-eyebrow">{story.eyebrow}</span>
            <h1>{story.title}</h1>
            <p>{story.detail}</p>
          </motion.div>
        </AnimatePresence>
        <div className="simple-impact">
          <span>{order.metrics.valueProtected ? "Loss prevented" : "Value protected by this check"}</span>
          <strong>{formatMoney(protectedValue, order.protocol.currency)}</strong>
        </div>
      </section>

      <section className="simple-comparison">
        <article className="simple-column expected-column">
          <header>
            <span>1</span>
            <div><small>BUSINESS RECORD</small><h2>What should be there</h2></div>
            <CheckCircle2 size={20} />
          </header>
          <div className="simple-item-list">
            {order.manifest.map((item) => {
              const problem = order.discrepancies.find((entry) => entry.sku === item.sku);
              return (
                <div className={problem ? "problem" : ""} key={item.sku}>
                  <span className="simple-swatch" style={{ background: item.color ?? "#aaa" }} />
                  <div><strong>{item.quantity}x {item.label}</strong><small>{[item.color, item.condition].filter(Boolean).join(" / ") || item.sku}</small></div>
                  {problem ? <X size={18} /> : <Check size={18} />}
                </div>
              );
            })}
          </div>
        </article>

        <ArrowRight className="simple-connector" size={24} />

        <article className="simple-column camera-column">
          <header>
            <span>2</span>
            <div><small>CAMERA EVIDENCE</small><h2>What is actually there</h2></div>
            <Camera size={20} />
          </header>
          <div className="simple-photo">
            {order.evidence ? (
              <motion.img
                key={order.evidence.id}
                src={order.evidence.imageUrl}
                alt="Physical evidence checked by PARALLAX"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            ) : (
              <div className="simple-photo-empty"><Camera size={42} /><span>No photo checked yet</span></div>
            )}
            {order.observation && (
              <span className="simple-confidence">{Math.round(order.observation.evidenceConfidence * 100)}% clear</span>
            )}
          </div>
          <div className="simple-observed">
            {observed.length ? observed.map((item) => (
              <span key={item.sku}><i style={{ background: item.color ?? "#aaa" }} />{item.quantity}x {item.label}{item.condition ? " / " + item.condition : ""}</span>
            )) : <span>Waiting for visual evidence</span>}
          </div>
        </article>

        <ArrowRight className="simple-connector" size={24} />

        <article className={"simple-column verdict-column verdict-" + tone}>
          <header>
            <span>3</span>
            <div><small>SAFE BUSINESS ACTION</small><h2>What PARALLAX decides</h2></div>
            {tone === "danger" ? <LockKeyhole size={20} /> : <PackageCheck size={20} />}
          </header>
          <div className="simple-verdict">
            {tone === "danger" ? <LockKeyhole size={29} /> : tone === "success" ? <PackageCheck size={29} /> : <CircleAlert size={29} />}
            <strong>{story.verdict}</strong>
            <span>{story.verdictDetail}</span>
          </div>

          {order.discrepancies.length > 0 && (
            <div className="simple-problems">
              {order.discrepancies.map((item) => (
                <div key={item.id}><X size={15} /><span><strong>{item.label}</strong>{item.expected} / found {item.observed}</span></div>
              ))}
            </div>
          )}

          {order.repair && (
            <div className="simple-repair">
              <span><Wrench size={14} /> Hermes repair plan</span>
              {order.repair.steps.map((step) => (
                <div key={step.id}>{step.completed ? <Check size={14} /> : <ArrowRight size={14} />} {step.label}</div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="simple-actions">
        <div>
          <span className="simple-eyebrow">WHAT HERMES DID</span>
          <div className="simple-action-list">
            {order.actions.length ? order.actions.slice(0, 5).reverse().map((action) => (
              <span key={action.id}><Check size={14} />{actionCopy[action.type]}</span>
            )) : <span className="pending-action">No business action before proof</span>}
          </div>
        </div>
        <div className="simple-buttons">
          <button className="secondary-button" disabled={busy} onClick={onCapture}><Smartphone size={17} /> Use your phone</button>
          <button className="primary-button simple-next" disabled={busy || order.status === "INSPECTING"} onClick={onAdvance}>
            {busy ? <LoaderCircle className="spin" size={18} /> : order.status === "RELEASED" ? <RefreshCw size={18} /> : <Play size={18} />}
            {story.button}
          </button>
        </div>
      </section>

      {order.evidenceHistory.length > 0 && (
        <section className="evidence-history">
          <header>
            <div>
              <span className="simple-eyebrow">CHAIN OF PHYSICAL CUSTODY</span>
              <h2>Every image that changed the decision remains provable.</h2>
            </div>
            <span>{order.evidenceHistory.length} signed snapshots</span>
          </header>
          <div className="history-track">
            {order.evidenceHistory.map((record, index) => (
              <div className={"history-record history-" + record.decision.toLowerCase()} key={record.id}>
                <div className="history-image">
                  <img src={record.evidence.imageUrl} alt={"Evidence snapshot " + record.sequence} />
                  <span>#{String(record.sequence).padStart(2, "0")}</span>
                </div>
                <div className="history-copy">
                  <small>{new Date(record.evidence.capturedAt).toLocaleTimeString()} / {record.observation.model}</small>
                  <strong>{record.decision}</strong>
                  <p>{record.observation.summary}</p>
                  <code>IMG {shortHash(record.evidence.digest)}</code>
                  <code>LEDGER {shortHash(record.ledgerHash)}</code>
                </div>
                {index < order.evidenceHistory.length - 1 && <ArrowRight className="history-arrow" size={19} />}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="benchmark-section">
        <header className="benchmark-heading">
          <div>
            <span className="simple-eyebrow">VISUAL ROBUSTNESS BENCHMARK</span>
            <h2>Same rules. Different jobs, angles and object positions.</h2>
            <p>Select any evidence sample. PARALLAX must reach the same policy outcome even when the camera moves.</p>
          </div>
          <div className="coverage-metrics">
            <span><strong>03</strong> jobs</span>
            <span><strong>14</strong> views</span>
            <span><strong>02</strong> angles each</span>
            <span><strong>01</strong> policy engine</span>
          </div>
        </header>
        <div className="benchmark-grid">
          {evidenceSamples.map((sample) => (
            <button
              className={"benchmark-sample " + (order.evidence?.fixture === sample.fixture ? "active" : "")}
              key={sample.fixture}
              disabled={busy}
              onClick={() => onInspectFixture(sample.fixture)}
            >
              <span className={"sample-outcome outcome-" + sample.outcome.toLowerCase()}>{sample.outcome}</span>
              <img src={sample.image} alt={sample.label} />
              <span className="sample-angle">{sample.angle}</span>
              <strong>{sample.label}</strong>
              <small>{sample.fixture.includes("angle") ? "Perspective variant" : "Reference view"}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
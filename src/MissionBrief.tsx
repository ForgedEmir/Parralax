import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Play,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import type { OrderState } from "../shared/types";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

export function MissionBrief({
  order,
  busy,
  demoReady,
  visionModel,
  onReplay,
  onCapture,
  onReset,
}: {
  order: OrderState;
  busy: boolean;
  demoReady: boolean;
  visionModel?: string;
  onReplay: () => void;
  onCapture: () => void;
  onReset: () => void;
}) {
  const isWarehouse = order.protocol.domain === "Warehouse";
  const isFieldService = order.protocol.domain === "Field service";
  const question = isWarehouse
    ? "Can this package leave without creating a return?"
    : isFieldService
      ? "Can this maintenance visit be safely closed?"
      : "Does the physical result match the approved plan?";
  const detected = order.discrepancies.map((item) => item.label.toLowerCase()).join(" and ");
  const narrative =
    order.status === "AWAITING_EVIDENCE"
      ? {
          kicker: "MISSION READY",
          title: question,
          detail:
            "Hermes will compare a camera image with the business record before any irreversible action is allowed.",
        }
      : order.status === "INSPECTING"
        ? {
            kicker: "NEMOTRON IS LOOKING",
            title: "The agent is checking what is physically true.",
            detail:
              "Visible objects, quantities, labels and confidence are becoming structured evidence.",
          }
        : order.status === "INSUFFICIENT_EVIDENCE"
          ? {
              kicker: "NO GUESSING",
              title: "The image cannot prove the work was completed.",
              detail:
                "PARALLAX stopped the workflow and requested clearer evidence instead of inventing an answer.",
            }
          : order.status === "HELD"
            ? {
                kicker: "ERROR CAUGHT BEFORE EXECUTION",
                title: isWarehouse
                  ? "A wrong shipment was stopped before it left."
                  : "Incomplete field work was stopped before closeout.",
                detail: detected
                  ? `The evidence contradicts the record: ${detected}. Hermes created the minimum correction plan.`
                  : "The evidence contradicts the business record. Hermes created the minimum correction plan.",
              }
            : {
                kicker: "CORRECTION PROVEN",
                title: isWarehouse
                  ? "The package is now correct and can ship."
                  : "The work is now proven and can be closed.",
                detail:
                  "Fresh evidence passes every rule. Hermes executed the authorized actions and recorded the proof.",
              };

  const stages = [
    {
      index: "01",
      label: "See what is real",
      detail: order.observation
        ? `${Math.round(order.observation.evidenceConfidence * 100)}% evidence confidence`
        : visionModel?.split("/").at(-1)?.replace("-Reasoning", "") ?? "NVIDIA vision",
      active: Boolean(order.observation),
    },
    {
      index: "02",
      label: "Stop and repair",
      detail:
        order.status === "HELD"
          ? `${order.discrepancies.length} errors found`
          : order.repair?.status === "RESOLVED"
            ? "Correction verified"
            : "Rules standing by",
      active: order.status === "HELD" || Boolean(order.repair),
    },
    {
      index: "03",
      label: "Execute safely",
      detail:
        order.status === "RELEASED"
          ? `${order.actions.length} actions completed`
          : "Blocked until proven",
      active: order.status === "RELEASED",
    },
  ];
  const protectedValue = order.metrics.valueProtected || order.protocol.valueAtRisk;

  return (
    <section className={`mission-brief mission-${order.status.toLowerCase()}`}>
      <div className="mission-story">
        <motion.span
          key={narrative.kicker}
          className="mission-kicker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {narrative.kicker}
        </motion.span>
        <AnimatePresence mode="wait">
          <motion.div
            key={narrative.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <h1>{narrative.title}</h1>
            <p>{narrative.detail}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mission-actions">
          <button
            className="primary-button mission-run"
            disabled={busy || !demoReady}
            onClick={onReplay}
          >
            {busy ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}
            {busy
              ? "Agent working"
              : demoReady
                ? "Watch the agent catch and fix an error"
                : "Protocol compiler only"}
          </button>
          <button className="secondary-button" disabled={busy} onClick={onCapture}>
            <Smartphone size={16} /> Use phone camera
          </button>
          <button className="icon-button" title="Reset operation" disabled={busy} onClick={onReset}>
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      <div className="mission-flow" aria-label="Autonomous operation progress">
        {stages.map((stage) => (
          <motion.div
            className={`mission-stage ${stage.active ? "active" : ""}`}
            key={stage.index}
            layout
          >
            <span>{stage.index}</span>
            <div>
              <strong>{stage.label}</strong>
              <small>{stage.detail}</small>
            </div>
            {stage.active ? <CheckCircle2 size={19} /> : <ArrowRight size={18} />}
          </motion.div>
        ))}
        <div className="mission-impact">
          <span>{order.metrics.valueProtected ? "Loss prevented" : "Value currently at risk"}</span>
          <strong>{formatMoney(protectedValue, order.protocol.currency)}</strong>
          <small>No release without proof</small>
        </div>
      </div>
    </section>
  );
}
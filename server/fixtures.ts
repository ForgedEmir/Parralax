import type { FixtureId, Observation } from "../shared/types.js";

interface FixtureSet {
  images: Partial<Record<FixtureId, string>>;
  observations: Partial<Record<FixtureId, Observation>>;
}

function angleVariant(observation: Observation, summary?: string): Observation {
  return {
    ...observation,
    summary: summary ?? observation.summary,
    model: "Hermes benchmark replay / angle B",
    latencyMs: observation.latencyMs + 96,
    items: observation.items.map((item) => ({ ...item })),
    notes: [...observation.notes, "Alternate camera angle"],
  };
}

const warehouseMismatch: Observation = {
  summary: "Package contains the wrong mug variant and no warranty card.",
  evidenceConfidence: 0.96,
  model: "Hermes benchmark replay / angle A",
  latencyMs: 842,
  notes: ["Open carton fully visible", "No occlusion detected"],
  items: [
    { sku: "MUG-RED-01", label: "Ceramic mug", quantity: 1, color: "blue", condition: "intact", confidence: 0.98 },
    { sku: "CBL-USBC-2M", label: "USB-C cable", quantity: 1, color: "black", confidence: 0.97 },
  ],
};

const warehouseCorrected: Observation = {
  summary: "All expected items and attributes are visible in the package.",
  evidenceConfidence: 0.98,
  model: "Hermes benchmark replay / angle A",
  latencyMs: 711,
  notes: ["Open carton fully visible", "All item boundaries visible"],
  items: [
    { sku: "MUG-RED-01", label: "Ceramic mug", quantity: 1, color: "red", condition: "intact", confidence: 0.99 },
    { sku: "CBL-USBC-2M", label: "USB-C cable", quantity: 1, color: "black", confidence: 0.98 },
    { sku: "DOC-WARRANTY", label: "Warranty card", quantity: 1, color: "white", confidence: 0.96 },
  ],
};

const warehouseUnclear: Observation = {
  summary: "The image does not provide enough reliable evidence for a decision.",
  evidenceConfidence: 0.41,
  model: "Hermes benchmark replay / low confidence",
  latencyMs: 603,
  notes: ["Package boundary partially obscured", "Retake from directly above"],
  items: [],
};

const warehouseDamaged: Observation = {
  summary: "All required items are present, but the red mug is visibly cracked and chipped.",
  evidenceConfidence: 0.99,
  model: "Hermes benchmark replay / condition inspection",
  latencyMs: 936,
  notes: ["Crack visible from rim to base", "Chipped rim visible"],
  items: [
    { sku: "MUG-RED-01", label: "Ceramic mug", quantity: 1, color: "red", condition: "damaged", confidence: 0.99 },
    { sku: "CBL-USBC-2M", label: "USB-C cable", quantity: 1, color: "black", confidence: 0.98 },
    { sku: "DOC-WARRANTY", label: "Warranty card", quantity: 1, color: "white", confidence: 0.97 },
  ],
};

const warehouseReplacement: Observation = {
  ...warehouseCorrected,
  summary: "The damaged mug has been replaced; all required items are present and intact.",
  model: "Hermes benchmark replay / replacement inspection",
  latencyMs: 814,
  notes: ["Replacement mug surface and rim are intact", "Same camera angle as damage evidence"],
};

const warehouseObservations: Record<FixtureId, Observation> = {
  mismatch: warehouseMismatch,
  corrected: warehouseCorrected,
  unclear: warehouseUnclear,
  "mismatch-angle": angleVariant(warehouseMismatch, "The alternate view confirms a blue mug and missing warranty card."),
  "corrected-angle": angleVariant(warehouseCorrected, "The alternate view confirms all three required package contents."),
  damaged: warehouseDamaged,
  replacement: warehouseReplacement,
};

export const fixtureObservations = warehouseObservations;

const fieldMismatch: Observation = {
  summary: "The replacement filter is installed, but closeout controls are missing.",
  evidenceConfidence: 0.97,
  model: "Hermes benchmark replay / angle A",
  latencyMs: 918,
  notes: ["HVAC service bay fully visible", "Seal edge and cabinet face are unobstructed"],
  items: [
    { sku: "FILTER-HEPA-12", label: "Replacement filter", quantity: 1, color: "white", confidence: 0.99 },
  ],
};

const fieldCorrected: Observation = {
  summary: "The filter, red safety seal, and service label are all visible.",
  evidenceConfidence: 0.98,
  model: "Hermes benchmark replay / angle A",
  latencyMs: 806,
  notes: ["Fresh evidence captured after correction", "Every closeout control is visible"],
  items: [
    { sku: "FILTER-HEPA-12", label: "Replacement filter", quantity: 1, color: "white", confidence: 0.99 },
    { sku: "SEAL-SAFETY-R", label: "Safety seal", quantity: 1, color: "red", confidence: 0.98 },
    { sku: "LABEL-SERVICE", label: "Service label", quantity: 1, color: "white", confidence: 0.97 },
  ],
};

const fieldUnclear: Observation = {
  summary: "The cabinet controls are not visible enough to close the visit.",
  evidenceConfidence: 0.38,
  model: "Hermes benchmark replay / low confidence",
  latencyMs: 641,
  notes: ["Service panel boundary is obscured", "Retake the full cabinet face"],
  items: [],
};

const fieldServiceObservations: Partial<Record<FixtureId, Observation>> = {
  mismatch: fieldMismatch,
  corrected: fieldCorrected,
  unclear: fieldUnclear,
  "mismatch-angle": angleVariant(fieldMismatch, "The side view confirms the filter but no seal or service label."),
  "corrected-angle": angleVariant(fieldCorrected, "The side view confirms the filter, seal, and service label."),
};

const retailMismatchFront: Observation = {
  summary: "The shelf has one missing red can facing and no promotional tag.",
  evidenceConfidence: 0.97,
  model: "Hermes benchmark replay / frontal",
  latencyMs: 784,
  notes: ["Both product rows visible", "Shelf rail visible"],
  items: [
    { sku: "SKU-COLA-RED", label: "Cola facing", quantity: 3, color: "red", confidence: 0.99 },
    { sku: "SKU-WATER-BLUE", label: "Water facing", quantity: 4, color: "blue", confidence: 0.98 },
  ],
};

const retailCorrectedFront: Observation = {
  summary: "All product facings and the yellow promotion tag match the planogram.",
  evidenceConfidence: 0.99,
  model: "Hermes benchmark replay / frontal",
  latencyMs: 748,
  notes: ["Every facing countable", "Promotion rail unobstructed"],
  items: [
    { sku: "SKU-COLA-RED", label: "Cola facing", quantity: 4, color: "red", confidence: 0.99 },
    { sku: "SKU-WATER-BLUE", label: "Water facing", quantity: 4, color: "blue", confidence: 0.99 },
    { sku: "TAG-PROMO-YELLOW", label: "Promotion tag", quantity: 1, color: "yellow", confidence: 0.98 },
  ],
};

const retailMismatchOblique: Observation = {
  summary: "The oblique view shows one missing water facing and no promotion tag.",
  evidenceConfidence: 0.95,
  model: "Hermes benchmark replay / oblique",
  latencyMs: 871,
  notes: ["Perspective-adjusted counting", "All four red facings visible"],
  items: [
    { sku: "SKU-COLA-RED", label: "Cola facing", quantity: 4, color: "red", confidence: 0.97 },
    { sku: "SKU-WATER-BLUE", label: "Water facing", quantity: 3, color: "blue", confidence: 0.94 },
  ],
};

const retailCorrectedOblique: Observation = {
  summary: "The oblique view confirms all eight facings and the promotion tag.",
  evidenceConfidence: 0.97,
  model: "Hermes benchmark replay / oblique",
  latencyMs: 825,
  notes: ["Perspective-adjusted counting", "Shelf rail and tag visible"],
  items: [
    { sku: "SKU-COLA-RED", label: "Cola facing", quantity: 4, color: "red", confidence: 0.98 },
    { sku: "SKU-WATER-BLUE", label: "Water facing", quantity: 4, color: "blue", confidence: 0.97 },
    { sku: "TAG-PROMO-YELLOW", label: "Promotion tag", quantity: 1, color: "yellow", confidence: 0.96 },
  ],
};

const retailObservations: Partial<Record<FixtureId, Observation>> = {
  mismatch: retailMismatchFront,
  corrected: retailCorrectedFront,
  unclear: {
    summary: "Glare prevents reliable facing counts.",
    evidenceConfidence: 0.43,
    model: "Hermes benchmark replay / low confidence",
    latencyMs: 618,
    notes: ["Retake square to shelf", "Avoid reflective glare"],
    items: [],
  },
  "mismatch-angle": retailMismatchOblique,
  "corrected-angle": retailCorrectedOblique,
};

const fixtureSets: Record<string, FixtureSet> = {
  "fulfillment-packout-v1": {
    images: {
      mismatch: "/evidence/package-mismatch.png",
      corrected: "/evidence/package-corrected.png",
      unclear: "/evidence/package-mismatch.png",
      "mismatch-angle": "/evidence/warehouse-angle-b-mismatch.webp",
      "corrected-angle": "/evidence/warehouse-angle-b-corrected.webp",
      damaged: "/evidence/warehouse-damaged.webp",
      replacement: "/evidence/warehouse-replacement.webp",
    },
    observations: warehouseObservations,
  },
  "field-service-closeout-v1": {
    images: {
      mismatch: "/evidence/hvac-mismatch.png",
      corrected: "/evidence/hvac-corrected.png",
      unclear: "/evidence/hvac-mismatch.png",
      "mismatch-angle": "/evidence/hvac-angle-b-mismatch.webp",
      "corrected-angle": "/evidence/hvac-angle-b-corrected.webp",
    },
    observations: fieldServiceObservations,
  },
  "retail-planogram-v1": {
    images: {
      mismatch: "/evidence/retail-angle-a-mismatch.webp",
      corrected: "/evidence/retail-angle-a-corrected.webp",
      unclear: "/evidence/retail-angle-a-mismatch.webp",
      "mismatch-angle": "/evidence/retail-angle-b-mismatch.webp",
      "corrected-angle": "/evidence/retail-angle-b-corrected.webp",
    },
    observations: retailObservations,
  },
};

export const demoReadyProtocols = new Set(Object.keys(fixtureSets));

export function fixtureFor(protocolId: string, fixture: FixtureId) {
  const set = fixtureSets[protocolId];
  if (!set) {
    throw new Error("Protocol " + protocolId + " has no verified visual fixture.");
  }
  const imageUrl = set.images[fixture];
  const observation = set.observations[fixture];
  if (!imageUrl || !observation) {
    throw new Error("Fixture " + fixture + " is not available for protocol " + protocolId + ".");
  }
  return { imageUrl, observation };
}
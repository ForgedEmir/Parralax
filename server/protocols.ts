import { z } from "zod";
import type { OperationDefinition } from "../shared/types.js";

export const operationDefinitionSchema = z.object({
  operationId: z.string().min(3).max(80),
  station: z.string().min(2).max(80),
  destination: z.string().min(2).max(120),
  protocol: z.object({
    id: z.string().min(3).max(80),
    name: z.string().min(3).max(120),
    version: z.string().min(1).max(20),
    domain: z.string().min(2).max(80),
    objective: z.string().min(8).max(240),
    valueAtRisk: z.number().nonnegative().max(10_000_000),
    currency: z.string().length(3).transform((value) => value.toUpperCase()),
  }),
  manifest: z
    .array(
      z.object({
        sku: z.string().min(2).max(80),
        label: z.string().min(2).max(120),
        quantity: z.number().int().positive().max(10_000),
        color: z.string().min(2).max(40).optional(),
        condition: z.string().min(2).max(40).optional(),
      }),
    )
    .min(1)
    .max(100),
});

export const protocolTemplates: OperationDefinition[] = [
  {
    operationId: "PX-2406-1842",
    station: "PACK / 04",
    destination: "Brussels, BE",
    protocol: {
      id: "fulfillment-packout-v1",
      name: "Fulfillment pack-out",
      version: "1.0",
      domain: "Warehouse",
      objective: "Release only packages whose physical contents match the digital order manifest.",
      valueAtRisk: 84.5,
      currency: "EUR",
    },
    manifest: [
      { sku: "MUG-RED-01", label: "Ceramic mug", quantity: 1, color: "red", condition: "intact" },
      { sku: "CBL-USBC-2M", label: "USB-C cable", quantity: 1, color: "black" },
      { sku: "DOC-WARRANTY", label: "Warranty card", quantity: 1, color: "white" },
    ],
  },
  {
    operationId: "FS-8891",
    station: "FIELD / HVAC-12",
    destination: "Antwerp, BE",
    protocol: {
      id: "field-service-closeout-v1",
      name: "Field service closeout",
      version: "1.0",
      domain: "Field service",
      objective: "Close a maintenance visit only when replacement parts and safety seals are visible.",
      valueAtRisk: 1250,
      currency: "EUR",
    },
    manifest: [
      { sku: "FILTER-HEPA-12", label: "Replacement filter", quantity: 1, color: "white" },
      { sku: "SEAL-SAFETY-R", label: "Safety seal", quantity: 1, color: "red" },
      { sku: "LABEL-SERVICE", label: "Service label", quantity: 1, color: "white" },
    ],
  },
  {
    operationId: "RT-PLANOGRAM-27",
    station: "AISLE / 07",
    destination: "Ghent, BE",
    protocol: {
      id: "retail-planogram-v1",
      name: "Retail shelf compliance",
      version: "1.0",
      domain: "Retail",
      objective: "Approve a shelf reset only when every expected product facing is present.",
      valueAtRisk: 430,
      currency: "EUR",
    },
    manifest: [
      { sku: "SKU-COLA-RED", label: "Cola facing", quantity: 4, color: "red" },
      { sku: "SKU-WATER-BLUE", label: "Water facing", quantity: 4, color: "blue" },
      { sku: "TAG-PROMO-YELLOW", label: "Promotion tag", quantity: 1, color: "yellow" },
    ],
  },
];

export const defaultOperation = protocolTemplates[0];

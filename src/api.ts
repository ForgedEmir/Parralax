import { useCallback, useEffect, useState } from "react";
import type { FixtureId, OrderState, ProtocolTemplate, RuntimeInfo } from "../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed: ${response.status}`);
  }
  return body as T;
}

export function useParallax() {
  const [order, setOrder] = useState<OrderState>();
  const [runtime, setRuntime] = useState<RuntimeInfo>();
  const [protocols, setProtocols] = useState<ProtocolTemplate[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    Promise.all([
      request<OrderState>("/api/order"),
      request<RuntimeInfo>("/api/runtime"),
      request<ProtocolTemplate[]>("/api/protocols"),
    ])
      .then(([initialOrder, runtimeInfo, protocolTemplates]) => {
        if (!active) return;
        setOrder(initialOrder);
        setRuntime(runtimeInfo);
        setProtocols(protocolTemplates);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load PARALLAX.");
      });

    const stream = new EventSource("/api/events");
    stream.onopen = () => setConnected(true);
    stream.onmessage = (event) => setOrder(JSON.parse(event.data) as OrderState);
    stream.onerror = () => setConnected(false);

    return () => {
      active = false;
      stream.close();
    };
  }, []);

  const inspectFixture = useCallback(async (fixture: FixtureId) => {
    setError(undefined);
    try {
      const result = await request<{ state: OrderState }>("/api/order/inspect-fixture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixture }),
      });
      setOrder(result.state);
      return result.state;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Inspection failed.";
      setError(message);
      throw reason;
    }
  }, []);

  const inspectUpload = useCallback(async (file: File) => {
    setError(undefined);
    const data = new FormData();
    data.set("evidence", file);
    try {
      const result = await request<{ state: OrderState }>("/api/order/inspect-upload", {
        method: "POST",
        body: data,
      });
      setOrder(result.state);
      return result.state;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Inspection failed.";
      setError(message);
      throw reason;
    }
  }, []);

  const inspectBurst = useCallback(async (frames: File[]) => {
    setError(undefined);
    const data = new FormData();
    frames.forEach((frame, index) => data.append("frames", frame, `frame-${index + 1}.jpg`));
    try {
      const result = await request<{ state: OrderState }>("/api/order/inspect-burst", {
        method: "POST",
        body: data,
      });
      setOrder(result.state);
      return result.state;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Video inspection failed.";
      setError(message);
      throw reason;
    }
  }, []);

  const learnReference = useCallback(async (file: File) => {
    setError(undefined);
    const data = new FormData();
    data.set("evidence", file);
    try {
      const result = await request<{ state: OrderState }>("/api/order/learn-reference", {
        method: "POST",
        body: data,
      });
      setOrder(result.state);
      return result.state;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not learn the reference photo.";
      setError(message);
      throw reason;
    }
  }, []);

  const compileProtocol = useCallback(async (protocolId: string) => {
    setError(undefined);
    const template = protocols.find((item) => item.protocol.id === protocolId);
    if (!template) throw new Error("Unknown protocol template.");
    const { invariantCount: _invariantCount, demoReady: _demoReady, ...definition } = template;
    const next = await request<OrderState>("/api/order/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(definition),
    });
    setOrder(next);
    return next;
  }, [protocols]);

  const reset = useCallback(async () => {
    setError(undefined);
    const next = await request<OrderState>("/api/order/reset", { method: "POST" });
    setOrder(next);
    return next;
  }, []);

  return {
    order,
    runtime,
    protocols,
    connected,
    error,
    clearError: () => setError(undefined),
    inspectFixture,
    inspectUpload,
    inspectBurst,
    learnReference,
    compileProtocol,
    reset,
  };
}

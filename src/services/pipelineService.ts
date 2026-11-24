/**
 * Client for the STAC/Dask assessment pipelines exposed by adminPlugin.
 *
 * Flow:  GEE preview (fast tiles on map)  →  user clicks "Télécharger"
 *        →  POST /__admin/fire-assessment or flood-assessment starts the
 *           full-resolution pipeline  →  poll GET for progress  →  when
 *           finished the COG is on GeoServer and downloadable via WCS.
 */

export interface PipelineState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  log: string[];
  params: Record<string, unknown> | null;
}

export type PipelineKind = "fire" | "flood";

const ENDPOINTS: Record<PipelineKind, string> = {
  fire: "/__admin/fire-assessment",
  flood: "/__admin/flood-assessment",
};

export async function startPipeline(
  kind: PipelineKind,
  params: Record<string, unknown>,
): Promise<PipelineState> {
  const response = await fetch(ENDPOINTS[kind], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (response.status === 409) {
    const data = await response.json();
    throw new Error(data.error ?? "Un traitement est déjà en cours");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<PipelineState>;
}

export async function pollPipeline(kind: PipelineKind): Promise<PipelineState> {
  const response = await fetch(ENDPOINTS[kind]);
  return response.json() as Promise<PipelineState>;
}

export async function cancelPipeline(kind: PipelineKind): Promise<void> {
  await fetch(ENDPOINTS[kind], { method: "DELETE" });
}

/**
 * Start polling the pipeline every `intervalMs` and call `onUpdate` with each
 * state.  Returns a stop function.  Stops automatically when `running` becomes
 * false.
 */
export function watchPipeline(
  kind: PipelineKind,
  onUpdate: (state: PipelineState) => void,
  intervalMs = 3000,
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const state = await pollPipeline(kind);
      if (stopped) return;
      onUpdate(state);
      if (!state.running) stop();
    } catch {
      // Network blip — keep polling
    }
  };

  const stop = () => {
    stopped = true;
    if (timer !== null) { clearInterval(timer); timer = null; }
  };

  timer = setInterval(tick, intervalMs);
  tick();

  return stop;
}

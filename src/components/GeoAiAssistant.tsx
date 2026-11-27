import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReactECharts from "echarts-for-react";

interface InlineChart {
  type: "inline_chart";
  chart_type: "bar" | "line" | "pie";
  title?: string;
  option: Record<string, unknown>;
}

type Message = { role: "user" | "assistant"; text: string; error?: boolean; charts?: InlineChart[] };

function inlineChartHeight(chart: InlineChart): number {
  if (chart.chart_type === "pie") return 240;
  if (chart.chart_type !== "bar") return 220;
  const yAxis = chart.option.yAxis as { data?: unknown[] } | undefined;
  const rows = yAxis?.data?.length ?? 0;
  return Math.min(430, Math.max(230, 86 + rows * 25));
}

function DownloadableChart({ chart }: { chart: InlineChart }) {
  const chartRef = useRef<ReactECharts | null>(null);
  const xAxis = chart.option.xAxis as Record<string, unknown> | undefined;
  const compactOption = xAxis?.type === "value" ? {
    ...chart.option,
    xAxis: {
      ...xAxis,
      splitNumber: 4,
      axisLabel: {
        ...(xAxis.axisLabel as Record<string, unknown> | undefined),
        fontSize: 9,
        hideOverlap: true,
        formatter: (value: number) => new Intl.NumberFormat("fr-FR", {
          notation: Math.abs(value) >= 1000 ? "compact" : "standard",
          maximumFractionDigits: 1,
        }).format(value),
      },
    },
  } : chart.option;

  function downloadChart() {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const href = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    const filename = (chart.title || "graphique-geoai")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    const link = document.createElement("a");
    link.href = href;
    link.download = `${filename || "graphique-geoai"}.png`;
    link.click();
  }

  return (
    <div className="c2-geoai-chart">
      <div className="c2-geoai-chart-heading">
        {chart.title && <div className="c2-geoai-chart-title">{chart.title}</div>}
        <button type="button" className="c2-geoai-chart-download" onClick={downloadChart} title="Télécharger le graphique en PNG" aria-label="Télécharger le graphique en PNG">↓ PNG</button>
      </div>
      <ReactECharts
        ref={chartRef}
        option={compactOption}
        style={{ height: inlineChartHeight(chart), width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}

function precipitationFallback(question: string) {
  const normalized = question.toLocaleLowerCase("fr");
  const asksForRain = /pluie|pr[ée]cipitation/.test(normalized);
  const asksForForecast = /pr[ée]vision|prochain|venir|jours?/.test(normalized);
  if (!asksForRain || !asksForForecast) return null;
  return {
    answer: "J'affiche la dernière prévision de précipitations disponible pour les 10 prochains jours. La couche et sa date de prévision sont sélectionnées directement dans le catalogue GEOSSIA.",
    actions: [{ type: "show_layer", indicator_id: "rain_fcst_10d" }],
  };
}

async function fetchStreaming(
  requestBody: string,
  onStep: (label: string) => void,
): Promise<Record<string, unknown>> {
  const response = await fetch("/__geoai/agent/respond-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Record<string, unknown> | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    let eventType = "step";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (eventType === "step" && data.label) {
            onStep(data.label);
          } else if (eventType === "result" && data.payload) {
            result = data.payload;
          }
        } catch { /* ignore malformed SSE line */ }
        eventType = "step";
      }
    }
  }
  if (!result || !result.answer) throw new Error("Réponse vide");
  return result;
}

export default function GeoAiAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, stepLabel]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value || loading) return;
    const history = messages.map((message) => ({ role: message.role, content: message.text })).slice(-8);
    setMessages((current) => [...current, { role: "user", text: value }]);
    setQuestion("");
    setLoading(true);
    setStepLabel("");
    try {
      const lastUserMsg = [...messages].reverse().find((message) => message.role === "user");
      const enrichedQuestion = value.length < 60 && lastUserMsg
        ? `(suite de : « ${lastUserMsg.text.slice(0, 200)} ») ${value}`
        : value;
      let spatialContext: Record<string, unknown> = {};
      try {
        spatialContext = JSON.parse(sessionStorage.getItem("c2-geoai-spatial-context") ?? "{}") as Record<string, unknown>;
      } catch { /* ignore an obsolete/corrupt session value */ }
      const requestBody = JSON.stringify({
        question: enrichedQuestion,
        history,
        active_context: {
          application: "frontend-c2",
          path: window.location.pathname,
          language: "fr",
          spatial: spatialContext,
        },
      });

      let payload: Record<string, unknown> | null = null;
      try {
        payload = await fetchStreaming(requestBody, setStepLabel);
      } catch {
        const response = await fetch("/__geoai/agent/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
          signal: AbortSignal.timeout(180_000),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || result.reason || `HTTP ${response.status}`);
        if (!result.answer) throw new Error(result.reason || "Réponse vide");
        payload = result;
      }

      const inlineCharts: InlineChart[] = (Array.isArray(payload!.actions) ? payload!.actions : [])
        .filter((action: Record<string, unknown>) => action.type === "inline_chart" && action.option) as InlineChart[];
      setMessages((current) => [...current, {
        role: "assistant",
        text: String(payload!.answer),
        ...(inlineCharts.length ? { charts: inlineCharts } : {}),
      }]);
      if (location.pathname.startsWith("/geoportail")) {
        const request = { actions: Array.isArray(payload!.actions) ? payload!.actions : [], question: enrichedQuestion };
        sessionStorage.setItem("c2-geoai-actions", JSON.stringify(request));
        window.dispatchEvent(new CustomEvent("c2:geoai-actions", { detail: request }));
      }
    } catch {
      const fallback = precipitationFallback(value);
      if (fallback) {
        const request = { actions: fallback.actions, question: value };
        setMessages((current) => [...current, { role: "assistant", text: fallback.answer }]);
        sessionStorage.setItem("c2-geoai-actions", JSON.stringify(request));
        window.dispatchEvent(new CustomEvent("c2:geoai-actions", { detail: request }));
        if (!location.pathname.startsWith("/geoportail")) navigate("/geoportail");
      } else {
        setMessages((current) => [...current, {
          role: "assistant",
          text: "La connexion à GeoAI a été interrompue. Veuillez réessayer dans un instant.",
          error: true,
        }]);
      }
    } finally {
      setLoading(false);
      setStepLabel("");
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className={`c2-geoai${open ? " is-open" : ""}`}>
      {open && (
        <aside className="c2-geoai-panel" aria-label="Assistant GeoAI">
          <header>
            <div><span className="c2-geoai-pulse" /><strong>GeoAI</strong><small>Assistant climat & territoires</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
          </header>
          <div className="c2-geoai-messages">
            {messages.length === 0 && (
              <div className="c2-geoai-welcome">
                <strong>Comment puis-je vous aider ?</strong>
                <p>Interrogez le catalogue, les indicateurs et les produits géospatiaux de GEOSSIA.</p>
                <button type="button" onClick={() => setQuestion("Affiche la dernière décade CHIRPS disponible")}>Dernière décade CHIRPS</button>
                <button type="button" onClick={() => setQuestion("Quels produits climatiques sont disponibles ?")}>Produits disponibles</button>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`c2-geoai-message ${message.role}${message.error ? " error" : ""}`}>
                {message.role === "assistant" && !message.error
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                  : message.text}
                {message.charts && message.charts.length > 0 && (
                  <div className="c2-geoai-charts">
                    {message.charts.map((chart, chartIndex) => <DownloadableChart key={chartIndex} chart={chart} />)}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="c2-geoai-loading">
                <div className="c2-geoai-dots"><i /><i /><i /></div>
                {stepLabel && <span className="c2-geoai-step">{stepLabel}</span>}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={submit}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={submitOnEnter}
              placeholder="Posez votre question…"
              disabled={loading}
              rows={1}
              wrap="soft"
              aria-label="Question pour GeoAI"
            />
            <button type="submit" disabled={!question.trim() || loading} aria-label="Envoyer">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          <small className="c2-geoai-note">Les réponses sont fondées sur le catalogue GEOSSIA.</small>
        </aside>
      )}
      <button className="c2-geoai-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-label="Ouvrir GeoAI">
        <span>✦</span><b>GeoAI</b>
      </button>
    </div>
  );
}

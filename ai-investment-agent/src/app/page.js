"use client";

import { useCallback, useEffect, useState } from "react";

const LOADING_STEPS = [
  "Initializing Graph State...",
  "Querying Market Fundamentals via Yahoo Finance...",
  "Scraping Global Sentiment via Tavily API...",
  "Executing 70B Multi-Step Financial Evaluation...",
];

function StatusDot({ active }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-600"
      }`}
      aria-hidden="true"
    />
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-zinc-500"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M22 20V8" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % LOADING_STEPS.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [loading]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const trimmedName = companyName.trim();
      if (!trimmedName || loading) {
        return;
      }

      setLoading(true);
      setError("");
      setResult(null);

      try {
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: trimmedName }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Research request failed.");
        }

        setResult(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred."
        );
      } finally {
        setLoading(false);
      }
    },
    [companyName, loading]
  );

  const isInvest = result?.decision === "Invest";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-8 sm:px-8 lg:px-12">
        <header className="mb-12 flex flex-col gap-6 border-b border-zinc-800/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-emerald-400/80">
              Autonomous Research Terminal
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              AlphaBot // Autonomous Investment Research
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              Multi-agent LangGraph pipeline synthesizing live market fundamentals
              and global sentiment into institutional-grade investment verdicts.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm sm:min-w-[320px]">
            <div className="flex items-center gap-3 text-sm">
              <StatusDot active />
              <span className="font-mono text-zinc-500">Engine</span>
              <span className="text-zinc-200">Llama 3.3 70B via Groq</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <StatusDot active />
              <span className="font-mono text-zinc-500">Orchestrator</span>
              <span className="text-zinc-200">LangGraph.js</span>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="company-search" className="sr-only">
              Company name
            </label>
            <div className="group relative flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  <SearchIcon />
                </div>
                <input
                  id="company-search"
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Enter a global company name (e.g. Apple, Tesla, ASML)"
                  disabled={loading}
                  autoComplete="organization"
                  className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 py-3 pl-12 pr-4 text-base text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !companyName.trim()}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-8 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
                    Researching
                  </>
                ) : (
                  <>
                    <ChartIcon />
                    Run Analysis
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div
            role="alert"
            className="mx-auto mt-8 flex w-full max-w-3xl items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
          >
            <AlertIcon />
            <div>
              <p className="font-medium text-red-100">Research pipeline error</p>
              <p className="mt-1 leading-relaxed text-red-200/90">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <section
            aria-live="polite"
            aria-busy="true"
            className="mx-auto mt-12 w-full max-w-3xl"
          >
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm">
              <div className="mb-6 flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                </span>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-400">
                  Live Agent Trace
                </p>
              </div>

              <div className="space-y-4">
                {LOADING_STEPS.map((step, index) => {
                  const isActive = index === loadingStepIndex;
                  const isComplete = index < loadingStepIndex;

                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-500 ${
                        isActive
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-zinc-800/80 bg-zinc-950/40"
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full transition-colors ${
                          isComplete
                            ? "bg-emerald-400"
                            : isActive
                              ? "animate-pulse bg-emerald-300"
                              : "bg-zinc-700"
                        }`}
                      />
                      <p
                        className={`text-sm ${
                          isActive ? "text-zinc-100" : "text-zinc-500"
                        }`}
                      >
                        {step}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 space-y-3">
                <div className="h-3 animate-pulse rounded-full bg-zinc-800/80" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-zinc-800/60" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-zinc-800/40" />
              </div>
            </div>
          </section>
        )}

        {result && !loading && (
          <section className="mx-auto mt-12 grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <article
              className={`rounded-3xl border p-8 ${
                isInvest
                  ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-zinc-900/80"
                  : "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-zinc-900/80"
              }`}
            >
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">
                Investment Verdict
              </p>
              <h2
                className={`mt-4 text-4xl font-semibold tracking-tight ${
                  isInvest ? "text-emerald-300" : "text-amber-200"
                }`}
              >
                {result.decision}
              </h2>
              <p className="mt-3 text-sm text-zinc-400">{result.companyName}</p>

              <div
                className={`mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ${
                  isInvest
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/10 text-amber-200"
                }`}
              >
                <StatusDot active={isInvest} />
                {isInvest ? "Signal: Constructive exposure" : "Signal: Capital preservation"}
              </div>

              <dl className="mt-8 space-y-3 border-t border-zinc-800/80 pt-6 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Research passes</dt>
                  <dd className="font-mono text-zinc-300">{result.searchCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Transcript depth</dt>
                  <dd className="font-mono text-zinc-300">
                    {result.transcriptLength} nodes
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">
                Analyst Reasoning
              </p>
              <h3 className="mt-3 text-lg font-medium text-zinc-100">
                Quantitative &amp; qualitative synthesis
              </h3>
              <div className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6">
                <p className="text-base leading-8 text-zinc-300">
                  {result.reasoning}
                </p>
              </div>
            </article>
          </section>
        )}

        {!loading && !result && !error && (
          <section className="mx-auto mt-16 w-full max-w-3xl text-center">
            <p className="text-sm leading-relaxed text-zinc-500">
              Submit any publicly traded company to activate the LangGraph research
              loop. The agent will gather Yahoo Finance fundamentals, Tavily news
              sentiment, and produce a structured Invest or Pass verdict.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

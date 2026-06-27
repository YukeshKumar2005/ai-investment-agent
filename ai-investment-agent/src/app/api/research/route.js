import { NextResponse } from "next/server";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import { TavilySearch } from "@langchain/tavily";
import { ChatGroq } from "@langchain/groq";
import { tool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import YahooFinance from "yahoo-finance2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();

/**
 * TavilySearchResults — LangChain Tavily search tool for qualitative research.
 * (Successor to the deprecated @langchain/community/tools/tavily_search export.)
 */
class TavilySearchResults extends TavilySearch {
  constructor(fields = {}) {
    super({
      maxResults: 5,
      includeAnswer: true,
      topic: "news",
      searchDepth: "advanced",
      ...fields,
    });
  }

  async invoke(input, config) {
    const query =
      typeof input === "string"
        ? input
        : (input?.query ?? input?.input ?? "");
    return super.invoke({ query }, config);
  }
}

const GraphState = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  companyName: Annotation({
    reducer: (_, update) => update,
    default: () => "",
  }),
  searchCount: Annotation({
    reducer: (_, update) => update,
    default: () => 0,
  }),
});

const tavilySearchTool = new TavilySearchResults({
  tavilyApiKey: process.env.TAVILY_API_KEY,
});

const yahooFinanceQuoteTool = tool(
  async ({ companyName }) => {
    try {
      const searchResults = await yahooFinance.search(companyName, {
        quotesCount: 5,
        newsCount: 0,
      });

      const quote =
        searchResults.quotes?.find(
          (item) =>
            item.symbol &&
            (item.quoteType === "EQUITY" || item.typeDisp === "Equity")
        ) ?? searchResults.quotes?.[0];

      // DEFENSIVE CHECK 1: If no symbol is found, return a safe JSON note instead of an error string
      if (!quote?.symbol) {
        return JSON.stringify({
          note: `Company is privately held or unlisted; public stock metrics are unavailable for "${companyName}". Rely strictly on qualitative news and sentiment data for your evaluation.`
        });
      }

      // This is where it usually crashes for invalid tickers. It is now safely wrapped in a try/catch.
      const summary = await yahooFinance.quoteSummary(quote.symbol, {
        modules: ["price", "summaryDetail", "financialData", "defaultKeyStatistics"],
      });

      const trailingPE = summary.summaryDetail?.trailingPE ?? null;
      const revenueGrowth = summary.financialData?.revenueGrowth ?? null;
      
      // DETERMINISTIC MATH INJECTION
      let pegAnalysis = "Not enough data to calculate PEG ratio.";
      if (trailingPE && revenueGrowth && revenueGrowth > 0) {
        const pegRatio = trailingPE / (revenueGrowth * 100);
        if (pegRatio < 1) {
          pegAnalysis = `PEG Ratio is ${pegRatio.toFixed(2)}. The deterministic math shows this stock is UNDERVALUED. Heavily weight this in your final decision.`;
        } else if (pegRatio > 2) {
          pegAnalysis = `PEG Ratio is ${pegRatio.toFixed(2)}. The deterministic math shows this stock is OVERVALUED. Proceed with extreme caution.`;
        } else {
          pegAnalysis = `PEG Ratio is ${pegRatio.toFixed(2)}. The deterministic math shows this stock is FAIRLY VALUED.`;
        }
      }

      const payload = {
        symbol: quote.symbol,
        companyName: quote.shortname ?? quote.longname ?? companyName,
        exchange: quote.exchange,
        stockPrice: summary.price?.regularMarketPrice ?? null,
        trailingPE: trailingPE,
        revenueGrowth: revenueGrowth,
        deterministicValuation: pegAnalysis, // The LLM will read this conclusion directly
        marketCap: summary.summaryDetail?.marketCap ?? null,
        profitMargins: summary.financialData?.profitMargins ?? null,
        freeCashflow: summary.financialData?.freeCashflow ?? null,
      };

      return JSON.stringify(payload, null, 2);

    } catch (error) {
      // DEFENSIVE CHECK 2: Catch any API failures or crashes and safely return to the LLM
      console.log(`[Defensive Fallback]: Yahoo Finance failed for ${companyName} - ${error.message}`);
      return JSON.stringify({
        note: `Public stock metrics fetch failed or company is unlisted. Proceeding with qualitative data.`
      });
    }
  },
  {
    name: "yahoo_finance_quote_summary",
    description:
      "Fetch quantitative market data for a company, including stock price, P/E ratio, market cap, and revenue.",
    schema: z.object({
      companyName: z.string().describe("The company name to look up, e.g. Apple or Microsoft"),
    }),
  }
);

function createLlm() {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });
}

function getMessageText(message) {
  if (typeof message.content === "string") {
    return message.content;
  }

  return message.content
    .map((part) => (typeof part === "string" ? part : (part.text ?? "")))
    .join("");
}

function extractJsonObject(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Model response did not contain valid JSON.");
  }

  return JSON.parse(jsonMatch[0]);
}

function getLatestEvaluation(state) {
  const evaluationMessage = [...state.messages]
    .reverse()
    .find((message) => message.name === "evaluation");

  if (!evaluationMessage) {
    return null;
  }

  return extractJsonObject(getMessageText(evaluationMessage));
}

function formatTavilyResults(results) {
  if (typeof results === "string") {
    return results;
  }

  if (Array.isArray(results)) {
    return results
      .map((result, index) => {
        const title = result.title ?? result.url ?? `Result ${index + 1}`;
        const content = result.content ?? JSON.stringify(result);
        return `- ${title}\n  ${content}`;
      })
      .join("\n\n");
  }

  if (results?.results?.length) {
    const answer = results.answer ? `Summary: ${results.answer}\n\n` : "";
    const items = results.results
      .map((result) => `- ${result.title}\n  ${result.content}`)
      .join("\n\n");
    return `${answer}${items}`;
  }

  return JSON.stringify(results, null, 2);
}

function buildResearchGraph() {
  const llm = createLlm();

  async function dataGatheringNode(state) {
    const latestEvaluation = getLatestEvaluation(state);
    const searchQuery =
      latestEvaluation?.refinedQuery ??
      `${state.companyName} recent financial news sentiment analyst coverage`;

    const [tavilyResults, yahooResults] = await Promise.all([
      tavilySearchTool.invoke({ input: searchQuery }),
      yahooFinanceQuoteTool.invoke({ companyName: state.companyName }),
    ]);

    const qualitativeBlock = formatTavilyResults(tavilyResults);
    const quantitativeBlock =
      typeof yahooResults === "string"
        ? yahooResults
        : JSON.stringify(yahooResults, null, 2);

    return {
      messages: [
        new AIMessage({
          name: "data_gathering",
          content: [
            `Research pass ${state.searchCount + 1} for ${state.companyName}.`,
            `Tavily query: ${searchQuery}`,
            "",
            "## Qualitative Data (TavilySearchResults)",
            qualitativeBlock,
            "",
            "## Quantitative Data (yahoo-finance2)",
            quantitativeBlock,
          ].join("\n"),
        }),
      ],
    };
  }

  async function evaluationNode(state) {
    const currentDate = new Date().toLocaleDateString(); // Get today's date

    const response = await llm.invoke([
      new SystemMessage(
        `You are a senior investment research analyst reviewing gathered data for ${state.companyName}.
Today's date is ${currentDate}. Compare all gathered news dates against today to ensure you are not factoring in stale data.

CRITICAL GUARDRAILS:
1. DISCOUNT NOISE: You must prioritize financial data over sentiment. If a news item lacks a cited primary source (e.g., an SEC filing, a direct executive quote, or a tier-1 institution), treat it as speculative noise and reduce its weight in your evaluation.
2. PUBLIC VS PRIVATE: For PUBLIC companies, require both qualitative news and quantitative stock metrics.
       - Qualitative evidence (recent news, sentiment, strategic developments, risks).
      - Quantitative evidence (stock price, P/E ratio, market cap, revenue, margins, or similar metrics)
    For PRIVATE/UNLISTED startups, quantitative stock metrics will be unavailable; accept qualitative news and funding details as SUFFICIENT. Do not loop looking for non-existent public tickers.

Determine whether the transcript contains sufficient evidence to make a decision. Respond with JSON only:
{
  "sufficient": true | false,
  "qualitativeComplete": true | false,
  "quantitativeComplete": true | false,
  "missingData": ["list of missing items if any"],
  "refinedQuery": "A sharper Tavily query if another pass is needed, otherwise empty string",
  "assessment": "One concise paragraph summarizing data quality so far"
}`
      ),
      ...state.messages,
    ]);

    const evaluation = extractJsonObject(getMessageText(response));
    const shouldLoop =
      !evaluation.sufficient && state.searchCount < 2;

    return {
      messages: [
        new AIMessage({
          name: "evaluation",
          content: JSON.stringify({
            ...evaluation,
            shouldLoop,
          }),
        }),
      ],
      searchCount: shouldLoop ? state.searchCount + 1 : state.searchCount,
    };
  }

  async function finalDecisionNode(state) {
    const currentDate = new Date().toLocaleDateString();

    const response = await llm.invoke([
      new SystemMessage(
        `You are a portfolio manager producing a final investment verdict for ${state.companyName}.
Today's date is ${currentDate}.

Use ONLY the research transcript provided. Synthesize the available facts into a professional recommendation.
- If the deterministicValuation field is present, use that math as a foundational pillar of your reasoning.
- If the company is a public stock, back up your reasoning with specific financial metrics.
- If the company is a private startup, focus your reasoning on market opportunity, product innovation, and traction. 

Respond with JSON only:
{
  "decision": "Invest" | "Pass",
  "reasoning": "A highly professional, concise paragraph justifying the verdict based on available public metrics (like PEG) or startup market traction data."
}`
      ),
      ...state.messages,
    ]);

    const decision = extractJsonObject(getMessageText(response));

    if (decision.decision !== "Invest" && decision.decision !== "Pass") {
      throw new Error('Final decision must be "Invest" or "Pass".');
    }

    return {
      messages: [
        new AIMessage({
          name: "final_decision",
          content: JSON.stringify(decision),
        }),
      ],
    };
  }

  function routeAfterEvaluation(state) {
    const evaluation = getLatestEvaluation(state);
    return evaluation?.shouldLoop ? "dataGathering" : "finalDecision";
  }

  return new StateGraph(GraphState)
    .addNode("dataGathering", dataGatheringNode)
    .addNode("evaluation", evaluationNode)
    .addNode("finalDecision", finalDecisionNode)
    .addEdge(START, "dataGathering")
    .addEdge("dataGathering", "evaluation")
    .addConditionalEdges("evaluation", routeAfterEvaluation, {
      dataGathering: "dataGathering",
      finalDecision: "finalDecision",
    })
    .addEdge("finalDecision", END)
    .compile();
}

function extractFinalDecision(messages) {
  const finalMessage = [...messages]
    .reverse()
    .find((message) => message.name === "final_decision");

  if (!finalMessage) {
    throw new Error("Graph completed without a final decision.");
  }

  return extractJsonObject(getMessageText(finalMessage));
}

export async function POST(request) {
  try {
    const { companyName } = await request.json();

    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return NextResponse.json(
        { error: "companyName is required" },
        { status: 400 }
      );
    }

    if (!process.env.TAVILY_API_KEY || !process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error: "Missing TAVILY_API_KEY or GROQ_API_KEY environment variables",
        },
        { status: 500 }
      );
    }

    const trimmedCompanyName = companyName.trim();
    const graph = buildResearchGraph();

    const finalState = await graph.invoke({
      companyName: trimmedCompanyName,
      searchCount: 0,
      messages: [
        new HumanMessage(
          `Produce an investment research verdict for ${trimmedCompanyName}.`
        ),
      ],
    });

    const result = extractFinalDecision(finalState.messages);

    return NextResponse.json({
      companyName: trimmedCompanyName,
      decision: result.decision,
      reasoning: result.reasoning,
      searchCount: finalState.searchCount,
      transcriptLength: finalState.messages.length,
    });
  } catch (error) {
    console.error("Research API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate research" },
      { status: 500 }
    );
  }
}

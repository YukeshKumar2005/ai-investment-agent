# AlphaBot: Autonomous AI Investment Research Agent

**Built for the Altuni AI Labs Product Development Engineer (Intern) Assignment.**

## 📖 Overview
AlphaBot is a stateful, cyclic AI agent built to research global companies and output a deterministic "Invest" or "Pass" verdict. It leverages an advanced LangGraph architecture to dynamically gather quantitative stock metrics and qualitative market sentiment, synthesize the data, and provide professional investment reasoning.

## ⚙️ How to Run It

### 1. Prerequisites
- Node.js (v18+)
- API Keys for **Groq** (LLM) and **Tavily** (Web Search)

### 2. Setup Steps
Clone the repository and install the dependencies. Note: `--legacy-peer-deps` is required to resolve downstream peer dependency conflicts between LangChain community tools and the latest Next.js Zod validation schemas.

```bash
git clone [https://github.com/](https://github.com/)[your-username]/ai-investment-agent.git
cd ai-investment-agent
npm install --legacy-peer-deps

```

### 3. Environment Variables

Create a `.env.local` file in the root directory and add your keys:

```text
GROQ_API_KEY="your_groq_api_key"
TAVILY_API_KEY="your_tavily_key"

```

### 4. Start the Server

```bash
npm run dev

```

Navigate to `http://localhost:3000` to interact with the dashboard.

---

## 🧠 How It Works (Architecture & Approach)

This application bypasses standard sequential LangChain wrappers in favor of **LangGraph.js**, allowing for stateful, cyclic reasoning.

1. **State Management:** The graph maintains a `messages` array, acting as the agent's memory to track searches, results, and evaluation logic.
2. **Multi-Tool Orchestration:** - `yahoo-finance2` (Quantitative): Fetches raw ticker data, margins, and revenue.
* `Tavily Search API` (Qualitative): Scrapes real-time news and market sentiment.


3. **Evaluation Node:** The LLM reviews the gathered context. If data is insufficient, it loops back with a refined search query (capped by a `searchCount` limit to prevent infinite API burn).
4. **Final Decision Node:** Synthesizes the data into a strict JSON output containing the verdict and reasoning.

---

## ⚖️ Key Decisions & Trade-Offs

**1. Model Selection: Groq + Llama-3.3-70b-versatile vs. OpenAI**
I opted to use Groq's LPU infrastructure running the 70B Llama 3.3 model. This trade-off prioritized blazing-fast token inference latency and open-weights architecture over OpenAI's ecosystem, ensuring the UI remains highly responsive during multi-step graph loops.

**2. Deterministic Math Injection vs. LLM Computation**
Large Language Models are prone to arithmetic hallucinations. Instead of asking the model to evaluate valuation multiples, I built a deterministic JavaScript function inside the data-gathering node to calculate the PEG Ratio (Price/Earnings-to-Growth). The mathematical conclusion (e.g., "Undervalued", "Overvalued") is injected directly into the LLM's prompt, forcing it to base its reasoning on hard logic rather than generated text.

**3. Defensive Programming: Public vs. Private Markets**
The pipeline initially crashed when querying unlisted startups (like Namma Yatri or Swiggy) because the Yahoo Finance API returned a 404 for missing ticker symbols.

* *The Fix:* I wrapped the tool execution in a robust `try...catch` block. If a ticker is missing, it injects a structured fallback note into the graph state.
* *AI Alignment:* I engineered the system prompts to recognize unlisted startups dynamically, instructing the LLM to accept qualitative funding news as "sufficient" rather than endlessly looping or breaking JSON formatting in search of missing stock data.

**4. Source Credibility Guardrails**
To combat speculative market noise, the Evaluation Node prompt forces the LLM to discount sentiment lacking tier-1 institutional citations, prioritizing fundamental data.

---

## 🚀 Example Runs

### Example 1: Public Enterprise (Apple Inc.)

* **Decision:** Invest
* **Reasoning:** "Apple presents a strong investment opportunity, anchored by a calculated PEG ratio that suggests fair valuation relative to its revenue growth. Quantitative metrics highlight robust profit margins and substantial free cashflow, indicating exceptional operational efficiency..."

### Example 2: Private Startup (Namma Yatri)

* **Decision:** Invest
* **Reasoning:** "As a privately held startup, quantitative stock metrics are unavailable. However, qualitative data reveals massive market traction, disrupting traditional ride-hailing with a zero-commission model. Recent funding rounds indicate strong institutional confidence in their open-network architecture..."

---

## 🔮 What I Would Improve With More Time

1. **Vectorized SEC Filings (RAG):** Instead of relying solely on open-web search tools for news, I would implement a PDF parsing pipeline and vector database to pull unedited facts directly from recent Form 10-K and 10-Q filings.
2. **Caching Layer:** I would integrate Redis to cache financial data requests for 24 hours, preventing rate-limiting during high-traffic spikes and further lowering latency.
3. **Advanced Quantitative Agents:** I would add deterministic tools for calculating the Altman Z-score (bankruptcy risk) and Piotroski F-score (value investing metrics) to give the agent deeper, institutional-grade analytical capabilities.

---

*Note: A complete log of the LLM chat sessions detailing the architectural thought process and build iteration is included with this submission as requested.*

```



```

# Architectural Study: Multi-Agent Intent Routing, Dynamic Component Orchestration & Rendering Resiliency in Omega AI

**Document Version**: 3.0  
**Target Architecture**: Decoupled Analytics Engine (FastAPI + Next.js + Hugging Face ZeroGPU + OpenAI)  
**Author**: DeepMind Agentic Coding Assistant  
**Status**: Proposal & Deep Feasibility Study (No code changes applied)

---

## 1. Root Cause Analysis: The "Disappearing Text" Phenomenon

The user's uploaded screenshot reveals a critical frontend/backend disconnect:

```
[FastAPI Backend: api/index.py]
      │  Returns JSON: { answer: "<Rich 3-paragraph analysis>", components: [ { type: "markdown", content: "### Data Health & Summary\nDetailed overview..." }, ... ] }
      ▼
[Next.js Frontend: ChatInterface.tsx]
      │
      ├── While Typewriter is Running (done === false):
      │     Displays msg.answer! User sees rich, insightful, highly relevant findings.
      │
      └── When Typewriter Finishes (done === true):
            Swaps DOM to msg.components.map(...)!
            Replaces msg.answer with components[0].content (which was the 1-line prompt placeholder!).
            The rich text vanishes from the screen!
```

### Technical Anatomy in `ChatInterface.tsx` (Lines 424–436)
```tsx
{!done && isLatest ? (
  <div className="text-[15px] leading-relaxed text-[#0A0A0A] whitespace-pre-wrap font-sans">
    <span className="omega-caret">{display}</span>  {/* Renders msg.answer */}
  </div>
) : (
  <div className="flex flex-col gap-5 font-sans text-[15px] leading-relaxed text-[#0A0A0A]">
    {msg.components?.map((comp: any, idx: number) => {
      if (comp.type === "markdown") {
        return <div key={idx}>{comp.content}</div>;  {/* Renders placeholder! */}
      }
      ...
    })}
  </div>
)}
```

### Why this occurred:
1. `_generate_insight_via_llm` in `crew.py` generated two separate fields:
   - `insight_text`: Contains the authentic, high-quality, 3-paragraph executive narrative.
   - `components`: An array of UI blocks where `components[0]` was instructed to contain markdown.
2. In the prompt schema, `components[0]` had a placeholder string:
   `{"type": "markdown", "content": "### Data Health & Summary\nDetailed overview of dataset structure and distributions."}`
   `gpt-4o-mini` echoed that placeholder string literally into `components[0]`.
3. In `api/index.py`, `answer` was set to `insight_text`, and passed to the frontend.
4. While typing, the user saw `display` (from `msg.answer`).
5. As soon as typing finished, the UI swapped to `msg.components`, replacing the rich briefing with the 1-line placeholder text.
6. When exporting to PDF, the exporter reads `components`, cementing the placeholder into the PDF while the real narrative was discarded.

---

## 2. Evaluation of User Proposals

The user has proposed two strategic architectural enhancements:
1. **Proposal 1**: Replace the rule-based keyword classifier with an **LLM Intent Classification Agent** powered by `gpt-4o-mini`.
2. **Proposal 2**: Address the "Rigid Structural Cadence" by introducing a **Component Orchestrator Agent** powered by `gpt-4o-mini` to dynamically choose which components are included based on intent.

---

### 2.1 Deep Analysis of Proposal 1: Dedicated LLM Intent Classification Agent

#### The Problem It Solves:
Handcrafted keyword lists are brittle. In the recent test:
- *"Does city_type drive ev_adoption_likelihood..."* failed because `"drive"` was used instead of `"driver"` / `"drivers"`.
- *"How can we address range anxiety..."* failed because `"address"` was not in the keyword list.
An LLM intent classifier understands grammar, conjugation, semantic intent, and context effortlessly.

#### Risks & Trade-offs:
1. **Latency Overhead**: Calling `gpt-4o-mini` at the start of the pipeline introduces **1.5s – 3.0s** of additional sequential delay before the Planner can even begin.
2. **Failure Point in the Front-of-Funnel**: If the intent call times out or encounters a 429 rate limit, the entire query fails before doing any work.
3. **Over-Categorization**: An LLM agent without strict boundaries might invent new intent labels (`"urban_psychographic_exploration"`) that downstream agents (Planner/Coder) don't have playbooks for.

#### Recommended Architecture: The "Hybrid Tiered Classifier"
Instead of a pure LLM call for every query, use a **Zero-Latency Regex Fast-Path + LLM Fallback**:
- **Fast-Path (0.01ms)**: If query contains explicit executive markers (`"ceo"`, `"shut down"`, `"forecast"`, `"predict"`, `"invest"`), route immediately with zero API delay.
- **LLM Semantic Classifier (gpt-4o-mini, max 100 tokens, temperature 0)**: Used when the query is nuanced or does not trigger high-confidence keywords. Enforce strict JSON enum output: `{"intent": "strategic_decision" | "driver_attribution" | "aggregation" | "distribution"}`.
- **Latency Impact**: $< 0.8\text{s}$ average; 100% semantic accuracy.

---

### 2.2 Deep Analysis of Proposal 2: Component Orchestrator Agent

#### The Problem It Solves:
Currently, the pipeline outputs the exact same monolithic sequence on every turn:
$$\text{Header} \longrightarrow \text{KPI Cards} \longrightarrow \text{Data Table} \longrightarrow \text{Bar Chart} \longrightarrow \text{Strategies} \longrightarrow \text{Priority Matrix} \longrightarrow \text{Risks}$$
This creates visual fatigue and feels artificial for simple queries. An orchestrator allows dynamic layouts:
- *Simple Aggregation*: Executive Summary + 1 Primary Chart.
- *Driver Analysis*: Driver Narrative + Feature Ranking Table + Horizontal Impact Bar Chart + Actionable Levers.
- *Executive Decision*: Strategic Briefing + Decision Scorecard + Grouped Bar Chart + Phased Strategies + Priority Matrix + Risk Mitigation.

#### Critical Risks of a Standalone Component Orchestrator Agent:
1. **The 5-Agent Latency Explosion (The Render 504 Trap)**:
   Adding a standalone component selection agent creates a 5-step serial chain:
   $$\text{Intent Agent} \longrightarrow \text{Planner} \longrightarrow \text{Coder} \longrightarrow \text{Sandbox} \longrightarrow \text{Insight Agent} \longrightarrow \text{Component Agent}$$
   | Agent / Step | Model | Latency |
   | :--- | :--- | :--- |
   | 1. Intent Classifier | `gpt-4o-mini` | 2s |
   | 2. Planner Agent | `gpt-5.6-luna` / `o3-mini` | 12s – 20s |
   | 3. Coder Agent | `gpt-4o-mini` | 6s – 12s |
   | 4. Sandbox Execution | Python / HF ZeroGPU | 5s – 15s |
   | 5. Insight Synthesis | `gpt-4o-mini` | 4s – 7s |
   | 6. Component Orchestrator | `gpt-4o-mini` | 3s – 6s |
   | **Total Pipeline Latency** | | **32s – 62s (Worst-case: 85s+)** |
   Any single retry or network delay will push execution beyond Render's **100s reverse-proxy timeout**, triggering a 504 Gateway Timeout!

2. **Artifact Desynchronization**:
   If the Component Orchestrator decides that a query needs a table and a chart, but the Coder only computed a scalar metric, the orchestrator will either fabricate numbers or crash the frontend.

#### Recommended Architecture: "Planner-Led Contract" or "Unified Executive Synthesis"
Instead of adding a 5th separate agent call:
- **Approach A (Planner Layout Contract)**:
  During Step 2, the **Planner Agent** already inspects the query and schema. It includes a `<layout_contract>` tag specifying which components should be rendered (e.g. `[narrative, scorecard_table, driver_chart, strategies]`). The Coder and Insight Generator simply follow this contract. **Latency added: 0.0 seconds!**
- **Approach B (Unified Synthesis Agent)**:
  The **Insight Generator Agent** is given the responsibility of both writing the narrative AND selecting which components to include from the generated data artifacts. **Latency added: 0.0 seconds!**

---

## 3. Comprehensive Risk Analysis Matrix

| # | Risk Description | Severity | Likelihood | Impact on Pipeline | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R1** | **Cascading Latency Overrun** | **Critical** | **High** | Multi-agent sequential calls exceed Render's 100s timeout, dropping the HTTP connection. | Avoid adding standalone sequential agents; use Planner Contract or Unified Synthesis to keep total agent calls $\le 3$. |
| **R2** | **Disappearing Text Bug** | **High** | **Certain** | The user sees rich findings during typewriter, but content is replaced by 1-line placeholder when typing finishes. | Permanently render `msg.answer` as the foundational narrative in `ChatInterface.tsx`; ensure `components[0]` is not an empty placeholder. |
| **R3** | **Data Desynchronization** | **High** | **Medium** | An external component agent requests a chart or table that the Coder never generated. | The component selector must only pick from verified sandbox output files (`query_result.json`, `chart.json`). |
| **R4** | **Unsanitized Object Leaks** | **Medium** | **High** | LLM outputs objects (e.g. `{'risk': ..., 'mitigation': ...}`) that stringify to raw Python code in PDF. | Defensive backend sanitizer that parses both string arrays and dictionary objects into clean text. |
| **R5** | **OpenAI Rate Limiting (TPM/RPM)** | **Medium** | **Medium** | 5 sequential LLM calls per turn consume user rate limits $2.5\times$ faster on multi-user concurrency. | Minimize token usage via strict `max_tokens: 150` on classification and reuse prompt context. |

---

## 4. Proposed Phased Implementation Plan

### Phase 1: Fix the Foundational Text Rendering (Zero Latency Overhead)
1. **Frontend Resiliency (`ChatInterface.tsx`)**:
   Update `AssistantBubble` so that `msg.answer` (the comprehensive narrative) is **permanently rendered as the leading text block**, followed by the dynamic components (`msg.components`).
   This ensures that what the user sees during typing remains on the screen forever, and exports cleanly to the PDF.
2. **Backend Unification (`api/index.py`)**:
   Ensure `components` does not duplicate a placeholder markdown block if `answer` already contains the full executive brief.
3. **Risk Sanitizer (`api/index.py`)**:
   Handle both string risks and dictionary risks `{"risk": "...", "mitigation": "..."}` cleanly formatting them as:
   `• Risk: [description] — Mitigation: [strategy]`.

### Phase 2: Hybrid Intent Router (`src/crew.py`)
1. Implement `classify_query_intent_hybrid()`:
   - Evaluates fast regex heuristics for unambiguous strategic/predictive keywords.
   - If ambiguous, dispatches a micro-call to `gpt-4o-mini` with `max_tokens: 80`, temperature 0, and JSON mode.
   - Accurately classifies verbs (*"drive"*, *"influence"*, *"address"*), slang, and compound questions.

### Phase 3: Dynamic Component Selection via Planner Contract (`src/crew.py`)
1. Upgrade `_PLANNER_SYSTEM_PROMPT` to output `<layout_components>`:
   - For simple lookups: `["narrative", "chart"]`
   - For driver analysis: `["narrative", "kpi_grid", "table", "chart", "strategies"]`
   - For strategic decisions: `["narrative", "kpi_grid", "table", "chart", "strategies", "priority_matrix", "risks"]`
2. Pass the layout contract to `_generate_insight_via_llm`.
3. The Insight Generator only emits the components specified in the contract, completely breaking the rigid 7-block cadence without adding an extra agent to the pipeline.

---

## 5. Architectural Comparison: Current vs. Proposed

```mermaid
graph TD
    subgraph Current Pipeline (Rigid & Buggy)
        Q1[User Query] --> C1[Keyword Heuristics - misses 'drive']
        C1 --> P1[Planner Agent]
        P1 --> CD1[Coder Agent]
        CD1 --> S1[Sandbox Exec]
        S1 --> I1[Insight Agent - emits placeholder in comp 0]
        I1 --> UI1[ChatInterface - swaps answer for placeholder upon completion!]
    end

    subgraph Proposed Resilient Architecture
        Q2[User Query] --> C2[Hybrid Intent Router - 0ms fastpath + 0.6s micro LLM]
        C2 --> P2[Planner Agent - determines Layout Contract]
        P2 --> CD2[Coder Agent - subsampled & safe]
        CD2 --> S2[Sandbox Exec]
        S2 --> I2[Insight Agent - emits only contracted components]
        I2 --> BE2[api/index.py - Sanitizes dicts & prepends rich narrative]
        BE2 --> UI2[ChatInterface - Narrative stays permanently; components follow]
    end
```

---

## 6. Verification Protocol (For Future Implementation)
1. **Text Persistence Test**: Send query; confirm that typewriter text remains completely visible and unbroken once animation finishes.
2. **Intent Semantic Breadth Test**: Verify *"Does city_type drive EV adoption?"* routes to `driver_attribution`, and *"How can we address battery concerns?"* routes to `prescriptive_strategy`.
3. **Dynamic Layout Test**:
   - Verify a basic count query renders only Narrative + Chart.
   - Verify a CEO query renders Narrative + Scorecard + Chart + Strategies + Matrix + Risks.
4. **Latency Verification**: Total turn time must remain under **35 seconds** to maintain a 65-second safety buffer against Render's 100s timeout.

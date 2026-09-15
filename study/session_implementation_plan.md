# Implementation Plan: Enhancing Model Output Quality & Analytical Depth

Transform Omega from a formulaic 2-sentence summary generator into an executive-grade cognitive analytics platform by addressing prompt bottlenecks, architectural omissions, backend component dropping, and rendering limitations.

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions**:
> 1. **Intent & Persona Routing**: Re-enabling and fortifying query classification so that strategic queries (e.g. CEO decisions, factor attribution) automatically trigger deeper analytical playbooks instead of defaulting to basic data profiling (`descriptive`).
> 2. **Prompt Modernization**: Uncapping the arbitrary 3-4 steps and 40-50 lines limit for complex queries while preserving brevity for simple queries.
> 3. **Backend Bug Fix**: Eliminating the bug in `api/index.py` that silently discards `strategies`, `priority_matrix`, and `risks` when `raw_components` is returned.
> 4. **PDF & UI Formatting**: Elevating chart heights and adding structured multi-section reporting in the PDF output.

## Proposed Changes

Grouped by component layer:

---

### 1. Analytical Core & Agent Prompts (`Omega_Streamlit/src/crew.py`)

#### [MODIFY] [`crew.py`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/crew.py)
- **Restore Query Complexity & Persona Classification**: Introduce `_classify_query_context()` to distinguish between:
  - Strategic Decision queries (e.g., CEO shutting down a market)
  - Driver / Attribution queries (e.g., which factors impact EV adoption)
  - Predictive / Forecasting queries
  - Simple operational aggregations
- **Adaptive Planner Playbooks (`_PLANNER_SYSTEM_PROMPT`)**:
  - Replace the rigid "Keep to 3-4 steps" rule with context-adaptive analytical plans.
  - For factor attribution: instruct the coder to calculate multi-feature correlation / feature importance across all columns rather than guessing 2-3 columns.
  - For strategic decisions: instruct the coder to produce a multi-metric comparative scorecard and trade-off evaluation.
- **Coder Guidelines (`_CODER_SYSTEM_PROMPT`)**:
  - Lift the 40-50 lines restriction to allow multi-metric slicing and feature ranking calculations up to 120 lines when needed.
- **Modular Insight Generation Prompts**:
  - Abolish the invariant 4-element few-shot template (`[markdown, metric_grid, table, chart]`).
  - Introduce rich, structured prompts (`_STRATEGIC_DECISION_PROMPT`, `_DRIVER_ATTRIBUTION_PROMPT`) that generate rich executive summaries, trade-offs, actionable strategies, priority matrices, and risk assessments.

---

### 2. Backend Orchestration & Data Flow (`Omega_Streamlit/api/index.py`)

#### [MODIFY] [`index.py`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/api/index.py)
- **Fix Component Drop Bug (Lines 595–647)**:
  - Ensure `strategies`, `priority_matrix`, and `risks` are always included in the returned `components` payload, even when `raw_components` is provided by the LLM.
- **Enhance Plotly-to-Recharts Translation**:
  - Add support for multi-series grouped bar charts so comparisons across multiple dimensions are preserved rather than flattened into a single trace.

---

### 3. PDF Rendering & Frontend UI (`Omega_Streamlit/utils/` & `Omega_Streamlit/components/`)

#### [MODIFY] [`pdfRendererDocument.tsx`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/utils/pdfRendererDocument.tsx)
- **Dynamic Chart Sizing**: Increase chart image height from fixed `160` to `220` points to eliminate squashed, illegible axis labels.
- **Rich Markdown Section Headers**: Update `parseMarkdownText` to parse markdown headers (`##`, `###`) into distinct stylized PDF headers.
- **Render Full Executive Sections**: Ensure that `strategies`, `priority_matrix`, and `risks` cleanly render as dedicated, beautifully styled sections on subsequent pages.

#### [MODIFY] [`ChatInterface.tsx`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/components/omega/ChatInterface.tsx)
- Enhance markdown block rendering with typography hierarchy (bold headers, clean bullet spacing).

---

## Verification Plan

### Automated & Sanity Checks
- Test query classification across strategic, factor-attribution, and simple-aggregation prompts.
- Verify sandbox execution of multi-metric feature importance scripts.
- Validate FastAPI endpoint response payload to ensure `components` retains `strategies`, `priority_matrix`, and `risks`.

### End-to-End Visual Verification
- Re-run the two queries from the sample PDF:
  1. *"Which factors highly affect ev_adoption_likelihood"* $\rightarrow$ verify feature ranking table, driver chart, and strategic levers.
  2. *"Being the CEO, i have to take a call on shutting down operations in one of the city_type. Which one should it be and why?"* $\rightarrow$ verify multi-metric scorecard, trade-off rationale, actionable strategies, priority matrix, and operational risks.
- Export PDF for both queries and verify that the executive report is comprehensive, crisp, and high-resolution without squashed charts or missing sections.

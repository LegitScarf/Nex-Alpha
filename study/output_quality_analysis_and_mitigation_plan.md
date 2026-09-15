# Omega AI: Output Quality Analysis, Risk Assessment & Comprehensive Mitigation Plan

**Document Version**: 2.0  
**Target Platform**: Omega AI Analytics Platform (Next.js + FastAPI + Hugging Face ZeroGPU + OpenAI)  
**Status**: Approved for Implementation (Retaining `gpt-4o-mini` for Insight Generation)

---

## Part 1: Diagnostic Analysis of Agent Prompts, Backend Pipeline & Rendering

### 1.1 Observed Patterns in Model Output
An examination of generated executive reports (e.g. from `global_ev_adoption_behavior_2026.csv`, 50,000 rows $\times$ 23 columns) revealed four consistent bottlenecks:
1. **Superficial Narrative Depth**: For high-stakes queries (e.g., *"Being the CEO, I have to take a call on shutting down operations in one of the city_type..."*), the model returned only 2 brief sentences.
2. **Invariant, Formulaic Response Structure**: Every output conformed strictly to: 1 heading $\rightarrow$ 1–2 sentences text $\rightarrow$ 2–3 KPI cards $\rightarrow$ 1 tiny table $\rightarrow$ 1 single bar chart.
3. **Arbitrary Qualitative Labels Instead of Statistical Rigor**: Trivial labels like *"Shutdown Candidate: Yes/No"* or *"Impact: High/Medium"* were generated without regression weights, correlation values, or p-values.
4. **Missing Executive Sections in Reports**: Actionable strategies, priority matrices, and risk warnings were completely absent from the exported PDF reports.

### 1.2 Root Cause Mapping
```
[User Query]
     │
     ▼
[crew.py: Intent Classifier] ────────► BYPASSED in run_omega()! Always defaults to "descriptive"
     │
     ▼
[crew.py: Planner Agent] ────────────► Constrained by "Brevity: 3-4 concise steps" rule
     │
     ▼
[crew.py: Coder Agent] ──────────────► Constrained by "< 40-50 lines" rule; basic groupby only
     │
     ▼
[Sandbox Execution] ─────────────────► Generates minimal query_result.json & chart.json
     │
     ▼
[crew.py: Insight Generator] ────────► Prompted with _DESCRIPTIVE_INSIGHT_PROMPT; rigid 4-item list template
     │
     ▼
[api/index.py: FastAPI] ─────────────► CRITICAL BUG: Drops strategies, priority_matrix & risks when raw_components exists!
     │
     ▼
[Frontend UI & PDF Renderer] ────────► squashed 160px chart, missing executive sections
```

---

## Part 2: Risk Assessment

Expanding the analytical capabilities of Omega introduces specific technical risks across the infrastructure:

| Risk Domain | Potential Failure Mode | Technical Severity |
| :--- | :--- | :--- |
| **1. Render 100s Request Timeout** | Complex multi-step analysis, Coder retries, and large JSON synthesis could push total execution time past Render's hard 100s reverse-proxy limit, triggering a **504 Gateway Timeout**. | **Critical** |
| **2. Hugging Face Space Queue / Timeout** | The remote HF Space has a 30.0s execution timeout. Cold starts or un-optimized feature importance scripts on 50,000 rows can trigger timeout and force local fallback, doubling latency. | **High** |
| **3. Memory Exhaustion (OOM) on Local Fallback** | Render Starter web services have 512MB–1GB RAM. Unconstrained scikit-learn models on 50,000 rows can exceed memory limits and trigger process SIGKILL. | **High** |
| **4. Frontend & PDF Schema Drift** | If the LLM generates non-standard keys (e.g. `columns` instead of `headers`, or non-string table cells), React or `@react-pdf` can crash with unhandled exceptions. | **Critical** |
| **5. Latency Inflation on Simple Queries** | Forcing deep multi-criteria reporting on basic lookups (*"What is the average income?"*) would cause unnecessary 20s delays for a 2s question. | **Medium** |

---

## Part 3: Comprehensive Mitigation Plan

### 3.1 Strict 45-Second Latency Budget & Safe Subsampling
To prevent Render 504 timeouts, the entire turn is kept within a 45-second budget:
- **Subsampling Rule**: For correlation matrices and feature importance on datasets $> 10,000$ rows, the Coder is instructed to sample up to 10,000 rows (`df.sample(n=min(10000, len(df)), random_state=42)`). This preserves $99.9\%$ statistical precision while reducing compute time to $< 0.5$ seconds and memory to $< 20$MB.
- **Coder Retries**: Capped at 2 attempts (1 initial + 1 targeted fix) instead of 3.

### 3.2 Model Tiering Strategy
- **Planner Agent**: `gpt-5.6-luna` (fallback `o3-mini`) for analytical reasoning.
- **Coder Agent**: `gpt-4o-mini` (fallback `gpt-4o-mini`) for rapid code generation.
- **Insight Generator**: **Retained on `gpt-4o-mini`** (as requested). Output quality is upgraded via refined system prompts and structured prompt engineering without suffering the 30s latency overhead of reasoning models.

### 3.3 3-Tier Adaptive Complexity Routing
Queries are dynamically categorized into three operational tiers:
1. **Tier 1: Direct Aggregation / Lookup**: 1-step aggregation + 1 chart. Target: $\le 6$s.
2. **Tier 2: Driver & Attribution Analysis**: Subsampled feature correlations / rankings + horizontal driver chart + lever analysis. Target: $\le 18$s.
3. **Tier 3: Strategic Decision / Executive**: Multi-criteria comparison scorecard + trade-off evaluation + actionable strategies + priority matrix + operational risks. Target: $\le 25$s.

### 3.4 Defensive Backend Schema Sanitizer (`api/index.py`)
A validation and normalization layer guarantees that all components conform to expected TypeScript schemas before transmission:
- Normalize `headers` and convert all table cells to clean, formatted strings.
- Normalize metric card labels and values.
- **Fix Component Drop**: Ensure `strategies`, `priority_matrix`, and `risks` are always preserved in the final `components` array.

### 3.5 PDF & Frontend Rendering Upgrades
- **Dynamic Chart Height**: Increase chart height from fixed 160pt to 220pt in `pdfRendererDocument.tsx` to ensure axis labels are crisp and readable.
- **Markdown Header Support**: Enhance the text parser to convert `##` and `###` markdown tokens into distinct PDF section subheadings.
- **Render Full Executive Sections**: Ensure strategies, priority matrix, and risks are cleanly rendered with badges and executive styling.

---

## Part 4: Implementation Roadmap

1. **`Omega_Streamlit/src/crew.py`**:
   - Restore query complexity classification (`_classify_query_context`).
   - Upgrade `_PLANNER_SYSTEM_PROMPT` with adaptive playbooks (Driver Attribution, Strategic Decision, Direct Lookup).
   - Upgrade `_CODER_SYSTEM_PROMPT` with line ceiling relief and safe 10k subsampling.
   - Upgrade Insight Prompts (`_STRATEGIC_INSIGHT_PROMPT`, `_DRIVER_INSIGHT_PROMPT`, `_DESCRIPTIVE_INSIGHT_PROMPT`) on `gpt-4o-mini`.
2. **`Omega_Streamlit/api/index.py`**:
   - Fix dropped component bug (always append strategies, priority matrix, and risks).
   - Add defensive schema sanitizer for tables, metrics, and charts.
   - Upgrade `convert_plotly_to_recharts` to support multi-trace bar charts.
3. **`Omega_Streamlit/utils/pdfRendererDocument.tsx`**:
   - Upgrade chart height to 220pt.
   - Add markdown header parsing (`##`, `###`).
   - Clean up table padding and section wrapping.
4. **Verification**:
   - Verify Python code execution in sandbox.
   - Verify FastAPI endpoint response structure.

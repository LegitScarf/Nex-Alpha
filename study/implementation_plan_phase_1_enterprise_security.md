# Implementation Plan: Phase 1 Enterprise Security Hardening (Zero-Sample Schema Prompting & Local Compute Isolation)

This plan details the step-by-step engineering tasks to implement **Phase 1 Enterprise Security** in Omega. It eliminates all raw transaction data and personal identifiable information (PII) leakage to commercial LLMs while incorporating defensive mitigations so that analytical output quality, chart rendering, and server memory stability remain uncompromised.

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Decision — Compute Isolation & Memory Guards:**
> - In Phase 1, all standard analytical queries (aggregations, multi-criteria scorecards, driver rankings, Plotly charts) will run **strictly inside the local Python sandbox on Render**, bypassing remote data dispatch to Hugging Face ZeroGPU.
> - Because Render free-tier containers have a **512 MB RAM ceiling**, we introduce an automatic in-memory downsampler (capping heavy statistical operations to 15,000 sampled rows) and explicit post-turn garbage collection (`gc.collect()`). This prevents memory-related container crashes (`SIGKILL 137`).
> - For compute-heavy machine learning tasks (e.g. random forest training on 100k+ rows), we maintain a secure fallback setting.

---

## 1. Deep Codebase Audit: Where Data Leaks Today

| Component / File | Current Leaking Behavior | Target Hardened Behavior |
| :--- | :--- | :--- |
| [`Omega_Streamlit/src/schema.py`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/schema.py) | `_safe_sample_values()` extracts 3 real raw data values per column and embeds `samples=[val1, val2, val3]` in the schema string. | Replace `samples=[...]` with format clues (e.g., `contains_currency=True`, `format='$X,XXX.XX'`, `date_pattern='%Y-%m-%d'`). |
| [`Omega_Streamlit/src/semantic_model.py`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/semantic_model.py) | Passes `sample_str = df.head(10).to_string()` directly to `gpt-4o-mini` during domain bootstrapping. | Pass the anonymized safe structural profile instead of raw row text. |
| [`Omega_Streamlit/src/crew.py`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/crew.py) | Embeds `dataframe.head(5).to_string()` into prompts for both Planner (`gpt-5.6-luna`) and Coder (`gpt-4o-mini`). | Strip `df.head(5)` completely; pass `generate_safe_structural_profile(df)` providing formatting rules and categorical vocab. |
| [`Omega_Streamlit/src/hf_sandbox_client.py`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/hf_sandbox_client.py) | `stage_dataset_remote()` serializes and POSTs the entire raw CSV across the public internet to Hugging Face. | When `OMEGA_DATA_PRIVACY_LEVEL=enterprise`, bypass remote staging entirely and enforce local isolated execution. |
| [`Omega_Streamlit/src/interpreter.py`](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/interpreter.py) | Executes code directly on the full DataFrame in memory without RAM guardrails. | Inject a 15,000-row memory safeguard for correlation and model fitting, and invoke `gc.collect()` after each query. |

---

## 2. Proposed Changes

### Module 1: Safe Structural Profiling (Zero-Sample Schema Generator)

#### [Omega_Streamlit/src/schema.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/schema.py)
1. **Deprecate Raw Sample Values**:
   - Refactor `_safe_sample_values(series)` to return **zero raw data rows**.
   - Instead, compute format heuristics:
     - Detect if an `object` column contains currency symbols (`$`, `€`, `£`, `₹`, `,`, `%`).
     - Detect date string patterns (`YYYY-MM-DD`, `DD/MM/YYYY`).
2. **Implement `generate_safe_structural_profile(df: pd.DataFrame) -> str`**:
   - Output clean formatting guidance:
     - For currency/percentages: `Column 'Revenue' (object): Contains currency/commas. Clean with .str.replace('[$,]', '').astype(float)`.
     - For low-cardinality categories ($\le 8$ levels): Output exact valid category levels (`Valid categories: ['EMEA', 'APAC', 'Americas']`) so the model avoids spelling and casing mismatches.
     - For numeric columns: Output ranges `[min to max]` and null percentages without exposing rows.
     - For temporal columns: Output date ranges and detected patterns.
   - Suppress direct PII and contact info (columns matching `name`, `email`, `phone`, `ssn`, or values containing `@`) from categorical enumeration.

---

### Module 2: Bootstrap Semantic Business Modeling Without Rows

#### [Omega_Streamlit/src/semantic_model.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/semantic_model.py)
1. Remove:
   ```python
   sample_str = df.head(10).to_string()
   ```
2. Replace user prompt content with:
   ```python
   profile_str = generate_safe_structural_profile(df)
   user_message = (
       f"Dataset shape: {shape_str}\n\n"
       f"Dataset Structural Profile (Zero-Sample Anonymized):\n{profile_str}"
   )
   ```
3. Update `_BOOTSTRAP_SYSTEM_PROMPT` to instruct `gpt-4o-mini` to infer business domains, KPIs, and hierarchies from the safe structural profile without requiring raw row inspection.

---

### Module 3: Agentic Reasoning Loop Hardening

#### [Omega_Streamlit/src/crew.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/crew.py)
1. **Planner Agent Prompt**:
   - Remove `sample_str = dataframe.head(5).to_string()`.
   - Inject `safe_profile = generate_safe_structural_profile(dataframe)`.
   - Update `planner_messages` to pass structural formatting guidelines instead of raw sample rows.
2. **Coder Agent Prompt**:
   - Update `coder_instruction` to remove `Dataset Sample (first 5 rows)` and replace with the anonymized structural profile.
   - Instruct the Coder Agent: *"All column names, types, and formatting guidelines are defined in the Structural Profile. You do not need raw data samples."*
   - Pre-inject `sample_for_analysis(df, max_rows=15000)` into execution scope and coder system guidelines.
3. **Insight Generator Sanitization**:
   - Ensure that `query_data["result_rows"]` only contains computed aggregated figures (counts, sums, averages, metrics) and business dimensions (`Product_Category`, `Region`), while direct personal identifiers (`email`, `phone`, `ssn`) are strictly redacted.

---

### Module 4: Local Compute Isolation & Memory Guards

#### [Omega_Streamlit/src/interpreter.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/interpreter.py)
1. **Memory Guard for Render 512 MB Ceiling**:
   - Before executing generated code, ensure garbage collection (`gc.collect()`).
   - Provide helper `sample_for_analysis(target_df, max_rows=15000)` to keep peak RAM well under 250 MB during heavy correlation/ML calculations.
2. **Post-Execution Memory Reclaim**:
   - Clean up `exec_globals` and `exec_locals` in a `finally:` block and invoke `gc.collect()`.

#### [Omega_Streamlit/src/hf_sandbox_client.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/hf_sandbox_client.py)
1. When `OMEGA_DATA_PRIVACY_LEVEL=enterprise`, return `False` from `is_remote_configured()` and `stage_dataset_remote()`, routing execution strictly to the local fortified Python sandbox on Render.
2. Zero bytes of CSV data are transmitted to the public Hugging Face Space.

---

### Module 5: Configuration & Testing Controls

#### [Omega_Streamlit/.env](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/.env)
- Added the following environment toggles:
  ```env
  # ── Enterprise Data Security & Local Compute Isolation ─────────────────────
  OMEGA_DATA_PRIVACY_LEVEL=enterprise
  OMEGA_ZERO_SAMPLE_PROMPTING=true
  ```

---

## 3. Verification Plan

### Automated Regression & Accuracy Verification
1. **Compilation & Syntax Test**:
   - Run `python -m py_compile src/schema.py src/crew.py src/semantic_model.py src/interpreter.py src/hf_sandbox_client.py`.
2. **Prompt Data Leak Audit**:
   - Inspect outgoing LLM payloads for Planner, Coder, and Semantic Modeler to confirm that **no raw DataFrame rows or client PII values** appear in any message payload.
3. **Dirty Data & Currency Handling Test**:
   - Test a dataset containing `"$1,250.00"`, `"15.2%"`, and `"04/05/2023"`.
   - Verify that the Coder Agent successfully generates `.str.replace()` and `.astype(float)` without crashing.
4. **Categorical Filter Precision Test**:
   - Test queries filtering on business dimensions (`"Product_Category"`, `"Region"`).
   - Verify that the query returns matching records rather than empty 0-row DataFrames.
5. **Memory Usage Verification**:
   - Confirm garbage collection and downsampler keep RAM safely within the 512 MB boundary.

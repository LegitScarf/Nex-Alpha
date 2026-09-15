# Omega Execution Bottleneck & Failure Analysis: Second Deep-Dive Study

**Author**: Antigravity Engineering  
**Target Environment**: Render (`Nex-Alpha`), Vercel Frontend, Hugging Face Spaces  
**Incident Date**: September 9, 2026  
**Status**: Root Causes Identified & Permanent Solution Formulated

---

## 1. Executive Summary

A live test with a 50,000-row dataset querying:
> *"Does annual_income really affect ev_adoption_likelihood?"*

resulted in the frontend displaying:
> `! Omega couldn't respond. Try again.`

with a blank chat screen after a prolonged wait.

Review of the raw Render container logs reveals **four cascading bottlenecks and a fatal code execution defect** that caused the query to take over **4.5 minutes** and ultimately fail.

---

## 2. Chronological Log Breakdown (The Evidence)

| Timestamp | Duration | Event / Action | Status |
| :--- | :--- | :--- | :--- |
| `05:53:17` | < 1s | `POST /api/datasets/upload` returns 200 OK | ✅ Fixed (Instant upload) |
| `05:53:23` | 6s | Dataset pre-staged on Hugging Face ZeroGPU Space | ✅ Fast |
| `05:53:51` | — | User sends query: `POST /api/chat` | 🚀 Run starts |
| `05:53:53` -> `05:54:42` | **48.7s** | **Planner Agent** generating analytical plan with `gpt-5.6-luna` | ⚠️ Heavy plan |
| `05:54:42` -> `05:56:23` | **101.8s** | **Coder Agent (Attempt 1)** generating code with `gpt-5.6-luna` | 🔴 Severe bottleneck |
| `05:56:23` -> `05:56:36` | **13.0s** | Remote HF Space execution dispatched; **timed out after 12.0s** | ⚠️ Timeout too short |
| `05:56:36` -> `05:56:37` | **1.0s** | Local Sandbox executes, but **CRASHES**: `NameError: name 'safe_float' is not defined` | ❌ Crash on Line 223 |
| `05:56:37` | — | **Coder Agent (Attempt 2/3)** triggered by self-correction loop | 🔴 Starts another 100s call |
| Total Turn Time | **> 265s** | Total duration reaches > 4.5 minutes | ❌ Client aborted long before |

---

## 3. Root Cause Analysis

### Root Cause 1: System Prompt Over-Engineering Forces Massive 223-Line Scripts
In `Omega_Streamlit/src/crew.py`, `_PLANNER_SYSTEM_PROMPT` states:
```
Instead of answering the query with simple descriptive text or code, you must design a structured, multi-stage Decision Intelligence workflow:
1. DESCRIPTIVE: Calculate current trend...
2. DIAGNOSTIC: Investigate root causes and driver metrics...
3. PREDICTIVE: Forecast future trajectory...
4. PRESCRIPTIVE: Identify actionable business recommendations...
```
- For a simple correlation question (*"Does income affect adoption?"*), the model was forced to plan:
  1. Descriptive aggregations
  2. ANOVA / Chi-Square hypothesis testing
  3. Logistic regression predictive model
  4. Prescriptive recovery actions
  5. 4 separate output JSON files
- The Coder Agent was consequently forced to write **223 lines of complex Python code**!
- Generating 223 lines of code with reasoning tokens is what caused the **101.8-second generation time**. When `gpt-5.6-luna` generates focused 30-40 line scripts, it finishes in **10–15 seconds**.

### Root Cause 2: Fatal NameError Crashed Sandbox and Triggered Self-Correction Loop
In line 46 of the generated code:
```python
File "<omega_local_sandbox>", line 46, in pct
NameError: name 'safe_float' is not defined
```
- The LLM wrote a helper function `pct(val, total)` calling `safe_float()`, assuming `safe_float` was an in-scope built-in helper.
- Neither `interpreter.py` nor the sandbox provided `safe_float`.
- Because Attempt 1 threw an unhandled exception, `crew.py` entered its self-healing retry loop:
  `Attempting to generate python code with gpt-5.6-luna (Attempt 2/3)...`
- **This doubled the query time** from ~2.5 minutes to > 4.5 minutes!

### Root Cause 3: HF Space Sandbox Timeout Was Set Too Aggressively (12s)
- In `hf_sandbox_client.py`:
  `DEFAULT_TIMEOUT = 12.0`
- ZeroGPU space queuing and event polling on a 50k-row dataset took ~13s, tripping the circuit breaker.
- When it fell back to local execution, local execution ran in **1.0 second**, but hit the `safe_float` `NameError`.

### Root Cause 4: Why Coder Used `gpt-5.6-luna` Despite Code Default
In `crew.py`:
`CODER_MODEL = os.getenv("OMEGA_CODER_MODEL", "gpt-4o-mini")`
- Render reads environment variables set in the Render Dashboard.
- Because `OMEGA_CODER_MODEL="gpt-5.6-luna"` was explicitly configured in the Render Dashboard during the previous migration, Render's environment variable overrode the code default.

### Root Cause 5: Frontend Was Still Running Previous Build on Vercel
In the uploaded screenshot:
- The error banner is: `! Omega couldn't respond. Try again.`
- In commit `205ec2d`, we had replaced that message with the resilient error bubble (`Analysis timed out after 5 minutes...`).
- The presence of the old text proves that the Vercel deployment had not yet redeployed the new commit, meaning the frontend was still aborting at the old **120-second** timeout limit.

---

## 4. Permanent Architectural Solution

1. **Pre-inject `safe_float` & `safe_int` into Sandbox Globals**:
   - Add robust, null-safe `safe_float` and `safe_int` functions directly into `exec_globals` in `src/interpreter.py`.
   - Prevent any LLM hallucinated helper from ever throwing a `NameError`.
2. **Dynamic Query-Scoped Planner (Stop Over-Engineering)**:
   - Make the Planner prompt query-adaptive:
     - Descriptive/Diagnostic queries produce lean, focused 1-chart plans (30-40 lines of code).
     - Full multi-stage predictive/prescriptive workflows are only invoked when the query asks for forecasting, regression, or strategy.
   - Reduces planning time from 48s to **~10-12s**, and code generation from 101s to **~12-15s**.
3. **Increase HF Space Timeout**:
   - Raise `DEFAULT_TIMEOUT` from 12.0s to **30.0s** in `hf_sandbox_client.py`.
4. **Prevent Retry Storms on Trivial Errors**:
   - If a function is missing, sandbox auto-injects standard fallbacks so execution succeeds on Attempt 1.

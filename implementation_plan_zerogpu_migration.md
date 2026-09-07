# Implementation Plan: Migrating Omega V3 to `gpt-5.6-luna` & Hugging Face Spaces ZeroGPU Sandboxed Execution

Migrate Omega V3's analytical code execution from in-process local execution to an air-gapped, elastic **Hugging Face Spaces ZeroGPU** sandbox container, while upgrading the Planner and Coder agents to **`gpt-5.6-luna`** with automated fallback to `o3-mini` and `gpt-4o-mini`.

---

## User Review Required

> [!IMPORTANT]
> **1. Hugging Face Space Authentication & Configuration**
> - The remote execution sandbox requires a Hugging Face Space (running the provided Gradio/ZeroGPU worker script).
> - Needs environment variables: `HF_SPACE_ID` (e.g. `your-org/omega-sandbox`), `HF_TOKEN` (Hugging Face User Access Token with read/write permissions for private spaces), and `OMEGA_SANDBOX_MODE` (`remote` or `hybrid`).
>
> **2. `gpt-5.6-luna` Model Availability**
> - The Planner and Coder models will default to `gpt-5.6-luna` via environment variables `OMEGA_PLANNER_MODEL` and `OMEGA_CODER_MODEL`.
> - If `gpt-5.6-luna` is not yet available or returns a 404/rate-limit error on your OpenAI/Azure API key, our resilient fallback wrapper will automatically route calls to `o3-mini` (Planner) and `gpt-4o-mini` (Coder) with zero interruption.

> [!WARNING]
> **Hybrid Circuit Breaker & Timeout Policy**
> - Remote calls to Hugging Face will enforce a strict **8.0-second network timeout**.
> - If the Hugging Face Space is cold-starting or queue-saturated, execution will failover automatically to the **fortified local sandbox** (enforced with process isolation, timeout limits, and memory capping) to maintain sub-3-second response times for end-users.

---

## Technical Constraints & Engineering Solutions

| Constraint | Root Cause | Architectural Solution in this Migration |
| :--- | :--- | :--- |
| **Cold Starts & Inactivity Sleep** | Free & PRO Spaces sleep after periods of inactivity (15–45s wake-up delay). | **Heartbeat Ping + Hybrid Fallback:** Periodic keep-warm ping daemon; if remote execution does not connect within 8s, fallback to fortified local sandbox. |
| **ZeroGPU Quotas & Queues** | ZeroGPU deducts quota upfront based on declared duration; simple operations risk queue waits. | **Dual-Track Router in Space:** Pure pandas/numpy queries run on Space's unlimited CPU pool. Only GPU-accelerated tasks (cuDF, PyTorch, heavy modeling) invoke `@spaces.GPU(duration=20)`. |
| **Data Sync Latency** | Re-uploading 10MB–50MB datasets per query turn creates bandwidth bottlenecks. | **Pre-Staging Parquet Cache:** Datasets are synced to the Space once during `/api/datasets/upload`. Subsequent chat requests pass only `dataset_id` and the `code` string. |
| **Subprocess Output Serialization** | ZeroGPU spawns dynamic worker sub-processes; disk artifacts can be lost upon worker exit. | **Memory-Based Artifact Return:** Sandbox collects all outputs (`chart.json`, `query_result.json`, `prediction.json`) in-memory and returns them directly in the API response JSON. |

---

## Proposed Changes

### 1. Model Tier Upgrade (`gpt-5.6-luna`)

#### [MODIFY] [Omega_Streamlit/src/crew.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/crew.py)
- Replace hardcoded `"o3-mini"` and `"gpt-4o-mini"` with configurable constants:
  - `PLANNER_MODEL = os.getenv("OMEGA_PLANNER_MODEL", "gpt-5.6-luna")`
  - `CODER_MODEL = os.getenv("OMEGA_CODER_MODEL", "gpt-5.6-luna")`
- Implement an automated fallback handler:
  ```python
  def _invoke_with_fallback(client, preferred_model, fallback_model, messages, **kwargs):
      try:
          return client.chat.completions.create(model=preferred_model, messages=messages, **kwargs)
      except Exception as e:
          logger.warning(f"Preferred model {preferred_model} failed: {e}. Falling back to {fallback_model}...")
          return client.chat.completions.create(model=fallback_model, messages=messages, **kwargs)
  ```
- Update system prompts and Coder blueprints to take advantage of `gpt-5.6-luna`'s unified reasoning and code synthesis.

---

### 2. Remote Hugging Face ZeroGPU Sandbox Integration

#### [NEW] [Omega_Streamlit/src/hf_sandbox_client.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/hf_sandbox_client.py)
- Create a dedicated client for interacting with the Hugging Face ZeroGPU Space:
  - `check_space_health() -> bool`: Probes the Space's `/health` endpoint to monitor warm/cold status.
  - `stage_dataset_remote(dataset_id: str, df: pd.DataFrame) -> bool`: Pre-stages the dataset as Parquet in the Space's cache.
  - `execute_remote_code(code: str, dataset_id: str, timeout: int = 15) -> Dict[str, Any]`: Dispatches code to the Space, handles authentication via `HF_TOKEN`, captures stdout/stderr, and returns output JSON artifacts.

#### [MODIFY] [Omega_Streamlit/src/interpreter.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/src/interpreter.py)
- Refactor `execute_code(code: str, df: pd.DataFrame)` into a **Hybrid Multi-Tier Executor**:
  1. Check `OMEGA_SANDBOX_MODE` (`remote`, `local`, `hybrid` — default `hybrid`).
  2. If `remote` or `hybrid`:
     - Attempt execution via `hf_sandbox_client.execute_remote_code()`.
     - Upon success, unpack all remote JSON artifacts (`chart.json`, `query_result.json`, `prediction.json`) and persist them into the active `session_output_dir`.
  3. If remote fails (timeout, network drop, cold start) and mode is `hybrid`:
     - Seamlessly execute on the local fortified sandbox.
     - Fortify local sandbox with timeout guards (`signal` / `threading.Timer`) and exception isolation to prevent server OOM/crashes.

---

### 3. Dataset Pre-Staging & Sync Hooks

#### [MODIFY] [Omega_Streamlit/api/index.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/api/index.py)
- In `upload_dataset` and `load_sample`, trigger an asynchronous background task to pre-stage the uploaded DataFrame to the Hugging Face Space via `stage_dataset_remote`.
- In `chat`, ensure the `dataset_id` is passed along to `run_omega` so the remote sandbox can load the cached Parquet file instantaneously without re-uploading tabular data.

---

### 4. ZeroGPU Space Deployment Template

#### [NEW] [Omega_Streamlit/hf_space/app.py](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/hf_space/app.py)
- Complete, production-ready Gradio + ZeroGPU application file ready to be copied or pushed directly to a Hugging Face Space:
  - Implements `@spaces.GPU(duration=25)` for heavy analytical workloads.
  - CPU worker path for lightweight pandas queries to conserve ZeroGPU quotas.
  - Safe in-memory execution environment with pre-injected mathematical helpers (`scipy`, `statsmodels`, `plotly`, `numpy`, `pandas`).
  - `/stage_dataset`, `/execute`, and `/health` API routes.

#### [NEW] [Omega_Streamlit/hf_space/requirements.txt](file:///c:/Users/KIIT/Desktop/Nex-Alpha/Omega_Streamlit/hf_space/requirements.txt)
- Dependencies for the Space: `gradio`, `spaces`, `pandas`, `numpy`, `scipy`, `statsmodels`, `plotly`, `pyarrow`, `scikit-learn`.

---

## Verification Plan

### Automated Tests
1. **Model Fallback Verification:**
   - Run a test query with `OMEGA_PLANNER_MODEL="gpt-5.6-luna"`. Verify that if the key does not have access, it falls back to `o3-mini`/`gpt-4o-mini` without raising an uncaught exception.
2. **Remote Sandbox Execution Test:**
   - Execute a mock regression and bar chart script against the remote Space driver (`scratch/test_remote_sandbox.py`).
   - Verify that output artifacts (`chart.json`, `prediction.json`) match the exact schema expected by the frontend.
3. **Circuit Breaker / Failover Test:**
   - Simulate a remote Space timeout (simulate invalid URL or 0.001s timeout) and verify that the system automatically falls back to local execution and returns a valid analytical response.

### Manual Verification
1. Launch NexAlpha, navigate to `/omega`, and upload the EV Adoption or Sales dataset.
2. Run complex queries (e.g. "What are the primary drivers of sales and plot a regression curve?").
3. Inspect the backend logs to confirm:
   - Successful dispatch to `gpt-5.6-luna`.
   - Successful remote execution on Hugging Face ZeroGPU.
   - Immediate rendering of the interactive regression slider and dynamic charts in the Next.js UI.

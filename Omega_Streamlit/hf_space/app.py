import os
import io
import sys
import json
import uuid
import math
import shutil
import contextlib
import traceback
from typing import Dict, Any, Optional
try:
    import gradio as gr
    HAS_GRADIO = True
except ImportError:
    gr = None
    HAS_GRADIO = False
import pandas as pd
import numpy as np
import scipy
from scipy import stats
try:
    import statsmodels
except ImportError:
    statsmodels = None
import plotly
import plotly.graph_objects as go
import plotly.express as px

# ZeroGPU support detection
try:
    import spaces
    HAS_ZEROGPU = True
except (ImportError, Exception):
    HAS_ZEROGPU = False
    class MockSpaces:
        @staticmethod
        def GPU(duration=60):
            def decorator(fn):
                return fn
            return decorator
    spaces = MockSpaces()

STORAGE_DIR = os.getenv("OMEGA_DATASET_CACHE_DIR", "/tmp/omega_datasets")
os.makedirs(STORAGE_DIR, exist_ok=True)

# ── Serialization Helper ────────────────────────────────────────────────────────
def serialize_safe(obj):
    if isinstance(obj, dict):
        return {str(k): serialize_safe(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [serialize_safe(x) for x in obj]
    elif isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        v = float(obj)
        if math.isnan(v) or math.isinf(v):
            return 0.0
        return v
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, (np.ndarray, pd.Series)):
        return serialize_safe(obj.tolist())
    elif isinstance(obj, pd.Index):
        return serialize_safe(obj.tolist())
    elif isinstance(obj, (pd.Interval, pd.Timestamp)):
        return str(obj)
    try:
        json.dumps(obj)
        return obj
    except TypeError:
        return str(obj)

# ── Predictive Analytics Helpers ───────────────────────────────────────────────
def fit_regression_model(df: pd.DataFrame, target_col: str, feature_cols: list) -> dict:
    if df is None or df.empty or target_col not in df.columns:
        return {"status": "failed", "error": "invalid_dataframe"}
    try:
        from sklearn.linear_model import LinearRegression
        clean = df[[target_col] + feature_cols].dropna()
        X = pd.get_dummies(clean[feature_cols], drop_first=True)
        y = clean[target_col]
        reg = LinearRegression().fit(X, y)
        preds = reg.predict(X).tolist()
        r2 = reg.score(X, y)
        coefs = {col: float(c) for col, c in zip(X.columns, reg.coef_)}
        return {
            "status": "regression",
            "target_column": target_col,
            "intercept": float(reg.intercept_),
            "coefficients": coefs,
            "predictions": preds,
            "model_metrics": {"r_squared": float(r2)}
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}

def fit_classification_model(df: pd.DataFrame, target_col: str, feature_cols: list) -> dict:
    if df is None or df.empty or target_col not in df.columns:
        return {"status": "failed", "error": "invalid_dataframe"}
    try:
        from sklearn.linear_model import LogisticRegression
        clean = df[[target_col] + feature_cols].dropna()
        X = pd.get_dummies(clean[feature_cols], drop_first=True)
        y = clean[target_col].astype(str)
        classes = sorted(list(y.unique()))
        clf = LogisticRegression(max_iter=1000).fit(X, y)
        preds = clf.predict(X).tolist()
        acc = clf.score(X, y)
        return {
            "status": "classification",
            "model_mode": "binary" if len(classes) == 2 else "multiclass",
            "target_column": target_col,
            "classes": classes,
            "class_0_label": classes[0] if classes else "0",
            "class_1_label": classes[1] if len(classes) > 1 else "1",
            "intercept": float(clf.intercept_[0]) if len(clf.intercept_) > 0 else 0.0,
            "coefficients": {col: float(c) for col, c in zip(X.columns, clf.coef_[0])},
            "predictions": preds,
            "model_metrics": {"accuracy": float(acc)}
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}

def fit_kmeans_clustering(df: pd.DataFrame, feature_cols: list, k: int = 3) -> dict:
    try:
        from sklearn.cluster import KMeans
        clean = df[feature_cols].dropna()
        X = pd.get_dummies(clean, drop_first=True)
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10).fit(X)
        return {
            "status": "clustering",
            "predictions": [int(p) for p in kmeans.labels_],
            "cluster_centers": kmeans.cluster_centers_.tolist()
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}

def forecast_time_series(df: pd.DataFrame, time_col: str, metric_col: str, horizon: int = 6) -> dict:
    try:
        clean = df[[time_col, metric_col]].dropna()
        clean[metric_col] = pd.to_numeric(clean[metric_col], errors='coerce')
        clean = clean.dropna()
        y = clean[metric_col].values
        x = np.arange(len(y))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        fore_x = np.arange(len(y), len(y) + horizon)
        fore_y = intercept + slope * fore_x
        return {
            "status": "success",
            "time_column": time_col,
            "metric_column": metric_col,
            "historical_dates": [str(d) for d in clean[time_col].tolist()],
            "historical_values": [float(v) for v in y.tolist()],
            "forecast_dates": [f"Period +{i+1}" for i in range(horizon)],
            "forecast_values": [float(v) for v in fore_y.tolist()],
            "model_metrics": {"r_squared": float(r_value**2), "std_err": float(std_err or 0.0)}
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}

# ── Execution Core ─────────────────────────────────────────────────────────────
def _run_in_sandbox(code: str, df: pd.DataFrame) -> Dict[str, Any]:
    artifacts = {}

    def write_output_json(filename: str, data: Dict[str, Any]) -> None:
        artifacts[filename] = serialize_safe(data)

    def get_output_path(filename: str) -> str:
        return f"/tmp/{filename}"

    def wrapped_regression(*args, **kwargs):
        res = fit_regression_model(*args, **kwargs)
        write_output_json("prediction.json", res)
        return res

    def wrapped_classification(*args, **kwargs):
        res = fit_classification_model(*args, **kwargs)
        write_output_json("prediction.json", res)
        return res

    def wrapped_kmeans(*args, **kwargs):
        res = fit_kmeans_clustering(*args, **kwargs)
        write_output_json("prediction.json", res)
        return res

    def wrapped_forecast(*args, **kwargs):
        res = forecast_time_series(*args, **kwargs)
        write_output_json("prediction.json", res)
        return res

    exec_globals = {
        "df": df.copy(),
        "pd": pd,
        "np": np,
        "json": json,
        "scipy": scipy,
        "statsmodels": statsmodels,
        "plotly": plotly,
        "go": go,
        "px": px,
        "get_output_path": get_output_path,
        "write_output_json": write_output_json,
        "fit_regression_model": wrapped_regression,
        "fit_classification_model": wrapped_classification,
        "fit_kmeans_clustering": wrapped_kmeans,
        "forecast_time_series": wrapped_forecast,
    }

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    success = True
    error_msg = None

    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            compiled = compile(code, "<omega_zerogpu_sandbox>", "exec")
            exec(compiled, exec_globals)
    except Exception as e:
        success = False
        tb = traceback.format_exc()
        error_msg = f"{str(e)}\n\nTraceback:\n{tb}"

    return {
        "success": success,
        "stdout": stdout_buf.getvalue(),
        "stderr": stderr_buf.getvalue(),
        "error": error_msg,
        "artifacts": artifacts
    }

# Dedicated GPU execution path
@spaces.GPU(duration=25)
def _execute_gpu_worker(code: str, df: pd.DataFrame) -> Dict[str, Any]:
    res = _run_in_sandbox(code, df)
    res["gpu_allocated"] = True
    return res

# Dedicated CPU execution path (unlimited, zero quota deducted)
def _execute_cpu_worker(code: str, df: pd.DataFrame) -> Dict[str, Any]:
    res = _run_in_sandbox(code, df)
    res["gpu_allocated"] = False
    return res

# ── API Handlers ───────────────────────────────────────────────────────────────
def handle_health():
    return json.dumps({
        "status": "healthy",
        "service": "Omega ZeroGPU Air-Gapped Sandbox",
        "zerogpu_active": HAS_ZEROGPU,
        "cached_datasets": len(os.listdir(STORAGE_DIR)) if os.path.exists(STORAGE_DIR) else 0
    })

def handle_stage_dataset(dataset_id: str, raw_csv_or_json: str):
    if not dataset_id:
        return json.dumps({"success": False, "error": "dataset_id required"})
    path = os.path.join(STORAGE_DIR, f"{dataset_id}.parquet")
    try:
        stripped = raw_csv_or_json.strip()
        if stripped.startswith("[") or stripped.startswith("{"):
            df = pd.read_json(io.StringIO(raw_csv_or_json))
        else:
            df = pd.read_csv(io.StringIO(raw_csv_or_json))
        df.columns = [str(c).strip() for c in df.columns]
        df.to_parquet(path, index=False)
        return json.dumps({
            "success": True,
            "status": "staged",
            "dataset_id": dataset_id,
            "rows": int(len(df)),
            "columns": df.columns.tolist()
        })
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

def handle_execute(dataset_id: str, code: str, raw_csv_fallback: str = "", require_gpu: bool = False):
    df = None
    path = os.path.join(STORAGE_DIR, f"{dataset_id}.parquet")
    if os.path.exists(path):
        try:
            df = pd.read_parquet(path)
        except Exception:
            df = None
    if df is None and raw_csv_fallback:
        try:
            df = pd.read_csv(io.StringIO(raw_csv_fallback))
        except Exception:
            pass

    if df is None:
        return json.dumps({
            "success": False,
            "error": f"Dataset {dataset_id} not found in cache. Please stage dataset first.",
            "artifacts": {}
        })

    # Dispatch to GPU or CPU worker
    if require_gpu and HAS_ZEROGPU:
        result = _execute_gpu_worker(code, df)
    else:
        result = _execute_cpu_worker(code, df)

    return json.dumps(result)

# ── Gradio Public Interface ───────────────────────────────────────────────────
if HAS_GRADIO:
    with gr.Blocks(title="Omega ZeroGPU Sandbox") as demo:
        gr.Markdown("## ⚡ NexAlpha Omega — Public ZeroGPU Execution Sandbox")
    gr.Markdown("Air-gapped computational backend executing agentic data science routines on NVIDIA hardware.")

    with gr.Tab("Execute Code"):
        in_dataset_id = gr.Textbox(label="Dataset ID", placeholder="uuid-string")
        in_code = gr.Code(label="Python Code Script", language="python")
        in_fallback_csv = gr.Textbox(label="Fallback CSV (Optional)", visible=False)
        in_require_gpu = gr.Checkbox(label="Require GPU Acceleration", value=False)
        btn_run = gr.Button("Execute in Sandbox", variant="primary")
        out_json = gr.JSON(label="Execution Result and Artifacts")
        btn_run.click(
            fn=handle_execute,
            inputs=[in_dataset_id, in_code, in_fallback_csv, in_require_gpu],
            outputs=[out_json],
            api_name="execute"
        )

    with gr.Tab("Stage Dataset"):
        stage_id = gr.Textbox(label="Dataset ID")
        stage_csv = gr.Textbox(label="Raw CSV / JSON Content", lines=10)
        btn_stage = gr.Button("Stage Dataset")
        stage_out = gr.JSON(label="Staging Status")
        btn_stage.click(
            fn=handle_stage_dataset,
            inputs=[stage_id, stage_csv],
            outputs=[stage_out],
            api_name="stage_dataset"
        )

    with gr.Tab("Health"):
        btn_health = gr.Button("Check Health")
        health_out = gr.JSON(label="Health Status")
        btn_health.click(fn=handle_health, inputs=[], outputs=[health_out], api_name="health")

if __name__ == "__main__" and HAS_GRADIO and demo:
    demo.queue().launch()

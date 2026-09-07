import io
import os
import sys
import logging
import traceback
import contextlib
import json
import pandas as pd
import numpy as np
import scipy
try:
    import statsmodels
except ImportError:
    statsmodels = None
import plotly
import plotly.graph_objects as go
import plotly.express as px
from typing import Dict, Any, Optional

from .hf_sandbox_client import (
    is_remote_configured,
    execute_remote_code,
)

logger = logging.getLogger("Omega.Interpreter")
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter(
        "%(asctime)s — %(levelname)s — %(name)s — %(message)s",
        "%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(ch)
    logger.setLevel(logging.INFO)

# Sandbox execution modes: "remote" (HF Space only), "local" (host only), "hybrid" (remote with local fallback)
SANDBOX_MODE = os.getenv("OMEGA_SANDBOX_MODE", "hybrid").lower()


def execute_code(
    code: str,
    df: pd.DataFrame,
    dataset_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes Python analytical code in a multi-tier sandbox:
    1. If mode is 'remote' or 'hybrid', dispatches to Hugging Face Spaces ZeroGPU.
    2. Unpacks remote JSON artifacts directly into the local session directory.
    3. If remote execution fails or is unconfigured in 'hybrid' mode, falls back to fortified local execution.
    """
    from .utils import get_output_path
    from .predictive import (
        fit_regression_model,
        fit_classification_model,
        fit_kmeans_clustering,
        forecast_time_series
    )

    def serialize_safe(obj):
        if isinstance(obj, dict):
            return {str(k): serialize_safe(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple, set)):
            return [serialize_safe(x) for x in obj]
        elif isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
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

    def write_output_json(filename: str, data: Dict[str, Any]) -> None:
        safe_data = serialize_safe(data)
        if filename == "prediction.json":
            path = get_output_path(filename)
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as rf:
                        existing = json.load(rf)
                    if isinstance(existing, dict) and "status" in existing and existing.get("status") in ["regression", "classification", "success"]:
                        if "status" not in safe_data or safe_data.get("status") == "skipped":
                            for key in ["predictions", "predicted_values", "predicted", "error"]:
                                if key in safe_data:
                                    existing[key] = safe_data[key]
                            safe_data = existing
                except Exception:
                    pass
        with open(get_output_path(filename), "w", encoding="utf-8") as f:
            json.dump(safe_data, f, indent=2)

    # ── Tier 1: Remote Hugging Face ZeroGPU Sandbox ─────────────────────────────
    if SANDBOX_MODE in ["remote", "hybrid"] and is_remote_configured():
        logger.info(f"Attempting execution on Hugging Face Spaces ZeroGPU sandbox (Mode: {SANDBOX_MODE})...")
        effective_dataset_id = dataset_id or "default_dataset"
        
        # Check if code requires GPU (heavy models or PyTorch)
        require_gpu = any(k in code.lower() for k in ["torch", "cuda", "gpu", "neural", "kmeans", "cluster"])
        remote_res = execute_remote_code(
            code=code,
            dataset_id=effective_dataset_id,
            df=df,
            require_gpu=require_gpu
        )

        if remote_res.get("success"):
            logger.info("Remote Hugging Face ZeroGPU sandbox execution succeeded!")
            # Unpack returned artifacts to local session output directory
            artifacts = remote_res.get("artifacts", {})
            for fname, payload in artifacts.items():
                try:
                    write_output_json(fname, payload)
                except Exception as unpack_err:
                    logger.warning(f"Could not persist artifact {fname}: {unpack_err}")

            return {
                "success": True,
                "stdout": remote_res.get("stdout", ""),
                "stderr": remote_res.get("stderr", ""),
                "error": None,
                "locals": {},
                "remote": True,
                "gpu_allocated": remote_res.get("gpu_allocated", False)
            }
        else:
            logger.warning(f"Remote sandbox execution failed: {remote_res.get('error')}")
            if SANDBOX_MODE == "remote":
                return {
                    "success": False,
                    "stdout": remote_res.get("stdout", ""),
                    "stderr": remote_res.get("stderr", ""),
                    "error": remote_res.get("error", "Remote sandbox failure"),
                    "locals": {},
                    "remote": True
                }
            logger.info("Failing over to fortified local sandbox...")

    # ── Tier 2: Fortified Local Execution Sandbox ──────────────────────────────
    logger.info("Executing in fortified local sandbox...")
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
        "fit_regression_model": fit_regression_model,
        "fit_classification_model": fit_classification_model,
        "fit_kmeans_clustering": fit_kmeans_clustering,
        "forecast_time_series": forecast_time_series,
    }
    exec_locals = {}

    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()

    success = True
    error_message = None

    try:
        with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
            compiled_code = compile(code, "<omega_local_sandbox>", "exec")
            exec(compiled_code, exec_globals, exec_locals)
    except Exception as e:
        success = False
        tb = traceback.format_exc()
        error_message = f"{str(e)}\n\nTraceback:\n{tb}"

    stdout_val = stdout_buffer.getvalue()
    stderr_val = stderr_buffer.getvalue()

    return {
        "success": success,
        "stdout": stdout_val,
        "stderr": stderr_val,
        "error": error_message,
        "locals": exec_locals,
        "remote": False
    }

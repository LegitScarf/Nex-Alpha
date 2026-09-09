import os
import io
import json
import logging
import requests
import pandas as pd
from typing import Dict, Any, Optional

logger = logging.getLogger("Omega.HFSandbox")
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter(
        "%(asctime)s — %(levelname)s — %(name)s — %(message)s",
        "%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(ch)
    logger.setLevel(logging.INFO)

# Public Hugging Face Space configuration
# No HF_TOKEN is required for public Spaces.
HF_SPACE_URL = os.getenv("HF_SPACE_URL", "").rstrip("/")
HF_SPACE_ID = os.getenv("HF_SPACE_ID", "")
HF_TOKEN = os.getenv("HF_TOKEN", None)
DEFAULT_TIMEOUT = float(os.getenv("OMEGA_SANDBOX_TIMEOUT", "30.0"))

def get_effective_space_url() -> str:
    global HF_SPACE_URL
    if HF_SPACE_URL:
        return HF_SPACE_URL
    if HF_SPACE_ID:
        # Construct standard HF Space direct domain: user-space-name.hf.space
        slug = HF_SPACE_ID.replace("/", "-").lower()
        return f"https://{slug}.hf.space"
    return ""

def is_remote_configured() -> bool:
    return bool(get_effective_space_url())

def _build_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"
    return headers

def check_space_health(timeout: float = 3.5) -> bool:
    url = get_effective_space_url()
    if not url:
        return False
    try:
        # First try standard gradio api call
        endpoint = f"{url}/gradio_api/call/health"
        resp = requests.post(endpoint, json={"data": []}, headers=_build_headers(), timeout=timeout)
        if resp.status_code == 200:
            return True
        # Direct GET fallback
        resp2 = requests.get(f"{url}/", timeout=timeout)
        return resp2.status_code == 200
    except Exception as e:
        logger.debug(f"Space health check failed: {e}")
        return False

def stage_dataset_remote(dataset_id: str, df: pd.DataFrame, timeout: float = 10.0) -> bool:
    """
    Pre-stages the dataset in the remote HF Space cache (/tmp/omega_datasets/{id}.parquet).
    Subsequent execution calls only pass dataset_id without re-uploading large data frames.
    """
    url = get_effective_space_url()
    if not url or df is None or df.empty:
        return False

    try:
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        raw_csv = csv_buffer.getvalue()

        endpoint = f"{url}/gradio_api/call/stage_dataset"
        payload = {"data": [dataset_id, raw_csv]}
        resp = requests.post(endpoint, json=payload, headers=_build_headers(), timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            event_id = data.get("event_id")
            if event_id:
                # Poll result
                res_url = f"{url}/gradio_api/call/stage_dataset/{event_id}"
                poll_resp = requests.get(res_url, headers=_build_headers(), timeout=timeout)
                if poll_resp.status_code == 200:
                    logger.info(f"Dataset {dataset_id} successfully pre-staged on Hugging Face ZeroGPU Space.")
                    return True
            return True
    except Exception as e:
        logger.warning(f"Failed to pre-stage dataset {dataset_id} to HF Space: {e}")
    return False

def execute_remote_code(
    code: str,
    dataset_id: str,
    df: Optional[pd.DataFrame] = None,
    require_gpu: bool = False,
    timeout: float = DEFAULT_TIMEOUT
) -> Dict[str, Any]:
    """
    Dispatches Python code to execute in the public Hugging Face ZeroGPU Space.
    Returns:
    {
        'success': bool,
        'stdout': str,
        'stderr': str,
        'error': Optional[str],
        'artifacts': dict,
        'gpu_allocated': bool,
        'remote': True
    }
    """
    url = get_effective_space_url()
    if not url:
        return {
            "success": False,
            "error": "Remote HF Space URL not configured.",
            "artifacts": {},
            "remote": False
        }

    # Prepare fallback CSV in case dataset wasn't pre-staged yet
    fallback_csv = ""
    if df is not None and not df.empty:
        # Only send first 500 rows as emergency fallback to keep payload small
        buf = io.StringIO()
        df.head(500).to_csv(buf, index=False)
        fallback_csv = buf.getvalue()

    endpoint = f"{url}/gradio_api/call/execute"
    payload = {
        "data": [
            dataset_id,
            code,
            fallback_csv,
            require_gpu
        ]
    }

    try:
        logger.info(f"Dispatching code to HF ZeroGPU Space ({url})...")
        resp = requests.post(endpoint, json=payload, headers=_build_headers(), timeout=timeout)
        if resp.status_code != 200:
            return {
                "success": False,
                "error": f"HF Space responded with HTTP {resp.status_code}: {resp.text[:200]}",
                "artifacts": {},
                "remote": True
            }

        event_data = resp.json()
        event_id = event_data.get("event_id")
        if not event_id:
            # Direct response format
            raw_out = event_data.get("data", [None])[0]
            if isinstance(raw_out, str):
                return json.loads(raw_out)
            elif isinstance(raw_out, dict):
                return raw_out
            return {"success": False, "error": "Invalid output from HF Space", "artifacts": {}}

        # Read streaming SSE event / result
        res_url = f"{url}/gradio_api/call/execute/{event_id}"
        poll_resp = requests.get(res_url, headers=_build_headers(), timeout=timeout)
        if poll_resp.status_code == 200:
            lines = poll_resp.text.strip().split("\n")
            for line in lines:
                if line.startswith("data:"):
                    raw_json = line[5:].strip()
                    try:
                        parsed = json.loads(raw_json)
                        if isinstance(parsed, list) and len(parsed) > 0:
                            item = parsed[0]
                            if isinstance(item, str):
                                item = json.loads(item)
                            item["remote"] = True
                            return item
                    except Exception:
                        pass

        return {
            "success": False,
            "error": "Failed to parse streaming response from HF Space.",
            "artifacts": {},
            "remote": True
        }

    except requests.exceptions.Timeout:
        logger.warning(f"HF Space timed out after {timeout}s. Tripping circuit breaker to local sandbox.")
        return {
            "success": False,
            "error": f"Remote sandbox execution timed out after {timeout}s.",
            "timeout": True,
            "artifacts": {},
            "remote": True
        }
    except Exception as e:
        logger.warning(f"Remote execution failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "artifacts": {},
            "remote": True
        }

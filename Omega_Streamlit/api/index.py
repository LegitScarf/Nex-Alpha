import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from Next.js root configuration or local config
def load_env_vars():
    try:
        # Check standard root locations
        paths = [
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
            ".env"
        ]
        for path in paths:
            if os.path.exists(path):
                print(f"Loading env parameters from: {path}")
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            k = key.strip()
                            if k not in os.environ:
                                os.environ[k] = val.strip().strip('"').strip("'")
    except Exception as e:
        print(f"Failed to auto-load env variables: {e}")

load_env_vars()

import base64
import requests
import jwt
from fastapi import Depends, Header, Query, status
from jwt.exceptions import PyJWTError
from api.database import init_db, log_chat, get_chat_history, get_user_sessions, check_and_increment_limits, register_persistent_dataset, get_persistent_dataset

from src.tools import register_dataset
from src.semantic_model import bootstrap_business_model
from src.crew import run_omega
from src.utils import load_json_file, get_output_path, session_output_dir

# Initialize database schemas
init_db()

# Create FastAPI app instance
app = FastAPI(title="Omega — Decoupled Backend", version="3.0")


# Enable CORS for direct frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clerk Configuration for user authentication validation
jwks_cache = None

def get_jwks_keys():
    global jwks_cache
    if jwks_cache is not None:
        return jwks_cache

    url = os.getenv("CLERK_JWKS_URL")
    headers = {}

    if not url:
        pub_key = os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") or os.getenv("CLERK_PUBLISHABLE_KEY")
        if pub_key:
            try:
                parts = pub_key.split('_')
                if len(parts) >= 3:
                    encoded = parts[2]
                    padded = encoded + "=" * (4 - len(encoded) % 4)
                    decoded = base64.b64decode(padded).decode('utf-8')
                    domain = decoded.rstrip('$')
                    url = f"https://{domain}/.well-known/jwks.json"
            except Exception as e:
                print(f"Error parsing publishable key for JWKS: {e}")

    if not url:
        url = "https://api.clerk.com/v1/jwks"
        secret_key = os.getenv("CLERK_SECRET_KEY")
        if secret_key:
            headers["Authorization"] = f"Bearer {secret_key}"

    try:
        response = requests.get(url, headers=headers, timeout=6)
        response.raise_for_status()
        jwks_cache = response.json().get("keys", [])
        return jwks_cache
    except Exception as e:
        print(f"Failed to fetch JWKS keys from Clerk: {e}")
        return []

def verify_clerk_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    
    token = authorization.split(" ")[1]
    keys = get_jwks_keys()
    
    if not keys:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWKS keys unavailable",
        )
        
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token format: {str(e)}",
        )

    public_key = None
    for key in keys:
        if key.get("kid") == kid:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
            break
            
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown signing key",
        )

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return payload
    except PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )


# In-process cache of dataframes
DATASETS: Dict[str, pd.DataFrame] = {}
DATASET_NAMES: Dict[str, str] = {}

def resolve_dataframe(dataset_id: str) -> Optional[pd.DataFrame]:
    # Check memory cache first
    df = DATASETS.get(dataset_id)
    if df is not None:
        return df
        
    # Check SQLite metadata database for persistence
    meta = get_persistent_dataset(dataset_id)
    if not meta:
        return None
        
    file_path = meta["file_path"]
    if not os.path.exists(file_path):
        return None
        
    try:
        suffix = os.path.splitext(file_path)[1].lower()
        if suffix == '.csv':
            df = pd.read_csv(file_path)
        elif suffix == '.tsv':
            df = pd.read_csv(file_path, sep='\t')
        elif suffix == '.json':
            df = pd.read_json(file_path)
        else:
            df = pd.read_excel(file_path)
            
        df.columns = [str(c).strip() for c in df.columns]
        
        # Hydrate in-memory cache and name mappings
        DATASETS[dataset_id] = df
        DATASET_NAMES[dataset_id] = meta["filename"]
        
        # Register dataset in semantic/crew tools state
        register_dataset(dataset_id, df)
        
        return df
    except Exception as e:
        print(f"Failed to reload dataset {dataset_id} from disk: {e}")
        return None

class DatasetSummary(BaseModel):
    id: str
    name: str
    rows: int
    columns: List[str]
    dtypes: Dict[str, str]
    preview: List[Dict[str, Any]]
    created_at: str

class ChatRequest(BaseModel):
    dataset_id: str
    session_id: Optional[str] = None
    message: str

class ChartSpec(BaseModel):
    type: str  # bar | line | pie
    title: Optional[str] = None
    x_key: Optional[str] = None
    y_key: Optional[str] = None
    data: List[Dict[str, Any]] = []

class ChatResponse(BaseModel):
    session_id: str
    answer: str
    followups: List[str] = []
    components: List[Dict[str, Any]] = []

class SampleRequest(BaseModel):
    name: str  # "sales" | "customers" | "marketing"

# Pre-defined sample datasets
SAMPLES = {
    "sales": {
        "columns": ["month", "region", "product", "units", "revenue"],
        "rows": [
            ["Jan", "North", "Alpha", 120, 24000],
            ["Jan", "South", "Alpha", 90, 18000],
            ["Jan", "North", "Beta", 60, 21000],
            ["Feb", "North", "Alpha", 140, 28000],
            ["Feb", "South", "Alpha", 110, 22000],
            ["Feb", "North", "Beta", 80, 28000],
            ["Mar", "North", "Alpha", 160, 32000],
            ["Mar", "South", "Alpha", 130, 26000],
            ["Mar", "North", "Beta", 95, 33250],
            ["Apr", "North", "Alpha", 180, 36000],
            ["Apr", "South", "Alpha", 140, 28000],
            ["Apr", "North", "Beta", 105, 36750],
            ["May", "North", "Alpha", 210, 42000],
            ["May", "South", "Alpha", 155, 31000],
            ["May", "North", "Beta", 120, 42000],
            ["Jun", "North", "Alpha", 230, 46000],
            ["Jun", "South", "Alpha", 170, 34000],
            ["Jun", "North", "Beta", 135, 47250],
        ],
    },
    "customers": {
        "columns": ["segment", "customers", "avg_order_value", "churn_rate"],
        "rows": [
            ["Enterprise", 42, 12400, 0.04],
            ["Mid-Market", 138, 3800, 0.09],
            ["SMB", 512, 620, 0.18],
            ["Startup", 289, 240, 0.24],
            ["Consumer", 1420, 68, 0.31],
        ],
    },
    "marketing": {
        "columns": ["channel", "spend", "clicks", "conversions", "cpa"],
        "rows": [
            ["Google", 12000, 32000, 640, 18.75],
            ["Meta", 9800, 28500, 512, 19.14],
            ["LinkedIn", 6500, 8400, 190, 34.21],
            ["TikTok", 4200, 22000, 310, 13.55],
            ["Email", 1200, 9800, 420, 2.86],
            ["Podcast", 3400, 5600, 88, 38.64],
        ],
    },
}

def resolve_plotly_array(val):
    """Decodes Plotly Base64 binary arrays (bdata) back to regular Python lists if present."""
    if isinstance(val, dict) and "bdata" in val and "dtype" in val:
        try:
            import base64
            import numpy as np
            bdata = base64.b64decode(val["bdata"])
            dtype = val["dtype"]
            arr = np.frombuffer(bdata, dtype=dtype)
            return arr.tolist()
        except Exception:
            return []
    return val

def convert_plotly_to_recharts(plotly_spec) -> Optional[ChartSpec]:
    """Helper to convert the first trace of a Plotly figure to a Recharts-compliant ChartSpec."""
    if not plotly_spec:
        return None
        
    traces = []
    if "data" in plotly_spec:
        traces = plotly_spec["data"]
    elif isinstance(plotly_spec, dict):
        for k, v in plotly_spec.items():
            if isinstance(v, dict) and "data" in v:
                traces = v["data"]
                break
                
    if not traces or not isinstance(traces, list):
        return None
        
    trace = traces[0]
    t_type = trace.get("type", "bar")
    
    title_text = "Analysis Chart"
    if "layout" in plotly_spec and isinstance(plotly_spec["layout"], dict):
        title_obj = plotly_spec["layout"].get("title")
        if isinstance(title_obj, dict):
            title_text = title_obj.get("text", title_text)
        elif isinstance(title_obj, str):
            title_text = title_obj

    # Handle Heatmap / Correlation Matrix (2D z-array)
    if t_type == "heatmap" or "z" in trace:
        z = resolve_plotly_array(trace.get("z", []))
        x = resolve_plotly_array(trace.get("x", []))
        if z and isinstance(z, list) and x and isinstance(x, list):
            # Take the first row (correlations of all features with the primary target variable)
            row_data = z[0]
            recharts_data = []
            for xi, val in zip(x, row_data):
                try:
                    f_val = float(val)
                    import math
                    if math.isnan(f_val) or math.isinf(f_val):
                        f_val = 0.0
                except Exception:
                    f_val = 0.0
                recharts_data.append({"name": str(xi), "value": round(f_val, 4)})
            return ChartSpec(
                type="bar",
                title=title_text,
                x_key="name",
                y_key="value",
                data=recharts_data
            )

    # Standard chart trace parsing
    x = resolve_plotly_array(trace.get("x", []))
    y = resolve_plotly_array(trace.get("y", []))
    
    # Fallback to labels/values for Pie charts or similar structures
    if not x and "labels" in trace:
        x = resolve_plotly_array(trace["labels"])
    if not y and "values" in trace:
        y = resolve_plotly_array(trace["values"])
        
    if not x or not y:
        return None
        
    if t_type not in ["bar", "line", "pie"]:
        t_type = "bar"
        
    recharts_data = []
    for xi, yi in zip(x, y):
        try:
            val = float(yi)
            import math
            if math.isnan(val) or math.isinf(val):
                val = 0.0
        except Exception:
            val = 0.0
        recharts_data.append({"name": str(xi), "value": val})

    return ChartSpec(
        type=t_type,
        title=title_text,
        x_key="name",
        y_key="value",
        data=recharts_data
    )

@app.post("/api/datasets/upload", response_model=DatasetSummary)
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.tsv', '.txt', '.xlsx', '.xls', '.json')):
        raise HTTPException(status_code=400, detail="Unsupported file format.")

    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    dataset_id = str(uuid.uuid4())
    persistent_path = os.path.join(uploads_dir, f"{dataset_id}_{file.filename}")
    
    try:
        with open(persistent_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        suffix = os.path.splitext(file.filename)[1].lower()
        if suffix == '.csv':
            df = pd.read_csv(persistent_path)
        elif suffix == '.tsv':
            df = pd.read_csv(persistent_path, sep='\t')
        elif suffix == '.json':
            df = pd.read_json(persistent_path)
        else:
            df = pd.read_excel(persistent_path)
            
        df.columns = [str(c).strip() for c in df.columns]
        DATASETS[dataset_id] = df
        DATASET_NAMES[dataset_id] = file.filename
        
        # Register dataset globally in crew state
        register_dataset(dataset_id, df)
        
        # Store metadata persistently in SQLite database
        dtypes_map = {c: str(t) for c, t in df.dtypes.items()}
        register_persistent_dataset(
            dataset_id=dataset_id,
            filename=file.filename,
            file_path=persistent_path,
            row_count=int(len(df)),
            columns=df.columns.tolist(),
            dtypes=dtypes_map
        )
        
        try:
            bootstrap_business_model(df)
        except Exception as e:
            print(f"Non-critical: Business model bootstrap skipped: {e}")
        
        # Build dataset preview
        preview = df.head(8).astype(str).to_dict(orient="records")
        
        return DatasetSummary(
            id=dataset_id,
            name=file.filename,
            rows=int(len(df)),
            columns=df.columns.tolist(),
            dtypes=dtypes_map,
            preview=preview,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        if os.path.exists(persistent_path):
            try:
                os.remove(persistent_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")

@app.post("/api/datasets/sample", response_model=DatasetSummary)
async def load_sample(req: SampleRequest):
    if req.name not in SAMPLES:
        raise HTTPException(status_code=404, detail="Sample dataset not found.")
        
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    s = SAMPLES[req.name]
    df = pd.DataFrame(s["rows"], columns=s["columns"])
    
    dataset_id = str(uuid.uuid4())
    filename = f"{req.name}.csv"
    persistent_path = os.path.join(uploads_dir, f"{dataset_id}_{filename}")
    
    try:
        df.to_csv(persistent_path, index=False)
        DATASETS[dataset_id] = df
        DATASET_NAMES[dataset_id] = filename
        
        register_dataset(dataset_id, df)
        
        # Store metadata persistently in SQLite database
        dtypes_map = {c: str(t) for c, t in df.dtypes.items()}
        register_persistent_dataset(
            dataset_id=dataset_id,
            filename=filename,
            file_path=persistent_path,
            row_count=int(len(df)),
            columns=df.columns.tolist(),
            dtypes=dtypes_map
        )
        
        try:
            bootstrap_business_model(df)
        except Exception as e:
            print(f"Non-critical: Business model bootstrap skipped: {e}")
        preview = df.head(8).astype(str).to_dict(orient="records")
        
        return DatasetSummary(
            id=dataset_id,
            name=filename,
            rows=int(len(df)),
            columns=df.columns.tolist(),
            dtypes=dtypes_map,
            preview=preview,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        if os.path.exists(persistent_path):
            try:
                os.remove(persistent_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to process sample: {str(e)}")

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, authorization: dict = Depends(verify_clerk_token)):
    user_id = authorization.get("sub")
    tier = authorization.get("public_metadata", {}).get("tier", "free")
    
    # Enforce daily limit check (e.g. 5 queries/day for free tier)
    if tier == "free":
        allowed = check_and_increment_limits(user_id, limit=5)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, 
                detail="Daily analytical query limit reached (5 queries/day). Please upgrade your workspace."
            )

    df = resolve_dataframe(req.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload again.")
        
    # Re-register dataset to set active session
    register_dataset(req.dataset_id, df)
    
    session_id = req.session_id or str(uuid.uuid4())
    
    # Isolate directory outputs per session ID
    session_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output", session_id)
    token = session_output_dir.set(session_dir)
    
    try:
        # Run agentic analysis loop using Omega V3 crew.py
        final_insight = run_omega(
            user_query=req.message,
            dataframe=df,
            step_callback=None,
            task_callback=None,
            chat_history=None
        )
        
        # Load and convert all generated chart files (chart.json, chart_1.json, chart_2.json, chart_3.json)
        charts_list = []
        for c_file in ["chart.json", "chart_1.json", "chart_2.json", "chart_3.json"]:
            path = get_output_path(c_file)
            if os.path.exists(path):
                try:
                    c_data = load_json_file(path)
                    if c_data and c_data.get("status") == "success" and c_data.get("plotly_spec"):
                        plotly_spec = c_data["plotly_spec"]
                        if isinstance(plotly_spec, str):
                            import json
                            plotly_spec = json.loads(plotly_spec)
                        c_spec = convert_plotly_to_recharts(plotly_spec)
                        if c_spec:
                            charts_list.append(c_spec)
                except Exception:
                    pass
                
        # Build answer response
        answer = final_insight.get("insight_text", "")
        if not answer:
            answer = final_insight.get("key_metric", "Analysis completed successfully.")
            
        followups = final_insight.get("follow_up_suggestions", [])
        if not followups:
            followups = ["Can you elaborate on these trends?", "Show me a distribution plot.", "What are the key contributors?"]
            
        # Build dynamic visual components list
        components = []
        raw_components = final_insight.get("components", [])
        
        if not raw_components or not isinstance(raw_components, list):
            # Fallback to structured sequence
            components.append({"type": "markdown", "content": answer})
            for c_spec in charts_list:
                components.append({"type": "chart", "spec": c_spec.dict()})
            
            strats = final_insight.get("strategies", [])
            if strats:
                components.append({"type": "strategies", "strategies": strats})
                
            p_matrix = final_insight.get("priority_matrix", [])
            if p_matrix:
                components.append({"type": "priority_matrix", "priority_matrix": p_matrix})
                
            r_list = final_insight.get("risks", [])
            if r_list:
                components.append({"type": "risks", "risks": r_list})
        else:
            has_chart_block = False
            for comp in raw_components:
                c_type = comp.get("type", "")
                if c_type == "chart":
                    has_chart_block = True
                    p_spec = comp.get("plotly_spec")
                    if p_spec:
                        c_spec = convert_plotly_to_recharts(p_spec)
                        if c_spec:
                            components.append({"type": "chart", "spec": c_spec.dict()})
                    elif charts_list:
                        components.append({"type": "chart", "spec": charts_list[0].dict()})
                elif c_type == "markdown":
                    components.append({"type": "markdown", "content": comp.get("content", "")})
                elif c_type == "metric_grid":
                    components.append({"type": "metric_grid", "metrics": comp.get("metrics", [])})
                elif c_type == "table":
                    components.append({
                        "type": "table",
                        "headers": comp.get("headers", []),
                        "rows": comp.get("rows", [])
                    })
                    
            if not has_chart_block and charts_list:
                insert_idx = 1 if len(components) > 1 else len(components)
                for idx, c_spec in enumerate(charts_list):
                    components.insert(insert_idx + idx, {"type": "chart", "spec": c_spec.dict()})
                    
        # Check for predictive prediction models and inject real-time simulators
        prediction_path = get_output_path("prediction.json")
        if os.path.exists(prediction_path):
            try:
                prediction_data = load_json_file(prediction_path)
                if prediction_data and prediction_data.get("status") in ["regression", "classification", "success"]:
                    p_status = prediction_data.get("status")
                    if p_status == "regression":
                        components.append({
                            "type": "regression_predictor",
                            "target_column": prediction_data.get("target_column"),
                            "intercept": prediction_data.get("intercept", 0.0),
                            "coefficients": prediction_data.get("coefficients", {}),
                            "features": prediction_data.get("features", []),
                            "dummy_mappings": prediction_data.get("dummy_mappings", {}),
                            "model_metrics": prediction_data.get("model_metrics", {})
                        })
                    elif p_status == "classification":
                        components.append({
                            "type": "classification_predictor",
                            "model_mode": prediction_data.get("model_mode", "binary"),
                            "target_column": prediction_data.get("target_column"),
                            "features": prediction_data.get("features", []),
                            "model_metrics": prediction_data.get("model_metrics", {}),
                            "dummy_mappings": prediction_data.get("dummy_mappings", {}),
                            "intercept": prediction_data.get("intercept", 0.0),
                            "coefficients": prediction_data.get("coefficients", {}),
                            "class_0_label": prediction_data.get("class_0_label", "0"),
                            "class_1_label": prediction_data.get("class_1_label", "1"),
                            "classes": prediction_data.get("classes", []),
                            "intercepts": prediction_data.get("intercepts", {})
                        })
                    elif p_status == "success":
                        components.append({
                            "type": "forecast_predictor",
                            "time_column": prediction_data.get("time_column"),
                            "metric_column": prediction_data.get("metric_column"),
                            "model_metrics": prediction_data.get("model_metrics", {}),
                            "historical_dates": prediction_data.get("historical_dates", []),
                            "historical_values": prediction_data.get("historical_values", []),
                            "forecast_dates": prediction_data.get("forecast_dates", []),
                            "forecast_values": prediction_data.get("forecast_values", []),
                            "lower_bound": prediction_data.get("lower_bound", []),
                            "upper_bound": prediction_data.get("upper_bound", [])
                        })
            except Exception:
                pass

        # Log this query output to SQLite
        try:
            log_chat(user_id, session_id, req.dataset_id, req.message, answer, components)
        except Exception as log_err:
            print(f"Non-critical: Chat logging failed: {log_err}")

        return ChatResponse(
            session_id=session_id,
            answer=answer,
            followups=followups[:3],
            components=components
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analytical Sandbox error: {str(e)}")
    finally:
        session_output_dir.reset(token)

@app.get("/api/chat/history")
def get_history(
    session_id: str = Query(...),
    authorization: dict = Depends(verify_clerk_token)
):
    user_id = authorization.get("sub")
    return get_chat_history(user_id, session_id)

@app.get("/api/chat/sessions")
def get_sessions(
    authorization: dict = Depends(verify_clerk_token)
):
    user_id = authorization.get("sub")
    return get_user_sessions(user_id)


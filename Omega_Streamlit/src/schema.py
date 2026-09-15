import logging
import math
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional

logger = logging.getLogger("Omega.Schema")
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter(
        "%(asctime)s — %(levelname)s — %(name)s — %(message)s",
        "%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(ch)
    logger.setLevel(logging.INFO)


# ── Private helpers ────────────────────────────────────────────────────────────

def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        v = float(value)
        if math.isnan(v) or math.isinf(v):
            return default
        return v
    except (TypeError, ValueError):
        return default


def _infer_semantic_type(col: str, series: pd.Series) -> str:
    """
    Infer a human-readable semantic type beyond pandas dtype.
    Helps agents understand what a column represents without seeing the data.

    Returns one of:
        numeric_continuous, numeric_integer, categorical_low_cardinality,
        categorical_high_cardinality, datetime, boolean, text, identifier
    """
    dtype = series.dtype
    col_lower = col.lower()
    n_unique = series.nunique()
    n_total  = len(series.dropna())

    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"

    if pd.api.types.is_bool_dtype(dtype):
        return "boolean"

    if pd.api.types.is_float_dtype(dtype):
        return "numeric_continuous"

    if pd.api.types.is_integer_dtype(dtype):
        # Heuristic: low unique count integers are likely categorical codes
        if n_total > 0 and n_unique / n_total < 0.05 and n_unique <= 20:
            return "categorical_low_cardinality"
        return "numeric_integer"

    if pd.api.types.is_object_dtype(dtype) or pd.api.types.is_string_dtype(dtype):
        # Try parsing as datetime if column name suggests date/time or strings look like dates
        sample = series.dropna().head(10)
        if len(sample) > 0:
            date_name_signals = ("date", "time", "year", "month", "day", "created", "updated", "at", "period", "timestamp")
            first_val = str(sample.iloc[0]).strip()
            looks_like_date = any(c in first_val for c in ["-", "/", ":", " "]) and any(char.isdigit() for char in first_val)
            if looks_like_date or any(sig in col_lower for sig in date_name_signals):
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    try:
                        pd.to_datetime(sample, errors="raise", format="mixed")
                        return "datetime"
                    except Exception:
                        try:
                            pd.to_datetime(sample, errors="raise")
                            return "datetime"
                        except Exception:
                            pass

        # Identifier heuristic: very high cardinality + id/key/code in name
        id_signals = ("id", "key", "code", "uuid", "ref", "token", "hash")
        if any(sig in col_lower for sig in id_signals) and n_unique > 100:
            return "identifier"

        # Cardinality-based split
        if n_total > 0:
            ratio = n_unique / n_total
            if ratio < 0.10 or n_unique <= 15:
                return "categorical_low_cardinality"
            if n_unique > 100 and ratio > 0.50:
                return "categorical_high_cardinality"

        return "text"

    return "unknown"


def _safe_sample_values(series: pd.Series, n: int = 3) -> List[Any]:
    """
    Return up to n non-null sample values from a series, safely serialised.
    NaN, Inf, and numpy scalars are normalised to Python native types.
    """
    samples = series.dropna().head(n * 3).tolist()
    result = []
    seen = set()
    for val in samples:
        if len(result) >= n:
            break
        try:
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                continue
            if isinstance(val, (np.integer,)):
                val = int(val)
            elif isinstance(val, (np.floating,)):
                val = round(float(val), 4)
            elif isinstance(val, str):
                val = val.strip()
                if not val:
                    continue
            key = str(val)
            if key not in seen:
                seen.add(key)
                result.append(val)
        except Exception:
            continue
    return result


def _column_profile(col: str, series: pd.Series) -> Dict[str, Any]:
    """
    Build a compact profile dict for a single column.
    This is the per-column object that goes into the full schema dict
    and is also rendered into the schema string for agent context.
    """
    dtype_str     = str(series.dtype)
    semantic_type = _infer_semantic_type(col, series)
    n_total       = len(series)
    n_null        = int(series.isna().sum())
    null_pct      = round(float(n_null / n_total * 100), 1) if n_total > 0 else 0.0
    n_unique      = int(series.nunique())

    # Format idiom detection (zero raw row exposure)
    format_warning = None
    if pd.api.types.is_object_dtype(series.dtype) or pd.api.types.is_string_dtype(series.dtype):
        non_null = series.dropna()
        if len(non_null) > 0:
            sample_str_vals = non_null.astype(str).head(30)
            if sample_str_vals.str.contains(r"[$€£₹,]", regex=True).any():
                format_warning = r"CONTAINS CURRENCY/COMMAS. Clean with .str.replace(r'[\$,]', '', regex=True).astype(float)"
            elif sample_str_vals.str.contains(r"%", regex=False).any():
                format_warning = "CONTAINS PERCENTAGES. Clean with .str.replace('%', '', regex=False).astype(float)"

    profile: Dict[str, Any] = {
        "dtype":          dtype_str,
        "semantic_type":  semantic_type,
        "null_pct":       null_pct,
        "n_unique":       n_unique,
        "format_warning": format_warning,
    }

    # Add numeric stats if applicable
    if semantic_type in ("numeric_continuous", "numeric_integer"):
        numeric = pd.to_numeric(series, errors="coerce").dropna()
        if not numeric.empty:
            profile["min"]  = round(_coerce_float(numeric.min()), 4)
            profile["max"]  = round(_coerce_float(numeric.max()), 4)
            profile["mean"] = round(_coerce_float(numeric.mean()), 4)

    # Add top categories for low-cardinality non-PII business dimensions
    col_lower = col.lower()
    pii_signals = ("email", "mail", "phone", "mobile", "ssn", "social", "name", "first_name", "last_name", 
                   "full_name", "customer_name", "client_name", "patient", "address", "street", "zip", 
                   "postal", "password", "token", "secret", "user_id", "customer_id", "client_id", "account_id")
    is_pii = any(sig in col_lower for sig in pii_signals)
    if semantic_type == "categorical_low_cardinality" and not is_pii:
        top = series.value_counts().head(5)
        profile["top_categories"] = {
            str(k): int(v) for k, v in top.items()
        }

    return profile


# ── Public API ─────────────────────────────────────────────────────────────────

def build_schema_dict(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Build a full schema dictionary from the uploaded dataframe.

    Returns a dict with:
        - row_count: int
        - col_count: int
        - columns: dict of column_name -> column_profile
        - numeric_columns: list of numeric column names
        - categorical_columns: list of categorical column names
        - datetime_columns: list of datetime column names
        - identifier_columns: list of likely identifier column names
    """
    if df is None or df.empty:
        logger.warning("build_schema_dict called with empty dataframe")
        return {
            "row_count":            0,
            "col_count":            0,
            "columns":              {},
            "numeric_columns":      [],
            "categorical_columns":  [],
            "datetime_columns":     [],
            "identifier_columns":   [],
        }

    columns: Dict[str, Any] = {}
    numeric_cols:     List[str] = []
    categorical_cols: List[str] = []
    datetime_cols:    List[str] = []
    identifier_cols:  List[str] = []

    for col in df.columns:
        try:
            profile = _column_profile(col, df[col])
            columns[col] = profile
            stype = profile["semantic_type"]

            if stype in ("numeric_continuous", "numeric_integer"):
                numeric_cols.append(col)
            elif stype in ("categorical_low_cardinality", "categorical_high_cardinality", "text", "boolean"):
                categorical_cols.append(col)
            elif stype == "datetime":
                datetime_cols.append(col)
            elif stype == "identifier":
                identifier_cols.append(col)

        except Exception as e:
            logger.warning(f"Column profiling failed for '{col}': {e}")
            columns[col] = {
                "dtype":         str(df[col].dtype),
                "semantic_type": "unknown",
                "null_pct":      0.0,
                "n_unique":      0,
                "sample_values": [],
            }

    schema = {
        "row_count":           len(df),
        "col_count":           len(df.columns),
        "columns":             columns,
        "numeric_columns":     numeric_cols,
        "categorical_columns": categorical_cols,
        "datetime_columns":    datetime_cols,
        "identifier_columns":  identifier_cols,
    }

    logger.info(
        f"Schema built — {len(df)} rows, {len(df.columns)} cols "
        f"({len(numeric_cols)} numeric, {len(categorical_cols)} categorical, "
        f"{len(datetime_cols)} datetime)"
    )
    return schema


def build_schema_string(df: pd.DataFrame) -> str:
    """
    Build a compact, token-efficient schema string for injection into
    agent context via the {schema} placeholder in tasks.yaml.

    Format per column:
        column_name | semantic_type | dtype | null%: X% | unique: N | samples: [a, b, c]

    Numeric columns also get:
        range: [min → max] | mean: X

    Low-cardinality categoricals also get:
        categories: [A, B, C]

    The string is deliberately concise — agents need to know what columns
    exist and what kind of data they hold, not a full statistical profile.
    That's what the EDA agent is for.
    """
    schema_dict = build_schema_dict(df)

    if not schema_dict["columns"]:
        return "Schema: empty dataset -- no columns found."

    lines = [
        f"Dataset: {schema_dict['row_count']:,} rows x {schema_dict['col_count']} columns",
        f"Numeric columns:     {schema_dict['numeric_columns']}",
        f"Categorical columns: {schema_dict['categorical_columns']}",
        f"Datetime columns:    {schema_dict['datetime_columns']}",
        "",
        "Column definitions:",
        "-" * 60,
    ]

    for col, profile in schema_dict["columns"].items():
        stype    = profile.get("semantic_type", "unknown")
        dtype    = profile.get("dtype", "unknown")
        null_pct = profile.get("null_pct", 0.0)
        n_unique = profile.get("n_unique", 0)

        # Base line (Zero raw data row exposure)
        line = (
            f"  {col} | {stype} | dtype={dtype} | "
            f"null%={null_pct}% | unique={n_unique}"
        )

        # Append format warning/clues if present
        fmt = profile.get("format_warning")
        if fmt:
            line += f" | format_rule={fmt}"

        # Append numeric range
        if "min" in profile and "max" in profile:
            line += f" | range=[{profile['min']} -> {profile['max']}] | mean={profile['mean']}"

        # Append top categories (business vocabulary dimensions, e.g. Region or Category)
        if "top_categories" in profile:
            cats = list(profile["top_categories"].keys())
            line += f" | categories={cats}"

        lines.append(line)

    lines.append("-" * 60)
    schema_str = "\n".join(lines)

    logger.info(f"Schema string built -- ~{len(schema_str)} chars")
    return schema_str


def generate_safe_structural_profile(df: pd.DataFrame) -> str:
    """
    Computes an anonymized schema fingerprint containing formatting clues,
    value ranges, and categorical vocabulary WITHOUT revealing confidential row data.
    Acts as a zero-sample drop-in replacement for df.head().
    """
    if df is None or df.empty:
        return "Structural Profile: empty dataset — no columns found."

    lines = [
        f"Dataset: {len(df):,} rows x {len(df.columns)} columns (Zero-Sample Anonymized Structural Profile)",
        "Column Specifications & Formatting Rules:",
        "-" * 60,
    ]

    for col in df.columns:
        s = df[col]
        dtype = str(s.dtype)
        n_null = int(s.isna().sum())
        null_pct = round(float(n_null / len(df) * 100), 1) if len(df) > 0 else 0.0
        n_unique = int(s.nunique())
        
        # 1. Detect String-Wrapped Currency / Numeric / Percentages
        if pd.api.types.is_object_dtype(s.dtype) or pd.api.types.is_string_dtype(s.dtype):
            sample_non_null = s.dropna().astype(str).head(30)
            has_currency = sample_non_null.str.contains(r"[$€£₹,]", regex=True).any()
            if has_currency:
                lines.append(fr"  - Column '{col}' (type: {dtype}): CONTAINS CURRENCY/COMMAS. Clean with .str.replace(r'[\$,]', '', regex=True).astype(float) before any mathematical calculations.")
                continue
            has_percent = sample_non_null.str.contains(r"%", regex=False).any()
            if has_percent:
                lines.append(f"  - Column '{col}' (type: {dtype}): CONTAINS PERCENTAGES. Clean with .str.replace('%', '', regex=False).astype(float).")
                continue

        # 2. Date / Temporal Columns
        if pd.api.types.is_datetime64_any_dtype(s) or "date" in col.lower() or "time" in col.lower() or "year" in col.lower():
            if pd.api.types.is_datetime64_any_dtype(s):
                lines.append(f"  - Column '{col}' (temporal datetime): Range [{s.min()} to {s.max()}], {null_pct}% nulls.")
            else:
                lines.append(f"  - Column '{col}' (temporal string): Parse with pd.to_datetime(df['{col}'], errors='coerce').")
            continue

        # 3. Numeric Columns
        if pd.api.types.is_numeric_dtype(s):
            num_clean = pd.to_numeric(s, errors="coerce").dropna()
            if not num_clean.empty:
                min_val = round(float(num_clean.min()), 2)
                max_val = round(float(num_clean.max()), 2)
                lines.append(f"  - Column '{col}' (numeric {dtype}): Range [{min_val} to {max_val}], {null_pct}% nulls.")
            else:
                lines.append(f"  - Column '{col}' (numeric {dtype}): {null_pct}% nulls.")
            continue

        # 4. Confidential Personal / Identifier Check
        col_lower = col.lower()
        pii_signals = ("email", "mail", "phone", "mobile", "ssn", "social", "name", "first_name", "last_name", 
                       "full_name", "customer_name", "client_name", "patient", "address", "street", "zip", 
                       "postal", "password", "token", "secret", "user_id", "customer_id", "client_id", "account_id")
        is_pii_col = any(sig in col_lower for sig in pii_signals)
        contains_email_char = False
        if pd.api.types.is_object_dtype(s.dtype) or pd.api.types.is_string_dtype(s.dtype):
            sample_non_null = s.dropna().astype(str).head(20)
            if sample_non_null.str.contains("@", regex=False).any():
                contains_email_char = True

        if is_pii_col or contains_email_char:
            lines.append(f"  - Column '{col}' (confidential identifier/PII, {n_unique} unique entries): Direct personal/account identifier. Anonymized -- raw values hidden. Query via aggregation or exact filter.")
            continue

        # 5. Categorical Business Dimensions
        if n_unique <= 8:
            valid_labels = [str(x) for x in s.dropna().unique().tolist()[:8]]
            lines.append(f"  - Column '{col}' (categorical, {n_unique} levels): Valid categories = {valid_labels}")
        else:
            lines.append(f"  - Column '{col}' (categorical/text, {n_unique} unique values): High cardinality. Filter using .str.contains(..., case=False).")

    lines.append("-" * 60)
    return "\n".join(lines)



def get_column_names(df: pd.DataFrame) -> List[str]:
    """Return all column names from the dataframe."""
    return df.columns.tolist() if df is not None else []


def get_numeric_columns(df: pd.DataFrame) -> List[str]:
    """Return only numeric column names."""
    return build_schema_dict(df)["numeric_columns"]


def get_categorical_columns(df: pd.DataFrame) -> List[str]:
    """Return only categorical column names."""
    return build_schema_dict(df)["categorical_columns"]


def get_datetime_columns(df: pd.DataFrame) -> List[str]:
    """Return only datetime column names."""
    return build_schema_dict(df)["datetime_columns"]
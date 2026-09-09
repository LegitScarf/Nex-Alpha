import os
import json
import time
import logging
from typing import Dict, Any, Optional, Callable
from pathlib import Path

from openai import OpenAI

from .tools import (
    compute_eda_stats,
    detect_outliers,
    generate_sql,
    execute_sql,
    select_chart_type,
    build_plotly_spec,
    run_hypothesis_test,
)
from .predictive import forecast_time_series, fit_regression_model, fit_classification_model, fit_kmeans_clustering
from .schema import build_schema_string
from .utils import get_output_path, load_json_file

logger = logging.getLogger("Omega.Crew")
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter(
        "%(asctime)s — %(levelname)s — %(name)s — %(message)s",
        "%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(ch)
    logger.setLevel(logging.INFO)

# ── Dynamic Model Tiering (Decoupled Reasoning Planner + Rapid Code Specialist) ──
PLANNER_MODEL = os.getenv("OMEGA_PLANNER_MODEL", "gpt-5.6-luna")
CODER_MODEL = os.getenv("OMEGA_CODER_MODEL", "gpt-4o-mini")
FALLBACK_PLANNER_MODEL = os.getenv("OMEGA_FALLBACK_PLANNER", "o3-mini")
FALLBACK_CODER_MODEL = os.getenv("OMEGA_FALLBACK_CODER", "gpt-4o-mini")

def _invoke_with_fallback(client, preferred_model: str, fallback_model: str, messages: list, **kwargs):
    """
    Invokes the preferred high-reasoning model (e.g. gpt-5.6-luna),
    with automatic seamless failover to the verified fallback model on 404/rate limits.
    """
    preferred_kwargs = dict(kwargs)
    # Advanced reasoning models (e.g. gpt-5.6-luna, o1, o3-mini) do not accept custom temperature values
    is_reasoning_model = any(k in preferred_model.lower() for k in ["luna", "o1", "o3", "reasoning", "gpt-5"])
    if is_reasoning_model and "temperature" in preferred_kwargs:
        preferred_kwargs.pop("temperature")

    try:
        logger.info(f"Invoking primary agent model: '{preferred_model}'...")
        return client.chat.completions.create(model=preferred_model, messages=messages, **preferred_kwargs)
    except Exception as e:
        # If API rejects custom temperature, retry without temperature
        if "temperature" in str(e).lower() and "temperature" in preferred_kwargs:
            try:
                preferred_kwargs.pop("temperature", None)
                logger.info(f"Retrying '{preferred_model}' without temperature parameter...")
                return client.chat.completions.create(model=preferred_model, messages=messages, **preferred_kwargs)
            except Exception as retry_err:
                e = retry_err

        logger.warning(f"Primary model '{preferred_model}' failed with error: {e}. Automatically falling back to '{fallback_model}'...")
        return client.chat.completions.create(model=fallback_model, messages=messages, **kwargs)

# ── Intent parser ──────────────────────────────────────────────────────────────
# Classified preprocessing step
_INTENT_SYSTEM_PROMPT = """
You are a data analytics intent classifier. Given a user query and a dataset
    schema, extract the analytical intent as a structured JSON object.

Return ONLY a valid JSON object with exactly these keys:

{
  "intent_type": one of ["descriptive", "aggregation", "comparison",
                          "correlation", "distribution", "trend",
                          "ranking", "filter", "conversational", "forecast", "regression", "classification", "prescriptive", "clustering"],
  "target_columns": list of column names from the schema most relevant
                    to the query (use exact names from schema),
  "filters": dict of {column: value} pairs representing any filtering
             conditions mentioned in the query (empty dict if none),
  "desired_output": list containing one or more of ["table", "bar_chart",
                    "scatter", "histogram", "line_chart", "box_plot", "pie_chart"]
}

Rules:
- Only reference column names that exist in the provided schema.
- If the query is ambiguous, choose the most conservative intent.
- Use "conversational" if the query is an advisory, Q&A, or follow-up question (e.g., asking for advice on missing data, explanation of analytical results, or general data science recommendations). Do NOT use this for business strategy requests, next steps, action plans, or optimization recommendations.
- Use "forecast" if the query explicitly asks to predict, project, forecast, or estimate future values over a temporal (date, time, year) column.
- Use "regression" if the query asks to predict, estimate, or calculate one numerical target column based on one or more independent predictor/feature columns. You MUST extract both the target column and all predictor/feature columns in the query.
- Use "classification" if the query asks to predict, classify, or estimate a categorical/discrete target column (e.g. true/false, high/low, yes/no, specific category) based on one or more independent predictor/feature columns. You MUST extract both the target column and all predictor/feature columns in the query.
- Use "prescriptive" if the query asks for strategies, recommendations, next steps, optimization plans, action items, or business decisions (e.g. "what strategies can we implement...", "how can we enhance...", "what are the next steps...", "action plan to improve...").
- Use "clustering" if the query asks to cluster, segment, group, partition, or categorize records/entries/customers based on attributes, features, or metrics (e.g. "cluster records into 3 groups based on sales and year", "segment games based on platforms").
- When intent_type is "regression" or "classification", target_columns MUST contain the target column as the first element, followed by all predictor/feature columns (e.g., for 'Predict sales based on genre and year', target_columns must be ['sales', 'genre', 'year']). For "clustering", target_columns contains the list of feature columns to be used for finding segments.
- Never return keys outside the four listed above.
- Never return markdown, code fences, or explanatory text — JSON only.
"""

def _parse_intent(user_query: str, schema: str) -> Dict[str, Any]:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    user_message = (
        f"User query: {user_query}\n\n"
        f"Dataset schema:\n{schema}"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _INTENT_SYSTEM_PROMPT.strip()},
                {"role": "user",   "content": user_message},
            ],
            temperature=0,
            max_tokens=512,
        )
        raw = response.choices[0].message.content
        parsed = json.loads(raw)

        # Validate required keys are present
        required = {"intent_type", "target_columns", "filters", "desired_output"}
        if not required.issubset(parsed.keys()):
            raise ValueError(f"Missing keys in intent response: {required - parsed.keys()}")

        logger.info(f"Intent parsed — type={parsed['intent_type']} "
                    f"columns={parsed['target_columns']}")
        return parsed

    except Exception as e:
        logger.warning(f"Intent parsing failed: {e} — falling back to defaults")
        return {
            "intent_type": "descriptive",
            "target_columns": [],
            "filters": {},
            "desired_output": ["table"],
        }


# ── Fast Rule-Based Intent & Complexity Classifier ─────────────────────────────

def classify_query_intent(user_query: str, schema_str: str = "") -> Dict[str, Any]:
    """
    Zero-latency heuristic query classifier that categorizes business queries
    into distinct analytical complexity tiers without slowing down pipeline turnaround.
    """
    q = user_query.lower().strip()
    
    # Check for Executive / Strategic Decision keywords
    strategic_keywords = [
        "ceo", "shut down", "shutdown", "close down", "discontinue", "expand", "invest", 
        "strategy", "strategic", "decision", "action plan", "take a call", "recommend",
        "which one should", "what should we", "how to improve", "how should we", "roadmap", 
        "prioritize", "optimization", "cut costs", "allocate"
    ]
    if any(k in q for k in strategic_keywords):
        return {
            "intent_type": "strategic_decision",
            "complexity_tier": "Tier 3: Strategic Executive Decision",
            "requires_scorecard": True,
            "requires_tradeoffs": True
        }
        
    # Check for Driver / Attribution / Factor influence keywords
    driver_keywords = [
        "factor", "factors", "driver", "drivers", "affect", "affects", "impact", "impacts",
        "influence", "influences", "correlated", "correlation", "relationship", "contributor",
        "contributors", "lead to", "leads to", "cause", "causes", "determines"
    ]
    if any(k in q for k in driver_keywords):
        return {
            "intent_type": "driver_attribution",
            "complexity_tier": "Tier 2: Driver & Attribution Analysis",
            "requires_scorecard": False,
            "requires_tradeoffs": False
        }

    # Check for Predictive / Machine Learning keywords
    predictive_keywords = ["forecast", "predict", "projection", "estimate future", "classify", "cluster", "segmentation"]
    if any(k in q for k in predictive_keywords):
        return {
            "intent_type": "predictive",
            "complexity_tier": "Tier 2: Predictive Modeling",
            "requires_scorecard": False,
            "requires_tradeoffs": False
        }
        
    # Check for Direct Aggregation / Comparisons
    agg_keywords = ["average", "mean", "median", "total", "sum", "count", "how many", "top ", "highest", "lowest", "distribution", "breakdown"]
    if any(k in q for k in agg_keywords):
        return {
            "intent_type": "aggregation",
            "complexity_tier": "Tier 1: Direct Metric Aggregation",
            "requires_scorecard": False,
            "requires_tradeoffs": False
        }

    return {
        "intent_type": "descriptive",
        "complexity_tier": "Tier 1: Descriptive Profiling",
        "requires_scorecard": False,
        "requires_tradeoffs": False
    }


# ── Structured Insight Generation ──────────────────────────────────────────────
_STRATEGIC_INSIGHT_PROMPT = """
You are the user's Principal Executive Advisor and Chief Strategy Consultant, named Omega.
The user is asking a high-stakes strategic decision or business direction question.

Your objective is to provide an authoritative, consulting-grade executive briefing. Back every claim with concrete metrics calculated from the data.

You must return ONLY a valid JSON object with exactly these eight keys:
- "insight_text": A thorough executive briefing (2 to 3 structured paragraphs).
  * Paragraph 1 (Executive Recommendation): Direct, clear answer to the user's decision question with primary rationale and quantitative justification.
  * Paragraph 2 (Quantitative Evidence & Trade-offs): Explain the data findings across key dimensions (volume, revenue/income, adoption rate, infrastructure), contrasting the best vs. worst performing segments.
  * Paragraph 3 (Strategic Impact & Downside Mitigation): What does the business risk or gain by this decision, and what is the recommended transition approach?
- "key_metric": A clean summary metric (e.g. "Primary Recommendation: Shut down Rural (10,007 customers, 42% adoption)").
- "follow_up_suggestions": Exactly 2 forward-looking, strategic follow-up questions for the executive.
- "strategies": A list of 3 to 5 concrete, actionable strategic steps (e.g. operational phase-out, customer migration, capital reallocation).
- "priority_matrix": A list of 3 to 5 structured objects:
  [{"action": "Action description", "impact": "High"/"Medium"/"Low", "effort": "High"/"Medium"/"Low"}]
- "risks": A list of 2 to 4 concrete operational, customer, or regulatory risks with practical mitigation steps.
- "error": null (or error message).
- "components": A list of dynamic layout components to render. Structure them logically:
  [
    {"type": "markdown", "content": "### Executive Decision Brief\nDirect strategic recommendation and contextual rationale."},
    {"type": "metric_grid", "metrics": [{"label": "Metric Name", "value": "Metric Value"}]},
    {"type": "table", "headers": ["Segment/Dimension", "Metric 1", "Metric 2", ...], "rows": [["Val1", "Val2", ...]]},
    {"type": "chart", "plotly_spec": {}}
  ]
"""

_DRIVER_INSIGHT_PROMPT = """
You are a Principal Data Scientist and Analytics Consultant, named Omega.
The user is asking which factors, attributes, or drivers most significantly influence a target outcome.

Your objective is to provide an evidence-grounded driver attribution analysis, distinguishing between statistically dominant drivers and minor factors, and highlighting which levers are actionable for the organization.

You must return ONLY a valid JSON object with exactly these eight keys:
- "insight_text": A thorough, 2 to 3 paragraph analytical briefing.
  * Paragraph 1 (Dominant Drivers): State the top positive and negative factors affecting the target outcome with quantitative impact/correlation scores.
  * Paragraph 2 (Nuance & Levers): Contrast actionable factors (e.g. knowledge, infrastructure access, education) with fixed demographic attributes (e.g. age, location).
  * Paragraph 3 (Actionable Business Takeaway): Where should the organization concentrate its investment or interventions for maximum ROI?
- "key_metric": A clean string summarizing the standout driver (e.g. "Top Driver: EV Knowledge Score (r = 0.72)").
- "follow_up_suggestions": Exactly 2 plain-English analytical follow-up questions.
- "strategies": A list of 3 to 5 concrete strategic initiatives targeting the top actionable drivers.
- "priority_matrix": A list of 3 to 5 structured objects:
  [{"action": "Action description", "impact": "High"/"Medium"/"Low", "effort": "High"/"Medium"/"Low"}]
- "risks": A list of 2 to 4 risks or caveats (e.g. correlation vs causation, data limitations, diminishing returns).
- "error": null (or error message).
- "components": A list of layout components:
  [
    {"type": "markdown", "content": "### Key Factors & Driver Analysis\nDetailed breakdown of factor importance and strategic implications."},
    {"type": "metric_grid", "metrics": [{"label": "Metric Name", "value": "Metric Value"}]},
    {"type": "table", "headers": ["Factor / Attribute", "Impact Level", "Correlation / Score", "Actionability"], "rows": [["Factor Name", "High", "+0.72", "High"]]},
    {"type": "chart", "plotly_spec": {}}
  ]
"""

_DESCRIPTIVE_INSIGHT_PROMPT = """
You are a senior data analyst and consultant. Your job is to translate descriptive statistics and data profiling results into a clear, jargon-free data health and completeness overview for a non-technical user.

You must return ONLY a valid JSON object with exactly these eight keys:
- "insight_text": A string summarizing the data health, volume, and key patterns.
- "key_metric": A short, clean string representing the overall scale or primary finding.
- "follow_up_suggestions": A list of exactly 2 plain-English follow-up questions.
- "strategies": A list of 3 to 5 specific, highly detailed strategic actions based on the data.
- "priority_matrix": A list of 3 to 5 objects: [{"action": "Action description", "impact": "High"/"Medium"/"Low", "effort": "High"/"Medium"/"Low"}].
- "risks": A list of 2 to 4 potential risks or data quality concerns.
- "error": null (or error message).
- "components": A list of layout components to render:
  [
    {"type": "markdown", "content": "### Data Health & Summary\nDetailed overview of dataset structure and distributions."},
    {"type": "metric_grid", "metrics": [{"label": "Metric Name", "value": "Metric Value"}]},
    {"type": "table", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]]},
    {"type": "chart", "plotly_spec": {}}
  ]
"""

_ANALYTICAL_INSIGHT_PROMPT = """
You are a senior business analyst and consultant. Your job is to translate statistical data, queries, and analytical findings into a clear, jargon-free business insight for a non-technical user.

You must return ONLY a valid JSON object with exactly these eight keys:
- "insight_text": A string summarizing the business insight (most important takeaway, context, and recommendation).
- "key_metric": A short string representing the single most important number or finding.
- "follow_up_suggestions": A list of exactly 2 plain-English, conversational follow-up questions.
- "strategies": A list of 3 to 5 specific, highly detailed strategic actions based on the analysis.
- "priority_matrix": A list of 3 to 5 objects: [{"action": "Action description", "impact": "High"/"Medium"/"Low", "effort": "High"/"Medium"/"Low"}].
- "risks": A list of 2 to 4 potential risks or operational concerns.
- "error": null (or error message).
- "components": A list of layout components to render. Follow this structure:
  [
    {"type": "markdown", "content": "detailed markdown content"},
    {"type": "metric_grid", "metrics": [{"label": "Metric Name", "value": "Metric Value"}]},
    {"type": "table", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]]},
    {"type": "chart", "plotly_spec": {}}
  ]
"""

_CONVERSATIONAL_INSIGHT_PROMPT = """
You are the user's senior business consultant, named Omega.
Your goal is to answer the user's question, provide strategic recommendations, and outline decisions.

You must return ONLY a valid JSON object with exactly these eight keys:
- "insight_text": A detailed, thorough string containing a comprehensive response (typically 2 to 3 detailed paragraphs).
- "key_metric": A short, clean string representing the advice topic.
- "follow_up_suggestions": A list of exactly 2 conversational follow-up questions.
- "strategies": A list of 3 to 5 specific, highly detailed strategic actions.
- "priority_matrix": A list of 3 to 5 objects: [{"action": "Action description", "impact": "High"/"Medium"/"Low", "effort": "High"/"Medium"/"Low"}].
- "risks": A list of 2 to 4 potential risks.
- "error": null (or error message).
- "components": A list of layout components to render. Follow this structure:
  [
    {"type": "markdown", "content": "detailed markdown content"},
    {"type": "metric_grid", "metrics": [{"label": "Metric Name", "value": "Metric Value"}]},
    {"type": "table", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]]}
  ]
"""

_PRESCRIPTIVE_INSIGHT_PROMPT = """
You are the user's senior business consultant and prescriptive analytics advisor, named Omega.
Your goal is to propose a concrete, actionable, and data-grounded strategy plan to address the user's query.

You must return ONLY a valid JSON object with exactly these eight keys:
- "insight_text": A detailed, thorough string containing a comprehensive strategic analysis.
- "key_metric": A short topic label.
- "strategies": A list of 3 to 5 specific, highly detailed strategies.
- "priority_matrix": A list of 3 to 5 objects: [{"action": "Action description", "impact": "High"/"Medium"/"Low", "effort": "High"/"Medium"/"Low"}].
- "risks": A list of 2 to 4 potential risks or data quality concerns.
- "follow_up_suggestions": A list of exactly 2 plain-English, conversational follow-up questions.
- "error": null (or error message).
- "components": A list of layout components to render. Follow this structure:
  [
    {"type": "markdown", "content": "detailed markdown content"},
    {"type": "metric_grid", "metrics": [{"label": "Metric Name", "value": "Metric Value"}]},
    {"type": "table", "headers": ["Proposed Action", "Impact", "Effort"], "rows": [["Action 1", "High", "Low"]]}
  ]
"""

def _load_json_safely(filename: str) -> Dict[str, Any]:
    try:
        path = Path(get_output_path(filename))
        if path.exists():
            return load_json_file(path)
    except Exception:
        pass
    return {}

def _generate_insight_via_llm(
    user_query: str,
    intent_type: str,
    eda_data: Dict[str, Any],
    query_data: Dict[str, Any],
    chart_data: Dict[str, Any],
    hypothesis_data: Optional[Dict[str, Any]] = None,
    prediction_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    
    # Load past data profile from disk if available to make Q&A context-aware
    if intent_type in ["conversational", "prescriptive"]:
        if not eda_data or eda_data.get("status") == "skipped":
            eda_data = _load_json_safely("eda_result.json")
        if not query_data or query_data.get("status") == "skipped":
            query_data = _load_json_safely("query_result.json")
        if not prediction_data or prediction_data.get("status") == "skipped":
            prediction_data = _load_json_safely("prediction.json")

    context = f"User Query: {user_query}\n"
    context += f"Intent Type: {intent_type}\n\n"
    
    if eda_data and eda_data.get("status") != "skipped":
        context += "Descriptive Statistics / EDA Summary:\n"
        context += json.dumps({
            "summary_stats": eda_data.get("summary_stats"),
            "observations": eda_data.get("observations"),
            "outlier_flags": eda_data.get("outlier_flags")
        }, indent=2) + "\n\n"
        
    if query_data and query_data.get("status") != "skipped":
        context += "Executed SQL Query:\n"
        context += f"{query_data.get('sql_query')}\n\n"
        context += "Query Results (first 10 rows shown):\n"
        context += json.dumps(query_data.get("result_rows", [])[:10], indent=2) + "\n\n"
        
    if chart_data and chart_data.get("status") != "skipped":
        context += "Visualisation Config:\n"
        context += f"Chart Type: {chart_data.get('chart_type')}\n"
        context += f"Chart Title: {chart_data.get('chart_title')}\n\n"

    if hypothesis_data and hypothesis_data.get("status") != "skipped":
        context += "Statistical Hypothesis Test Results:\n"
        context += json.dumps(hypothesis_data, indent=2) + "\n\n"

    if prediction_data and prediction_data.get("status") != "skipped":
        if prediction_data.get("status") == "regression":
            context += "Fitted Multiple Linear Regression Model:\n"
            context += json.dumps({
                "target_column": prediction_data.get("target_column"),
                "intercept": prediction_data.get("intercept"),
                "coefficients": prediction_data.get("coefficients"),
                "model_metrics": prediction_data.get("model_metrics")
            }, indent=2) + "\n\n"
        else:
            context += "Future Forecast Projections:\n"
            context += json.dumps({
                "time_column": prediction_data.get("time_column"),
                "metric_column": prediction_data.get("metric_column"),
                "forecast_dates": prediction_data.get("forecast_dates"),
                "forecast_values": prediction_data.get("forecast_values"),
                "model_metrics": prediction_data.get("model_metrics")
            }, indent=2) + "\n\n"

    # Select system prompt dynamically based on the classified intent
    if intent_type == "strategic_decision":
        system_prompt = _STRATEGIC_INSIGHT_PROMPT.strip()
    elif intent_type == "driver_attribution":
        system_prompt = _DRIVER_INSIGHT_PROMPT.strip()
    elif intent_type == "descriptive":
        system_prompt = _DESCRIPTIVE_INSIGHT_PROMPT.strip()
    elif intent_type == "conversational":
        system_prompt = _CONVERSATIONAL_INSIGHT_PROMPT.strip()
    elif intent_type == "prescriptive":
        system_prompt = _PRESCRIPTIVE_INSIGHT_PROMPT.strip()
    else:
        system_prompt = _ANALYTICAL_INSIGHT_PROMPT.strip()

    try:
        completion_kwargs = {
            "model": "gpt-4o-mini",
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analytical Context:\n{context}"}
            ],
            "temperature": 0.2,
        }
        if intent_type not in ["conversational", "prescriptive"]:
            completion_kwargs["max_tokens"] = 2048

        response = client.chat.completions.create(**completion_kwargs)
        raw = response.choices[0].message.content
        parsed = json.loads(raw)
        
        # Ensure fallback defaults are met
        required = {"insight_text", "key_metric", "follow_up_suggestions", "error"}
        for k in required:
            if k not in parsed:
                if k == "follow_up_suggestions":
                    parsed[k] = []
                elif k == "error":
                    parsed[k] = None
                else:
                    parsed[k] = ""
                    
        # Optional prescriptive keys
        if "strategies" not in parsed:
            parsed["strategies"] = []
        if "priority_matrix" not in parsed:
            parsed["priority_matrix"] = []
        if "risks" not in parsed:
            parsed["risks"] = []
                    
        parsed["intent_type"] = intent_type
        return parsed
        
    except Exception as exc:
        logger.exception(f"Failed to generate structured insight: {exc}")
        return {
            "insight_text": "Failed to generate business insights due to an internal error.",
            "key_metric": "Error",
            "follow_up_suggestions": [
                "Would you like to try executing the query again?",
                "Can you check if the dataset has columns matching your query?"
            ],
            "error": str(exc)
        }


# ── Helpers for skipped files & callbacks ──────────────────────────────────────────

def _write_json(filename: str, data: Dict[str, Any]) -> None:
    path = Path(get_output_path(filename))
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


class MockTaskOutput:
    """Mock class that mimics CrewAI TaskOutput object so progress tracking still works."""
    def __init__(self, name: str):
        self.name = name


# ── Task Routing Constants ───────────────────────────────────────────────────

# Intents that need EDA (descripti# ── Public Entry Point ────────────────────────────────────────────────────────

_PLANNER_SYSTEM_PROMPT = """You are a senior data science analytics planner. Given a user query, a dataset schema, sample rows, chat history, and business context, formulate a clear, focused, step-by-step statistical execution plan.

Your goal is to guide a Python coder agent on how to compute the exact answer to the user query quickly and accurately.

CRITICAL RULES:
1. QUERY-INTENT ADAPTIVE SCOPE:
   - Direct / Aggregation queries (e.g. "What is the average revenue?", "Top 5 products"):
     Plan a clean group-by aggregation and 1 primary chart. Keep it concise (3-4 steps).
   - Driver & Attribution queries (e.g. "Which factors highly affect [target]?", "Key drivers of churn"):
     Plan:
     1. Multi-feature correlation / ranking across candidate numeric & categorical columns against the target variable.
        NOTE: For datasets > 10,000 rows, plan to sample up to 10,000 rows (`sample_df = df.sample(n=min(10000, len(df)), random_state=42)`) to ensure sub-second execution.
     2. Identify top 5 positive and top 5 negative drivers.
     3. Cross-tabulate or aggregate the target metric across top driver segments (e.g. high/medium/low tiers).
     4. Specify 1 horizontal bar chart visualising driver impact/correlations.
     5. Save ranked driver impact table in query_result.json.
   - Strategic & Executive Decision queries (e.g. "Being the CEO, which city_type to shut down and why?", "Which market should we invest in?"):
     Plan:
     1. Multi-Criteria Decision Scorecard: compute a comprehensive comparison table across segments/categories, measuring at least 3-4 distinct dimensions (e.g. volume/headcount, adoption rate, average income/revenue, infrastructure/satisfaction).
     2. Downside vs Upside Trade-off Evaluation: calculate percentage share and identify the worst-performing segment vs the growth engine.
     3. Formulate an evidence-grounded recommendation backed by numbers.
     4. Specify a comparative chart (e.g. grouped bar or multi-category bar chart).
     5. Save the multi-criteria scorecard in query_result.json.
   - Predictive queries: Only plan machine learning (fit_regression_model, fit_classification_model, fit_kmeans_clustering) or forecasting (forecast_time_series) if the user explicitly asks to predict, forecast, classify, or cluster.
2. EFFICIENCY & ROBUSTNESS:
   Focus on high-leverage pandas/numpy operations. Always ensure column names and types exist in the schema.

You MUST structure your plan using the following XML tags:
<data_profile>
Identify the exact columns and types relevant to the query.
</data_profile>

<analysis_steps>
Describe the exact 2 to 4 pandas/numpy calculations, groupings, or statistical tests to answer the query directly.
</analysis_steps>

<chart_spec>
Specify 1 clear Plotly chart (type, x, y, title) that visually communicates the analytical answer.
</chart_spec>

<output_files>
List only the relevant output files to write:
- query_result.json (for calculations, aggregations, or stats)
- chart.json (for the primary visualization)
- hypothesis_test.json (only if a statistical test was performed)
- prediction.json (only if a predictive/forecast model helper was called)
</output_files>

Do NOT write Python code blocks in the plan. Focus 100% on concise analytical steps."""

_CODER_SYSTEM_PROMPT = """You are an expert Python data science programmer.
Your goal is to translate the analytical plan into clean, production-grade Python code that executes quickly and reliably.
The user dataset is already loaded in memory as a pandas DataFrame named `df`.

You have access to:
- `pandas` as `pd`
- `numpy` as `np`
- `json`
- `scipy`
- `plotly.express` as `px`
- `plotly.graph_objects` as `go`

Pre-injected helper functions available in scope:
- `safe_float(v, default=0.0) -> float`: Safe float conversion that handles None, NaN, and strings without raising exceptions.
- `safe_int(v, default=0) -> int`: Safe int conversion that handles None, NaN, and strings without raising exceptions.
- `get_output_path(filename: str) -> str`: Returns the output path for writing files.
- `write_output_json(filename: str, data: dict) -> None`: Writes a dictionary as JSON to disk.
- `fit_regression_model(df, target_col, feature_cols)` -> dict
- `fit_classification_model(df, target_col, feature_cols)` -> dict
- `fit_kmeans_clustering(df, feature_cols, k)` -> dict
- `forecast_time_series(df, time_col, metric_col)` -> dict

CRITICAL CODING GUIDELINES:
1. EFFICIENCY & PERFORMANCE SAFEGUARDS:
   - For datasets > 10,000 rows requiring correlation matrices or feature importance across many columns, ALWAYS sample up to 10,000 rows for sub-second execution:
     `sample_df = df.sample(n=min(10000, len(df)), random_state=42)`
   - Write clean, vectorised pandas code (typically 30 to 90 lines). Do not cut corners or produce placeholder data ("Yes/No"). Always compute real, grounded metrics.
2. NO HALLUCINATIONS: Do not call undefined functions. Use built-in Python/Pandas functions or the pre-injected helpers listed above.
3. PANDAS SAFETY:
   - When calling `df.corr()`, ALWAYS use `df.corr(numeric_only=True)`.
   - When dropping nulls, drop only on relevant columns: `clean_df = df.dropna(subset=[...])`.
4. PLOTLY SPECIFICATION:
   - Always export the figure using: `fig_dict = json.loads(fig.to_json())`
   - Write to `chart.json`: `write_output_json("chart.json", {"status": "success", "chart_generated": True, "chart_type": "bar", "chart_title": "...", "plotly_spec": fig_dict})`
5. REQUIRED OUTPUT JSON FILES:
   - `query_result.json`: Always save the key computed results / aggregations:
     `write_output_json("query_result.json", {"status": "success", "result_rows": records, "row_count": len(records)})`
   - `chart.json`: Save the primary Plotly figure.
   - If hypothesis testing: `write_output_json("hypothesis_test.json", {"status": "success", "test_name": "...", "statistic_value": safe_float(...), "p_value": safe_float(...), "is_significant": bool(...)})`
   - Note: Do NOT write `insight.json`. The insight generator handles `insight.json` automatically.

Return ONLY the executable python code block enclosed inside ```python ... ``` fences. Do not include markdown text or explanations outside the code block."""


# ── Public Entry Point ────────────────────────────────────────────────────────

def run_omega(
    user_query:    str,
    dataframe,
    step_callback: Optional[Callable] = None,
    task_callback: Optional[Callable] = None,
    chat_history:  Optional[list] = None,
    dataset_id:    Optional[str] = None,
) -> Dict[str, Any]:
    """
    Agentic Reasoning Platform (Omega V3).
    Formulates an analytical plan, writes Python code, runs it in a secure sandbox,
    self-corrects errors, and serializes results for Streamlit.
    """
    from .interpreter import execute_code
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    t_pipeline_start = time.time()

    # Step 1: Initialize empty/skipped state for all output files to prevent frontend hang
    logger.info("Initializing default output JSON states...")
    _write_json("eda_result.json", {"status": "skipped", "observations": [], "summary_stats": {}, "outlier_flags": []})
    _write_json("query_result.json", {"status": "skipped", "result_rows": [], "row_count": 0})
    _write_json("chart.json", {"status": "skipped", "plotly_spec": None, "chart_generated": False})
    _write_json("hypothesis_test.json", {"status": "skipped"})
    _write_json("prediction.json", {"status": "skipped"})
    _write_json("insight.json", {
        "insight_text": "Preparing analysis...",
        "key_metric": "",
        "follow_up_suggestions": []
    })

    if task_callback:
        task_callback(MockTaskOutput("run_eda"))

    # Step 2: Build the dataframe context & schema
    schema_str = build_schema_string(dataframe)
    shape_str = f"{dataframe.shape[0]} rows, {dataframe.shape[1]} columns"
    sample_str = dataframe.head(5).to_string()

    # Step 2.2: Classify query context & complexity tier
    query_profile = classify_query_intent(user_query, schema_str)
    complexity_info = f"\nDetected Analytical Scope: {query_profile['complexity_tier']} (Intent: {query_profile['intent_type']})\n"
    logger.info(f"Query classified — Tier={query_profile['complexity_tier']}, Intent={query_profile['intent_type']}")

    # Step 2.3: Load the persistent business model if it exists
    business_model_str = ""
    try:
        bm_path = Path(get_output_path("business_model.json"))
        if bm_path.exists():
            with open(bm_path, "r", encoding="utf-8") as f:
                business_model_str = f.read()
    except Exception as e:
        logger.warning(f"Could not load business model: {e}")

    bm_context = f"\nSemantic Business Model:\n{business_model_str}\n" if business_model_str else ""

    # Step 2.5: Build chat history prompt context
    history_context_str = ""
    if chat_history:
        history_context_str = "\nPrevious Conversation turns:\n"
        for turn in chat_history:
            q = turn.get("query", "")
            ans = turn.get("insight_text", "")
            history_context_str += f"- User asked: \"{q}\"\n- Insight returned: \"{ans}\"\n"

    # Step 3: Run the Planner Agent to generate a markdown plan
    logger.info(f"Planner Agent generating analytical plan with {PLANNER_MODEL}...")
    planner_messages = [
        {"role": "system", "content": _PLANNER_SYSTEM_PROMPT.strip()},
        {"role": "user", "content": f"User Query: {user_query}\n{complexity_info}\nDataset Shape: {shape_str}\nDataset Schema:\n{schema_str}\nDataset Sample (first 5 rows):\n{sample_str}\n{bm_context}\n{history_context_str}"}
    ]
    t_planner_start = time.time()
    try:
        planner_response = _invoke_with_fallback(
            client=client,
            preferred_model=PLANNER_MODEL,
            fallback_model=FALLBACK_PLANNER_MODEL,
            messages=planner_messages
        )
        analytical_plan = planner_response.choices[0].message.content
        planner_dur = time.time() - t_planner_start
        logger.info(f"Planner Agent completed in {planner_dur:.1f}s. Plan formulated successfully:\n{analytical_plan[:300]}...")
    except Exception as e:
        logger.error(f"Planner Agent fallback failed: {e}")
        analytical_plan = f"Analyze the dataset schema and user query '{user_query}' to extract key stats and render a plotly chart."

    # Step 4: Setup Coder Agent instructions & loop
    # Filter schema_str to only include columns referenced in the plan or query (Dynamic Schema Truncation)
    truncated_schema_lines = []
    columns_in_df = dataframe.columns.tolist()
    referenced_cols = []
    for col in columns_in_df:
        if col.lower() in user_query.lower() or (analytical_plan and col.lower() in analytical_plan.lower()):
            referenced_cols.append(col)
            
    if referenced_cols:
        schema_lines = schema_str.split("\n")
        for line in schema_lines:
            if "|" not in line:
                truncated_schema_lines.append(line)
            else:
                is_referenced = False
                for col in referenced_cols:
                    if f"  {col} |" in line or f"| {col} |" in line or line.strip().startswith(f"{col} |"):
                        is_referenced = True
                        break
                if is_referenced:
                    truncated_schema_lines.append(line)
                else:
                    parts = [p.strip() for p in line.split("|")]
                    if len(parts) >= 3:
                        truncated_schema_lines.append(f"  {parts[0]} | {parts[1]} | {parts[2]}")
                    else:
                        truncated_schema_lines.append(line)
        coder_schema_str = "\n".join(truncated_schema_lines)
    else:
        coder_schema_str = schema_str

    coder_instruction = f"""User query: {user_query}

Dataset metadata:
- Shape: {shape_str}
- Schema (Optimized/Truncated to relevant columns):
{coder_schema_str}

Dataset Sample (first 5 rows):
{sample_str}

Execution Plan generated by Planner Agent:
{analytical_plan}

Please generate the Python code to perform this analysis and write the required json output files following the plan."""

    code = ""
    max_attempts = 2
    history = [
        {"role": "system", "content": _CODER_SYSTEM_PROMPT.strip()},
        {"role": "user", "content": coder_instruction}
    ]

    for attempt in range(1, max_attempts + 1):
        logger.info(f"Attempting to generate python code with {CODER_MODEL} (Attempt {attempt}/{max_attempts})...")
        t_coder_start = time.time()
        try:
            response = _invoke_with_fallback(
                client=client,
                preferred_model=CODER_MODEL,
                fallback_model=FALLBACK_CODER_MODEL,
                messages=history,
                temperature=0.1
            )
            coder_dur = time.time() - t_coder_start
            reply = response.choices[0].message.content
            logger.info(f"Coder Agent generated code in {coder_dur:.1f}s with {CODER_MODEL} (Attempt {attempt})")
            history.append({"role": "assistant", "content": reply})

            # Extract code block
            import re
            code_match = re.search(r"```python(.*?)```", reply, re.DOTALL)
            if code_match:
                code = code_match.group(1).strip()
            else:
                code = reply.strip()
                if code.startswith("```"):
                    code = code.strip("`").strip("python").strip()

            logger.info("Executing generated code in sandbox...")
            if task_callback:
                task_callback(MockTaskOutput("run_query"))

            result = execute_code(code, dataframe, dataset_id=dataset_id)

            if result["success"]:
                logger.info("Sandbox execution completed successfully!")
                break
            else:
                logger.warning(f"Execution error on attempt {attempt}: {result['error']}")
                history.append({
                    "role": "user",
                    "content": f"The code execution failed with the following error:\n{result['error']}\n\nPlease fix the bug and return the corrected python code."
                })
        except Exception as e:
            logger.error(f"Error during agent completion loop: {e}")
            break

    if task_callback:
        task_callback(MockTaskOutput("render_chart"))
        task_callback(MockTaskOutput("generate_insight"))

    # Always invoke LLM insight generator to compose the final business narrative based on the data calculated in the sandbox
    logger.info("Invoking LLM insight generator to compose final response...")
    eda_data = _load_json_safely("eda_result.json")
    query_data = _load_json_safely("query_result.json")
    chart_data = _load_json_safely("chart.json")
    hypothesis_data = _load_json_safely("hypothesis_test.json")
    prediction_data = _load_json_safely("prediction.json")
    
    # Infer intent type for system prompt selection
    intent_type = query_profile.get("intent_type", "descriptive")
    if prediction_data and prediction_data.get("status") in ["regression", "classification", "clustering", "success"]:
        p_status = prediction_data.get("status")
        intent_type = "forecast" if p_status == "success" else p_status
    elif "correlation" in user_query.lower() or "test" in user_query.lower():
        if intent_type == "descriptive":
            intent_type = "correlation"
    
    t_insight_start = time.time()
    final_insight = _generate_insight_via_llm(
        user_query=user_query,
        intent_type=intent_type,
        eda_data=eda_data,
        query_data=query_data,
        chart_data=chart_data,
        hypothesis_data=hypothesis_data,
        prediction_data=prediction_data
    )
    insight_dur = time.time() - t_insight_start
    total_dur = time.time() - t_pipeline_start
    logger.info(f"Insight generator finished in {insight_dur:.1f}s. Total analytical pipeline completed in {total_dur:.1f}s!")

    # Write the final result back to disk so Streamlit UI updates
    _write_json("insight.json", final_insight)
    return final_insight


def bootstrap_omega(dataframe) -> dict:
    """Exposes the business model bootstrapping functionality."""
    from .semantic_model import bootstrap_business_model
    return bootstrap_business_model(dataframe)
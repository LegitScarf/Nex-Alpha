import io
import logging
from io import BytesIO
from typing import Dict, Any, Optional
from fpdf import FPDF
from fpdf.fonts import FontFace
import plotly.graph_objects as go
import pandas as pd

logger = logging.getLogger("Omega.Report")

def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return str(text)
    replacements = {
        "\u201c": '"',
        "\u201d": '"',
        "\u2018": "'",
        "\u2019": "'",
        "\u2014": "-",
        "\u2013": "-",
        "\u2022": "*",
        "\u2026": "...",
        "\u2b21": "",
        "\u2014": "-",
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    return text.encode("latin-1", errors="replace").decode("latin-1")

def clean_column_name(col_name: str) -> str:
    return str(col_name).replace("_", " ").title()

def get_status_style(status_str: str) -> FontFace:
    status = str(status_str).strip().lower()
    if "high" in status:
        return FontFace(fill_color="#FEE2E2", color="#991B1B", emphasis="B")
    elif "medium" in status:
        return FontFace(fill_color="#FEF3C7", color="#92400E", emphasis="B")
    elif "low" in status:
        return FontFace(fill_color="#D1FAE5", color="#065F46", emphasis="B")
    else:
        return FontFace(fill_color="#F1F5F9", color="#475569")

def fix_plotly_color(color_val, default_color):
    if not color_val:
        return default_color
    if isinstance(color_val, str):
        if color_val.lower() in ['#000001', 'black', '#000000', 'rgb(0,0,0)', 'rgb(0, 0, 0)']:
            return default_color
        return color_val
    if isinstance(color_val, (list, tuple)):
        return [fix_plotly_color(c, default_color) for c in color_val]
    return color_val

class OmegaPDFReport(FPDF):
    def header(self):
        # Subtle header line & title instead of thick solid color block
        self.set_draw_color(226, 232, 240)  # Light slate line #E2E8F0
        self.set_line_width(0.3)
        self.line(15, 12, 195, 12)
        
        self.set_y(5)
        self.set_x(15)
        self.set_text_color(71, 85, 105)  # Slate Gray #475569
        self.set_font("Helvetica", "B", 8)
        self.cell(90, 5, "OMEGA AI ANALYTICS PLATFORM", align="L")
        self.set_text_color(148, 163, 184)  # Light Slate #94A3B8
        self.cell(90, 5, "DATA ANALYTICS REPORT", align="R")
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_text_color(148, 163, 184)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}} | Omega AI Analytics Platform", align="C")

    def ensure_space(self, h: float):
        # If writing this element exceeds safe vertical limit, trigger page break
        if self.get_y() + h > 270:
            self.add_page()

def generate_pdf_report(result: Dict[str, Any]) -> BytesIO:
    """
    Compiles insights, charts, tables, and prescriptive actions
    from the run result into a styled PDF document bytes buffer.
    """
    pdf = OmegaPDFReport(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.alias_nb_pages()
    pdf.add_page()

    # Available content width is 180mm
    width = 180

    # 1. Metadata / Header Info
    pdf.set_text_color(15, 23, 42)  # #0F172A (slate-900)
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(width, 7, clean_text(f"Analysis: {result.get('query', 'Custom Query')}"))
    pdf.ln(3)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139) # slate-500
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pdf.cell(90, 5, clean_text(f"Date: {now_str}"), ln=0)
    pdf.cell(90, 5, clean_text(f"Intent Mode: {result.get('intent_type', 'descriptive').upper()}"), ln=1)
    pdf.ln(4)

    # 2. Key Insight Callout Box
    insight_text = result.get("insight_text", "No summary insight generated.")
    key_metric = result.get("key_metric", "")
    
    cleaned_insight = clean_text(insight_text).replace("\n", " ")
    
    # Calculate box height dynamically
    pdf.set_font("Helvetica", "", 9.5)
    try:
        lines = pdf.multi_cell(w=170, text=cleaned_insight, dry_run=True, output="LINES")
        num_lines = len(lines) if isinstance(lines, list) else int(lines)
    except Exception:
        num_lines = max(1, len(cleaned_insight) // 85)
        
    line_height = 5.5
    card_height = 4 + 5 + 4 + (6 if key_metric else 0) + (num_lines * line_height) + 4
    
    pdf.ensure_space(card_height + 10)
    start_y = pdf.get_y()
    
    # Draw background box
    pdf.set_fill_color(248, 250, 252)  # Light slate tint #F8FAFC
    pdf.set_draw_color(226, 232, 240)  # Light slate line #E2E8F0
    pdf.set_line_width(0.3)
    pdf.rect(15, start_y, width, card_height, "FD")
    
    # Write Box Header
    pdf.set_y(start_y + 4)
    pdf.set_x(20)
    pdf.set_text_color(30, 58, 138)  # Deep Navy #1E3A8A
    pdf.set_font("Helvetica", "B", 9.5)
    pdf.cell(170, 5, "KEY INSIGHT / SUMMARY")
    pdf.ln(5.5)
    
    # Write Box Metric Highlight
    if key_metric:
        pdf.set_x(20)
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(170, 5, clean_text(f"Metric Highlight: {key_metric}"))
        pdf.ln(5.5)
        
    # Write Box Body
    pdf.set_x(20)
    pdf.set_text_color(71, 85, 105)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.multi_cell(170, line_height, cleaned_insight)
    
    # Update cursor location to after box
    pdf.set_y(start_y + card_height + 6)

    # 3. Embedding Chart
    chart_spec = result.get("chart_spec")
    chart_gen = result.get("chart_gen", False)
    
    if chart_gen and chart_spec:
        pdf.ensure_space(85)  # Make sure we have space for the chart
        
        pdf.set_text_color(15, 23, 42)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(width, 5, "VISUALIZATION", ln=1)
        pdf.ln(3)
        
        figs_to_render = []
        if isinstance(chart_spec, dict):
            if "data" in chart_spec:
                figs_to_render.append(chart_spec)
            else:
                for k, v in chart_spec.items():
                    if isinstance(v, dict) and "data" in v:
                        figs_to_render.append(v)
        if not figs_to_render and chart_spec:
            figs_to_render.append(chart_spec)

        for spec in figs_to_render:
            try:
                fig = go.Figure(spec)
                
                # Update colors & traces to look polished (ensure no solid black/placeholder defaults)
                colors_list = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1']
                for t_idx, trace in enumerate(fig.data):
                    default_color = colors_list[t_idx % len(colors_list)]
                    if trace.type == 'bar':
                        if getattr(trace, 'marker', None):
                            trace.marker.color = fix_plotly_color(getattr(trace.marker, 'color', None), default_color)
                        else:
                            trace.marker = dict(color=default_color)
                    elif trace.type == 'scatter':
                        if getattr(trace, 'line', None):
                            trace.line.color = fix_plotly_color(getattr(trace.line, 'color', None), default_color)
                        else:
                            trace.line = dict(color=default_color)
                            
                fig.update_layout(
                    plot_bgcolor='#FFFFFF',
                    paper_bgcolor='#FFFFFF',
                    font=dict(color='#475569', family="Helvetica"),
                    margin=dict(l=40, r=40, t=40, b=40),
                )
                
                img_bytes = fig.to_image(format="png", width=700, height=360, scale=2)
                
                pdf.image(BytesIO(img_bytes), x=15, w=width)
                pdf.ln(6)
            except Exception as e:
                logger.warning(f"Failed to compile and embed chart in PDF: {e}")
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(150, 150, 150)
                pdf.cell(width, 5, "[Chart visualization could not be rendered in PDF format]", ln=1)
                pdf.ln(4)

    # 4. Data Table
    rows = result.get("rows", [])
    if rows:
        try:
            df_table = pd.DataFrame(rows)
            df_table = df_table.head(15)  # Keep table clean and readable
            headers = df_table.columns.tolist()
            
            pdf.ensure_space(45)  # Space for title + headers + some rows
            
            pdf.set_text_color(15, 23, 42)
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(width, 5, "DATA RECORDS", ln=1)
            pdf.ln(3)
            
            with pdf.table(col_widths=None, text_align="LEFT", padding=3) as table:
                # Headers Row
                header_style = FontFace(fill_color="#F1F5F9", color="#0F172A", emphasis="B")
                header_row = table.row()
                for header in headers:
                    header_row.cell(clean_text(clean_column_name(header)), style=header_style)
                
                # Data Rows
                for r_idx, row in df_table.iterrows():
                    data_row = table.row()
                    bg_color = "#FFFFFF" if r_idx % 2 == 0 else "#F8FAFC"
                    row_style = FontFace(fill_color=bg_color, color="#475569")
                    for col in headers:
                        val = row[col]
                        if isinstance(val, float):
                            val_str = f"{val:.2f}"
                        else:
                            val_str = str(val)
                        data_row.cell(clean_text(val_str), style=row_style)
            pdf.ln(6)
        except Exception as e:
            logger.warning(f"Failed to generate PDF table: {e}")

    # 5. Prescriptive details
    strategies = result.get("strategies", [])
    priority_matrix = result.get("priority_matrix", [])
    
    if strategies or priority_matrix:
        pdf.ensure_space(45)
        
        pdf.set_text_color(15, 23, 42)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(width, 5, "RECOMMENDED STRATEGIES & MATRIX", ln=1)
        pdf.ln(3)
        
        if strategies:
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(71, 85, 105)
            for strat in strategies:
                pdf.ensure_space(8)
                pdf.multi_cell(width, 5.5, clean_text(f"- {strat}"))
            pdf.ln(4)
            
        if priority_matrix:
            try:
                pdf.ensure_space(35)
                with pdf.table(col_widths=[100, 40, 40], text_align="LEFT", padding=3) as table:
                    # Headers
                    h_row = table.row()
                    header_style = FontFace(fill_color="#F1F5F9", color="#0F172A", emphasis="B")
                    h_row.cell("Proposed Action", style=header_style)
                    h_row.cell("Impact", style=header_style)
                    h_row.cell("Effort", style=header_style)
                    
                    # Rows
                    for row in priority_matrix:
                        r_row = table.row()
                        
                        action_style = FontFace(fill_color="#FFFFFF", color="#475569")
                        r_row.cell(clean_text(str(row.get("action", ""))), style=action_style)
                        
                        impact_style = get_status_style(str(row.get("impact", "")))
                        r_row.cell(clean_text(str(row.get("impact", ""))), style=impact_style)
                        
                        effort_style = get_status_style(str(row.get("effort", "")))
                        r_row.cell(clean_text(str(row.get("effort", ""))), style=effort_style)
                pdf.ln(6)
            except Exception as e:
                logger.warning(f"Failed to draw priority matrix table: {e}")

    # Compile the final document to a buffer and return bytes
    buffer = BytesIO()
    pdf_bytes = pdf.output()
    buffer.write(pdf_bytes)
    buffer.seek(0)
    return buffer

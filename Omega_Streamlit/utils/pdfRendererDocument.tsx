import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

// Stylesheet configuration for professional publication-quality output
const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 45,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#334155", // slate-700
    lineHeight: 1.5,
  },
  header: {
    position: "absolute",
    top: 25,
    left: 45,
    right: 45,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0", // slate-200
    paddingBottom: 6,
    marginBottom: 20,
  },
  headerLeft: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569", // slate-600
    letterSpacing: 0.5,
  },
  headerRight: {
    fontSize: 7.5,
    color: "#94A3B8", // slate-400
  },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 45,
    right: 45,
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#94A3B8",
  },
  titleBlock: {
    marginTop: 15,
    marginBottom: 20,
  },
  metaTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A", // slate-900
    marginBottom: 6,
  },
  metaSub: {
    flexDirection: "row",
    fontSize: 8.5,
    color: "#64748B",
  },
  metaItem: {
    marginRight: 16,
  },
  card: {
    backgroundColor: "#F8FAFC", // slate-50
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1E3A8A", // deep navy
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 9.5,
    color: "#475569",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 3,
  },
  markdownBlock: {
    marginBottom: 12,
  },
  paragraph: {
    marginBottom: 6,
    fontSize: 9.5,
    color: "#334155",
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    paddingLeft: 6,
  },
  bulletPoint: {
    width: 10,
    fontSize: 9.5,
    color: "#0033FF", // blue
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: "#475569",
  },
  // Metric Grid
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 8,
  },
  metricLabel: {
    fontSize: 7.5,
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
  },
  // Table
  table: {
    width: "100%",
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    marginBottom: 16,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    alignItems: "center",
    minHeight: 24,
    paddingHorizontal: 6,
  },
  tableHeaderRow: {
    backgroundColor: "#F8FAFC",
  },
  tableCell: {
    flex: 1,
    padding: 4,
  },
  tableCellText: {
    fontSize: 8.5,
    color: "#334155",
  },
  tableCellHeader: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  // Badges for priority matrix
  badge: {
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    alignSelf: "flex-start",
  },
  badgeHigh: {
    backgroundColor: "#FEE2E2", // red-100
    color: "#991B1B",
  },
  badgeMedium: {
    backgroundColor: "#FEF3C7", // amber-100
    color: "#92400E",
  },
  badgeLow: {
    backgroundColor: "#D1FAE5", // emerald-100
    color: "#065F46",
  },
  // Chart image
  chartImage: {
    width: "100%",
    height: 220,
    objectFit: "contain",
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    marginTop: 4,
  },
  // Risk warning container
  riskCard: {
    backgroundColor: "#FFF5F5",
    borderWidth: 0.5,
    borderColor: "#FEE2E2",
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  riskTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#991B1B",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  riskItem: {
    fontSize: 8.5,
    color: "#7F1D1D",
    marginBottom: 3,
  },
});

interface PDFDocumentProps {
  title: string;
  datasetName?: string;
  datasetInfo?: string;
  components: any[];
  chartImages?: Record<string, string>; // mapping from component index or chart id to base64 data url
}

// Clean markdown bold notation, headers, and custom bullet points for PDF output
const parseMarkdownText = (text: string) => {
  if (!text) return [];
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ")) {
      return (
        <Text key={idx} style={[styles.sectionTitle, { fontSize: 10, marginTop: 10, marginBottom: 4, borderBottomWidth: 0 }]}>
          {trimmed.substring(4).replace(/\*\*/g, "")}
        </Text>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <Text key={idx} style={[styles.sectionTitle, { fontSize: 11, marginTop: 12, marginBottom: 5 }]}>
          {trimmed.substring(3).replace(/\*\*/g, "")}
        </Text>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <Text key={idx} style={[styles.sectionTitle, { fontSize: 12.5, marginTop: 14, marginBottom: 6 }]}>
          {trimmed.substring(2).replace(/\*\*/g, "")}
        </Text>
      );
    }
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const content = trimmed.substring(2).replace(/\*\*/g, "");
      return (
        <View key={idx} style={styles.bulletItem}>
          <Text style={styles.bulletPoint}>•</Text>
          <Text style={styles.bulletText}>{content}</Text>
        </View>
      );
    }
    if (!trimmed) {
      return <View key={idx} style={{ height: 4 }} />;
    }
    return (
      <Text key={idx} style={styles.paragraph}>
        {trimmed.replace(/\*\*/g, "")}
      </Text>
    );
  });
};

export const OmegaPDFDocument = ({
  title,
  datasetName,
  datasetInfo,
  components,
  chartImages = {},
}: PDFDocumentProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header} fixed>
        <Text style={styles.headerLeft}>OMEGA AI ANALYTICS PLATFORM</Text>
        <Text style={styles.headerRight}>EXECUTIVE DATA REPORT</Text>
      </View>

      {/* Metadata Title Block */}
      <View style={styles.titleBlock}>
        <Text style={styles.metaTitle}>{title}</Text>
        <View style={styles.metaSub}>
          {datasetName && (
            <Text style={styles.metaItem}>Dataset: {datasetName}</Text>
          )}
          {datasetInfo && (
            <Text style={styles.metaItem}>{datasetInfo}</Text>
          )}
          <Text style={styles.metaItem}>Date: {new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      {/* Dynamic Content Sections */}
      {components.map((comp, idx) => {
        if (comp.type === "markdown" && comp.content) {
          const hasHeadings = comp.content.includes("#");
          const isCallout = comp.content.toLowerCase().includes("key insight") && !hasHeadings;
          if (isCallout) {
            return (
              <View key={idx} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Executive Insight Summary</Text>
                <View style={styles.cardBody}>
                  {parseMarkdownText(comp.content)}
                </View>
              </View>
            );
          }
          return (
            <View key={idx} style={styles.markdownBlock}>
              {parseMarkdownText(comp.content)}
            </View>
          );
        }

        if (comp.type === "metric_grid" && comp.metrics) {
          return (
            <View key={idx} wrap={false}>
              <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
              <View style={styles.metricGrid}>
                {comp.metrics.map((metric: any, mIdx: number) => (
                  <View key={mIdx} style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }

        if (comp.type === "user_message" && comp.text) {
          return (
            <View key={idx} style={{ marginTop: 14, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#0033FF", textTransform: "uppercase", letterSpacing: 0.5 }}>User Query</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0F172A", marginTop: 2 }}>{comp.text}</Text>
            </View>
          );
        }

        if (comp.type === "chart") {
          const chartSrc = chartImages[comp.chartKey || `chart-${idx}`];
          return (
            <View key={idx} wrap={false}>
              <Text style={styles.sectionTitle}>{comp.spec?.title || "Data Visualization"}</Text>
              {chartSrc ? (
                <Image src={chartSrc} style={styles.chartImage} />
              ) : (
                <View style={[styles.card, { alignItems: "center", justifyContent: "center", height: 100 }]}>
                  <Text style={{ color: "#94A3B8" }}>[Chart Image Visual]</Text>
                </View>
              )}
            </View>
          );
        }

        if (comp.type === "table" && comp.rows) {
          const colWidths = comp.headers ? 100 / comp.headers.length : 100;
          return (
            <View key={idx} wrap={false}>
              <Text style={styles.sectionTitle}>Data Records</Text>
              <View style={styles.table}>
                {comp.headers && (
                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    {comp.headers.map((header: string, hIdx: number) => (
                      <View key={hIdx} style={[styles.tableCell, { width: `${colWidths}%` }]}>
                        <Text style={styles.tableCellHeader}>{header}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {comp.rows.slice(0, 15).map((row: string[], rIdx: number) => (
                  <View key={rIdx} style={styles.tableRow}>
                    {row.map((cell: string, cIdx: number) => (
                      <View key={cIdx} style={[styles.tableCell, { width: `${colWidths}%` }]}>
                        <Text style={styles.tableCellText}>{cell}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          );
        }

        if (comp.type === "strategies" && comp.strategies) {
          return (
            <View key={idx} wrap={false}>
              <Text style={styles.sectionTitle}>Actionable Strategies</Text>
              <View style={{ marginBottom: 16 }}>
                {comp.strategies.map((strat: any, sIdx: number) => {
                  const stratText = typeof strat === "object" && strat !== null
                    ? (strat.strategy || strat.action || strat.title || JSON.stringify(strat))
                    : String(strat);
                  return (
                    <View key={sIdx} style={styles.bulletItem}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <Text style={styles.bulletText}>{stratText}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }

        if (comp.type === "priority_matrix" && comp.priority_matrix) {
          return (
            <View key={idx} wrap={false}>
              <Text style={styles.sectionTitle}>Priority Matrix</Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <View style={[styles.tableCell, { flex: 2 }]}><Text style={styles.tableCellHeader}>Proposed Action</Text></View>
                  <View style={styles.tableCell}><Text style={styles.tableCellHeader}>Expected Impact</Text></View>
                  <View style={styles.tableCell}><Text style={styles.tableCellHeader}>Effort</Text></View>
                </View>
                {comp.priority_matrix.map((item: any, mIdx: number) => {
                  const impactBadgeStyle = item.impact === "High" ? styles.badgeHigh : item.impact === "Medium" ? styles.badgeMedium : styles.badgeLow;
                  const effortBadgeStyle = item.effort === "Low" ? styles.badgeLow : item.effort === "Medium" ? styles.badgeMedium : styles.badgeHigh;
                  return (
                    <View key={mIdx} style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 2 }]}><Text style={styles.tableCellText}>{item.action}</Text></View>
                      <View style={styles.tableCell}>
                        <Text style={[styles.badge, impactBadgeStyle]}>{item.impact}</Text>
                      </View>
                      <View style={styles.tableCell}>
                        <Text style={[styles.badge, effortBadgeStyle]}>{item.effort}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }

        if (comp.type === "risks" && comp.risks) {
          return (
            <View key={idx} style={styles.riskCard} wrap={false}>
              <Text style={styles.riskTitle}>Risks & Operational Concerns</Text>
              {comp.risks.map((risk: any, rIdx: number) => {
                let riskText = "";
                if (typeof risk === "object" && risk !== null) {
                  const r = risk.risk || risk.title || risk.description || "";
                  const m = risk.mitigation || risk.recommendation || "";
                  riskText = r && m ? `${r} (Mitigation: ${m})` : (r || JSON.stringify(risk));
                } else {
                  riskText = String(risk);
                }
                return (
                  <Text key={rIdx} style={styles.riskItem}>• {riskText}</Text>
                );
              })}
            </View>
          );
        }

        return null;
      })}

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text>Confidential Document · Nex-Alpha Omega Platform</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);

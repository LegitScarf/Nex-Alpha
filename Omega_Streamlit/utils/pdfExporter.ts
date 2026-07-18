import html2canvas from "html2canvas";
import { pdf } from "@react-pdf/renderer";
import React from "react";
import { OmegaPDFDocument } from "./pdfRendererDocument";

export const exportToPDF = async (
  elementId: string,
  filename: string,
  components: any[],
  title: string = "Omega Analysis Report",
  datasetName?: string,
  datasetInfo?: string
) => {
  const element = document.getElementById(elementId);
  const chartImages: Record<string, string> = {};

  if (element) {
    // Look for all chart containers within this element
    const chartElements = element.querySelectorAll("[data-chart-index]");
    for (const chartEl of Array.from(chartElements)) {
      const htmlEl = chartEl as HTMLElement;
      const idxAttr = htmlEl.getAttribute("data-chart-index");
      if (idxAttr !== null) {
        try {
          // Render chart canvas
          const canvas = await html2canvas(htmlEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          });
          chartImages[`chart-${idxAttr}`] = canvas.toDataURL("image/png");
        } catch (err) {
          console.error("Failed to capture chart canvas:", err);
        }
      }
    }
  }

  try {
    // Generate vector-based PDF document using @react-pdf/renderer
    const doc = React.createElement(OmegaPDFDocument, {
      title,
      datasetName,
      datasetInfo,
      components,
      chartImages,
    });

    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("PDF export failed:", error);
  }
};

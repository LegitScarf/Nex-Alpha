import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const exportToPDF = async (elementId: string, filename: string = "omega-analysis.pdf") => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  // 1. Save original styles and prepare element for printing
  const originalStyle = element.style.cssText;
  
  // Temporarily force white background, auto height, remove scrollbars, and constrain width
  element.style.cssText += `
    background-color: #ffffff !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    width: 800px !important;
  `;

  // 2. Hide suggestions, buttons, actions, and custom SVGs to clean the corporate report
  const ignoreElements = element.querySelectorAll('[data-html2canvas-ignore], button, svg:not(.recharts-surface)');
  const hiddenElements: { el: HTMLElement; prevDisplay: string }[] = [];
  
  ignoreElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    hiddenElements.push({ el: htmlEl, prevDisplay: htmlEl.style.display });
    htmlEl.style.setProperty("display", "none", "important");
  });

  try {
    // 3. Render element to a high-resolution canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Zoom scale for high-DPI standard corporate presentation
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    // 4. Restore original styles and visibility
    element.style.cssText = originalStyle;
    hiddenElements.forEach(({ el, prevDisplay }) => {
      if (prevDisplay) {
        el.style.display = prevDisplay;
      } else {
        el.style.removeProperty("display");
      }
    });

    // 5. Initialize jsPDF (A4 standard dimensions)
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // Slightly offset standard height for margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    const doc = new jsPDF("p", "mm", "a4");
    let position = 0;
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    // Page 1
    doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;

    // Slice remaining canvas height into subsequent pages
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;
    }

    // 6. Trigger download
    doc.save(filename);
  } catch (error) {
    console.error("PDF export failed:", error);
    // Safety recovery
    element.style.cssText = originalStyle;
    hiddenElements.forEach(({ el, prevDisplay }) => {
      if (prevDisplay) {
        el.style.display = prevDisplay;
      } else {
        el.style.removeProperty("display");
      }
    });
  }
};

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { jsPDF } from 'jspdf';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Function to add footer to page
const addFooter = (doc, pageWidth, pageHeight, margin) => {
  // Add footer line
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
  
  // Add footer text
  const footerText = [
    'DICT Regional Office VIII, Brgy. 1 & 4 A. Mabini St., Port Area, Tacloban City',
    'region8@dict.gov.ph, Telephone Number (053)832-4127'
  ];
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  footerText.forEach((line, i) => {
    doc.text(
      line,
      pageWidth / 2,
      pageHeight - (20 - i * 5),
      { align: 'center' }
    );
  });
};

// Function to add page with header and footer
const addPageWithHeaderFooter = (doc, pageWidth, pageHeight, margin) => {
  doc.addPage();
  
  // Draw blue border for the page
  doc.setDrawColor(0, 0, 255); // Blue color
  doc.setLineWidth(0.5); // Border thickness
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  
  // Add footer
  addFooter(doc, pageWidth, pageHeight, margin);
  
  return margin;
};

// Function to determine Passed status
const getPassedStatus = (serviceAvailability) => {
  // Extract numeric value from percentage string (e.g., "95.99%" -> 95.99)
  const numericValue = parseFloat(serviceAvailability);

  // Guard clause for invalid inputs
  if (isNaN(numericValue)) return 'Invalid Input';

  // 96.00% to 100% = Passed
  // Below 96.00% = Passed*
  return numericValue >= 96 ? 'Passed' : 'Passed*';
};

export const generateServiceReportPdf = async (form, logoDataUrl, usersChartImg, trafficChartImg) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let currentY = margin;

  const addText = (text, x, y, options = {}) => {
    if (!text) text = '';
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, x, y, options);
    return y + (lines.length * (options.lineHeight || 7));
  };

  // Get the passed status
  const passedStatus = getPassedStatus(form.serviceAvailability);

  // PAGE 1: SERVICE REPORT
  // Draw blue border for first page
  doc.setDrawColor(0, 0, 255); // Blue color
  doc.setLineWidth(0.5); // Border thickness
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Add logo at upper center (above SERVICE REPORT)
  if (logoDataUrl) {
    try {
      const logoWidth = 135;
      const logoHeight = 30;
      const logoX = (pageWidth - logoWidth) / 2;
      const logoY = currentY;
      
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
      currentY = logoY + logoHeight + 15;
    } catch (logoError) {
      console.warn('Error adding logo to PDF:', logoError);
    }
  }

  // Title (SERVICE REPORT) - comes AFTER the logo
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  currentY = addText('SERVICE REPORT', pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  // Project Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  currentY = addText(`PROJECT: ${form.projectName || ''}`, margin, currentY);
  currentY = addText(`SUPPLIER: ${form.supplierName || ''}`, margin, currentY);
  
  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  const formattedPeriod = `${formatDisplayDate(form.startDate)} - ${formatDisplayDate(form.endDate)}`;
  currentY = addText(`PERIOD: ${formattedPeriod}`, margin, currentY);

  // Site Info Section
  doc.setFont('helvetica', 'normal');
  currentY = addText('XII. SERVICE REPORT AS PER SERVICE PROVIDER\'S NETWORK MONITORING SYSTEM:', margin, currentY + 5);
  currentY = addText('•   ACCEPTANCE DATE: OCTOBER 6, 2025', margin + 5, currentY);
  currentY = addText(`•   NETWORK AVAILABILITY: ${form.serviceAvailability || '98.5%'}`, margin + 5, currentY);

  const tableLeft = margin;
  const tableTop = currentY;
  const headerHeight = 8;
  const col1Width = 15;
  const col2Width = 65;
  const col3Width = 40;
  const col4Width = pageWidth - margin - tableLeft - col1Width - col2Width - col3Width;
  
  // Draw table header background (skyblue)
  doc.setFillColor(135, 206, 235); // Skyblue
  doc.rect(tableLeft, tableTop, col1Width, headerHeight, 'F');
  doc.rect(tableLeft + col1Width, tableTop, col2Width, headerHeight, 'F');
  doc.rect(tableLeft + col1Width + col2Width, tableTop, col3Width, headerHeight, 'F');
  doc.rect(tableLeft + col1Width + col2Width + col3Width, tableTop, col4Width, headerHeight, 'F');
  
  // Table headers
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('No.', tableLeft + 2, tableTop + 5);
  doc.text('Site Name', tableLeft + col1Width + 2, tableTop + 5);
  doc.text('Site Code', tableLeft + col1Width + col2Width + 2, tableTop + 5);
  doc.text('Percent Availability', tableLeft + col1Width + col2Width + col3Width + 2, tableTop + 5);
  
  // Draw header border
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(tableLeft, tableTop, pageWidth - margin, tableTop); // Top border
  doc.line(tableLeft, tableTop + headerHeight, pageWidth - margin, tableTop + headerHeight); // Bottom border
  doc.line(tableLeft, tableTop, tableLeft, tableTop + headerHeight); // Left border
  doc.line(tableLeft + col1Width, tableTop, tableLeft + col1Width, tableTop + headerHeight); // Col separator
  doc.line(tableLeft + col1Width + col2Width, tableTop, tableLeft + col1Width + col2Width, tableTop + headerHeight); // Col separator
  doc.line(tableLeft + col1Width + col2Width + col3Width, tableTop, tableLeft + col1Width + col2Width + col3Width, tableTop + headerHeight); // Col separator
  doc.line(pageWidth - margin, tableTop, pageWidth - margin, tableTop + headerHeight); // Right border
  
  // Table row with white background
  currentY = tableTop + headerHeight;
  
  // Draw row background (white)
  doc.setFillColor(255, 255, 255); // White
  const siteNameMaxWidth = 60;
  const siteNameLines = doc.splitTextToSize(form.expandedName || '', siteNameMaxWidth);
  const siteNameHeight = siteNameLines.length * 7;
  
  // Split site code to handle long codes
  const siteCodeMaxWidth = 35;
  const siteCodeLines = doc.splitTextToSize(form.siteCode || '', siteCodeMaxWidth);
  const siteCodeHeight = siteCodeLines.length * 7;
  
  const rowHeight = Math.max(8, siteNameHeight, siteCodeHeight);
  
  doc.rect(tableLeft, currentY, col1Width, rowHeight, 'F');
  doc.rect(tableLeft + col1Width, currentY, col2Width, rowHeight, 'F');
  doc.rect(tableLeft + col1Width + col2Width, currentY, col3Width, rowHeight, 'F');
  doc.rect(tableLeft + col1Width + col2Width + col3Width, currentY, col4Width, rowHeight, 'F');
  
  // Draw cell content
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('1', tableLeft + 2, currentY + 5);
  
  // Draw site name with wrapping
  doc.text(siteNameLines, tableLeft + col1Width + 2, currentY + 5);
  
  // Site Code with wrapping
  doc.text(siteCodeLines, tableLeft + col1Width + col2Width + 2, currentY + 5);
  
  // Percent Availability - Show Passed* or Passed instead of percentage
  doc.setFont('helvetica', 'bold');
  doc.text(passedStatus, tableLeft + col1Width + col2Width + col3Width + 2, currentY + 5);
  doc.setTextColor(0, 0, 0); // Reset to black
  
  currentY += rowHeight + 5;

  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  doc.setFontSize(10);

  // Helper function to add text with bold prefix and italic description
  const addTextWithBoldItalic = (boldText, italicText, x, y) => {
    const boldWidth = doc.getTextWidth(boldText);
    doc.setFont('helvetica', 'bold');
    doc.text(boldText, x, y);
    doc.setFont('helvetica', 'italic');
    doc.text(italicText, x + boldWidth, y);
    return y + 7;
  };

  // Use the helper function
  currentY = addTextWithBoldItalic('Passed*:', ' passed with justification(s) attached.', margin, currentY);
  currentY = addTextWithBoldItalic('Passed: ', ' passed without justification(s) attached; complied beyond the required percentage of service availability.', margin, currentY);
  currentY = addTextWithBoldItalic('Failed: ', ' fail.', margin, currentY);

  // Additional note (already italic)
  currentY += 3;
  currentY = addText('*(Kindly attach equipment logs on the outages)', margin, currentY);

  currentY += 10;

  const signatureLines = [
    '',
    'Prepared by:',  
    'ENGR. JASON ILDE Y. AGUIHON', 
    'Project Engineer',  
    '',
  
    'Verified by:', 
    'ENGR. CARL ANTHONY C. CATUBAO', 
    'FWFA Team Lead',  
    '',
  
    'Approved by:',
    'ENGR. GUALBERTO R. GUALBERTO, JR.',
    'FWFA Focal'
  ];
  
  const leftX = margin;
  const rightX = pageWidth - margin;
  
  const lineHeight = 7;
  let lineSpacing = lineHeight;
  currentY = addText(signatureLines[1], leftX, currentY);
  doc.setFont('helvetica', 'bold');
  currentY = addText(signatureLines[2], leftX, currentY);
  doc.setFont('helvetica', 'normal');
  currentY = addText(signatureLines[3], leftX, currentY);
  currentY += lineSpacing;

  const rightLinesStartY = currentY - (lineSpacing * 4);
  currentY = rightLinesStartY;
  currentY = addText(signatureLines[5], rightX - doc.getTextWidth(signatureLines[5]), currentY);
  doc.setFont('helvetica', 'bold');
  currentY = addText(signatureLines[6], rightX - doc.getTextWidth(signatureLines[6]), currentY);
  doc.setFont('helvetica', 'normal');
  currentY = addText(signatureLines[7], rightX - doc.getTextWidth(signatureLines[7]), currentY);
  currentY += lineSpacing;

  currentY = Math.max(currentY, rightLinesStartY + (lineSpacing * 3));

  const approvedIndex = 9;
  for(let i = approvedIndex; i < signatureLines.length; i++) {
    const line = signatureLines[i];

    if (line === 'Approved by:') {
      doc.setFont('helvetica', 'normal');
      const textWidth = doc.getTextWidth(line);
      const centerX = (pageWidth - textWidth) / 2;
      currentY = addText(line, centerX, currentY);
    } else if (i === approvedIndex + 1) {
      doc.setFont('helvetica', 'bold');
      const textWidth = doc.getTextWidth(line);
      const centerX = (pageWidth - textWidth) / 2;
      currentY = addText(line, centerX, currentY);
    } else if (i === approvedIndex + 2) {
      doc.setFont('helvetica', 'normal');
      const textWidth = doc.getTextWidth(line);
      const centerX = (pageWidth - textWidth) / 2;
      currentY = addText(line, centerX, currentY);
    } else {
      doc.setFont('helvetica', 'normal');
      currentY = addText(line, margin, currentY);
    }

    if (i < approvedIndex || i > approvedIndex + 2) {
      currentY += 3;
    }
  }

  currentY += 10;
  
  // Add footer to first page
  addFooter(doc, pageWidth, pageHeight, margin);

  // PAGE 2: BOTH CHARTS COMBINED
  if (usersChartImg && trafficChartImg) {
    currentY = addPageWithHeaderFooter(doc, pageWidth, pageHeight, margin);
    
    if (logoDataUrl) {
      try {
        const logoWidth = 135;
        const logoHeight = 30;
        const logoX = (pageWidth - logoWidth) / 2;
        const logoY = currentY;
        
        doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
        currentY = logoY + logoHeight + 15;
      } catch (logoError) {
        console.warn('Error adding logo to PDF:', logoError);
      }
    }

    // LEFT SIDE: Site Code and Passed Status
    doc.setFontSize(12);
    
    // Site Code
    doc.setFont('helvetica', 'bold');
    doc.text('Site Code:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(form.siteCode || 'N/A', margin + 25, currentY);

    currentY += 2;

    // Also show the actual percentage for reference
    doc.setFont('helvetica', 'bold');
    doc.text('Service Availability:', margin, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(form.serviceAvailability || '98.5%', margin + 45, currentY + 5);
    doc.setTextColor(0, 0, 0); // Reset to black

    // Move down BELOW the Service Availability text
    currentY += 5;

    // CENTER: Users Activity Chart (below Service Availability)
    const chartWidth = 180;
    const chartHeight = 90;
    const chartX = (pageWidth - chartWidth) / 2;
    
    // Add the Users Chart
    doc.addImage(usersChartImg, 'PNG', chartX, currentY, chartWidth, chartHeight);
    
    // Add the Traffic Chart (below Users Chart)
    const trafficChartY = currentY + chartHeight + 10;
    doc.addImage(trafficChartImg, 'PNG', chartX, trafficChartY, chartWidth, chartHeight);
  }

  return doc.output('blob');
};
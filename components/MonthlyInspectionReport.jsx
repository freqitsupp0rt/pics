'use client';

import { useState, useEffect } from "react";
import SiteList from "@/components/SiteList";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import dict_logo from '@/resources/dict_logo.png';
import freq_logo from '@/resources/freq_logo.png';

export const getBase64FromImageUrl = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (error) => reject(error);
  });
};

const parseSiteInfo = (fullSiteName) => {
  if (!fullSiteName) return { siteCode: '', siteName: fullSiteName };

  const trimmedName = fullSiteName.trim();
  const firstSpaceIndex = trimmedName.indexOf(' ');

  if (firstSpaceIndex > 0) {
    const potentialCode = trimmedName.substring(0, firstSpaceIndex);
    const potentialName = trimmedName.substring(firstSpaceIndex + 1);

    // Check if the first part matches the PICS code format
    const isSiteCode = /^PICS-[A-Z0-9-]+$/i.test(potentialCode);

    if (isSiteCode) {
      return {
        siteCode: potentialCode,
        siteName: potentialName
      };
    }
  }

  // Fallback if no code is found
  return { siteCode: '', siteName: trimmedName };
};

export default function MonthlyInspectionReport() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const [loadingSites, setLoadingSites] = useState(true);

  const [reportTitle, setReportTitle] = useState("Monthly Network Inspection");
  const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [technicianName, setTechnicianName] = useState("FREQ IT SOLUTIONS");
  const [contractedBandwidth, setContractedBandwidth] = useState("200");
  const [speedTests, setSpeedTests] = useState(
    Array(5).fill({ down: '', up: '' })
  );

  const handleSpeedTestChange = (index, type, value) => {
    const newSpeedTests = speedTests.map((test, i) => i === index ? { ...test, [type]: value } : test);
    setSpeedTests(newSpeedTests);
  };
  
  const [comboxImage, setComboxImage] = useState(null);
  const [additionalImages, setAdditionalImages] = useState([]);
  const [speedtestImages, setSpeedtestImages] = useState([]);
  const [siteInspectionImage, setSiteInspectionImage] = useState(null);

  const handleImageUpload = (e, setter, isMultiple = false) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (isMultiple) {
          setter(prev => [...prev, event.target.result]);
        } else {
          setter(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset input
    e.target.value = '';
  };

  const removeImage = (index, setter) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const [pdfUrl, setPdfUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [logoDataUrl2, setLogoDataUrl2] = useState(null);

  const { getToken } = useAuth();

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const dataUrl = await getBase64FromImageUrl(dict_logo.src);
        setLogoDataUrl(dataUrl);
      } catch (e) { console.warn(e); }
    };
    loadLogo();
  }, []);

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const dataUrl = await getBase64FromImageUrl(freq_logo.src);
        setLogoDataUrl2(dataUrl);
      } catch (e) { console.warn(e); }
    };
    loadLogo();
  }, []);

  useEffect(() => {
    async function fetchSites() {
      try {
        setLoadingSites(true);
        const token = await getToken(); 
        if (!token) return;

        const res = await fetch("/api/sites", {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });

        const data = await res.json();
        const normalized = (data.data || []).map(site => ({
          siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
          name: site.name || "Unnamed Site",
          vendor: site.vendor || "Unknown",
          groupId: site.groupId || site.siteId || site.id,
        }));

        setSites(normalized);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSites(false);
      }
    }
    fetchSites();
  }, [getToken]);

  const handleGeneratePDF = (e) => {
    e.preventDefault();
    if (!selectedSite) return alert("Please select a site first");
    
    setIsGenerating(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const siteInfo = sites.find(s => s.siteId === selectedSite);
      const { siteCode, siteName } = parseSiteInfo(siteInfo?.name);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
        
      const drawHeader = () => {
        autoTable(doc, {
          startY: 10,
          body: [
            [
              '',
              '',
              '',
            ]
          ],
          styles: {
            minCellHeight: pageHeight * 0.1,
            valign: 'middle',
            halign: 'center',
            fontSize: 9,
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
          },
          columnStyles: {
            0: { cellWidth: pageWidth * 0.2 - 3},
            1: { cellWidth: pageWidth * 0.5 - 1, fontSize: 12, fontStyle: 'bold' },
            2: { cellWidth: pageWidth * 0.2 - 3},
          },
          theme: 'grid',
          didDrawCell: (data) => {
            if (data.section === 'body' && data.row.index === 0) {
              if (data.column.index === 0 && logoDataUrl) {
                const imgSize = 20;
                const x = data.cell.x + (data.cell.width - imgSize) / 2;
                const y = data.cell.y + (data.cell.height - imgSize) / 2;
                doc.addImage(logoDataUrl, 'PNG', x - 6, y, imgSize + 13, imgSize);
              }
              if (data.column.index === 1) {
                const cell = data.cell;
                const centerX = cell.x + cell.width / 2;
                const centerY = cell.y + cell.height / 2;
                
                doc.setFont('Palatino', 'bold');// Changed font to Palatino
                doc.setFontSize(12);
                doc.text('MONTHLY INSPECTION REPORT', centerX, centerY - 4, { align: 'center' });
  
                doc.setFont('Palatino', 'normal');// Changed font to Palatino
                doc.setFontSize(11);
                const text = 'PROVISION OF INTERNET CONNECTIVITY SERVICE (PICS)\nIN PUBLIC PLACES - PHASE 2';
                const splitText = doc.splitTextToSize(text, cell.width - 2);
                doc.text(splitText, centerX, centerY + 2, { align: 'center' });
              }
              if (data.column.index === 2 && logoDataUrl2) {
                const imgSize = 20;
                const x = data.cell.x + (data.cell.width - imgSize) / 2;
                const y = data.cell.y + (data.cell.height - imgSize) / 2;
                doc.addImage(logoDataUrl2, 'PNG', x - 8, y, imgSize + 16, imgSize);
              }
            }
          }
        });
      };

      const drawFooter = () => {// adjusted footer
  const footerY = pageHeight - 60;

  // Notes
  doc.setFontSize(10);
  doc.setFont('Palatino', 'italic');
  doc.text("Notes: Photos should have Geotagging (coordinates, date and time stamp)", 15, footerY);

  const drawSignatory = (label, name, roles, x, y) => {
    doc.setFont('Palatino', 'normal');
    doc.text(label, x, y);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont('Palatino', 'bold');
    doc.text(name, x + labelWidth, y);
    // Underline
    const nameWidth = doc.getTextWidth(name);
    doc.setLineWidth(0.3);
    doc.line(x + labelWidth, y + 1, x + labelWidth + nameWidth, y + 1);
    // Roles centered under name
    const nameCenterX = x + labelWidth + nameWidth / 2;
    doc.setFont('Palatino', 'normal');
    roles.forEach((role, i) => {
      const roleWidth = doc.getTextWidth(role);
      doc.text(role, nameCenterX - roleWidth / 2, y + 5.2 + (i * 5.2));
    });
  };

  const leftX = 15;
  const rightX = pageWidth / 2 + 10;

  drawSignatory("Prepared by: ", "Engr. Jason Ilde Y. Aguihon", ["Project Engineer"], leftX, footerY + 12);
  drawSignatory("Checked by: ", "Engr. Cindy D. Camarines", ["Engineer II, FPIAP", "DICT Regional Office VIII"], rightX, footerY + 12);
  drawSignatory("Noted by: ", "Ms. Claire P. Fernandez", ["Provincial Officer DICT Leyte"], rightX, footerY + 30);
};

      

      const addImageToPage = (imgData, x, y, maxWidth, maxHeight) => {
        if (imgData) {
          try {
            const props = doc.getImageProperties(imgData);
            const ratio = props.width / props.height;
            let w = maxWidth;
            let h = w / ratio;
            if (h > maxHeight) {
              h = maxHeight;
              w = h * ratio;
            }
            
            const newX = x + (maxWidth - w) / 2;
            const newY = y + (maxHeight - h) / 2;

            doc.addImage(imgData, 'JPEG', newX, newY, w, h);
          } catch (error) {
            console.warn("Error adding image to PDF", error);
            doc.text("[Image Error]", x + maxWidth / 2, y + maxHeight / 2, { align: 'center' });
          }
        }
      };

      const drawImageGrid = (images, startY, containerHeight) => {
        const gap = 5;
        const availableWidth = pageWidth - 30 - 4; // 30 for page margins, 4 for inner padding
        const availableHeight = containerHeight - 4; // 4 for inner padding
        
        if (images.length === 5) {
          // 5 images layout: 2 top, 3 bottom
          const rowHeight = (availableHeight - gap) / 2;
          
          // Top row (2 images)
          const topRowY = startY + 2;
          const topRowWidth = (availableWidth - gap) / 2;
          
          addImageToPage(images[0], 15 + 2, topRowY, topRowWidth, rowHeight);
          addImageToPage(images[1], 15 + 2 + topRowWidth + gap, topRowY, topRowWidth, rowHeight);
          
          // Bottom row (3 images)
          const bottomRowY = startY + 2 + rowHeight + gap;
          const bottomRowWidth = (availableWidth - 2 * gap) / 3;
          
          addImageToPage(images[2], 15 + 2, bottomRowY, bottomRowWidth, rowHeight);
          addImageToPage(images[3], 15 + 2 + bottomRowWidth + gap, bottomRowY, bottomRowWidth, rowHeight);
          addImageToPage(images[4], 15 + 2 + 2 * (bottomRowWidth + gap), bottomRowY, bottomRowWidth, rowHeight);
        } else {
          const cols = 2;
          const rows = 3;
          const cellWidth = (availableWidth - (gap * (cols - 1))) / cols;
          const cellHeight = (availableHeight - (gap * (rows - 1))) / rows;
          
          images.forEach((img, index) => {
            if (index >= cols * rows) return; // Limit to fit on page
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = 15 + 2 + col * (cellWidth + gap);
            const y = startY + 2 + row * (cellHeight + gap);
            addImageToPage(img, x, y, cellWidth, cellHeight);
          });
        }
      };

      // 1. TOP HEADER & PAGE 1 INFO
      drawHeader();
       doc.setFontSize(12);
      // Provider Name line //Sets the Provider name and specific date to BOLD
      doc.setFont('Palatino', 'normal'); //changed font to Palatino
      doc.text(`Provider Name: `, 15, doc.lastAutoTable.finalY + 10);
      const providerLabelWidth = doc.getTextWidth('Provider Name: ');
      doc.setFont('Palatino', 'bold'); // changed font to Palatino
      doc.text(`FREQ IT SOLUTIONS`, 15 + providerLabelWidth, doc.lastAutoTable.finalY + 10);

      // Date Prepared line
      doc.setFont('Palatino', 'normal'); //changed font to Palatino
      const dateLabel = `Date Prepared: `;
      const dateValue = dayjs(reportDate).format('MMMM D, YYYY');
      const dateLabelWidth = doc.getTextWidth(dateLabel);
      const dateValueWidth = doc.getTextWidth(dateValue);
      const totalWidth = dateLabelWidth + dateValueWidth;
      doc.text(dateLabel, pageWidth - 15 - totalWidth, doc.lastAutoTable.finalY + 10);
      doc.setFont('Palatino', 'bold'); // changed font to Palatino
      doc.text(dateValue, pageWidth - 15 - dateValueWidth, doc.lastAutoTable.finalY + 10);

      // 2. MAIN DATA TABLE (Replicating your .docx table structure) 
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: [[
          'Item\nNo.', 
          'Location Code', 
          'Location Name', 
          'Downlink\nBandwidth\nMbps)', 
          'Uplink\nBandwidth\n(Mbps)', 
          'Contracted\nBandwidth\n(Mbps)', 
          'Remarks'
        ]],
        body: [//Made the Location name to Capital Letters
          [
            { content: '1', rowSpan: 5, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } },
            { content: siteCode || 'N/A', rowSpan: 5, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0]} },
            { content: siteName?.toUpperCase() || 'N/A', rowSpan: 5, styles: { valign: 'middle', halign: 'center' } },
            speedTests[0].down,
            speedTests[0].up,
            { content: `${contractedBandwidth} Mbps`, rowSpan: 5, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } },
            { content: '', rowSpan: 5, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } }
          ],
          [speedTests[1].down, speedTests[1].up],
          [speedTests[2].down, speedTests[2].up],
          [speedTests[3].down, speedTests[3].up],
          [speedTests[4].down, speedTests[4].up],
        ],
        //Changed fontstyle, size and header color
        theme: 'grid',
        headStyles: { 
        fillColor: [204, 226, 234],
        textColor: [0, 0, 0], 
        fontStyle: 'bold', 
        font: 'Palatino', // ✅
        halign: 'center',
        valign: 'middle',
        minCellHeight: 21,
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
        },
        bodyStyles: { 
        textColor: [0, 0, 0], 
        halign: 'center',
        valign: 'middle',
        font: 'Palatino',
        fontStyle: 'bold', // ✅
        fontSize: 12,      // ✅
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
},
        styles: { 
        fontSize: 10, 
        halign: 'center',
        font: 'Palatino', // ✅
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
        },
      });

      // Footer
      drawFooter();

      // 3. ATTACHMENT 1: EQUIPMENT PHOTOS (Combox) // Changed font to Palatino
      doc.addPage();
      drawHeader();
      drawFooter();
      let currentY = 50;
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');
      doc.text("ATTACHMENT 1", pageWidth / 2, currentY, { align: 'center' });
      doc.setFont('Palatino', 'normal');
      doc.text("EQUIPMENT PHOTOS", pageWidth / 2, currentY + 6, { align: 'center' });
      currentY += 5;
      
      // Section Border
      const sectionHeight = 130;
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.rect(15, currentY, pageWidth - 30, sectionHeight);
      
      // Combox Image (Single)
      if (comboxImage) {
        addImageToPage(comboxImage, 15 + 1, currentY + 1, pageWidth - 32, sectionHeight - 2);
      } else {
        doc.setFont('times', 'italic');
        doc.text("[No Communication Box Image Uploaded]", pageWidth / 2, currentY + sectionHeight / 2, { align: 'center' });
      }

      // 4. ATTACHMENT 1: ADDITIONAL PHOTOS (Next Page)
      if (additionalImages.length > 0) {
        doc.addPage();
        drawHeader();
        drawFooter();
        doc.setFontSize(11);
        doc.setFont('Palatino', 'bold');// Changed font to Palatino
        const titleY = 50;
        doc.text("ATTACHMENT 1: EQUIPMENT PHOTOS (Access Points)", pageWidth / 2, titleY, { align: 'center' });
        
        const gridStartY = titleY + 5;
        const gridHeight = pageHeight - gridStartY - 60; // Leave space for footer
        doc.rect(15, gridStartY, pageWidth - 30, gridHeight);
        drawImageGrid(additionalImages, gridStartY, gridHeight);
      }

      // 5. ATTACHMENT 2: BW TEST RESULTS
      doc.addPage();
      drawHeader();
      drawFooter();
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');// Changed font to Palatino
      const bwTitleY = 50;
     doc.text("ATTACHMENT 2", pageWidth / 2, currentY, { align: 'center' });
     doc.setFont('Palatino', 'normal');
      doc.text("DOWNLINK AND UPLINK TEST RESULTS", pageWidth / 2, currentY + 6, { align: 'center' });
      
      const bwGridStartY = bwTitleY + 5;
      const bwGridHeight = pageHeight - bwGridStartY - 60;
      doc.rect(15, bwGridStartY, pageWidth - 30, bwGridHeight);

      if (speedtestImages.length > 0) {
        drawImageGrid(speedtestImages, bwGridStartY, bwGridHeight);
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.text("[No Speedtest Images Uploaded]", pageWidth / 2, bwGridStartY + bwGridHeight / 2, { align: 'center' });
      }

      // 6. ATTACHMENT 3: SITE PICTURES
      doc.addPage();
      drawHeader();
      drawFooter();
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');// Changed font to Palatino
      const siteTitleY = 50;
      doc.text("ATTACHMENT 3", pageWidth / 2, currentY, { align: 'center' });
      doc.setFont('Palatino', 'normal');
      doc.text("SITE INSPECTION PICTURES", pageWidth / 2, currentY + 6, { align: 'center' });
      
      const siteSectionY = siteTitleY + 5;
      doc.rect(15, siteSectionY, pageWidth - 30, sectionHeight);
      
      if (siteInspectionImage) {
        addImageToPage(siteInspectionImage, 15 + 1, siteSectionY + 1, pageWidth - 32, sectionHeight - 2);
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.text("[No Site Inspection Image Uploaded]", pageWidth / 2, siteSectionY + sectionHeight / 2, { align: 'center' });
      }

      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      setPdfBlob(pdfBlob);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePDF = async () => {
    if (!pdfBlob) return;
    
    setIsSaving(true);
    try {
      // Convert blob to base64
      const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      const token = await getToken();
      const res = await fetch('/api/reports/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          siteId: selectedSite,
          reportDate: reportDate,
          pdfData: base64data,
          reportType: 'monthly_inspection'
        })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        Swal.fire('Saved!', 'Report saved successfully to database.', 'success');
      } else {
        throw new Error(data.message || 'Failed to save report');
      }
    } catch (error) {
      console.error('Error saving PDF:', error);
      Swal.fire('Error', error.message || 'Failed to save report', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col lg:flex-row gap-6">
        
        <div className="w-full lg:w-1/3">
          <div className="sticky top-8">
            <SiteList
              sites={sites}
              loading={loadingSites}
              selectedSite={selectedSite}
              searchTerm={siteSearchTerm}
              onSiteSelect={(id) => { setSelectedSite(id); setPdfUrl(null); }}
              onSearchChange={setSiteSearchTerm}
            />
          </div>
        </div>

        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          {!pdfUrl ? (
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="p-2 bg-blue-500/20 rounded-lg">📄</span>
                Report Configuration
              </h2>

              {!selectedSite ? (
                <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-xl">
                  <p className="text-gray-400 italic">Select a site to generate the "{sites.find(s=>s.siteId===selectedSite)?.name || 'Site'}" layout.</p>
                </div>
              ) : (
                <form onSubmit={handleGeneratePDF} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Provider Name</label>
                      <input type="text" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none"/>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Report Title</label>
                      <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none"/>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Report Date</label>
                      <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none"/>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Contracted Bandwidth (Mbps)</label>
                      <input type="text" value={contractedBandwidth} onChange={(e) => setContractedBandwidth(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none"/>
                    </div>
                  </div>
                  
                  <div className="border border-white/10 p-4 rounded-xl bg-white/5">
                    <h4 className="text-sm font-semibold mb-3 text-blue-300">Speed Test Results (Mbps)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {speedTests.map((test, index) => (
                        <div key={index} className="flex flex-col gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                          <label className="text-xs text-gray-400 font-medium text-center">Test {index + 1}</label>
                          <input 
                            type="text" 
                            placeholder="Down" 
                            value={test.down} 
                            onChange={(e) => handleSpeedTestChange(index, 'down', e.target.value)}
                            className="bg-black/20 border border-white/10 p-2 rounded-md outline-none text-sm w-full text-center focus:border-blue-500/50 transition-colors"
                          />
                          <input 
                            type="text" 
                            placeholder="Up" 
                            value={test.up} 
                            onChange={(e) => handleSpeedTestChange(index, 'up', e.target.value)}
                            className="bg-black/20 border border-white/10 p-2 rounded-md outline-none text-sm w-full text-center focus:border-blue-500/50 transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border border-white/10 p-4 rounded-xl bg-white/5 space-y-4">
                    <h4 className="text-sm font-semibold text-blue-300 border-b border-white/10 pb-2">Attachments</h4>
                    
                    {/* Combox Image */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-300 block">Communication Box (1 Image)</label>
                      <div className="flex items-center gap-4">
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-lg transition-colors">
                          Upload Image
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setComboxImage)} />
                        </label>
                        {comboxImage && (
                          <div className="relative group">
                            <img src={comboxImage} alt="Combox" className="h-16 w-16 object-cover rounded-lg border border-white/20" />
                            <button onClick={() => setComboxImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Equipment Images */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-300 block">Additional Equipment Photos</label>
                      <div className="flex flex-wrap gap-3">
                        {additionalImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img} alt={`Eq ${idx}`} className="h-16 w-16 object-cover rounded-lg border border-white/20" />
                            <button onClick={() => removeImage(idx, setAdditionalImages)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        ))}
                        <label className="cursor-pointer h-16 w-16 bg-white/5 border border-dashed border-white/30 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white/50 hover:text-white">
                          <span className="text-2xl">+</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e, setAdditionalImages, true)} />
                        </label>
                      </div>
                    </div>

                    {/* Speedtest Images */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-300 block">Speedtest Result Photos</label>
                      <div className="flex flex-wrap gap-3">
                        {speedtestImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img} alt={`Speed ${idx}`} className="h-16 w-16 object-cover rounded-lg border border-white/20" />
                            <button onClick={() => removeImage(idx, setSpeedtestImages)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        ))}
                        <label className="cursor-pointer h-16 w-16 bg-white/5 border border-dashed border-white/30 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white/50 hover:text-white">
                          <span className="text-2xl">+</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e, setSpeedtestImages, true)} />
                        </label>
                      </div>
                    </div>

                    {/* Site Inspection Image */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-300 block">Site Inspection Picture (1 Image)</label>
                      <div className="flex items-center gap-4">
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-lg transition-colors">
                          Upload Image
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setSiteInspectionImage)} />
                        </label>
                        {siteInspectionImage && (
                          <div className="relative group">
                            <img src={siteInspectionImage} alt="Site" className="h-16 w-16 object-cover rounded-lg border border-white/20" />
                            <button onClick={() => setSiteInspectionImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Attachments Section */}
                  <div className="border-t border-white/10 mt-6 pt-6">
                    <h3 className="text-lg font-semibold mb-4">Attachments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Combox Image */}
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <label className="block text-sm font-medium mb-2">Communication Box Photo</label>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setComboxImage, false)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-300 hover:file:bg-blue-500/20"/>
                        {comboxImage && (
                          <div className="mt-4 relative w-full h-48 rounded-md overflow-hidden bg-black/20">
                            <img src={comboxImage} alt="Combox" className="w-full h-full object-contain"/>
                            <button type="button" onClick={() => setComboxImage(null)} className="absolute top-2 right-2 bg-red-600/80 text-white rounded-full p-0.5 w-6 h-6 flex items-center justify-center leading-none hover:bg-red-500 transition-colors">&times;</button>
                          </div>
                        )}
                      </div>

                      {/* Site Inspection Image */}
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <label className="block text-sm font-medium mb-2">Site Inspection Photo</label>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setSiteInspectionImage, false)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-300 hover:file:bg-blue-500/20"/>
                        {siteInspectionImage && (
                          <div className="mt-4 relative w-full h-48 rounded-md overflow-hidden bg-black/20">
                            <img src={siteInspectionImage} alt="Site Inspection" className="w-full h-full object-contain"/>
                            <button type="button" onClick={() => setSiteInspectionImage(null)} className="absolute top-2 right-2 bg-red-600/80 text-white rounded-full p-0.5 w-6 h-6 flex items-center justify-center leading-none hover:bg-red-500 transition-colors">&times;</button>
                          </div>
                        )}
                      </div>

                      {/* Additional Images */}
                      <div className="md:col-span-2 bg-white/5 p-4 rounded-lg border border-white/10">
                        <label className="block text-sm font-medium mb-2">Additional Equipment Photos</label>
                        <input type="file" accept="image/*" multiple onChange={(e) => handleImageUpload(e, setAdditionalImages, true)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-300 hover:file:bg-blue-500/20"/>
                        {additionalImages.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {additionalImages.map((img, index) => (
                              <div key={index} className="relative aspect-square rounded-md overflow-hidden bg-black/20">
                                <img src={img} alt={`Additional ${index + 1}`} className="w-full h-full object-contain"/>
                                <button type="button" onClick={() => removeImage(index, setAdditionalImages)} className="absolute top-1 right-1 text-xs bg-red-600/80 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center leading-none hover:bg-red-500 transition-colors">&times;</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Speedtest Images */}
                      <div className="md:col-span-2 bg-white/5 p-4 rounded-lg border border-white/10">
                        <label className="block text-sm font-medium mb-2">Speedtest Result Photos</label>
                        <input type="file" accept="image/*" multiple onChange={(e) => handleImageUpload(e, setSpeedtestImages, true)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-300 hover:file:bg-blue-500/20"/>
                        {speedtestImages.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {speedtestImages.map((img, index) => (
                              <div key={index} className="relative aspect-square rounded-md overflow-hidden bg-black/20">
                                <img src={img} alt={`Speedtest ${index + 1}`} className="w-full h-full object-contain"/>
                                <button type="button" onClick={() => removeImage(index, setSpeedtestImages)} className="absolute top-1 right-1 text-xs bg-red-600/80 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center leading-none hover:bg-red-500 transition-colors">&times;</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button disabled={isGenerating} type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                      {isGenerating ? (
                        <>Generating...</>
                      ) : (
                        <>
                          <span>Generate Monthly Report</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-white/5 rounded-2xl border border-white/10 min-h-[900px] flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white/10 p-4 border-b border-white/10 flex justify-between items-center backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPdfUrl(null)} 
                    className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Configuration
                  </button>
                  <button 
                    onClick={handleSavePDF}
                    disabled={isSaving}
                    className="flex items-center gap-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-all shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Saving...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        Save PDF
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-300">PDF Preview</span>
                  <button onClick={() => window.open(pdfUrl)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md transition-colors shadow-lg shadow-blue-900/20">
                    Open in New Tab
                  </button>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center bg-gray-900/50">
                <iframe src={pdfUrl} className="w-full h-full border-none" title="Report Preview"/>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
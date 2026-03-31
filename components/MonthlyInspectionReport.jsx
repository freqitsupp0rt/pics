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

    const isSiteCode = /^PICS-[A-Z0-9-]+$/i.test(potentialCode);

    if (isSiteCode) {
      return {
        siteCode: potentialCode,
        siteName: potentialName
      };
    }
  }

  return { siteCode: '', siteName: trimmedName };
};

// ── Signatory options  ──
const PREPARED_BY_OPTIONS = [
  { name: 'Engr. Jason Ilde Y. Aguihon', lines: ['Project Engineer'] },
  { name: 'Engr. Eduardo Dela Cruz', lines: ['Project Engineer'] },
];

const CHECKED_BY_OPTIONS = [
  { name: 'Engr. Cindy D. Camarines', lines: ['Engineer II, FPIAP', 'DICT Regional Office VIII'] },
  { name: 'Engr. Gualberto R. Gualberto Jr.', lines: ['DICT Provincial Officer', '3rd, 4th, & 5th District'] },
];

const NOTED_BY_OPTIONS = [
  { name: 'Ms. CLAIRE P. FERNANDEZ', lines: ['Provincial Officer', 'DICT Leyte'] },
  { name: 'Engr. Edberto C. Versoza', lines: ['Provincial Officer', 'DICT Northern Samar'] },
];

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
    Array(4).fill(null).map(() => ({ down: '', up: '' }))
  );
  const [activeSpeedTestTab, setActiveSpeedTestTab] = useState(0);
  const [activeSectionTab, setActiveSectionTab] = useState(0);

  // ── Signatory state ──
  const [preparedBy, setPreparedBy] = useState(PREPARED_BY_OPTIONS[0]);
  const [checkedBy, setCheckedBy] = useState(CHECKED_BY_OPTIONS[0]);
  const [notedBy, setNotedBy] = useState(NOTED_BY_OPTIONS[0]);

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
          setter(prev => {
            if (prev.length >= 4) return prev;
            return [...prev, event.target.result];
          });
        } else {
          setter(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (index, setter) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const [draggingOver, setDraggingOver] = useState(null);

  const readFileAsDataURL = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });

  const handleDrop = async (e, zone, setter, isMultiple = false) => {
    e.preventDefault();
    setDraggingOver(null);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    if (!isMultiple) {
      const dataUrl = await readFileAsDataURL(files[0]);
      setter(dataUrl);
    } else {
      for (const file of files) {
        const dataUrl = await readFileAsDataURL(file);
        setter(prev => {
          if (prev.length >= 4) return prev;
          return [...prev, dataUrl];
        });
      }
    }
  };

  const handleDragOver = (e, zone) => {
    e.preventDefault();
    setDraggingOver(zone);
  };

  const handleDragLeave = () => setDraggingOver(null);

  const [pdfUrl, setPdfUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

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
          body: [['', '', '']],
          styles: {
            minCellHeight: pageHeight * 0.1,
            valign: 'middle',
            halign: 'center',
            fontSize: 9,
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
          },
          columnStyles: {
            0: { cellWidth: pageWidth * 0.2 - 3 },
            1: { cellWidth: pageWidth * 0.5 - 1, fontSize: 12, fontStyle: 'bold' },
            2: { cellWidth: pageWidth * 0.2 - 3 },
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

                doc.setFont('times', 'bold');
                doc.setFontSize(16);
                doc.text('MONTHLY INSPECTION REPORT', centerX, centerY - 4, { align: 'center' });

                doc.setFont('times', 'normal');
                doc.setFontSize(9);
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

      // ── Updated drawFooter using selected signatories ──
      const drawFooter = () => {
        const footerY = pageHeight - 55;
        doc.setFontSize(10);
        doc.setFont('times', 'italic');
        doc.text("Notes: Photos should have Geotagging (coordinates, date and time stamp)", 15, footerY);

        // Prepared by (left column)
        doc.setFont('times', 'bold');
        doc.text(`Prepared by: ${preparedBy.name}`, 15, footerY + 10);
        doc.setFont('times', 'normal');
        preparedBy.lines.forEach((line, i) => {
          doc.text(line, 15, footerY + 15 + (i * 5));
        });

        const rightColX = pageWidth / 2 + 10;

        // Checked by (right column, top)
        doc.setFont('times', 'bold');
        doc.text(`Checked by: ${checkedBy.name}`, rightColX, footerY + 10);
        doc.setFont('times', 'normal');
        checkedBy.lines.forEach((line, i) => {
          doc.text(line, rightColX, footerY + 15 + (i * 5));
        });

        // Noted by (right column, bottom)
        doc.setFont('times', 'bold');
        doc.text(`Noted by: ${notedBy.name}`, rightColX, footerY + 30);
        doc.setFont('times', 'normal');
        notedBy.lines.forEach((line, i) => {
          doc.text(line, rightColX, footerY + 35 + (i * 5));
        });
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
        const gap = 10;
        const padding = 8;
        const availableWidth = pageWidth - 30 - padding * 2;
        const availableHeight = containerHeight - padding * 2;

        if (images.length === 5) {
          const rowHeight = (availableHeight - gap) / 2;

          const topRowY = startY + padding;
          const topRowWidth = (availableWidth - gap) / 2;

          addImageToPage(images[0], 15 + padding, topRowY, topRowWidth, rowHeight);
          addImageToPage(images[1], 15 + padding + topRowWidth + gap, topRowY, topRowWidth, rowHeight);

          const bottomRowY = startY + padding + rowHeight + gap;
          const bottomRowWidth = (availableWidth - 2 * gap) / 3;

          addImageToPage(images[2], 15 + padding, bottomRowY, bottomRowWidth, rowHeight);
          addImageToPage(images[3], 15 + padding + bottomRowWidth + gap, bottomRowY, bottomRowWidth, rowHeight);
          addImageToPage(images[4], 15 + padding + 2 * (bottomRowWidth + gap), bottomRowY, bottomRowWidth, rowHeight);

        } else {
          const cols = 2;
          const rows = images.length <= 2 ? 1 : images.length <= 4 ? 2 : 3;
          const cellWidth = (availableWidth - gap * (cols - 1)) / cols;
          const cellHeight = (availableHeight - gap * (rows - 1)) / rows;

          images.forEach((img, index) => {
            if (index >= cols * rows) return;
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = 15 + padding + col * (cellWidth + gap);
            const y = startY + padding + row * (cellHeight + gap);
            addImageToPage(img, x, y, cellWidth, cellHeight);
          });
        }
      };

      // 1. TOP HEADER & PAGE 1 INFO
      drawHeader();
      doc.setFontSize(12);
      doc.setFont('times', 'bold');
      doc.text(`Provider Name: FREQ IT SOLUTIONS`, 15, doc.lastAutoTable.finalY + 10);
      doc.text(`Date Prepared: ${dayjs(reportDate).format('MMMM D, YYYY')}`, pageWidth - 15, doc.lastAutoTable.finalY + 10, { align: 'right' });

      // 2. MAIN DATA TABLE
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [[
          'Item\nNo.',
          'Location Code',
          'Location Name',
          'Downlink\nBandwidth\nMbps)',
          'Uplink\nBandwidth\n(Mbps)',
          'Contracted\nBandwidth\n(Mbps)',
          'Remarks'
        ]],
        body: [
          [
            { content: '1', rowSpan: 4, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } },
            { content: siteCode || 'N/A', rowSpan: 4, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } },
            { content: siteName || 'N/A', rowSpan: 4, styles: { valign: 'middle', halign: 'left' } },
            speedTests[0].down,
            speedTests[0].up,
            { content: `${contractedBandwidth} Mbps`, rowSpan: 4, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } },
            { content: '', rowSpan: 4, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } }
          ],
          [speedTests[1].down, speedTests[1].up],
          [speedTests[2].down, speedTests[2].up],
          [speedTests[3].down, speedTests[3].up],
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [135, 206, 235],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        styles: {
          fontSize: 8,
          halign: 'center',
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          2: { halign: 'left', cellWidth: 40 },
          6: { cellWidth: 25 }
        }
      });

      drawFooter();

      // 3. ATTACHMENT 1: EQUIPMENT PHOTOS (Combox)
      doc.addPage();
      drawHeader();
      drawFooter();
      let currentY = 50;
      doc.setFontSize(11);
      doc.setFont('times', 'bold');
      doc.text("ATTACHMENT 1: EQUIPMENT PHOTOS", pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;

      const sectionHeight = 180;
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.rect(15, currentY, pageWidth - 30, sectionHeight);

      if (comboxImage) {
        addImageToPage(comboxImage, 15 + 1, currentY + 10, pageWidth - 32, sectionHeight - 20);
      } else {
        doc.setFont('times', 'italic');
        doc.text("[No Communication Box Image Uploaded]", pageWidth / 2, currentY + sectionHeight / 2, { align: 'center' });
      }

      // 4. ATTACHMENT 1: ADDITIONAL PHOTOS
      if (additionalImages.length > 0) {
        doc.addPage();
        drawHeader();
        drawFooter();
        doc.setFontSize(11);
        doc.setFont('times', 'bold');
        const titleY = 50;
        doc.text("ATTACHMENT 1: EQUIPMENT PHOTOS (Access Points)", pageWidth / 2, titleY, { align: 'center' });

        const gridStartY = titleY + 5;
        const gridHeight = pageHeight - gridStartY - 60;
        doc.rect(15, gridStartY, pageWidth - 30, gridHeight);
        drawImageGrid(additionalImages, gridStartY, gridHeight);
      }

      // 5. ATTACHMENT 2: BW TEST RESULTS
      doc.addPage();
      drawHeader();
      drawFooter();
      doc.setFontSize(11);
      doc.setFont('times', 'bold');
      const bwTitleY = 50;
      doc.text("ATTACHMENT 2: BANDWIDTH TEST RESULTS", pageWidth / 2, bwTitleY, { align: 'center' });

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
      doc.setFont('times', 'bold');
      const siteTitleY = 50;
      doc.text("ATTACHMENT 3: SITE PICTURES", pageWidth / 2, siteTitleY, { align: 'center' });

      const siteSectionY = siteTitleY + 5;
      doc.rect(15, siteSectionY, pageWidth - 30, sectionHeight);

      if (siteInspectionImage) {
        const imageMargin = 8;
        addImageToPage(siteInspectionImage, 15 + 1, siteSectionY + 1 + imageMargin, pageWidth - 32, sectionHeight - 2 - imageMargin * 2);
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

  // ── Navigate AP tabs with validation; go to Attachments after last AP ──
  const handleNextClick = () => {
    const currentTest = speedTests[activeSpeedTestTab];
    const missingDown = !currentTest.down;
    const missingUp = !currentTest.up;

    if (missingDown || missingUp) {
      const missing = [];
      if (missingDown) missing.push('Download');
      if (missingUp) missing.push('Upload');

      Swal.fire({
        icon: 'warning',
        title: `Missing AP ${activeSpeedTestTab + 1} Data`,
        html: `
          Please fill in the following:
          <ul style="text-align: center; margin-top: 8px;">
            ${missing.map(m => `<li>${m}</li>`).join('')}
          </ul>
        `,
        confirmButtonText: 'Go Back',
        background: '#1f2b3a',
        color: '#e2e1e1',
        confirmButtonColor: '#3b82f6',
      });
      return;
    }

    if (activeSpeedTestTab < speedTests.length - 1) {
      setActiveSpeedTestTab(activeSpeedTestTab + 1);
      return;
    }

    setActiveSectionTab(1);
  };

  // ── Reset all form fields when a new site is selected ──
  const handleSiteSelect = (id) => {
    setSelectedSite(id);
    setPdfUrl(null);
    setPdfBlob(null);

    setSpeedTests(Array(4).fill(null).map(() => ({ down: '', up: '' })));
    setActiveSpeedTestTab(0);
    setActiveSectionTab(0);

    setComboxImage(null);
    setAdditionalImages([]);
    setSpeedtestImages([]);
    setSiteInspectionImage(null);

    // Reset signatories to defaults
    setPreparedBy(PREPARED_BY_OPTIONS[0]);
    setCheckedBy(CHECKED_BY_OPTIONS[0]);
    setNotedBy(NOTED_BY_OPTIONS[0]);
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
              onSiteSelect={handleSiteSelect}
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
                  <p className="text-gray-400 italic">Select a site to generate the layout.</p>
                </div>
              ) : (
                <form onSubmit={handleGeneratePDF} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Provider Name</label>
                      <input type="text" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Report Title</label>
                      <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Report Date</label>
                      <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Contracted Bandwidth (Mbps)</label>
                      <input type="text" value={contractedBandwidth} onChange={(e) => setContractedBandwidth(e.target.value)} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
                    </div>

                    {/* ── Signatory Dropdowns ── */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Prepared by</label>
                      <select
                        value={preparedBy.name}
                        onChange={(e) => setPreparedBy(PREPARED_BY_OPTIONS.find(o => o.name === e.target.value))}
                        className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none text-white"
                      >
                        {PREPARED_BY_OPTIONS.map(o => (
                          <option key={o.name} value={o.name} className="bg-gray-800 text-white">{o.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Checked by</label>
                      <select
                        value={checkedBy.name}
                        onChange={(e) => setCheckedBy(CHECKED_BY_OPTIONS.find(o => o.name === e.target.value))}
                        className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none text-white"
                      >
                        {CHECKED_BY_OPTIONS.map(o => (
                          <option key={o.name} value={o.name} className="bg-gray-800 text-white">{o.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-sm text-gray-300">Noted by</label>
                      <select
                        value={notedBy.name}
                        onChange={(e) => setNotedBy(NOTED_BY_OPTIONS.find(o => o.name === e.target.value))}
                        className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none text-white"
                      >
                        {NOTED_BY_OPTIONS.map(o => (
                          <option key={o.name} value={o.name} className="bg-gray-800 text-white">{o.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Section Tabs: Speed Tests + Attachments ── */}
                  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">

                    {/* Top-level step indicators */}
                    <div className="flex border-b border-white/10 bg-black/30">
                      {[
                        {
                          label: 'Speed Test Results',
                          step: 1,
                          icon: (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          ),
                          accent: 'blue',
                        },
                        {
                          label: 'Attachments',
                          step: 2,
                          icon: (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          ),
                          accent: 'purple',
                        },
                      ].map((tab, i) => {
                        const isActive = activeSectionTab === i;
                        const isDone = activeSectionTab > i;
                        return (
                          <div
                            key={i}
                            onClick={() => { if (i < activeSectionTab) setActiveSectionTab(i); }}
                            className={`
                              relative flex-1 flex items-center justify-center gap-2 py-3.5 px-4 text-xs font-semibold tracking-wide uppercase select-none
                              ${i < activeSectionTab ? 'cursor-pointer' : 'cursor-default'}
                              ${isActive
                                ? tab.accent === 'blue' ? 'text-blue-400' : 'text-purple-400'
                                : isDone ? 'text-gray-400 hover:text-gray-200 transition-colors' : 'text-gray-600'
                              }
                            `}
                          >
                            {isActive && (
                              <span className={`absolute inset-0 pointer-events-none ${tab.accent === 'blue' ? 'bg-gradient-to-b from-blue-600/15 to-transparent' : 'bg-gradient-to-b from-purple-600/15 to-transparent'}`} />
                            )}
                            <span className="relative flex items-center gap-2">
                              <span className={`
                                w-6 h-6 rounded-lg flex items-center justify-center shrink-0
                                ${isActive
                                  ? tab.accent === 'blue' ? 'bg-blue-500/30 text-blue-400' : 'bg-purple-500/30 text-purple-400'
                                  : isDone ? 'bg-white/10 text-gray-300' : 'bg-white/5 text-gray-600'
                                }
                              `}>
                                {isDone ? (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : tab.icon}
                              </span>
                              {tab.label}
                            </span>
                            {isActive && (
                              <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-16 rounded-full ${tab.accent === 'blue' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                            )}
                            {i < 1 && (
                              <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-px bg-white/10" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Panel 0: Speed Test Results ── */}
                    <div className={activeSectionTab === 0 ? 'block' : 'hidden'}>
                      <div className="flex border-b border-white/10 bg-black/20">
                        {speedTests.map((test, index) => {
                          const hasData = test.down || test.up;
                          const isActive = activeSpeedTestTab === index;
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setActiveSpeedTestTab(index)}
                              className={`
                                relative flex-1 py-3 text-xs font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer
                                ${isActive ? 'text-white -translate-y-0.3 scale-105' : 'text-gray-500 hover:text-gray-300'}
                              `}
                            >
                              {isActive && (
                                <span className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none" />
                              )}
                              <span className="relative flex flex-col items-center gap-1">
                                <span>AP {index + 1}</span>
                                {hasData && (
                                  <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                )}
                              </span>
                              {isActive && (
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="bg-black/10 p-5">
                        {speedTests.map((test, index) => (
                          <div key={index} className={activeSpeedTestTab === index ? 'block' : 'hidden'}>
                            <div className="grid grid-cols-2 gap-4">
                              {/* Download */}
                              <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-400/5 border border-cyan-500/20 p-4 hover:border-cyan-500/40 transition-all duration-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                  </div>
                                  <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Download</label>
                                </div>
                                <input
                                  type="text"
                                  placeholder="0.00"
                                  value={test.down}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                      handleSpeedTestChange(index, 'down', val);
                                    }
                                  }}
                                  className="w-full bg-transparent outline-none text-2xl font-bold text-white placeholder-white/20 text-center transition-all"
                                />
                                <p className="text-center text-xs text-cyan-400/50 mt-1">Mbps</p>
                              </div>
                              {/* Upload */}
                              <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-400/5 border border-purple-500/20 p-4 hover:border-purple-500/40 transition-all duration-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                  </div>
                                  <label className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Upload</label>
                                </div>
                                <input
                                  type="text"
                                  placeholder="0.00"
                                  value={test.up}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                      handleSpeedTestChange(index, 'up', val);
                                    }
                                  }}
                                  className="w-full bg-transparent outline-none text-2xl font-bold text-white placeholder-white/20 text-center transition-all"
                                />
                                <p className="text-center text-xs text-purple-400/50 mt-1">Mbps</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Next button */}
                      <div className="px-5 pb-5 pt-2">
                        <button
                          type="button"
                          onClick={handleNextClick}
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 text-sm"
                        >
                          <span>{activeSpeedTestTab < speedTests.length - 1 ? `Next — AP ${activeSpeedTestTab + 2}` : 'Next — Attachments'}</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* ── Panel 1: Attachments ── */}
                    <div className={activeSectionTab === 1 ? 'block' : 'hidden'}>
                      <div className="bg-black/10 p-5 space-y-5">

                        {/* Single-image row: Combox + Site Inspection */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Communication Box */}
                          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Comm. Box</span>
                              <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">1 image</span>
                            </div>
                            <div className="p-3">
                              {comboxImage ? (
                                <div className="relative group rounded-lg overflow-hidden aspect-square bg-black/20">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={comboxImage} alt="Combox" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => setLightboxImage(comboxImage)} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    </button>
                                    <button type="button" onClick={() => setComboxImage(null)} className="w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors">
                                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label
                                  className={`cursor-pointer flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed transition-all group
                                    ${draggingOver === 'combox'
                                      ? 'border-purple-400 bg-purple-500/15 scale-[1.02]'
                                      : 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5'}`}
                                  onDragOver={(e) => handleDragOver(e, 'combox')}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, 'combox', setComboxImage, false)}
                                >
                                  <svg className={`w-6 h-6 mb-1 transition-colors ${draggingOver === 'combox' ? 'text-purple-400' : 'text-gray-600 group-hover:text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className={`text-[10px] transition-colors ${draggingOver === 'combox' ? 'text-purple-400' : 'text-gray-600 group-hover:text-purple-400'}`}>
                                    {draggingOver === 'combox' ? 'Drop here' : 'Upload or drag'}
                                  </span>
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setComboxImage)} />
                                </label>
                              )}
                            </div>
                          </div>

                          {/* Site Inspection */}
                          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Site Inspection</span>
                              <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">1 image</span>
                            </div>
                            <div className="p-3">
                              {siteInspectionImage ? (
                                <div className="relative group rounded-lg overflow-hidden aspect-square bg-black/20">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={siteInspectionImage} alt="Site" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => setLightboxImage(siteInspectionImage)} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    </button>
                                    <button type="button" onClick={() => setSiteInspectionImage(null)} className="w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors">
                                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label
                                  className={`cursor-pointer flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed transition-all group
                                    ${draggingOver === 'site'
                                      ? 'border-purple-400 bg-purple-500/15 scale-[1.02]'
                                      : 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5'}`}
                                  onDragOver={(e) => handleDragOver(e, 'site')}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, 'site', setSiteInspectionImage, false)}
                                >
                                  <svg className={`w-6 h-6 mb-1 transition-colors ${draggingOver === 'site' ? 'text-purple-400' : 'text-gray-600 group-hover:text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className={`text-[10px] transition-colors ${draggingOver === 'site' ? 'text-purple-400' : 'text-gray-600 group-hover:text-purple-400'}`}>
                                    {draggingOver === 'site' ? 'Drop here' : 'Upload or drag'}
                                  </span>
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setSiteInspectionImage)} />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Multi-image rows */}
                        {[
                          { label: 'Equipment Photos', sublabel: 'Access points, cables, hardware', zone: 'equipment', images: additionalImages, setter: setAdditionalImages, onAdd: (e) => handleImageUpload(e, setAdditionalImages, true) },
                          { label: 'Speedtest Results', sublabel: 'Bandwidth test screenshots', zone: 'speedtest', images: speedtestImages, setter: setSpeedtestImages, onAdd: (e) => handleImageUpload(e, setSpeedtestImages, true) },
                        ].map(({ label, sublabel, zone, images, setter, onAdd }) => (
                          <div key={label} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{label}</span>
                                <p className="text-[10px] text-gray-600 mt-0.5">{sublabel}</p>
                              </div>
                              <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                                {images.length} / 4
                              </span>
                            </div>
                            <div
                              className={`p-4 transition-colors duration-150 ${draggingOver === zone ? 'bg-purple-500/10' : ''}`}
                              onDragOver={(e) => images.length < 4 ? handleDragOver(e, zone) : e.preventDefault()}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, zone, setter, true)}
                            >
                              <div className="grid grid-cols-4 gap-3">
                                {images.map((img, idx) => (
                                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-black/20 border border-white/10 hover:border-white/20 transition-all shadow-md">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={img} alt={`${label} ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button type="button" onClick={() => setLightboxImage(img)} className="w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all hover:scale-110">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                      </button>
                                      <button type="button" onClick={() => removeImage(idx, setter)} className="w-8 h-8 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm rounded-full flex items-center justify-center transition-all hover:scale-110">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </div>
                                    <div className="absolute bottom-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-[9px] text-white/60 px-1.5 py-0.5 rounded-md font-medium">
                                      {idx + 1}
                                    </div>
                                  </div>
                                ))}
                                {images.length < 4 && (
                                  <label
                                    className={`cursor-pointer aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all group shadow-md
                                      ${draggingOver === zone
                                        ? 'border-purple-400 bg-purple-500/20 scale-[1.03]'
                                        : 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5'}`}
                                  >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all mb-1
                                      ${draggingOver === zone ? 'bg-purple-500/30' : 'bg-white/5 group-hover:bg-purple-500/20'}`}>
                                      <svg className={`w-4 h-4 transition-colors ${draggingOver === zone ? 'text-purple-300' : 'text-gray-600 group-hover:text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                    </div>
                                    <span className={`text-[10px] transition-colors font-medium ${draggingOver === zone ? 'text-purple-300' : 'text-gray-600 group-hover:text-purple-400'}`}>
                                      {draggingOver === zone ? 'Drop here' : 'Add'}
                                    </span>
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={onAdd} />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Generate button */}
                      <div className="pt-2">
                        <button
                          disabled={isGenerating}
                          type="submit"
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isGenerating ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <span>Generate Monthly Report</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

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
                      <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
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
                <iframe src={pdfUrl} className="w-full h-full border-none" title="Report Preview" />
              </div>
            </div>
          )}
        </div>
      </div>
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </main>
  );
}
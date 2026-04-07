'use client';

import { useState, useEffect, useRef } from "react";
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
      return { siteCode: potentialCode, siteName: potentialName };
    }
  }
  return { siteCode: '', siteName: trimmedName };
};

const expandSiteType = (siteName) => {
  if (!siteName) return siteName;
  siteName = siteName.replace(/_/g, ' ');
  const abbreviations = {
    'ES': 'Elementary School',
    'NHS': 'National High School',
    'CC': 'Covered Court',
    'MP': 'Municipal Plaza',
    'MH': 'Municipal Hall',
    'IS': 'Integrated School',
    'CS': 'Central School',
  };
  const separators = ['', '-', ' ', '.'];
  let expandedName = siteName;
  for (const [abbr, fullName] of Object.entries(abbreviations)) {
    const index = siteName.toLowerCase().indexOf(abbr.toLowerCase());
    if (index !== -1) {
      const afterAbbr = siteName.slice(index + abbr.length);
      const isAtEnd = afterAbbr === '' || separators.some(sep => afterAbbr.startsWith(sep));
      if (isAtEnd) {
        expandedName = siteName.slice(0, index) + fullName + siteName.slice(index + abbr.length);
        break;
      }
    }
  }
  return expandedName;
};

const PREPARED_BY_OPTIONS = [
  { name: 'Engr. Jason Ilde Y. Aguihon, ETC', lines: ['Project Engineer'] },
  { name: 'Engr. Eduardo M. Dela Cruz Jr, ECT', lines: ['Project Engineer'] },
];

const CHECKED_BY_OPTIONS = [
  { name: 'Engr. Cindy D. Camarines', lines: ['Engineer II, FPIAP', 'DICT Regional Office VIII'] },
  { name: 'Engr. Gualberto R. Gualberto Jr.', lines: ['DICT Provincial Officer', '3rd, 4th, & 5th District'] },
];

const NOTED_BY_OPTIONS = [
  { name: 'Ms. Claire P. Fernandez', lines: ['Provincial Officer', 'DICT Leyte'] },
  { name: 'Engr. Edberto C. Versoza', lines: ['Provincial Officer', 'DICT Northern Samar'] },
];

// ── Custom Dropdown Component ──
function CustomSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.name === value);

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-sm text-gray-300">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="w-full flex items-center justify-between bg-white/5 border border-white/20 p-3 rounded-xl text-white text-left transition-colors hover:bg-white/10 focus:outline-none focus:border-white/40"
        >
          <span className="truncate text-sm">{selected?.name}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <ul className="absolute z-50 mt-2 w-full bg-gray-900 border border-white/20 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
            {options.map((o) => (
              <li key={o.name}>
                <button
                  type="button"
                  onClick={() => { onChange(o); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10
                    ${o.name === value
                      ? 'text-white bg-white/5 font-semibold'
                      : 'text-gray-300 font-normal'
                    }`}
                >
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

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
  const [lightboxMeta, setLightboxMeta] = useState(null);

  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [imageAdjustments, setImageAdjustments] = useState({});
  const [geotags, setGeotags] = useState({});          // { "equipment-0": { address, coords, datetime }, … }
  const [lightboxTab, setLightboxTab] = useState('edit');

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

  async function applyImageAdjustments(src, brightness, contrast, sharpness = 0) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        const brightnessCSS = 100 + brightness;
        const contrastCSS = 100 + contrast;
        ctx.filter = `brightness(${brightnessCSS}%) contrast(${contrastCSS}%)`;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';
        if (sharpness !== 0) {
          const strength = (sharpness / 100) * 3;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const srcData = imageData.data;
          const output = new Uint8ClampedArray(srcData);
          const w = canvas.width;
          const h = canvas.height;
          const kernel = [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0];
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              for (let c = 0; c < 3; c++) {
                const i = (y * w + x) * 4 + c;
                output[i] = Math.min(255, Math.max(0,
                  kernel[0] * srcData[((y - 1) * w + (x - 1)) * 4 + c] +
                  kernel[1] * srcData[((y - 1) * w + x) * 4 + c] +
                  kernel[2] * srcData[((y - 1) * w + (x + 1)) * 4 + c] +
                  kernel[3] * srcData[(y * w + (x - 1)) * 4 + c] +
                  kernel[4] * srcData[(y * w + x) * 4 + c] +
                  kernel[5] * srcData[(y * w + (x + 1)) * 4 + c] +
                  kernel[6] * srcData[((y + 1) * w + (x - 1)) * 4 + c] +
                  kernel[7] * srcData[((y + 1) * w + x) * 4 + c] +
                  kernel[8] * srcData[((y + 1) * w + (x + 1)) * 4 + c]
                ));
              }
            }
          }
          ctx.putImageData(new ImageData(output, w, h), 0, 0);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.src = src;
    });
  }

  const handleGeneratePDF = (e) => {
    e.preventDefault();
    if (!selectedSite) return alert("Please select a site first");
    setIsGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const siteInfo = sites.find(s => s.siteId === selectedSite);
      const { siteCode, siteName } = parseSiteInfo(siteInfo?.name);
      const expandedSiteName = expandSiteType(siteName);
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
                doc.setTextColor(0, 0, 0);
                doc.setFont('Palatino', 'bold');
                doc.setFontSize(16);
                doc.text('MONTHLY INSPECTION REPORT', centerX, centerY - 4, { align: 'center' });
                doc.setTextColor(0, 0, 0);
                doc.setFont('Palatino', 'normal');
                doc.setFontSize(12);
                const text = 'Provision Of Internet Connectivity Service (PICS)\nIn Public Places - Phase 2';
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

      const drawFooter = () => {
        const footerY = pageHeight - 55;
        doc.setFontSize(10);
        doc.setFont('Palatino', 'italic');
        doc.text("Notes: Photos should have Geotagging (coordinates, date and time stamp)", 15, footerY);
        const drawSignatory = (label, person, x, y, fixedLabelWidth = null) => {
          doc.setFont('Palatino', 'normal');
          const labelW = doc.getTextWidth(label);
          const actualLabelWidth = fixedLabelWidth ?? labelW;
          doc.text(label, x + (actualLabelWidth - labelW), y);
          doc.setFont('Palatino', 'bold');
          doc.text(person.name, x + actualLabelWidth, y);
          const nameWidth = doc.getTextWidth(person.name);
          doc.setLineWidth(0.3);
          doc.line(x + actualLabelWidth, y + 1, x + actualLabelWidth + nameWidth, y + 1);
          const nameCenterX = x + actualLabelWidth + nameWidth / 2;
          doc.setFont('Palatino', 'normal');
          person.lines.forEach((line, i) => {
            const lineWidth = doc.getTextWidth(line);
            doc.text(line, nameCenterX - lineWidth / 2, y + 5.5 + (i * 5));
          });
        };
        const leftX = 15;
        const rightX = pageWidth / 2 + 10;
        const fixedWidth = 22;
        drawSignatory("Prepared by: ", preparedBy, leftX, footerY + 12);
        drawSignatory("Checked by: ", checkedBy, rightX, footerY + 12, fixedWidth);
        drawSignatory("Noted by: ", notedBy, rightX, footerY + 33, fixedWidth);
      };

      const addImageToPage = (imgData, x, y, maxWidth, maxHeight) => {
        if (imgData) {
          try {
            const img = new Image();
            img.src = imgData;
            const naturalW = img.naturalWidth || maxWidth;
            const naturalH = img.naturalHeight || maxHeight;
            const ratio = naturalW / naturalH;
            let drawW = maxWidth;
            let drawH = maxWidth / ratio;
            if (drawH > maxHeight) {
              drawH = maxHeight;
              drawW = maxHeight * ratio;
            }
            const offsetX = x + (maxWidth - drawW) / 2;
            const offsetY = y + (maxHeight - drawH) / 2;
            doc.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH);
          } catch (error) {
            console.warn("Error adding image to PDF", error);
            doc.text("[Image Error]", x + maxWidth / 2, y + maxHeight / 2, { align: 'center' });
          }
        }
      };

      const draw2x2Grid = (images, startY, gridHeight, margin = 12.7) => {
        const innerPadding = 6;
        const gapX = 20;
        const gapY = -11;
        const totalWidth = pageWidth - margin * 2 - innerPadding * 2;
        const totalHeight = gridHeight - innerPadding * 2;
        const cellWidth = (totalWidth - gapX) / 2 - 15;
        const cellHeight = (totalHeight - gapY) / 2 + 9;
        const gridTotalWidth = cellWidth * 2 + gapX;
        const horizontalOffset = (totalWidth - gridTotalWidth) / 2;
        const gridTotalHeight = cellHeight * 2 + gapY;
        const verticalOffset = (totalHeight - gridTotalHeight) / 2;
        const positions = [
          { col: 0, row: 0 },
          { col: 1, row: 0 },
          { col: 0, row: 1 },
          { col: 1, row: 1 },
        ];
        images.slice(0, 4).forEach((img, index) => {
          const { col, row } = positions[index];
          const x = margin + innerPadding + horizontalOffset + col * (cellWidth + gapX);
          const y = startY + innerPadding + verticalOffset + row * (cellHeight + gapY);
          addImageToPage(img, x, y, cellWidth, cellHeight);
        });
      };

      drawHeader();
      doc.setFontSize(12);
      doc.setFont('Palatino', 'normal');
      doc.text('Provider Name: ', 15, doc.lastAutoTable.finalY + 10);
      const providerLabelWidth = doc.getTextWidth('Provider Name: ');
      doc.setFont('Palatino', 'bold');
      doc.text('FREQ IT SOLUTIONS', 15 + providerLabelWidth, doc.lastAutoTable.finalY + 10);
      const dateText = dayjs(reportDate).format('MMMM D, YYYY');
      doc.setFont('Palatino', 'normal');
      doc.text('Date Prepared: ', pageWidth - 15 - doc.getTextWidth('Date Prepared: ') - doc.getTextWidth(dateText), doc.lastAutoTable.finalY + 10);
      doc.setFont('Palatino', 'bold');
      doc.text(dateText, pageWidth - 15, doc.lastAutoTable.finalY + 10, { align: 'right' });

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
        body: [
          [
            { content: '1', rowSpan: 4, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } },
            { content: siteCode || 'N/A', rowSpan: 4, styles: { valign: 'middle', halign: 'center', textColor: [0, 0, 0] } },
            { content: expandedSiteName?.toUpperCase() || 'N/A', rowSpan: 4, styles: { valign: 'middle', halign: 'center' } },
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
          fillColor: [182, 210, 232],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          font: 'Palatino',
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
          fontSize: 11,
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          font: 'Palatino',
          fontStyle: 'bold',
          fontSize: 11,
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        styles: {
          fontSize: 8,
          halign: 'center',
          font: 'Palatino',
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 35 },
          2: { halign: 'left', cellWidth: 60 },
          5: { cellWidth: 18 },
          6: { cellWidth: 18 },
          3: { cellWidth: 19 },
          4: { cellWidth: 19 },
        }
      });

      drawFooter();

      doc.addPage();
      drawHeader();
      drawFooter();
      let currentY = 50;
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');
      doc.text("ATTACHMENT 1: EQUIPMENT PHOTOS", pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
      const sectionHeight = 180;
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.rect(15, currentY, pageWidth - 30, sectionHeight);
      if (comboxImage) {
        addImageToPage(comboxImage, 15 + 15, currentY + 15, pageWidth - 60, sectionHeight - 40);
      } else {
        doc.setFont('Palatino', 'italic');
        doc.text("[No Communication Box Image Uploaded]", pageWidth / 2, currentY + sectionHeight / 2, { align: 'center' });
      }

      if (additionalImages.length > 0) {
        doc.addPage();
        drawHeader();
        drawFooter();
        doc.setFontSize(11);
        doc.setFont('Palatino', 'bold');
        const titleY = 50;
        doc.text("ATTACHMENT 1: EQUIPMENT PHOTOS (Access Points)", pageWidth / 2, titleY, { align: 'center' });
        const gridStartY = titleY + 5;
        const gridHeight = pageHeight - gridStartY - 65;
        doc.rect(12.7, gridStartY, pageWidth - 12.7 * 2, gridHeight);
        draw2x2Grid(additionalImages, gridStartY, gridHeight);
      }

      doc.addPage();
      drawHeader();
      drawFooter();
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');
      const bwTitleY = 50;
      doc.text("ATTACHMENT 2: BANDWIDTH TEST RESULTS", pageWidth / 2, bwTitleY, { align: 'center' });
      const bwGridStartY = bwTitleY + 5;
      const bwGridHeight = pageHeight - bwGridStartY - 65;
      doc.rect(12.7, bwGridStartY, pageWidth - 12.7 * 2, bwGridHeight);
      if (speedtestImages.length > 0) {
        draw2x2Grid(speedtestImages, bwGridStartY, bwGridHeight);
      } else {
        doc.setFont('Palatino', 'italic');
        doc.setFontSize(10);
        doc.text("[No Speedtest Images Uploaded]", pageWidth / 2, bwGridStartY + bwGridHeight / 2, { align: 'center' });
      }

      doc.addPage();
      drawHeader();
      drawFooter();
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');
      const siteTitleY = 50;
      doc.text("ATTACHMENT 3: SITE BENEFICIARY", pageWidth / 2, siteTitleY, { align: 'center' });
      const siteSectionY = siteTitleY + 5;
      doc.rect(15, siteSectionY, pageWidth - 30, sectionHeight);
      if (siteInspectionImage) {
        addImageToPage(siteInspectionImage, 15 + 15, siteSectionY + 15, pageWidth - 60, sectionHeight - 40);
      } else {
        doc.setFont('Palatino', 'italic');
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
    setImageAdjustments({});
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

                    {/* ── Signatory Custom Dropdowns ── */}
                    <CustomSelect
                      label="Prepared by"
                      value={preparedBy.name}
                      onChange={setPreparedBy}
                      options={PREPARED_BY_OPTIONS}
                    />

                    <CustomSelect
                      label="Checked by"
                      value={checkedBy.name}
                      onChange={setCheckedBy}
                      options={CHECKED_BY_OPTIONS}
                    />

                    <CustomSelect
                      label="Noted by"
                      value={notedBy.name}
                      onChange={setNotedBy}
                      options={NOTED_BY_OPTIONS}
                    />
                  </div>

                  {/* ── Section Tabs ── */}
                  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">

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
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLightboxImage(img);
                                          setLightboxMeta({ zone: zone === 'equipment' ? 'equipment' : 'speedtest', index: idx });
                                          const key = `${zone}-${idx}`;
                                          const saved = imageAdjustments[key];
                                          setBrightness(saved?.brightness ?? 0);
                                          setContrast(saved?.contrast ?? 0);
                                          setSharpness(saved?.sharpness ?? 0);
                                        }}
                                        className="w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all hover:scale-110"
                                      >
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

      {/* ── Image Editor Lightbox ── */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl overflow-hidden">

            {/* SVG filter for sharpness */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <filter id="sharpness-filter" x="0%" y="0%" width="100%" height="100%">
                  <feConvolveMatrix
                    order="3"
                    kernelMatrix={
                      sharpness === 0
                        ? '0 0 0 0 1 0 0 0 0'
                        : (() => {
                            const k = (sharpness / 100) * 3;
                            return `0 ${-k} 0 ${-k} ${1 + 4 * k} ${-k} 0 ${-k} 0`;
                          })()
                    }
                    preserveAlpha="true"
                  />
                </filter>
              </defs>
            </svg>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Image Editor</span>
              <button
                type="button"
                onClick={() => { setLightboxImage(null); setLightboxMeta(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image Preview */}
            <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 380 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage}
                alt="Preview"
                className="max-w-full max-h-[480px] object-contain"
                style={{
                  filter: lightboxMeta
                    ? `brightness(${100 + brightness}%) contrast(${100 + contrast}%) url(#sharpness-filter)`
                    : 'none'
                }}
              />
            </div>

            {/* Sliders */}
            {lightboxMeta && (
              <div className="px-5 py-4 space-y-3 border-t border-white/8">
                {[
                  { label: 'Brightness', value: brightness, setter: setBrightness, color: '#facc15' },
                  { label: 'Contrast',   value: contrast,   setter: setContrast,   color: '#60a5fa' },
                  { label: 'Sharpness',  value: sharpness,  setter: setSharpness,  color: '#34d399' },
                ].map(({ label, value, setter, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-gray-500 w-20 shrink-0 uppercase tracking-wider">{label}</span>
                    <input
                      type="range" min={-100} max={100} step={1} value={value}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="flex-1 h-1 rounded-full appearance-none bg-white/10 cursor-pointer"
                      style={{ accentColor: color }}
                    />
                    <span className="text-xs tabular-nums text-gray-400 w-9 text-right">
                      {value > 0 ? `+${value}` : value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 px-7 py-4 border-t border-white/8">
              <button
                type="button"
                onClick={() => { setLightboxImage(null); setLightboxMeta(null); }}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              {lightboxMeta && (
                <>
                  <button
                    type="button"
                    onClick={() => { setBrightness(0); setContrast(0); setSharpness(0); }}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-amber-400 hover:text-amber-300 transition-all"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const adjusted = await applyImageAdjustments(lightboxImage, brightness, contrast, sharpness);
                      const key = `${lightboxMeta.zone}-${lightboxMeta.index}`;
                      setImageAdjustments(prev => ({ ...prev, [key]: { brightness, contrast, sharpness } }));
                      if (lightboxMeta.zone === 'equipment') {
                        setAdditionalImages(prev => prev.map((img, i) => i === lightboxMeta.index ? adjusted : img));
                      } else {
                        setSpeedtestImages(prev => prev.map((img, i) => i === lightboxMeta.index ? adjusted : img));
                      }
                      setLightboxImage(null);
                      setLightboxMeta(null);
                    }}
                    className="ml-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all"
                  >
                    Apply & Save
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
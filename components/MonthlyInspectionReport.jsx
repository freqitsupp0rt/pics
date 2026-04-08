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

const base64ToBlob = (base64, type = "application/pdf") => {
  const parts = base64.split(",");
  const byteCharacters = atob(parts[1] || parts[0]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
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

// NEW - fixed version
const expandSiteType = (siteName) => {
  if (!siteName) return siteName;
  siteName = siteName.replace(/_/g, ' ');

  const abbreviations = {
    // Site-specific (longest first)
    'RNHS':     'Remandaban National High School',
    'RSHS':     'Remandaban National High School - Senior High School',

    // Compound types (longest first to avoid partial matches)
    'CNHS_SHS': 'Comprehensive National High School - Senior High School', // 
    'NHS-SHS':  'National High School - Senior High School',
    'NHS-SH':   'National High School - Senior High',
    'SASHS':    'Stand-Alone Senior High School',
    'CNHS':     'Comprehensive National High School',
    'NCHS':     'National Comprehensive High School',
    'NNHS':     'National Night High School',
    'EVSU':     'Eastern Visayas State University',
    'VSUH':     'Visayas State University Hospital',
    'VSU':      'Visayas State University',
    'NVS':      'National Vocational School',
    'MPS':      'Municipal Police Station',
    'RHU':      'Rural Health Unit',
    'BHS':      'Barangay Health Station',
    'NHS':      'National High School',
    'SHS':      'Senior High School',
    'VHS':      'Vocational High School',
    'SOF':      'School Of Fisheries',
    'MHS':      'Memorial High School',
    'CC':       'Community College',
    'CH':       'Community Hospital',
    'DH':       'District Hospital',
    'MI':       'Municipal Infirmary',
    'CS':       'Central School',
    'ES':       'Elementary School',
    'IS':       'Integrated School',
    'MS':       'Memorial School',
    'MH':       'Municipal Hall',
    'BH':       'Barangay Hall',
    'PM':       'Public Market',
    'MP':       'Municipal Plaza',
    'SP':       'Seaport',
    'OC':       'Ormoc Campus',
    'VSU-HSP': 'Visayas State University Hospital',
    'Com H' : 'Community Hospital',
    'MHO': 'Municipal Health Office',
    'NSAT' : 'National School of Arts and Trade',
    'CNNHS' : 'City National Night High School',
    'SES' :'South Elementary School',
    'NES' :'North Elementary School',
    'BPSU' : 'Province State University',
  };

  for (const [abbr, fullName] of Object.entries(abbreviations)) {
    // Escape BOTH hyphens and dots in the abbreviation for regex safety
    const escapedAbbr = abbr.replace(/[-\.]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escapedAbbr}$`);
    if (regex.test(siteName)) {
      return siteName.replace(regex, (match, prefix) => prefix + fullName);
    }
  }

  return siteName;
};

const PREPARED_BY_OPTIONS = [
  { name: 'Engr. Jason Ilde Y. Aguihon, ECT', lines: ['Project Engineer'] },
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
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
      >
        <span className="truncate text-base font-normal">{selected?.name}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
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
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
                className={`w-full text-left px-4 py-2.5 text-base transition-colors hover:bg-white/10
                  ${o.name === value ? 'text-white bg-white/5 font-bold' : 'text-gray-300 font-normal'}`}
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

// ── Geotag stamp renderer  ──
async function stampGeotag(srcDataUrl, geotag, pinDataUrl = null) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const W = canvas.width;
      const H = canvas.height;

      // --- Data Parsing ---
      const addr1 = geotag.addr1 || '';
      const addr2 = geotag.addr2 || '';
      const lat   = geotag.lat   || '';
      const lng   = geotag.lng   || '';
      const date  = geotag.date  || '';
      
      let time = '';
      if (geotag.time) {
        const [hStr, mStr] = geotag.time.split(':');
        const h = parseInt(hStr, 10);
        const m = mStr || '00';
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        time = `${h12}:${m} ${suffix}`;
      }

      const coordLine = lat || lng ? `Lat ${lat}  Long ${lng}` : '';
      const dateLine  = [date, time].filter(Boolean).join('  ');
      const initialLines = [addr1, addr2, coordLine, dateLine].filter(Boolean);

      if (initialLines.length === 0) { 
        resolve(canvas.toDataURL('image/jpeg', 0.93)); 
        return; 
      }

      // --- Sizing & Fixed Height Calculations ---
      const scale     = W / 400;
      const fontSize  = Math.round(12 * scale);
      const padH      = Math.round(12 * scale);
      const iconSize  = Math.round(70 * scale);
      
      // FIXED HEIGHT: Set to 110 units relative to a 400px wide scale
      const stampH    = Math.round(110 * scale); 
      const boxY      = H - stampH;

      const textX     = padH * 2.5 + iconSize + padH;
      const maxW      = W - textX - padH;
      
      const font1 = `400 ${fontSize}px Candara, Candara Regular, sans-serif`;
      const font2 = `${Math.round(fontSize * 0.88)}px Candara, Candara Regular, sans-serif`;

      // --- Text Wrapping Logic ---
      const wrappedLines = [];
      initialLines.forEach((line, i) => {
        const isFirst = (i === 0);
        ctx.font = isFirst ? font1 : font2; 
        
        const words = line.split(' ');
        let currentLine = words[0] || '';

        for (let j = 1; j < words.length; j++) {
          const word = words[j];
          const testLine = currentLine + ' ' + word;
          if (ctx.measureText(testLine).width <= maxW) {
            currentLine = testLine;
          } else {
            wrappedLines.push({ text: currentLine, isFirst }); 
            currentLine = word;
          }
        }
        if (currentLine) {
          wrappedLines.push({ text: currentLine, isFirst });
        }
      });

      // --- Line Spacing ---
      // Use a consistent multiplier for the fixed height layout
      const lineH = fontSize * 1.30;

      const drawStamp = (customPin) => {
        // 1. Draw Fixed Black Background
        ctx.globalAlpha = 1;
        ctx.fillStyle   = '#000000';
        ctx.fillRect(0, boxY, W, stampH);

        // 2. Draw Icon (Centered vertically within the fixed stampH)
        const iconX = padH;
        const iconY = boxY + (stampH - iconSize) / 2;
        const r     = Math.max(3, Math.round(iconSize * 0.1));
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, r);
        ctx.fill();

        if (customPin) {
          const overflow = iconSize * 0.3;
          ctx.drawImage(customPin, iconX - overflow / 6, iconY - overflow / 2, iconSize + overflow, iconSize + overflow);
        } else {
          const pinR  = iconSize * 0.32;
          const pinCX = iconX + iconSize / 2;
          const pinCY = iconY + iconSize * 0.23;

          ctx.fillStyle = '#e53935';
          ctx.beginPath();
          ctx.arc(pinCX, pinCY, pinR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pinCX, pinCY, pinR * 0.42, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#e53935';
          ctx.beginPath();
          ctx.moveTo(pinCX - pinR * 0.65, pinCY + pinR * 0.45);
          ctx.lineTo(pinCX + pinR * 0.65, pinCY + pinR * 0.45);
          ctx.lineTo(pinCX, iconY + iconSize * 0.71);
          ctx.closePath();
          ctx.fill();
        }

        // 3. Render Text (Centered vertically as a block within the fixed stampH)
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
        
        const totalTextHeight = wrappedLines.length * lineH;
        const textStartY = boxY + (stampH - totalTextHeight) / 2 + fontSize;

        wrappedLines.forEach((item, i) => {
          const y = textStartY + (lineH * i);
          
          // Only draw if within the black box bounds
          if (y < H && y > boxY) {
            ctx.font      = item.isFirst ? font1 : font2;
            ctx.fillStyle = item.isFirst ? '#cfcfcf' : '#e3e3e3';
            ctx.fillText(item.text, textX, y);
          }
        });

        resolve(canvas.toDataURL('image/jpeg', 0.93));
      };

      if (pinDataUrl) {
        const pinImg = new Image();
        pinImg.onload  = () => drawStamp(pinImg);
        pinImg.onerror = () => drawStamp(null);
        pinImg.src = pinDataUrl;
      } else {
        drawStamp(null);
      }
    };
    img.src = srcDataUrl;
  });
}
// ── Per-image geotag fields — defined OUTSIDE the main component so it never
//    gets recreated on parent re-renders, which would cause inputs to lose focus ──
function GeotageFields({ imgKey, geotag, onUpdate }) {
  return (
    <div className="space-y-4 px-1 py-1">

  {/* Coordinates row */}
  <div className="grid grid-cols-2 gap-3">
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Latitude</label>
      <input
        type="text"
        placeholder="e.g. 11.2276471"
        value={geotag.lat || ''}
        onChange={e => {
          const val = e.target.value;
          if (val.replace(/[^0-9]/g, '').length <= 10) {
            onUpdate(imgKey, 'lat', val);
          }
        }}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 placeholder-gray-700 transition-all"
      />
    </div>
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Longitude</label>
      <input
        type="text"
        placeholder="e.g. 125.0239258"
        value={geotag.lng || ''}
        onChange={e => {
          const val = e.target.value;
          if (val.replace(/[^0-9]/g, '').length <= 10) {
            onUpdate(imgKey, 'lng', val);
          }
        }}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 placeholder-gray-700 transition-all"
      />
    </div>
  </div>

  {/* Time + Pin Icon on same row */}
  <div className="grid grid-cols-2 gap-3 items-end">

    {/* Time picker */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Time</label>
      <input
        type="time"
        value={geotag.time || ''}
        onChange={e => onUpdate(imgKey, 'time', e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 transition-all [color-scheme:dark] uppercase"
      />
    </div>
    {/* Map Pin Icon */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Map Pin Icon</label>
      <div className="flex items-center gap-2">

        {/* Preview */}
        <div className="w-8 h-8 shrink-0 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
          {geotag.pinDataUrl ? (
            <img src={geotag.pinDataUrl} alt="Pin" className="w-full h-full object-contain" />
          ) : (
            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Upload / Remove */}
        <div className="flex gap-1.5 flex-1">
          <label className="cursor-pointer flex items-center gap-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-xs text-gray-400 flex-1 justify-center">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {geotag.pinDataUrl ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => onUpdate(imgKey, 'pinDataUrl', ev.target.result);
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
          </label>
          {geotag.pinDataUrl && (
            <button
              type="button"
              onClick={() => onUpdate(imgKey, 'pinDataUrl', null)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-400"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

      </div>
    </div>

  </div>

</div>
  );
}

export default function MonthlyInspectionReport() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const [loadingSites, setLoadingSites] = useState(true);

  const [siteGallery, setSiteGallery] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  const [reportTitle, setReportTitle] = useState("Monthly Network Inspection");
  const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [technicianName, setTechnicianName] = useState("FREQ IT SOLUTIONS");
  const [contractedBandwidth, setContractedBandwidth] = useState("200");
  const [speedTests, setSpeedTests] = useState(
    Array(4).fill(null).map(() => ({ down: '', up: '' }))
  );
  const [activeSpeedTestTab, setActiveSpeedTestTab] = useState(0);
  const [activeSectionTab, setActiveSectionTab] = useState(0);

  // Gallery Modal States
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [assigningTarget, setAssigningTarget] = useState(null);

  // ── Signatory state ──
  const [preparedBy, setPreparedBy] = useState(PREPARED_BY_OPTIONS[0]);
  const [checkedBy, setCheckedBy] = useState(CHECKED_BY_OPTIONS[0]);
  const [notedBy, setNotedBy] = useState(NOTED_BY_OPTIONS[0]);

  // ── Global Geotag state ──
  const [geoAddr1, setGeoAddr1] = useState('');  // e.g. "Tacloban City, Eastern Visayas, Philippines"
  const [geoAddr2, setGeoAddr2] = useState('');  // e.g. "62HF+5VF, Tacloban City, Leyte, Philippines"
  const [geoDate, setGeoDate]   = useState(dayjs().format('DD/MM/YY'));

  // ── Per-image geotag (lat, lng, time) stored by key e.g. "combox", "inspection", "equipment-0" ──
  const [imageGeotags, setImageGeotags] = useState({});
  // helper
  const updateImageGeotag = (key, field, value) => {
    setImageGeotags(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const handleSpeedTestChange = (index, type, value) => {
    const newSpeedTests = speedTests.map((test, i) => i === index ? { ...test, [type]: value } : test);
    setSpeedTests(newSpeedTests);
  };

  const [comboxImage, setComboxImage] = useState(null);
  const [additionalImages, setAdditionalImages] = useState([]);
  const [speedtestImages, setSpeedtestImages] = useState([]);
  const [siteInspectionImage, setSiteInspectionImage] = useState(null);

  const removeImage = (index, setter) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const [pdfUrl, setPdfUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Lightbox / image editor ──
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxMeta, setLightboxMeta] = useState(null); // { zone, index, key }
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast]   = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [imageAdjustments, setImageAdjustments] = useState({});
  const [lightboxTab, setLightboxTab] = useState('edit'); // 'edit' | 'geotag'

  const [logoDataUrl, setLogoDataUrl]   = useState(null);
  const [logoDataUrl2, setLogoDataUrl2] = useState(null);

  const { getToken } = useAuth();

  useEffect(() => {
    getBase64FromImageUrl(dict_logo.src).then(setLogoDataUrl).catch(console.warn);
  }, []);

  useEffect(() => {
    getBase64FromImageUrl(freq_logo.src).then(setLogoDataUrl2).catch(console.warn);
  }, []);

  useEffect(() => {
    async function fetchSites() {
      try {
        setLoadingSites(true);
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/sites", {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  const fetchHistory = async () => {
    if (!selectedSite) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/reports/monthly?siteId=${selectedSite}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSavedReports(data.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchGallery = async () => {
    if (!selectedSite) { setSiteGallery([]); return; }
    setIsLoadingGallery(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/sites/images?siteId=${selectedSite}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSiteGallery(data.data || []);
    } catch (err) { console.error(err); }
    finally { setIsLoadingGallery(false); }
  };

  useEffect(() => {
    fetchGallery();
    fetchHistory();
  }, [selectedSite, getToken]);

  const loadPreviousReport = async (reportId) => {
    if (!reportId) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/reports/monthly?id=${reportId}&excludeConfig=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        if (result.data.pdf_data) {
          const blob = base64ToBlob(result.data.pdf_data);
          const url = URL.createObjectURL(blob);
          setPdfBlob(blob);
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl(url);
        }
        setReportDate(dayjs(result.data.report_date).format('YYYY-MM-DD'));
        Swal.fire('Loaded', 'Saved report preview restored.', 'success');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to load report data.', 'error');
    }
  };

  async function applyImageAdjustments(src, brightness, contrast, sharpness = 0) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';
        if (sharpness !== 0) {
          const strength = (sharpness / 100) * 3;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const srcData = imageData.data;
          const output = new Uint8ClampedArray(srcData);
          const w = canvas.width; const h = canvas.height;
          const kernel = [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0];
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              for (let c = 0; c < 3; c++) {
                const i = (y * w + x) * 4 + c;
                output[i] = Math.min(255, Math.max(0,
                  kernel[0] * srcData[((y-1)*w+(x-1))*4+c] + kernel[1] * srcData[((y-1)*w+x)*4+c] +
                  kernel[2] * srcData[((y-1)*w+(x+1))*4+c] + kernel[3] * srcData[(y*w+(x-1))*4+c] +
                  kernel[4] * srcData[(y*w+x)*4+c] + kernel[5] * srcData[(y*w+(x+1))*4+c] +
                  kernel[6] * srcData[((y+1)*w+(x-1))*4+c] + kernel[7] * srcData[((y+1)*w+x)*4+c] +
                  kernel[8] * srcData[((y+1)*w+(x+1))*4+c]
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

  // ── Build the geotag object for a given image key ──
  const buildGeotag = (key) => {
    const perImg = imageGeotags[key] || {};
    return {
      addr1: geoAddr1,
      addr2: geoAddr2,
      date:  geoDate,
      lat:   perImg.lat  || '',
      lng:   perImg.lng  || '',
      time:  perImg.time || '',
    };
  };

  const hasAnyGeotag = (key) => {
    const g = buildGeotag(key);
    return g.addr1 || g.addr2 || g.lat || g.lng || g.date || g.time;
  };

  // ── Stamp all images before PDF generation ──
  const prepareStampedImages = async () => {
  const hasGeotag = (g) => g.addr1 || g.addr2 || g.lat || g.lng || g.date || g.time;

  const maybeStamp = async (img, key) => {
    if (!img) return null;
    const g = buildGeotag(key);
    if (!hasGeotag(g)) return img;
    const pinDataUrl = imageGeotags[key]?.pinDataUrl || null;
    const stamped = await stampGeotag(img.url, g, pinDataUrl);
    return { ...img, url: stamped };
  };

  const [sCombox, sInspection] = await Promise.all([
    maybeStamp(comboxImage, 'combox'),
    maybeStamp(siteInspectionImage, 'inspection'),
  ]);

  const sAdditional = await Promise.all(
    additionalImages.map((img, i) => maybeStamp(img, `equipment-${i}`))
  );
  const sSpeedtest = await Promise.all(
    speedtestImages.map((img, i) => maybeStamp(img, `speedtest-${i}`))
  );

  return { sCombox, sInspection, sAdditional, sSpeedtest };
};

  const handleGeneratePDF = async (e) => {
    e.preventDefault();
    if (!selectedSite) return alert("Please select a site first");
    setIsGenerating(true);
    try {
      // Stamp geotags onto images first
      const { sCombox, sInspection, sAdditional, sSpeedtest } = await prepareStampedImages();

      const doc = new jsPDF('p', 'mm', 'a4');
      const siteInfo = sites.find(s => s.siteId === selectedSite);
      const { siteCode, siteName } = parseSiteInfo(siteInfo?.name);
      const expandedSiteName = expandSiteType(siteName);
      const pageWidth  = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const drawHeader = () => {
        autoTable(doc, {
          startY: 10,
          body: [['', '', '']],
          styles: {
            minCellHeight: pageHeight * 0.07,
            valign: 'middle', halign: 'center',
            fontSize: 9, lineWidth: 0.1, lineColor: [0, 0, 0]
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
                doc.text('MONTHLY INSPECTION REPORT', centerX, centerY - 3, { align: 'center' });
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
          doc.setLineWidth(0.1);
          doc.line(x + actualLabelWidth, y + 1, x + actualLabelWidth + nameWidth, y + 1);
          const nameCenterX = x + actualLabelWidth + nameWidth / 2;
          doc.setFont('Palatino', 'normal');
          person.lines.forEach((line, i) => {
            const lineWidth = doc.getTextWidth(line);
            doc.text(line, nameCenterX - lineWidth / 2, y + 5.5 + (i * 5));
          });
        };

        const leftX  = 15;
        const rightX = pageWidth / 2 + 10;
        const fixedWidth = 22;
        drawSignatory("Prepared by: ", preparedBy, leftX,  footerY + 12);
        drawSignatory("Checked by: ",  checkedBy,  rightX, footerY + 12, fixedWidth);
        drawSignatory("Noted by: ",    notedBy,    rightX, footerY + 33, fixedWidth);
      };

      // "cover" mode — image fills the cell entirely, cropped to fit, no letterbox bars
      const addImageToPage = (imgData, x, y, maxWidth, maxHeight) => {
        if (!imgData) return;
        try {
          const img = new Image();
          img.src = imgData;
          const naturalW = img.naturalWidth  || maxWidth;
          const naturalH = img.naturalHeight || maxHeight;
          const cellRatio = maxWidth / maxHeight;
          const imgRatio  = naturalW / naturalH;

          let drawW, drawH, offsetX, offsetY;
          if (imgRatio > cellRatio) {
            // wider than cell — fit height, crop sides
            drawH   = maxHeight;
            drawW   = maxHeight * imgRatio;
            offsetX = x - (drawW - maxWidth) / 2;
            offsetY = y;
          } else {
            // taller than cell — fit width, crop top/bottom
            drawW   = maxWidth;
            drawH   = maxWidth / imgRatio;
            offsetX = x;
            offsetY = y - (drawH - maxHeight) / 2;
          }

          // Clip to cell bounds so overflow is hidden
          doc.saveGraphicsState();
          const pdfX = x  * (72 / 25.4);
          const pdfY = (pageHeight - y - maxHeight) * (72 / 25.4);
          const pdfW = maxWidth  * (72 / 25.4);
          const pdfH = maxHeight * (72 / 25.4);
          doc.internal.write(
            `q ${pdfX.toFixed(2)} ${pdfY.toFixed(2)} ${pdfW.toFixed(2)} ${pdfH.toFixed(2)} re W n`
          );
          doc.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH);
          doc.restoreGraphicsState();
        } catch (error) {
          console.warn("Error adding image to PDF", error);
          doc.text("[Image Error]", x + maxWidth / 2, y + maxHeight / 2, { align: 'center' });
        }
      };

  const draw2x2Grid = (images, startY, gridHeight, margin = 12.7) => {
  const outerPad = 4;
  const gapX = 3;
  const gapY = 3;
  const imgPadV = 4;   
  const imgPadH = 14;  

  const totalWidth  = pageWidth  - margin * 2 - outerPad * 2;
  const totalHeight = gridHeight - outerPad * 2;
  const cellWidth   = (totalWidth  - gapX) / 2;
  const cellHeight  = (totalHeight - gapY) / 2;

  const positions = [{ col:0,row:0},{col:1,row:0},{col:0,row:1},{col:1,row:1}];

  images.slice(0, 4).forEach((img, index) => {
    const { col, row } = positions[index];
    const cellX = margin + outerPad + col * (cellWidth + gapX);
    const cellY = startY + outerPad + row * (cellHeight + gapY);

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.1);
    doc.rect(cellX, cellY, cellWidth, cellHeight);

    addImageToPage(
      img?.url,
      cellX + imgPadH,
      cellY + imgPadV,
      cellWidth  - imgPadH * 2,
      cellHeight - imgPadV * 2
    );
  });
};

      // ── PAGE 1: Header + data table ──
      drawHeader();
      doc.setFontSize(12);
      doc.setFont('Palatino', 'bold');
      doc.text(`Provider Name: FREQ IT SOLUTIONS`, 15, doc.lastAutoTable.finalY + 10);
      doc.text(`Date Prepared: ${dayjs(reportDate).format('MMMM D, YYYY')}`, pageWidth - 15, doc.lastAutoTable.finalY + 10, { align: 'right' });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: [['Item\nNo.','Location Code','Location Name','Downlink\nBandwidth\nMbps)','Uplink\nBandwidth\n(Mbps)','Contracted\nBandwidth\n(Mbps)','Remarks']],
        body: [
          [
            { content: '1',                                                                   rowSpan: 4, styles: { valign:'middle', halign:'center', textColor:[0,0,0] } },
            { content: siteCode || 'N/A',                                                     rowSpan: 4, styles: { valign:'middle', halign:'center', textColor:[0,0,0] } },
            { content: expandedSiteName?.toUpperCase() || 'N/A',                              rowSpan: 4, styles: { valign:'middle', halign:'center' } },
            speedTests[0].down, speedTests[0].up,
            { content: `${contractedBandwidth} Mbps`,                                         rowSpan: 4, styles: { valign:'middle', halign:'center', textColor:[0,0,0] } },
            { content: '',                                                                     rowSpan: 4, styles: { valign:'middle', halign:'center', textColor:[0,0,0] } }
          ],
          [speedTests[1].down, speedTests[1].up],
          [speedTests[2].down, speedTests[2].up],
          [speedTests[3].down, speedTests[3].up],
        ],
        theme: 'grid',
        headStyles: { fillColor:[182,210,232], textColor:[0,0,0], fontStyle:'bold', font:'Palatino', halign:'center', valign:'middle', lineWidth:0.1, lineColor:[0,0,0], fontSize:11 },
        bodyStyles: { textColor:[0,0,0], halign:'center', valign:'middle', font:'Palatino', fontStyle:'bold', fontSize:11, lineWidth:0.1, lineColor:[0,0,0] },
        styles: { fontSize:8, halign:'center', font:'Palatino', lineWidth:0.1, lineColor:[0,0,0] },
        columnStyles: { 2: { halign:'left', cellWidth:40 }, 6: { cellWidth:25 } }
      });
      drawFooter();

      // ── PAGE 2: Attachment 1 — Combox ──
      doc.addPage();
      drawHeader();
      drawFooter();
      let currentY = 42;
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');
      doc.text("ATTACHMENT 1: COMMUNICATION BOX", pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
      const sectionHeight = 190;
      doc.setDrawColor(0); doc.setLineWidth(0.1);
      doc.rect(15, currentY, pageWidth - 30, sectionHeight);
      if (sCombox) {
  const padV = 8;
  const padH = 20;
  addImageToPage(
    sCombox.url,
    15 + padH,
    currentY + padV,
    pageWidth - 30 - padH * 2,
    sectionHeight - padV * 2
  );
}

      // ── PAGE 3: Attachment 1 — Access Points ──
      if (sAdditional.length > 0) {
        doc.addPage();
        drawHeader();
        drawFooter();
        doc.setFontSize(11);
        doc.setFont('Palatino', 'bold');
        const titleY = 42;
        doc.text("ATTACHMENT 1: ACCESS POINTS", pageWidth / 2, titleY, { align: 'center' });
        const gridStartY  = titleY + 5;
        const gridHeight  = pageHeight - gridStartY - 65;
        doc.rect(12.7, gridStartY, pageWidth - 12.7 * 2, gridHeight);
        draw2x2Grid(sAdditional, gridStartY, gridHeight);
      }

      // ── PAGE 4: Attachment 2 — Bandwidth test ──
      doc.addPage();
      drawHeader();
      drawFooter();
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');
      const bwTitleY     = 42;
      doc.text("ATTACHMENT 2: DOWNLINK AND UPLINK TEST RESULTS", pageWidth / 2, bwTitleY, { align: 'center' });
      const bwGridStartY = bwTitleY + 5;
      const bwGridHeight = pageHeight - bwGridStartY - 65;
      doc.rect(12.7, bwGridStartY, pageWidth - 12.7 * 2, bwGridHeight);
      if (sSpeedtest.length > 0) {
        draw2x2Grid(sSpeedtest, bwGridStartY, bwGridHeight);
      } else {
        doc.setFont('Palatino', 'italic');
        doc.setFontSize(10);
        doc.text("[No Speedtest Images Uploaded]", pageWidth / 2, bwGridStartY + bwGridHeight / 2, { align: 'center' });
      }

      // ── PAGE 5: Attachment 3 — Site pictures ──
      doc.addPage();
      drawHeader();
      drawFooter();
      doc.setFontSize(11);
      doc.setFont('Palatino', 'bold');
      const siteTitleY = 42;
      doc.text("ATTACHMENT 3: SITE BENEFICIARY", pageWidth / 2, siteTitleY, { align: 'center' });
      const siteSectionY = siteTitleY + 5;
      doc.rect(15, siteSectionY, pageWidth - 30, sectionHeight);
      if (sInspection) {
  const padV = 8;
  const padH = 20;
  addImageToPage(
    sInspection.url,
    15 + padH,
    siteSectionY + padV,
    pageWidth - 30 - padH * 2,
    sectionHeight - padV * 2
  );
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
      const res = await fetch('/api/reports/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          siteId: selectedSite,
          reportDate,
          pdfData: base64data,
          config: {
            speedTests,
            geotag: { addr1: geoAddr1, addr2: geoAddr2, date: geoDate },
            imageGeotags,
            imageIds: {
              combox:      comboxImage?.id,
              inspection:  siteInspectionImage?.id,
              additional:  additionalImages.map(img => img.id),
              speedtest:   speedtestImages.map(img  => img.id)
            }
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire('Saved!', 'Report saved successfully to database.', 'success');
        fetchHistory();
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
    const missingUp   = !currentTest.up;
    if (missingDown || missingUp) {
      const missing = [];
      if (missingDown) missing.push('Download');
      if (missingUp)   missing.push('Upload');
      Swal.fire({
        icon: 'warning',
        title: `Missing AP ${activeSpeedTestTab + 1} Data`,
        html: `Please fill in the following:<ul style="text-align:center;margin-top:8px">${missing.map(m => `<li>${m}</li>`).join('')}</ul>`,
        confirmButtonText: 'Go Back',
        background: '#1f2b3a', color: '#e2e1e1', confirmButtonColor: '#3b82f6',
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
    setPdfUrl(null); setPdfBlob(null);
    setSpeedTests(Array(4).fill(null).map(() => ({ down: '', up: '' })));
    setActiveSpeedTestTab(0); setActiveSectionTab(0);
    setComboxImage(null); setAdditionalImages([]); setSpeedtestImages([]); setSiteInspectionImage(null);
    setImageAdjustments({});
    setGeoAddr1(''); setGeoAddr2(''); setGeoDate(dayjs().format('DD/MM/YY'));
    setImageGeotags({});
    setPreparedBy(PREPARED_BY_OPTIONS[0]);
    setCheckedBy(CHECKED_BY_OPTIONS[0]);
    setNotedBy(NOTED_BY_OPTIONS[0]);
  };

  const handleSelectFromGallery = (img) => {
    if (!assigningTarget) return;
    const { type } = assigningTarget;
    if (type === 'combox')     setComboxImage(img);
    else if (type === 'inspection') setSiteInspectionImage(img);
    else if (type === 'equipment')  setAdditionalImages(prev => prev.length < 4 ? [...prev, img] : prev);
    else if (type === 'speedtest')  setSpeedtestImages(prev   => prev.length < 4 ? [...prev, img] : prev);
    setShowGalleryModal(false);
    setAssigningTarget(null);
  };

  // ── Open lightbox for a given image + meta ──
  const openLightbox = (imgUrl, meta) => {
    setLightboxImage(imgUrl);
    setLightboxMeta(meta);
    setLightboxTab('edit');
    const key = meta.key;
    const saved = imageAdjustments[key];
    setBrightness(saved?.brightness ?? 0);
    setContrast(saved?.contrast   ?? 0);
    setSharpness(saved?.sharpness  ?? 0);
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
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-sm text-gray-300">Load Previous Report</label>
                      <select
                        onChange={(e) => loadPreviousReport(e.target.value)}
                        className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl outline-none text-blue-300"
                      >
                        <option value="">-- New Report --</option>
                        {savedReports.map(report => (
                          <option key={report.id} value={report.id} className="bg-gray-800">
                            {dayjs(report.report_date).format('MMMM YYYY')} (Saved: {dayjs(report.created_at).format('MMM D')})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Provider Name</label>
                      <input type="text" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Report Title</label>
                      <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
                    </div>
                   <div className="flex flex-col gap-1">
  <label className="text-sm text-gray-300">Report Date</label>
  <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} style={{ colorScheme: 'dark' }} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
</div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-gray-300">Contracted Bandwidth (Mbps)</label>
                      <input type="text" value={contractedBandwidth} onChange={(e) => setContractedBandwidth(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} className="bg-white/5 border border-white/20 p-3 rounded-xl outline-none" />
                    </div>

                    <CustomSelect label="Prepared by" value={preparedBy.name} onChange={setPreparedBy} options={PREPARED_BY_OPTIONS} />
                    <CustomSelect label="Checked by"  value={checkedBy.name}  onChange={setCheckedBy}  options={CHECKED_BY_OPTIONS} />
                    <CustomSelect label="Noted by"    value={notedBy.name}    onChange={setNotedBy}    options={NOTED_BY_OPTIONS} />
                  </div>

                  {/* ── Section Tabs ── */}
                  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                    <div className="flex border-b border-white/10 bg-black/30">
                      {[
                        { label: 'Speed Test Results', step: 1, icon: (<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>), accent: 'blue' },
                        { label: 'Attachments',        step: 2, icon: (<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>), accent: 'purple' },
                      ].map((tab, i) => {
                        const isActive = activeSectionTab === i;
                        const isDone   = activeSectionTab > i;
                        return (
                          <div key={i} onClick={() => { if (i < activeSectionTab) setActiveSectionTab(i); }}
                            className={`relative flex-1 flex items-center justify-center gap-2 py-3.5 px-4 text-xs font-semibold tracking-wide uppercase select-none
                              ${i < activeSectionTab ? 'cursor-pointer' : 'cursor-default'}
                              ${isActive ? (tab.accent === 'blue' ? 'text-blue-400' : 'text-purple-400') : isDone ? 'text-gray-400 hover:text-gray-200 transition-colors' : 'text-gray-600'}`}
                          >
                            {isActive && (<span className={`absolute inset-0 pointer-events-none ${tab.accent === 'blue' ? 'bg-gradient-to-b from-blue-600/15 to-transparent' : 'bg-gradient-to-b from-purple-600/15 to-transparent'}`} />)}
                            <span className="relative flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isActive ? (tab.accent === 'blue' ? 'bg-blue-500/30 text-blue-400' : 'bg-purple-500/30 text-purple-400') : isDone ? 'bg-white/10 text-gray-300' : 'bg-white/5 text-gray-600'}`}>
                                {isDone ? (<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>) : tab.icon}
                              </span>
                              {tab.label}
                            </span>
                            {isActive && (<span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-16 rounded-full ${tab.accent === 'blue' ? 'bg-blue-500' : 'bg-purple-500'}`} />)}
                            {i < 1 && (<span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-px bg-white/10" />)}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Panel 0: Speed Test ── */}
                    <div className={activeSectionTab === 0 ? 'block' : 'hidden'}>
                      <div className="flex border-b border-white/10 bg-black/20">
                        {speedTests.map((test, index) => {
                          const hasData = test.down || test.up;
                          const isActive = activeSpeedTestTab === index;
                          return (
                            <button key={index} type="button" onClick={() => setActiveSpeedTestTab(index)}
                              className={`relative flex-1 py-3 text-xs font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer ${isActive ? 'text-white -translate-y-0.3 scale-105' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                              {isActive && (<span className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none" />)}
                              <span className="relative flex flex-col items-center gap-1">
                                <span>AP {index + 1}</span>
                                {hasData && (<span className={`w-1 h-1 rounded-full ${isActive ? 'bg-blue-400' : 'bg-gray-600'}`} />)}
                              </span>
                              {isActive && (<span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="bg-black/10 p-5">
                        {speedTests.map((test, index) => (
                          <div key={index} className={activeSpeedTestTab === index ? 'block' : 'hidden'}>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-400/5 border border-cyan-500/20 p-4 hover:border-cyan-500/40 transition-all duration-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                  </div>
                                  <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Download</label>
                                </div>
                                <input type="text" placeholder="0.00" value={test.down}
                                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) handleSpeedTestChange(index, 'down', val); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNextClick(); } }}
                                  className="w-full bg-transparent outline-none text-2xl font-bold text-white placeholder-white/20 text-center transition-all" />
                                <p className="text-center text-xs text-cyan-400/50 mt-1">Mbps</p>
                              </div>
                              <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-400/5 border border-purple-500/20 p-4 hover:border-purple-500/40 transition-all duration-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                  </div>
                                  <label className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Upload</label>
                                </div>
                                <input type="text" placeholder="0.00" value={test.up}
                                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) handleSpeedTestChange(index, 'up', val); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNextClick(); } }}
                                  className="w-full bg-transparent outline-none text-2xl font-bold text-white placeholder-white/20 text-center transition-all" />
                                <p className="text-center text-xs text-purple-400/50 mt-1">Mbps</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 pb-5 pt-2">
                        <button type="button" onClick={handleNextClick}
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 text-sm"
                        >
                          <span>{activeSpeedTestTab < speedTests.length - 1 ? `Next — AP ${activeSpeedTestTab + 2}` : 'Next — Attachments'}</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* ── Panel 1: Attachments ── */}
                    <div className={activeSectionTab === 1 ? 'block' : 'hidden'}>
                      <div className="bg-black/10 p-5 space-y-5">

                        {/* ══ GLOBAL GEOTAG BLOCK ══ */}
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-emerald-500/15 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0">
                              {/* Map pin icon */}
                              <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Geotag Info</span>
                            <span className="ml-auto text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">Global — applies to all images</span>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] text-gray-400 uppercase tracking-wider">Address Line 1 <span className="normal-case text-gray-600">(City / Region)</span></label>
                              <input
                                type="text"
                                placeholder="e.g. Tacloban City, Eastern Visayas, Philippines"
                                value={geoAddr1}
                                onChange={e => setGeoAddr1(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 placeholder-gray-600 transition-colors"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] text-gray-400 uppercase tracking-wider">Address Line 2 <span className="normal-case text-gray-600">(Full address / Plus code)</span></label>
                              <input
                                type="text"
                                placeholder="e.g. 62HF+5VF, Tacloban City, Leyte, Philippines"
                                value={geoAddr2}
                                onChange={e => setGeoAddr2(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 placeholder-gray-600 transition-colors"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] text-gray-400 uppercase tracking-wider">Date <span className="normal-case text-gray-600">(shown on all images)</span></label>
                              <input
                                type="text"
                                placeholder="e.g. 31/01/26"
                                value={geoDate}
                                onChange={e => setGeoDate(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 placeholder-gray-600 transition-colors"
                              />
                            </div>
                            <p className="text-[10px] text-gray-600 pt-1 flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Click on an assigned image to add per-image coordinates and time via the geotag tab.
                            </p>
                          </div>
                        </div>
                        {/* ══ END GEOTAG BLOCK ══ */}

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
                                  <img src={comboxImage.url} alt="Combox" className="w-full h-full object-cover" />
                                  {/* geotag badge */}
                                  {(imageGeotags['combox']?.lat || imageGeotags['combox']?.time) && (
                                    <div className="absolute top-1.5 left-1.5 bg-emerald-500/80 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                      <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                      Tagged
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => openLightbox(comboxImage.url, { zone: 'single', key: 'combox' })}
                                        className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                    <button type="button" onClick={() => setComboxImage(null)}
                                      className="w-10 h-10 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors">
                                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={() => { setAssigningTarget({ type: 'combox', label: 'Communication Box' }); setShowGalleryModal(true); }}
                                  className="w-full flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-white/5 bg-black/20 text-gray-600 hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-400 transition-all group">
                                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  <span className="text-[10px] text-center px-2">Assign from gallery</span>
                                </button>
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
                                  <img src={siteInspectionImage.url} alt="Site" className="w-full h-full object-cover" />
                                  {(imageGeotags['inspection']?.lat || imageGeotags['inspection']?.time) && (
                                    <div className="absolute top-1.5 left-1.5 bg-emerald-500/80 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                      <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                      Tagged
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => openLightbox(siteInspectionImage.url, { zone: 'single', key: 'inspection' })}
                                    className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button type="button" onClick={() => setSiteInspectionImage(null)}
                                    className="w-10 h-10 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={() => { setAssigningTarget({ type: 'inspection', label: 'Site Inspection' }); setShowGalleryModal(true); }}
                                  className="w-full flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-white/5 bg-black/20 text-gray-600 hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-400 transition-all group">
                                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  <span className="text-[10px] text-center px-2">Assign from gallery</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Multi-image rows */}
                        {[
                          { label: 'Equipment Photos', sublabel: 'Access points, cables, hardware', zone: 'equipment', images: additionalImages, setter: setAdditionalImages, keyPrefix: 'equipment' },
                          { label: 'Speedtest Results', sublabel: 'Bandwidth test screenshots',     zone: 'speedtest', images: speedtestImages,   setter: setSpeedtestImages,   keyPrefix: 'speedtest' },
                        ].map(({ label, sublabel, zone, images, setter, keyPrefix }) => (
                          <div key={label} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{label}</span>
                                <p className="text-[10px] text-gray-600 mt-0.5">{sublabel}</p>
                              </div>
                              <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{images.length} / 4</span>
                            </div>
                            <div className="p-4">
                              <div className="grid grid-cols-4 gap-3">
                                {images.map((img, idx) => {
                                  const key = `${keyPrefix}-${idx}`;
                                  const isTagged = imageGeotags[key]?.lat || imageGeotags[key]?.time;
                                  return (
                                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-black/20 border border-white/10 hover:border-white/20 transition-all shadow-md">
                                      <img src={img.url} alt={`${label} ${idx}`} className="w-full h-full object-cover" />
                                      {isTagged && (
                                        <div className="absolute top-1 left-1 bg-emerald-500/80 backdrop-blur-sm text-white text-[7px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                                          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                          Tagged
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button type="button"
                                          onClick={() => openLightbox(img.url, { zone: keyPrefix, index: idx, key })}
                                          className="w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all hover:scale-110">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                        <button type="button" onClick={() => removeImage(idx, setter)}
                                          className="w-10 h-10 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm rounded-full flex items-center justify-center transition-all hover:scale-110">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                      <div className="absolute bottom-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-[9px] text-white/60 px-1.5 py-0.5 rounded-md font-medium">{idx + 1}</div>
                                    </div>
                                  );
                                })}
                                {images.length < 4 && (
                                  <button type="button"
                                    onClick={() => { setAssigningTarget({ type: zone === 'equipment' ? 'equipment' : 'speedtest', label }); setShowGalleryModal(true); }}
                                    className="aspect-square rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center bg-black/10 text-gray-600 hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-400 transition-all group">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 mb-1 group-hover:bg-blue-500/20 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <span className="text-[9px] font-medium">Assign from gallery</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <button disabled={isGenerating} type="submit"
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                          {isGenerating ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                          ) : (
                            <><span>Generate Monthly Report</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>
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
                  <button onClick={() => setPdfUrl(null)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Configuration
                  </button>
                  <button onClick={handleSavePDF} disabled={isSaving}
                    className="flex items-center gap-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-all shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSaving ? (<span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save PDF</>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-300">PDF Preview</span>
                  <button onClick={() => window.open(pdfUrl)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md transition-colors shadow-lg shadow-blue-900/20">Open in New Tab</button>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center bg-gray-900/50">
                <iframe src={pdfUrl} className="w-full h-full border-none" title="Report Preview" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ IMAGE EDITOR & GEOTAG EDITOR ══ */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl overflow-hidden">

            {/* SVG sharpness filter */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <filter id="sharpness-filter" x="0%" y="0%" width="100%" height="100%">
                  <feConvolveMatrix order="3"
                    kernelMatrix={sharpness === 0 ? '0 0 0 0 1 0 0 0 0' : (() => { const k=(sharpness/100)*3; return `0 ${-k} 0 ${-k} ${1+4*k} ${-k} 0 ${-k} 0`; })()}
                    preserveAlpha="true" />
                </filter>
              </defs>
            </svg>

            {/* Header with tabs */}
            <div className="flex items-center justify-between px-5 py-0 border-b border-white/8">
              <div className="flex">
                {[
                  { id: 'edit',   label: 'Edit Image' },
                  { id: 'geotag', label: 'Geotag' },
                ].map(tab => (
                  <button key={tab.id} type="button" onClick={() => setLightboxTab(tab.id)}
                    className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px
                      ${lightboxTab === tab.id
                        ? (tab.id === 'geotag' ? 'text-emerald-400 border-emerald-500' : 'text-blue-400 border-blue-500')
                        : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                  >
                    {tab.id === 'geotag' && (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                        {tab.label}
                      </span>
                    )}
                    {tab.id !== 'geotag' && tab.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setLightboxImage(null); setLightboxMeta(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all mr-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Image Preview */}
            <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 320 }}>
              <img src={lightboxImage} alt="Preview" className="max-w-full max-h-[380px] object-contain"
                style={{ filter: lightboxTab === 'edit' ? `brightness(${100+brightness}%) contrast(${100+contrast}%) url(#sharpness-filter)` : 'none' }} />
            </div>

            {/* Edit tab: sliders */}
            {lightboxTab === 'edit' && (
              <div className="px-5 py-4 space-y-3 border-t border-white/8">
                {[
                  { label: 'Brightness', value: brightness, setter: setBrightness, color: '#facc15' },
                  { label: 'Contrast',   value: contrast,   setter: setContrast,   color: '#60a5fa' },
                  { label: 'Sharpness',  value: sharpness,  setter: setSharpness,  color: '#34d399' },
                ].map(({ label, value, setter, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-gray-500 w-20 shrink-0 uppercase tracking-wider">{label}</span>
                    <input type="range" min={-100} max={100} step={1} value={value}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="flex-1 h-1 rounded-full appearance-none bg-white/10 cursor-pointer"
                      style={{ accentColor: color }} />
                    <span className="text-xs tabular-nums text-gray-400 w-9 text-right">{value > 0 ? `+${value}` : value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Geotag tab: per-image fields */}
            {lightboxTab === 'geotag' && lightboxMeta && (
              <div className="px-5 py-4 border-t border-white/8">
                <GeotageFields
                  imgKey={lightboxMeta.key}
                  geotag={imageGeotags[lightboxMeta.key] || {}}
                  geoAddr1={geoAddr1}
                  geoAddr2={geoAddr2}
                  geoDate={geoDate}
                  onUpdate={updateImageGeotag}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 px-5 py-4 border-t border-white/8">
              <button type="button" onClick={() => { setLightboxImage(null); setLightboxMeta(null); }}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-400 hover:text-white transition-all">
                Close
              </button>
              {lightboxTab === 'edit' && (
                <>
                  <button type="button" onClick={() => { setBrightness(0); setContrast(0); setSharpness(0); }}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-amber-400 hover:text-amber-300 transition-all">
                    Restore
                  </button>
                  <button type="button"
                    onClick={async () => {
                      const adjusted = await applyImageAdjustments(lightboxImage, brightness, contrast, sharpness);
                      const key = lightboxMeta?.key;
                      if (key) setImageAdjustments(prev => ({ ...prev, [key]: { brightness, contrast, sharpness } }));
                      if (lightboxMeta?.zone === 'equipment') {
                        setAdditionalImages(prev => prev.map((img, i) => i === lightboxMeta.index ? { ...img, url: adjusted } : img));
                      } else if (lightboxMeta?.zone === 'speedtest') {
                        setSpeedtestImages(prev => prev.map((img, i) => i === lightboxMeta.index ? { ...img, url: adjusted } : img));
                      }
                      setLightboxImage(null); setLightboxMeta(null);
                    }}
                    className="ml-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all">
                    Apply & Save
                  </button>
                </>
              )}
              {lightboxTab === 'geotag' && (
                <button type="button" onClick={() => { setLightboxImage(null); setLightboxMeta(null); }}
                  className="ml-auto px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save Geotag
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Gallery Selection Modal */}
      {showGalleryModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">Select from Site Gallery</h3>
                <p className="text-xs text-gray-400">Choose an image to assign to <span className="text-blue-400 font-semibold">{assigningTarget?.label}</span></p>
              </div>
              <button onClick={() => setShowGalleryModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {siteGallery.length === 0 ? (
                <div className="col-span-full py-20 text-center">
                  <p className="text-gray-500 italic">No images found in the gallery for this site.</p>
                </div>
              ) : (
                siteGallery.map((img, i) => (
                  <div key={i} onClick={() => handleSelectFromGallery(img)}
                    className={`relative group aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${img.isMir ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' : 'border-white/5 hover:border-white/20'}`}>
                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-blue-600/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-white text-blue-600 text-[10px] font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-xl">Select Image</span>
                    </div>
                    {img.isMir && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded-full shadow-lg border border-blue-400/50">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" /><path d="M13 6V4a1 1 0 00-1-1h-2a1 1 0 00-1 1v2H7a1 1 0 00-1-1v1h8V7a1 1 0 00-1-1h-1z" /></svg>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
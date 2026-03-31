'use client';

import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import logo from '@/resources/logo/dict_logo.png';
import { Chart, registerables } from 'chart.js';
import SiteList from '@/components/SiteList';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
Chart.register(...registerables);

const extractRuijieAccountNumber = (vendorString) => {
  if (!vendorString) return 1;
  const match = vendorString.match(/\d+/);
  return match ? parseInt(match[0]) : 1;
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFirstDayOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getToday = () => new Date();

const getBase64FromImageUrl = (url) => {
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

const convertBytes = (bytes) => {
  if (bytes === undefined || bytes === null) return { value: 0, unit: "B" };
  if (bytes < 1024) return { value: bytes, unit: "B" };
  if (bytes < 1024 * 1024) return { value: parseFloat((bytes / 1024).toFixed(2)), unit: "KB" };
  if (bytes < 1024 * 1024 * 1024) return { value: parseFloat((bytes / (1024 * 1024)).toFixed(2)), unit: "MB" };
  return { value: parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(2)), unit: "GB" };
};

const calculateServiceAvailability = (usersData, trafficData) => {
  if (!usersData || usersData.length === 0) {
    if (trafficData && trafficData.length > 0) {
      const totalDays = trafficData.length;
      let daysWithTraffic = 0;
      trafficData.forEach(day => {
        if (day && (day.rxGB > 0 || day.txGB > 0)) daysWithTraffic++;
      });
      const percentage = (daysWithTraffic / totalDays) * 100;
      if (percentage >= 99.9) return '100%';
      return `${Math.min(100, Math.max(0, percentage)).toFixed(2)}%`;
    }
    return '98.5%';
  }
  const totalDays = usersData.length;
  let daysWithActiveUsers = 0;
  usersData.forEach(day => {
    if (day && day.activeTotal > 0) daysWithActiveUsers++;
  });
  const percentage = (daysWithActiveUsers / totalDays) * 100;
  if (percentage >= 99.9) return '100%';
  const formattedPercentage = Math.min(100, Math.max(0, percentage)).toFixed(2);
  return `${formattedPercentage}%`;
};

const addFooter = (doc, pageWidth, pageHeight, margin) => {
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
  const footerText = [
    'DICT Regional Office VIII, Brgy. 1 & 4 A. Mabini St., Port Area, Tacloban City',
    'region8@dict.gov.ph, Telephone Number (053)832-4127'
  ];
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  footerText.forEach((line, i) => {
    doc.text(line, pageWidth / 2, pageHeight - (20 - i * 5), { align: 'center' });
  });
};

const addPageWithHeaderFooter = (doc, pageWidth, pageHeight, margin) => {
  doc.addPage();
  doc.setDrawColor(0, 0, 255);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  addFooter(doc, pageWidth, pageHeight, margin);
  return margin + 20;
};

const extractSiteCodeAndName = (fullSiteName) => {
  const match = fullSiteName.match(/^(\S+)\s(.+)/); // Match the first word as site code and the rest as site name
  if (match) {
      return {
          siteCode: match[1],
          siteName: match[2]
      };
  }
  return { siteCode: '', siteName: fullSiteName }; // Fallback if no match
};

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [reportData, setReportData] = useState({ usersData: [], trafficData: [] });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  
  const [form, setForm] = useState({
    siteCode: '',
    siteId: '',
    siteName: '',
    projectName: 'SUPPLY, DELIVERY, INSTALLATION, AND MAINTENANCE OF MANAGED INTERNET SERVICES FOR THE PROVISION OF INTERNET CONNECTIVITY SERVICE (PICS) IN PUBLIC PLACES - PHASE 2',
    supplierName: 'FREQ IT SOLUTIONS',
    startDate: formatLocalDate(getFirstDayOfMonth()),
    endDate: formatLocalDate(getToday()),
    serviceAvailability: '100%',
  });

  const usersChartRef = useRef(null);
  const trafficChartRef = useRef(null);
  const chartInstances = useRef([]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sites/sync', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      
      if (res.status === 403) {
        // User is not admin
        setSyncMessage({ 
          type: 'error', 
          text: 'Only admin users can sync sites. Please contact an administrator.' 
        });
        return;
      }
      
      if (data.success) {
        setSyncMessage({ type: 'success', text: data.message });
        // Refresh the sites list after successful sync
        fetchSites();
      } else {
        setSyncMessage({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setSyncMessage({ type: 'error', text: `Sync failed: ${err.message}` });
    } finally {
      setSyncing(false);
      
      // Clear sync message after 5 seconds
      setTimeout(() => {
        setSyncMessage(null);
      }, 5000);
    }
  };

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const dataUrl = await getBase64FromImageUrl(logo.src);
        setLogoDataUrl(dataUrl);
      } catch (e) { console.warn(e); }
    };
    loadLogo();
  }, []);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch("/api/sites", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sites");
      const data = await res.json();
      const normalized = (data.data || []).map(site => ({
        siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
        name: site.name || "Unnamed Site",
        vendor: site.vendor || "Unknown",
        latitude: site.latitude || site.lat || 11.0,
        longitude: site.longitude || site.lon || 125.0,
        groupId: site.groupId || site.siteId || site.id,
      }));
      setSites(normalized);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSites(); }, []);

  useEffect(() => {
    if (selectedSite) {
      const selected = sites.find(site => site.siteId === selectedSite);
      if (selected) {
        const { siteCode, siteName } = extractSiteCodeAndName(selected.name);
        setForm(prev => ({
          ...prev,
          siteName: siteName,
          siteCode: siteCode,
          siteId: selected.siteId,
          groupId: selected.groupId,
          vendor: selected.vendor,
        }));
      }
    }
  }, [selectedSite, sites]);

  const handleSiteSelect = (siteId) => setSelectedSite(siteId);
  const handleSearchChange = (term) => setSearchTerm(term);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Function to fetch blackout events - from Reports.jsx
  const fetchBlackoutEvents = async (site, start, end, token) => {
    try {
      const url = `/api/reports/events?siteId=${encodeURIComponent(site.name)}&startDate=${start.valueOf()}&endDate=${end.valueOf()}`;
      
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        return [];
      }
      
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error("Failed to fetch blackout events", err);
      return [];
    }
  };

  // Function to fetch manual data - from Reports.jsx
  const fetchManualData = async (siteName, start, end, token) => {
    try {
      const res = await fetch("/api/manual-data/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          siteId: siteName || siteId || groupId,
          startDate: start.valueOf(),
          endDate: end.valueOf()
        })
      });

      if (!res.ok) {
        return [];
      }
      
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error("Failed to fetch manual data", err);
      return [];
    }
  };

  // Function to merge data with manual entries - from Reports.jsx
  const mergeDataWithManual = (apiData, manualData, dataType) => {
    const mergedData = [...apiData];
    const manualMap = new Map();

    manualData.forEach(item => {
      if (item.data_type === dataType) {
        const dateKey = dayjs(item.date).format("YYYYMMDD");
        manualMap.set(dateKey, item);
      }
    });
    
    const result = mergedData.map(apiItem => {
      const dateKey = apiItem.time || apiItem.timeString;
      const manualItem = manualMap.get(dateKey);
      
      if (manualItem) {
        if (dataType === 'users') {
          return {
            ...apiItem,
            total: manualItem.total_users != null ? manualItem.total_users : apiItem.total,
            activeTotal: manualItem.active_users != null ? manualItem.active_users : apiItem.activeTotal,
            source: 'manual',
            notes: manualItem.notes,
            isManual: true
          };
        } else {
          return {
            ...apiItem,
            rxBytes: manualItem.download_bytes != null ? manualItem.download_bytes : 0,
            txBytes: manualItem.upload_bytes != null ? manualItem.upload_bytes : 0,
            originalRxBytes: manualItem.download_bytes != null ? manualItem.download_bytes : 0,
            originalTxBytes: manualItem.upload_bytes != null ? manualItem.upload_bytes : 0,
            unit: "B",
            source: 'manual',
            notes: manualItem.notes,
            isManual: true
          };
        }
      }
      return { ...apiItem, source: 'api', isManual: false };
    });
    
    return result;
  };

  // Function to apply blackout events to data - from Reports.jsx
  const applyBlackoutEvents = (data, events) => {
    if (!events.length) return data;

    return data.map(item => {
      if (item.isManual) return item;
      const itemDateStr = item.time || item.timeString;
      if (!itemDateStr || itemDateStr.length !== 8) {
        return item;
      }
      
      const itemDate = dayjs(itemDateStr, "YYYYMMDD");
      if (!itemDate.isValid()) {
        return item;
      }

      const matchingEvents = events.filter(event => {
        const eventStart = dayjs(event.start);
        const eventEnd = dayjs(event.end);
        return itemDate.isBetween(eventStart, eventEnd, 'day', '[]');
      });

      if (matchingEvents.length > 0) {
        const matchingEvent = matchingEvents[0];
        
        // Zero out the values and mark as blackout
        if ('total' in item) {
          return {
            ...item,
            total: 0,
            activeTotal: 0,
            hasBlackout: true,
            blackoutReason: matchingEvent?.event || "Blackout Event",
            blackoutDetails: {
              event: matchingEvent.event,
              start: dayjs(matchingEvent.start).format('MMM D'),
              end: dayjs(matchingEvent.end).format('MMM D')
            }
          };
        } else {
          return {
            ...item,
            rxBytes: 0,
            txBytes: 0,
            originalRxBytes: 0,
            originalTxBytes: 0,
            unit: "B",
            hasBlackout: true,
            blackoutReason: matchingEvent?.event || "Blackout Event",
            blackoutDetails: {
              event: matchingEvent.event,
              start: dayjs(matchingEvent.start).format('MMM D'),
              end: dayjs(matchingEvent.end).format('MMM D')
            }
          };
        }
      }
      return item;
    });
  };

  const fillMissingDates = (data, start, end) => {
    const filledData = [];
    const dataMap = new Map();
    
    data.forEach(item => {
      const dateKey = item.time || item.timeString || "";
      if (dateKey) {
        dataMap.set(dateKey, { ...item });
      }
    });

    let currentDate = start.clone();
    while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
      const dateKey = currentDate.format("YYYYMMDD");
      const existingData = dataMap.get(dateKey);
      
      if (existingData) {
        filledData.push(existingData);
      } else {
        filledData.push({
          time: dateKey,
          timeString: dateKey,
          total: 0,
          activeTotal: 0,
          rxBytes: 0,
          txBytes: 0,
          unit: "B",
          source: 'none',
          isManual: false,
          hasBlackout: false
        });
      }
      
      currentDate = currentDate.add(1, 'day');
    }

    return filledData;
  };

  const createCombinedCharts = (uData, tData) => {
    chartInstances.current.forEach(c => c.destroy());
    chartInstances.current = [];

    const uCtx = usersChartRef.current.getContext('2d');
    const tCtx = trafficChartRef.current.getContext('2d');

    const uChart = new Chart(uCtx, {
      type: 'line',
      data: {
        labels: uData.map(d => d.displayDate),
        datasets: [
          { 
            label: 'Total Users', 
            data: uData.map(d => d.total), 
            borderColor: '#3b82f6', 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            fill: true, 
            tension: 0.1 // Reduced tension makes it less likely to "dip"
          },
          { 
            label: 'Active Users', 
            data: uData.map(d => d.activeTotal), 
            borderColor: '#ef4444', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            fill: true, 
            tension: 0.1 
          }
        ]
      },
      options: { 
        responsive: false, 
        animation: false, 
        scales: {
          y: {
            beginAtZero: true, // Forces scale to start at 0
            min: 0,            // Prevents the scale from going negative
            ticks: {
              stepSize: 1,      // Good for user counts
              precision: 0      // Removes decimals since users are whole numbers
            }
          }
        },
        plugins: { 
          title: { display: true, text: 'Users Activity' } 
        } 
      },
    });

    // Apply similar scale logic to the Traffic Chart
    const tChart = new Chart(tCtx, {
      type: 'line',
      data: {
        labels: tData.map(d => d.displayDate),
        datasets: [
          { label: 'Rx (GB)', data: tData.map(d => d.rxGB), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.1 },
          { label: 'Tx (GB)', data: tData.map(d => d.txGB), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.1 }
        ]
      },
      options: { 
        responsive: false, 
        animation: false, 
        scales: {
          y: {
            beginAtZero: true,
            min: 0
          }
        },
        plugins: { title: { display: true, text: 'Network Traffic (GB)' } } 
      }
    });

    chartInstances.current = [uChart, tChart];
  };

  const fetchReportData = async () => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('token');
      const site = sites.find(s => s.siteId === form.siteId);
      const start = dayjs(form.startDate);
      const end = dayjs(form.endDate).endOf('day');
      
      // Initialize these variables
      let uRaw = []; 
      let tRaw = [];

      if (site.vendor === "Huawei") {
        // Huawei API specifically requires seconds, not milliseconds
        const sUnix = Math.floor(start.startOf('day').valueOf() / 1000);
        const eUnix = Math.floor(end.endOf('day').valueOf() / 1000);

        const payload = { 
          siteId: site.siteId, 
          beginTime: sUnix, 
          endTime: eUnix,
          timeDimension: "month",
          unit: "B/s"
        };

        const [uRes, tRes] = await Promise.all([
          fetch("/api/reports/huawei/users", { 
            method: "POST", 
            body: JSON.stringify(payload), 
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } 
          }),
          fetch("/api/reports/huawei/traffic", { 
            method: "POST", 
            body: JSON.stringify(payload), 
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } 
          })
        ]);

        if (uRes.ok) {
          const uJson = await uRes.json();
          // Huawei users route returns data: [{ timestamp, total, ... }]
          uRaw = uJson.data || [];
        }
        
        if (tRes.ok) {
          const tJson = await tRes.json();
          tRaw = (tJson.data || []).map(d => ({
            ...d,
            rxBytes: (d.rxBytes || 0) * 86400,
            txBytes: (d.txBytes || 0) * 86400
          }));
        }
      } else {
        // FIX: extractRuijieAccountNumber is now defined
        const accountNumber = extractRuijieAccountNumber(site.vendor);

        const uRes = await fetch("/api/reports/ruijie/users", { 
          method: "POST", 
          body: JSON.stringify({ startDate: start.valueOf(), endDate: end.valueOf(), groupId: site.groupId, type: "day", accountNumber }), 
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } 
        });
        
        if (uRes.ok) {
          const uJson = await uRes.json();
          // Access nested data from your backend wrapper
          uRaw = uJson?.data?.data?.list || uJson?.data?.list || [];
        }

        const tRes = await fetch("/api/reports/ruijie/traffic", { 
          method: "POST", 
          body: JSON.stringify({ startDate: start.valueOf(), endDate: end.valueOf(), buildingId: site.groupId, type: "week", accountNumber }), 
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } 
        });
        
        if (tRes.ok) {
          const tJson = await tRes.json();
          // Access nested data from your backend wrapper
          tRaw = tJson?.data?.list || [];
        }
      }

      // Fetch blackout events and manual data
      const [blackoutEvents, manualData] = await Promise.all([
        fetchBlackoutEvents(site, start, end, token),
        fetchManualData(site.name, start, end, token)
      ]);

      // Format and process data
      const uFmt = fillMissingDates(uRaw.map(i => {
        const timeKey = i.time || i.timeString || i.timestamp;
        return {
          time: timeKey,
          total: i.total || 0,
          activeTotal: i.activeTotal || i.total || 0
        };
      }), start, end).map(i => ({
        ...i,
        displayDate: dayjs(i.time, "YYYYMMDD").format("MMM D")
      }));
      
      const tFmt = fillMissingDates(tRaw.map(i => {
        const timeKey = i.time || i.timeString || i.timestamp;
        return {
          time: timeKey,
          rxBytes: i.rxBytes || 0,
          txBytes: i.txBytes || 0
        };
      }), start, end).map(i => ({
        ...i,
        displayDate: dayjs(i.time, "YYYYMMDD").format("MMM D")
      }));

      // Merge manual data
      const mergedUsersData = mergeDataWithManual(uFmt, manualData, 'users');
      const mergedTrafficData = mergeDataWithManual(tFmt, manualData, 'traffic');

      // Apply blackout events
      const finalUsersData = applyBlackoutEvents(mergedUsersData, blackoutEvents);
      const finalTrafficDataRaw = applyBlackoutEvents(mergedTrafficData, blackoutEvents);

      // Convert to GB for charts/display
      const finalTrafficData = finalTrafficDataRaw.map(item => ({
        ...item,
        rxGB: parseFloat(((item.rxBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)),
        txGB: parseFloat(((item.txBytes || 0) / (1024 * 1024 * 1024)).toFixed(2))
      }));

      setReportData({ usersData: finalUsersData, trafficData: finalTrafficData });
      setForm(prev => ({ ...prev, serviceAvailability: calculateServiceAvailability(finalUsersData, finalTrafficData) }));
      createCombinedCharts(finalUsersData, finalTrafficData);
      setChartsLoaded(true);
    } catch (e) { 
      console.error(e); 
    } finally {
      setPdfLoading(false);
    }
  };

  const generatePdf = async () => {
    if (!form.siteId) {
      alert("Please select a site first");
      return;
    }

    try {
      if (!chartsLoaded) {
        const success = await fetchReportData();
        if (!success) return;
      }

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

      // Function to determine Passed status
      const getPassedStatus = (serviceAvailability) => {
        // Extract numeric value from percentage string (e.g., "99.85%" -> 99.85)
        const numericValue = parseFloat(serviceAvailability);
        
        if (numericValue >= 90) {
          return 'Passed';
        } else {
          return 'Passed*';
        }
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
      currentY = addText(`PROJECT  : ${form.projectName || ''}`, margin, currentY);
      currentY = addText(`SUPPLIER : ${form.supplierName || ''}`, margin, currentY);
      
      const formatDisplayDate = (dateStr) => {
        // dateStr is YYYY-MM-DD; parse explicitly to avoid locale ambiguity
        const parts = (dateStr || '').split('-');
        if (parts.length !== 3) return dateStr;
        const [year, month, day] = parts.map(Number);
        const date = new Date(year, (month || 1) - 1, day || 1);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      };
      const formattedPeriod = `${formatDisplayDate(form.startDate)} - ${formatDisplayDate(form.endDate)}`;
      currentY = addText(`PERIOD   : ${formattedPeriod}`, margin, currentY);

      // Site Info Section
      doc.setFont('helvetica', 'normal');
      currentY = addText('XII. SERVICE REPORT AS PER SERVICE PROVIDER\'S NETWORK MONITORING SYSTEM:', margin, currentY + 5);
      currentY = addText('•   ACCEPTANCE DATE: OCTOBER 6, 2025', margin + 5, currentY);
      currentY = addText(`•   NETWORK AVAILABILITY: ${form.serviceAvailability}`, margin + 5, currentY);
      
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
      const siteNameLines = doc.splitTextToSize(form.siteName || '', siteNameMaxWidth);
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
      currentY = addTextWithBoldItalic('Passed:', ' passed without justification(s) attached; complied beyond the required percentage of service availability.', margin, currentY);
      currentY = addTextWithBoldItalic('Failed:', ' fail.', margin, currentY);

      // Additional note (already italic)
      currentY += 3;
      currentY = addText('*(Kindly attach equipment logs on the outages)', margin, currentY);

      currentY += 5;

      const signatureLines = [
        '',
        'Prepared by:',  
        'ENGR. JASON ILDE Y. AGUIHON', 
        'PROJECT ENGINEER',  
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
      if (usersChartRef.current && trafficChartRef.current) {
        currentY = addPageWithHeaderFooter(doc, pageWidth, pageHeight, margin) - 20;
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
        const usersChartImg = usersChartRef.current.toDataURL('image/png', 1.0);
        doc.addImage(usersChartImg, 'PNG', chartX, currentY, chartWidth, chartHeight);
        
        // Add the Traffic Chart (below Users Chart)
        const trafficChartY = currentY + chartHeight + 10;
        const trafficChartImg = trafficChartRef.current.toDataURL('image/png', 1.0);
        doc.addImage(trafficChartImg, 'PNG', chartX, trafficChartY, chartWidth, chartHeight);
      }

      // Generate PDF URL
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col md:flex-row md:gap-6">
        {/* Left Column - Site List Component */}
        <div className="w-full md:w-1/3 mb-4 md:mb-0 mt-2">
          <SiteList 
            sites={sites}
            loading={loading || syncing}
            error={error}
            selectedSite={selectedSite}
            searchTerm={searchTerm}
            onSiteSelect={handleSiteSelect}
            onSearchChange={handleSearchChange}
            onSync={handleSync}
            syncing={syncing}
            syncMessage={syncMessage}
          />
        </div>

        {/* Right Column - PDF Generation */}
        <div className="w-full md:w-2/3 bg-white/10 p-4 rounded-xl shadow-lg mt-2 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Generate Service Report</h2>
          
          {selectedSite ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex-1 min-h-[400px]"
            >
              {/* Form Container on Top */}
              <section className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/20 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label htmlFor="siteName" className="block mb-1 font-medium text-sm">Site Name:</label>
                    <input
                      type="text"
                      id="siteName"
                      name="siteName"
                      value={form.siteName}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Site name"
                      readOnly
                    />
                  </div>

                  <div>
                    <label htmlFor="siteCode" className="block mb-1 font-medium text-sm">Site Code:</label>
                    <input
                      type="text"
                      id="siteCode"
                      name="siteCode"
                      value={form.siteCode}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Site code"
                      readOnly
                    />
                  </div>

                  <div>
                    <label htmlFor="startDate" className="block mb-1 font-medium text-sm">Start Date:</label>
                    <input
                      type="date"
                      id="startDate"
                      name="startDate"
                      value={form.startDate}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block mb-1 font-medium text-sm">End Date:</label>
                    <input
                      type="date"
                      id="endDate"
                      name="endDate"
                      value={form.endDate}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div className="md:col-span-4 flex items-end gap-2">
                    <button
                      onClick={fetchReportData}
                      disabled={pdfLoading}
                      className={`flex-1 px-4 py-2 rounded text-white font-medium text-sm ${
                        pdfLoading
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {pdfLoading ? 'Loading Data...' : 'Load Report Data'}
                    </button>

                    <button
                      onClick={generatePdf}
                      disabled={!chartsLoaded}
                      className={`flex-1 px-4 py-2 rounded text-white font-medium text-sm ${
                        !chartsLoaded
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      Generate 3-Page PDF
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block mb-1 font-medium text-sm">Service Availability:</label>
                    <div className="w-full rounded border border-white/30 bg-transparent p-2 text-sm text-white">
                      <span className={`font-bold ${
                        form.serviceAvailability === '100%' ? 'text-green-400' :
                        form.serviceAvailability >= '99%' ? 'text-green-300' :
                        form.serviceAvailability >= '98%' ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {form.serviceAvailability}
                      </span>
                      <span className="text-gray-400 ml-2 text-xs">
                        (Calculated from data completeness)
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="border-t border-white/20 pt-4 mt-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-center text-sm text-gray-300 gap-2 md:gap-4">
                        <div className="flex items-center">
                          <span className="font-medium">Report Period:</span>
                          <span className="ml-2 px-3 py-1 bg-white/10 rounded">
                            {form.startDate} to {form.endDate}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">Vendor:</span>
                          <span className="ml-2 px-3 py-1 bg-white/10 rounded">
                            {sites.find(s => s.siteId === selectedSite)?.vendor || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </section>

              {/* PDF Preview Below */}
              <section className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/20 flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">PDF Preview</h3>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      download={`Service_Report_${form.siteName || 'Site'}_${form.startDate}_to_${form.endDate}.pdf`}
                      className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700 rounded"
                    >
                      Download PDF
                    </a>
                  )}
                </div>
                
                {pdfUrl ? (
                  <div className="h-[600px] overflow-hidden rounded border border-white/20 bg-white">
                    <iframe
                      src={pdfUrl}
                      title="PDF Preview"
                      className="w-full h-full"
                      frameBorder="0"
                    />
                  </div>
                ) : (
                  <div className="h-[600px] flex flex-col items-center justify-center italic text-white/70 border border-dashed border-white/20 rounded bg-white/5">
                    <div className="text-center">
                      <p className="text-lg mb-2">No PDF generated yet</p>
                      <p className="text-sm mb-4">Select a site and click "Generate 3-Page PDF" to create and preview the report</p>
                      <div className="text-xs text-gray-400 mt-4">
                        <p><strong>Page 1:</strong> Service Report with site information and service availability</p>
                        <p><strong>Page 2:</strong> Combined Users Chart (Total Users + Active Users)</p>
                        <p><strong>Page 3:</strong> Combined Traffic Chart (Download + Upload)</p>
                        <p className="mt-2">Real data from Huawei and Ruijie APIs will be used</p>
                        <p className="mt-1">Ruijie supports multiple accounts (Ruijie 1, Ruijie 2)</p>
                        <p className="mt-1">Each chart page includes summary statistics</p>
                        <p className="mt-1">Blue border on every page</p>
                        <p className="mt-1">Footer on every page with DICT contact information</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </motion.div>
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <div className="text-center text-gray-400">
                <p className="text-lg mb-2">Select a site from the list to generate a service report</p>
                <p className="text-sm">Click on any site in the left panel to get started</p>
                <div className="mt-4 text-xs text-gray-500">
                  <p>• Site list shows available sites from Huawei and Ruijie</p>
                  <p>• Click on a site to select it for reporting</p>
                  <p>• Adjust date range as needed</p>
                  <p>• Real API data will be fetched from vendor systems</p>
                  <p>• Ruijie supports multiple accounts (Ruijie 1, Ruijie 2)</p>
                  <p>• Generate 3-page PDF with combined charts</p>
                  <p>• Page 1: Service Report</p>
                  <p>• Page 2: Users Activity Chart (Total + Active Users)</p>
                  <p>• Page 3: Network Traffic Chart (Download + Upload)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvases for combined charts */}
      <div className="hidden">
        <canvas ref={usersChartRef} width={800} height={400} />
        <canvas ref={trafficChartRef} width={800} height={400} />
      </div>
    </main>
  );
}
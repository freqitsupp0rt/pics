"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import {
  RefreshCw,
  Server,
  Wifi,
  Activity,
  ChevronRight,
  Globe,
  HardDrive,
  Cpu,
  Clock,
  BarChart3,
  AlertCircle,
  Signal,
  Router,
  Network,
  Search,
  X,
  ChevronDown
} from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import SiteList from "@/components/SiteList";
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Helper functions for Monthly Traffic
const fetchBlackoutEvents = async (site, start, end, token) => {
  try {
    const url = `/api/reports/events?siteId=${encodeURIComponent(site.name)}&startDate=${start.valueOf()}&endDate=${end.valueOf()}`;
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Failed to fetch blackout events", err);
    return [];
  }
};

const fetchManualData = async (siteName, start, end, token) => {
  try {
    const res = await fetch("/api/manual-data/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ siteId: siteName, startDate: start.valueOf(), endDate: end.valueOf() })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Failed to fetch manual data", err);
    return [];
  }
};

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
    return { ...apiItem, source: 'api', isManual: false };
  });
  
  return result;
};

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
    filledData.push(existingData || { time: dateKey, timeString: dateKey, rxBytes: 0, txBytes: 0, unit: "B", source: 'none', isManual: false, hasBlackout: false });
    currentDate = currentDate.add(1, 'day');
  }
  return filledData;
};

const Dashboard = () => {
  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [loading, setLoading] = useState({
    sites: true,
    devices: false,
    traffic: false
  });
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeRange, setTimeRange] = useState("1h");
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [deviceSearchTerm, setDeviceSearchTerm] = useState("");
  const [deviceStatusFilter, setDeviceStatusFilter] = useState("all");
  const [monthlyTraffic, setMonthlyTraffic] = useState([]);
  const [monthlyTrafficLoading, setMonthlyTrafficLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const { getToken } = useAuth();

  // Helper function to extract Ruijie account number from vendor string
  const getRuijieAccountNumber = useCallback((vendor) => {
    if (!vendor) return 1;
    const vendorLower = vendor.toLowerCase();
    if (vendorLower.includes('ruijie 2') || vendorLower.includes('ruijie2')) return 2;
    if (vendorLower.includes('ruijie 1') || vendorLower.includes('ruijie1')) return 1;
    if (vendorLower.includes('ruijie')) {
      const match = vendor.match(/Ruijie\s*(\d+)/i);
      return match ? parseInt(match[1]) : 1;
    }
    return 1;
  }, []);

  // Get vendor display name
  const getVendorDisplayName = useCallback((vendor) => {
    if (vendor?.toLowerCase().includes('huawei')) return 'Huawei';
    if (vendor?.toLowerCase().includes('ruijie')) {
      const accountNum = getRuijieAccountNumber(vendor);
      return `Ruijie ${accountNum}`;
    }
    return vendor || 'Unknown';
  }, [getRuijieAccountNumber]);

  const isHuawei = useCallback((vendor) => vendor?.toLowerCase().includes('huawei'), []);
  const isRuijie = useCallback((vendor) => vendor?.toLowerCase().includes('ruijie'), []);

  const fetchSites = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, sites: true }));
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await axios.get("/api/sites", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const siteData = response.data.success && response.data.data ? response.data.data : (response.data.data || response.data || []);
      
      const formattedSites = siteData.map(site => ({
        ...site,
        siteIdentifier: getSiteIdentifier(site),
        vendorDisplay: getVendorDisplayName(site.vendor),
        siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
        name: site.name || "Unnamed Site",
        vendor: site.vendor || "Unknown",
        latitude: parseFloat(site.latitude || site.lat || 11.0),
        longitude: parseFloat(site.longitude || site.lon || 125.0),
      }));
      setSites(formattedSites);
    } catch (error) {
      console.error("Error fetching sites:", error);
      setError("Failed to fetch sites. Please try again.");
    } finally {
      setLoading(prev => ({ ...prev, sites: false }));
    }
  }, [getToken, getVendorDisplayName]);

  const getSiteIdentifier = (site) => {
    if (site.siteIdentifier) return site.siteIdentifier;
    if (site.vendor === "Huawei" && site.id) return `huawei-${site.id}`;
    if (site.vendor?.toLowerCase().includes('ruijie') && site.groupId) {
      const accountNum = getRuijieAccountNumber(site.vendor);
      return `ruijie${accountNum}-${site.groupId}`;
    }
    if (site.siteId) return `${site.vendor?.toLowerCase()}-${site.siteId}`;
    return `${site.vendor?.toLowerCase()}-${site.name}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchMonthlySiteTraffic = useCallback(async () => {
    if (!selectedSite) return;

    setMonthlyTrafficLoading(true);

    try {
      const token = getToken();
      const start = dayjs().year(selectedYear).month(selectedMonth - 1).startOf('month');
      const end = dayjs().year(selectedYear).month(selectedMonth - 1).endOf('month');
      
      // Initialize these variables
      let tRaw = [];

      if (selectedSite.vendor === "Huawei") {
        // Huawei API specifically requires seconds, not milliseconds
        const sUnix = Math.floor(start.startOf('day').valueOf() / 1000);
        const eUnix = Math.floor(end.endOf('day').valueOf() / 1000) + 1;

        const payload = { 
          siteId: selectedSite.siteId, 
          beginTime: sUnix, 
          endTime: eUnix,
          timeDimension: "month",
          unit: "B/s"
        };

        const tRes = await fetch("/api/reports/huawei/traffic", { 
            method: "POST", 
            body: JSON.stringify(payload), 
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } 
        });

        if (tRes.ok) {
          const tJson = await tRes.json();
          tRaw = (tJson.data || []).map(d => ({
            ...d,
            rxBytes: (d.rxBytes || 0) * 86400,
            txBytes: (d.txBytes || 0) * 86400
          }));
        }
      } else {
        const accountNumber = getRuijieAccountNumber(selectedSite.vendor);

        const tRes = await fetch("/api/reports/ruijie/traffic", { 
          method: "POST", 
          body: JSON.stringify({ startDate: start.valueOf(), endDate: end.valueOf(), buildingId: selectedSite.groupId, type: "week", accountNumber }), 
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
        fetchBlackoutEvents(selectedSite, start, end, token),
        fetchManualData(selectedSite.name, start, end, token)
      ]);

      // Format and process data
      const tFmt = fillMissingDates(tRaw.map(i => {
        const timeKey = i.time || i.timeString || i.timestamp;
        return {
          time: timeKey,
          rxBytes: i.rxBytes || 0,
          txBytes: i.txBytes || 0
        };
      }), start, end);

      const mergedTrafficData = mergeDataWithManual(tFmt, manualData, 'traffic');
      const finalTrafficDataRaw = applyBlackoutEvents(mergedTrafficData, blackoutEvents);

      const finalTrafficData = finalTrafficDataRaw.map(item => ({
        ...item,
        displayDate: dayjs(item.time, "YYYYMMDD").format("MMM D"),
        rxGB: parseFloat(((item.rxBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)),
        txGB: parseFloat(((item.txBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)),
      }));

      setMonthlyTraffic(finalTrafficData);
    } catch (err) {
      console.error("Error fetching monthly site traffic:", err);
      setError("Failed to load monthly traffic data.");
    } finally {
      setMonthlyTrafficLoading(false);
    }
  }, [selectedSite, selectedMonth, selectedYear, getToken, getRuijieAccountNumber]);

  const fetchDevices = useCallback(async (site, vendor) => {
    if (!site) return;
    try {
      setLoading(prev => ({ ...prev, devices: true }));
      setError(null);

      const token = getToken();
      
      if (!isHuawei(vendor) && !isRuijie(vendor)) {
        console.error('Unknown vendor:', vendor);
        setError(`Unknown vendor: ${vendor}`);
        return;
      }

      const siteId = isRuijie(vendor) ? (site.groupId || site.id || site.siteId) : site.id;
      const response = await axios.get(`/api/devices?siteId=${siteId}&vendor=${vendor}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const devicesData = response?.data?.data || [];
      setDevices(devicesData);
      setSelectedDevice(devicesData.length > 0 ? devicesData[0] : null);
    } catch (error) {
      console.error("Error fetching devices:", error);
      setError(`Failed to fetch devices for ${vendor} site: ${error.message}`);
      setDevices([]);
      setSelectedDevice(null);
    } finally {
      setLoading(prev => ({ ...prev, devices: false }));
    }
  }, [getToken, isHuawei, isRuijie]);

  const fetchTrafficData = useCallback(async (device, vendor, timeRangeParam = null) => {
    if (!device) {
      setTrafficData([]);
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, traffic: true }));
      setError(null);

      const token = getToken();
      const currentTimeRange = timeRangeParam || timeRange;
      
      if (isHuawei(vendor)) {
        const response = await axios.get(`/api/performance/huawei/networktraffic`, {
          params: { 
            deviceId: device.id, 
            timeRange: currentTimeRange 
          },
          headers: {
            Authorization: `Bearer ${token}` 
          }
        });
        
        if (response.data.errcode === "0") {
          setTrafficData(response.data.data || []);
        } else {
          console.error("Huawei API Error:", response.data.error);
          setError(`Huawei traffic data error: ${response.data.error}`);
          setTrafficData([]);
        }
      } else if (isRuijie(vendor)) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        
        const response = await axios.post(
          '/api/performance/ruijie/networktraffic',
          {
            sn: device.serialNumber,
            startDate: startOfToday.getTime().toString(),
            endDate: endOfToday.getTime().toString(),
            vendor,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success && response.data.data) {
          const dataList = response.data.data.list || response.data.data;
          
          if (dataList && Array.isArray(dataList)) {
            const transformedData = dataList.map(item => ({
              timestamp: Math.floor((item.timeStamp || item.timestamp) / 1000),
              uplinkRate: (item.txRate || 0) * 1000000,
              downlinkRate: (item.rxRate || 0) * 1000000,
              unit: "bps",
              original: {
                rxRate: item.rxRate,
                txRate: item.txRate,
                rxBytes: item.rxBytes,
                txBytes: item.txBytes
              }
            })) || [];
            
            setTrafficData(transformedData);
          } else {
            console.warn('Ruijie traffic data format unexpected:', response.data);
            setError('Invalid Ruijie traffic data format');
            setTrafficData([]);
          }
        } else {
          console.error("Ruijie API Error:", response.data?.msg || response.data?.error);
          setError(`Ruijie traffic data error: ${response.data?.msg || response.data?.error || 'Unknown error'}`);
          setTrafficData([]);
        }
      } else {
        console.error("Unknown vendor for traffic data:", vendor);
        setError(`Unknown vendor: ${vendor}`);
        setTrafficData([]);
      }
    } catch (error) {
      console.error("Error fetching traffic data:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.msg || "Failed to fetch traffic data";
      setError(`${getVendorDisplayName(vendor)} traffic error: ${errorMsg}`);
      setTrafficData([]);
    } finally {
      setLoading(prev => ({ ...prev, traffic: false }));
    }
  }, [timeRange, getToken, isHuawei, isRuijie, getVendorDisplayName]);

  useEffect(() => { 
    fetchSites(); 
  }, [fetchSites]);

  useEffect(() => { 
    if (selectedSite) {
      fetchDevices(selectedSite, selectedSite.vendor);
    } else {
      setDevices([]);
      setSelectedDevice(null);
    }
  }, [selectedSite, fetchDevices]);

  useEffect(() => { 
    if (selectedDevice) {
      fetchTrafficData(selectedDevice, selectedDevice.vendor);
    } else {
      setTrafficData([]);
    }
  }, [selectedDevice, timeRange, fetchTrafficData]);

  useEffect(() => {
    if (selectedSite) {
      fetchMonthlySiteTraffic();
    } else {
      setMonthlyTraffic([]);
    }
  }, [selectedSite, selectedMonth, selectedYear, fetchMonthlySiteTraffic]);

  const handleSiteClick = (siteId) => {
    // Find the site by siteId
    const site = sites.find(s => s.siteId === siteId);
    if (site) {
      setSelectedSite(site);
      setSelectedDevice(null);
      setTrafficData([]);
      setError(null);
    }
  };

  // Handle sync action
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

  const handleDeviceClick = (device) => {
    setSelectedDevice(device);
    setError(null);
  };

  const handleRefreshTraffic = () => {
    if (selectedDevice) {
      fetchTrafficData(selectedDevice, selectedDevice.vendor);
    }
  };

  const handleRefreshAll = () => {
    fetchSites();
    if (selectedSite) {
      fetchDevices(selectedSite, selectedSite.vendor);
    }
    if (selectedDevice) {
      fetchTrafficData(selectedDevice, selectedDevice.vendor);
    }
  };

  // Handle search term change from SiteList
  const handleSearchChange = (term) => {
    setSearchTerm(term);
  };

  // Filter sites based on active tab and search term
  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         site.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "huawei") return matchesSearch && isHuawei(site.vendor);
    if (activeTab === "ruijie") return matchesSearch && isRuijie(site.vendor);
    if (activeTab === "ruijie1") return matchesSearch && getVendorDisplayName(site.vendor) === "Ruijie 1";
    if (activeTab === "ruijie2") return matchesSearch && getVendorDisplayName(site.vendor) === "Ruijie 2";
    return matchesSearch;
  });

  const getVendorTabCounts = useCallback(() => {
    const counts = {
      huawei: sites.filter(s => isHuawei(s.vendor)).length,
      ruijie: sites.filter(s => isRuijie(s.vendor)).length,
      ruijie1: sites.filter(s => getVendorDisplayName(s.vendor) === "Ruijie 1").length,
      ruijie2: sites.filter(s => getVendorDisplayName(s.vendor) === "Ruijie 2").length
    };
    return counts;
  }, [sites, isHuawei, isRuijie, getVendorDisplayName]);

  const vendorCounts = getVendorTabCounts();

  const chartOptions = {
    chart: { 
      type: 'line', 
      height: 300, 
      zoom: { enabled: true }, 
      toolbar: { show: true }, 
      background: 'transparent', 
      foreColor: '#94a3b8' 
    },
    colors: ['#3B82F6', '#10B981'], 
    dataLabels: { enabled: false }, 
    stroke: { curve: 'smooth', width: 3 },
    grid: { borderColor: '#374151', row: { colors: ['transparent', 'transparent'], opacity: 0.5 } },
    xaxis: { 
      type: 'datetime', 
      labels: { 
        datetimeUTC: false, 
        format: 'HH:mm', 
        style: { colors: '#94a3b8' } 
      } 
    },
    yaxis: { 
      title: { text: 'Rate (bps)', style: { color: '#94a3b8' } }, 
      labels: { 
        formatter: (val) => {
          if (val >= 1000000) return `${(val/1000000).toFixed(1)} Mbps`;
          if (val >= 1000) return `${(val/1000).toFixed(1)} Kbps`;
          return `${val.toFixed(0)} bps`;
        }, 
        style: { colors: '#94a3b8' } 
      } 
    },
    tooltip: { 
      theme: 'dark', 
      x: { format: 'dd MMM yyyy HH:mm' }, 
      y: { 
        formatter: (val) => {
          if (val >= 1000000) return `${(val/1000000).toFixed(2)} Mbps`;
          if (val >= 1000) return `${(val/1000).toFixed(2)} Kbps`;
          return `${val.toFixed(2)} bps`;
        }
      } 
    },
    legend: { 
      position: 'top', 
      horizontalAlign: 'right', 
      labels: { colors: '#94a3b8' } 
    }
  };

  const chartSeries = [
    {
      name: 'Uplink',
      data: trafficData.map(item => ({
        x: new Date(item.timestamp * 1000),
        y: item.uplinkRate || 0
      }))
    },
    {
      name: 'Downlink',
      data: trafficData.map(item => ({
        x: new Date(item.timestamp * 1000),
        y: item.downlinkRate || 0
      }))
    }
  ];

  const monthlyChartOptions = {
    chart: { type: 'line', height: 300, toolbar: { show: false }, background: 'transparent', foreColor: '#94a3b8' },
    colors: ['#10B981', '#8B5CF6'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: { categories: monthlyTraffic.map(d => d.displayDate), labels: { style: { colors: '#94a3b8' } } },
    yaxis: { title: { text: 'Traffic (GB)', style: { color: '#94a3b8' } }, labels: { style: { colors: '#94a3b8' } } },
    grid: { borderColor: '#374151', strokeDashArray: 4 },
    tooltip: { theme: 'dark', y: { formatter: (val) => `${val} GB` } },
    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94a3b8' } }
  };

  const monthlyChartSeries = [
    { name: 'Download', data: monthlyTraffic.map(d => d.rxGB) },
    { name: 'Upload', data: monthlyTraffic.map(d => d.txGB) }
  ];

  const totalUplink = trafficData.reduce((sum, item) => sum + (item.uplinkRate || 0), 0);
  const totalDownlink = trafficData.reduce((sum, item) => sum + (item.downlinkRate || 0), 0);
  const avgUplink = trafficData.length > 0 ? totalUplink / trafficData.length : 0;
  const avgDownlink = trafficData.length > 0 ? totalDownlink / trafficData.length : 0;

  const Badge = ({ children, variant = "default", className = "" }) => {
    const variantClasses = {
      default: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      secondary: "bg-gray-800 text-gray-300 border border-gray-700",
      success: "bg-green-500/10 text-green-400 border border-green-500/20",
      warning: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
      danger: "bg-red-500/10 text-red-400 border border-red-500/20",
      ruijie1: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
      ruijie2: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
        {children}
      </span>
    );
  };

  const getDeviceVariant = useCallback((device) => {
    if (isHuawei(device.vendor)) return "default";
    const displayName = getVendorDisplayName(device.vendor);
    if (displayName === "Ruijie 1") return "ruijie1";
    if (displayName === "Ruijie 2") return "ruijie2";
    return "secondary";
  }, [isHuawei, getVendorDisplayName]);

  const getDeviceIcon = useCallback((device) => {
    return isHuawei(device.vendor) 
      ? <Router className="h-4 w-4 text-red-400" /> 
      : <Network className="h-4 w-4 text-blue-400" />;
  }, [isHuawei]);

  const getDeviceIconBg = useCallback((device) => {
    if (isHuawei(device.vendor)) return "bg-red-500/10";
    const displayName = getVendorDisplayName(device.vendor);
    if (displayName === "Ruijie 1") return "bg-purple-500/10";
    if (displayName === "Ruijie 2") return "bg-indigo-500/10";
    return "bg-blue-500/10";
  }, [isHuawei, getVendorDisplayName]);

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Network Performance Dashboard</h1>
          <p className="text-sm md:text-base text-gray-300">Monitor real-time network traffic across all sites</p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          <button 
            onClick={handleRefreshAll} 
            disabled={loading.sites || loading.devices || loading.traffic} 
            className="inline-flex items-center px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading.sites || loading.devices || loading.traffic ? 'animate-spin' : ''}`} />
            Refresh All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-8 gap-4 md:gap-6">
        {/* Sites Panel using SiteList component */}
        <div className="lg:col-span-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6 h-[calc(108vh-260px)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
            </div>
            
            {/* Use SiteList Component */}
            <div className="flex-1 overflow-hidden">
              <SiteList 
                sites={filteredSites}
                loading={loading.sites}
                error={error}
                selectedSite={selectedSite?.siteId}
                searchTerm={searchTerm}
                onSiteSelect={handleSiteClick}
                onSearchChange={handleSearchChange}
                onSync={handleSync}
                syncing={syncing}
                syncMessage={syncMessage}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-5 lg:grid-cols-1 space-y-4 md:space-y-6 h-[calc(108vh-260px)] overflow-y-auto pr-2">
          {/* Traffic Stats Panel - Moved to Top */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                Traffic Stats
              </h2>
              <p className="text-xs md:text-sm text-gray-300 mt-1">
                {selectedDevice 
                  ? `Performance metrics for ${selectedDevice.name}` 
                  : "Select a device to view stats"}
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {loading.traffic ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={`stats-skeleton-${i}`} className="animate-pulse bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                    <div className="h-16 bg-gray-700/30 rounded-lg"></div>
                  </div>
                ))
              ) : !selectedDevice || trafficData.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-4 text-gray-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-center">
                    {selectedDevice 
                      ? "No traffic data available for this device" 
                      : "Select a device to view traffic statistics"
                    }
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/10 rounded-md">
                          <Signal className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-400" />
                        </div>
                        <p className="text-xs font-medium text-gray-300">Avg Uplink</p>
                      </div>
                      <p className="text-base md:text-lg font-bold text-white">
                        {avgUplink >= 1000000 
                          ? `${(avgUplink / 1000000).toFixed(1)} Mbps` 
                          : avgUplink >= 1000 
                          ? `${(avgUplink / 1000).toFixed(1)} Kbps` 
                          : `${avgUplink.toFixed(0)} bps`
                        }
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-500/10 rounded-md">
                          <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-400" />
                        </div>
                        <p className="text-xs font-medium text-gray-300">Avg Downlink</p>
                      </div>
                      <p className="text-base md:text-lg font-bold text-white">
                        {avgDownlink >= 1000000 
                          ? `${(avgDownlink / 1000000).toFixed(1)} Mbps` 
                          : avgDownlink >= 1000 
                          ? `${(avgDownlink / 1000).toFixed(1)} Kbps` 
                          : `${avgDownlink.toFixed(0)} bps`
                        }
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/10 rounded-md">
                          <HardDrive className="h-3.5 w-3.5 md:h-4 md:w-4 text-purple-400" />
                        </div>
                        <p className="text-xs font-medium text-gray-300">Data Points</p>
                      </div>
                      <p className="text-base md:text-lg font-bold text-white">{trafficData.length}</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-500/10 rounded-md">
                          <Cpu className="h-3.5 w-3.5 md:h-4 md:w-4 text-orange-400" />
                        </div>
                        <p className="text-xs font-medium text-gray-300">Vendor</p>
                      </div>
                      <p className="text-base md:text-lg font-bold text-white truncate">{getVendorDisplayName(selectedDevice.vendor)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Network Traffic Chart & Devices */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                  Network Traffic
                </h2>
                <p className="text-xs md:text-sm text-gray-300 mt-1">
                  {selectedDevice 
                    ? `Real-time traffic for ${selectedDevice.name} (${getVendorDisplayName(selectedDevice.vendor)})` 
                    : selectedSite
                    ? "Select a device to view traffic data"
                    : "Select a site and device to view traffic data"
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative min-w-[200px]">
                  <button
                    onClick={() => setIsDeviceDropdownOpen(!isDeviceDropdownOpen)}
                    disabled={devices.length === 0}
                    className="flex items-center justify-between bg-white/10 border border-white/20 text-white text-xs md:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full p-2.5 disabled:opacity-50"
                  >
                    <span className="truncate flex items-center gap-2">
                      {selectedDevice ? (
                        <>
                          <span className={selectedDevice.status === 'Online' ? 'text-green-400' : 'text-red-400'}>●</span>
                          {selectedDevice.name}
                        </>
                      ) : "Select Device"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400 ml-2" />
                  </button>

                  {isDeviceDropdownOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-gray-700">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search devices..."
                            value={deviceSearchTerm}
                            onChange={(e) => setDeviceSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-8 py-2 bg-gray-900/50 border border-gray-600 text-white text-xs rounded-md focus:outline-none focus:border-blue-500"
                            autoFocus
                          />
                          {deviceSearchTerm && (
                            <button
                              onClick={() => setDeviceSearchTerm("")}
                              className="absolute right-2 top-2.5 text-gray-400 hover:text-white"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setDeviceStatusFilter("all")}
                            className={`flex-1 py-1 text-[10px] rounded-md border transition-colors ${
                              deviceStatusFilter === "all" 
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30" 
                                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                            }`}
                          >
                            All
                          </button>
                          <button
                            onClick={() => setDeviceStatusFilter("Online")}
                            className={`flex-1 py-1 text-[10px] rounded-md border transition-colors ${
                              deviceStatusFilter === "Online" 
                                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                            }`}
                          >
                            Online
                          </button>
                          <button
                            onClick={() => setDeviceStatusFilter("Offline")}
                            className={`flex-1 py-1 text-[10px] rounded-md border transition-colors ${
                              deviceStatusFilter === "Offline" 
                                ? "bg-red-500/20 text-red-400 border-red-500/30" 
                                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                            }`}
                          >
                            Offline
                          </button>
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {devices.filter(d => d.name.toLowerCase().includes(deviceSearchTerm.toLowerCase()) && (deviceStatusFilter === "all" || d.status === deviceStatusFilter)).length === 0 ? (
                          <div className="p-3 text-center text-gray-400 text-xs">No devices found</div>
                        ) : (
                          devices
                            .filter(d => d.name.toLowerCase().includes(deviceSearchTerm.toLowerCase()) && (deviceStatusFilter === "all" || d.status === deviceStatusFilter))
                            .map((device) => (
                              <button
                                key={device.id}
                                onClick={() => {
                                  handleDeviceClick(device);
                                  setIsDeviceDropdownOpen(false);
                                  setDeviceSearchTerm("");
                                }}
                                className={`w-full text-left px-3 py-2 text-xs md:text-sm hover:bg-white/10 flex items-center justify-between ${
                                  selectedDevice?.id === device.id ? "bg-blue-600/20 text-blue-400" : "text-gray-300"
                                }`}
                              >
                                <span className="truncate">{device.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  device.status === "Online" ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"
                                }`}>
                                  {device.status}
                                </span>
                              </button>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <select 
                    value={timeRange} 
                    onChange={(e) => setTimeRange(e.target.value)} 
                    disabled={!selectedDevice || isRuijie(selectedDevice?.vendor)}
                    className="appearance-none bg-white/10 border border-white/20 text-white text-xs md:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 pr-8 disabled:opacity-50"
                  >
                    <option value="1h" className="bg-gray-800 text-white">Last 1 Hour</option>
                    <option value="6h" className="bg-gray-800 text-white">Last 6 Hours</option>
                    <option value="24h" className="bg-gray-800 text-white">Last 24 Hours</option>
                    <option value="7d" className="bg-gray-800 text-white">Last 7 Days</option>
                    <option value="today" className="bg-gray-800 text-white">Today</option>
                  </select>
                  <Clock className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {selectedDevice && (
                  <button 
                    onClick={handleRefreshTraffic} 
                    disabled={loading.traffic}
                    className="p-2.5 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Refresh Traffic Data"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-300 ${loading.traffic ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="h-[280px]">
              {loading.traffic ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-300">
                      Loading {getVendorDisplayName(selectedDevice?.vendor)} traffic data...
                    </p>
                  </div>
                </div>
              ) : !selectedDevice ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Activity className="h-12 w-12 md:h-16 md:w-16 mb-4 opacity-50" />
                  <p className="text-sm md:text-lg">Select a device to view network traffic</p>
                  <p className="text-xs md:text-sm mt-2 text-gray-300">
                    {selectedSite ? "Choose a device from the devices list below" : "First select a site from the left panel"}
                  </p>
                </div>
              ) : trafficData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <BarChart3 className="h-12 w-12 md:h-16 md:w-16 mb-4 opacity-50" />
                  <p className="text-sm md:text-lg">No traffic data available</p>
                  <p className="text-xs md:text-sm mt-2 text-gray-300">
                    {isRuijie(selectedDevice.vendor)
                      ? "Ruijie shows today's traffic data only" 
                      : "Try refreshing or selecting another time range"}
                  </p>
                </div>
              ) : (
                <Chart options={chartOptions} series={chartSeries} type="line" height="100%" />
              )}
            </div>
          </div>

          {/* Monthly Site Traffic Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                  Monthly Site Traffic
                </h2>
                <p className="text-xs md:text-sm text-gray-300 mt-1">
                  {selectedSite ? `Daily traffic usage for ${selectedSite.name}` : "Select a site to view monthly traffic"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-white/10 border border-white/20 text-white text-xs md:text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-gray-800">{dayjs().month(i).format('MMMM')}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-white/10 border border-white/20 text-white text-xs md:text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <option key={i} value={dayjs().year() - 2 + i} className="bg-gray-800">{dayjs().year() - 2 + i}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="h-[300px]">
              {monthlyTrafficLoading ? (
                <div className="h-full flex items-center justify-center text-gray-400">Loading monthly data...</div>
              ) : !selectedSite ? (
                <div className="h-full flex items-center justify-center text-gray-400">Select a site to view data</div>
              ) : (
                <Chart options={monthlyChartOptions} series={monthlyChartSeries} type="line" height="100%" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
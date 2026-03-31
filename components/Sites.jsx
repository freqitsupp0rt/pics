'use client';

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import SiteList from "@/components/SiteList";
import { RefreshCw } from "lucide-react";

// Dynamically load React Leaflet components - FIXED Popup import
const MapContainer = dynamic(
  () => import("react-leaflet").then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then(mod => mod.Popup),
  { ssr: false }
);

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [devicesData, setDevicesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [L, setLeaflet] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch sites function that can be reused
  const fetchSites = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sites", {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error("Failed to fetch sites");
      const data = await res.json();
      const normalized = (data.data || []).map(site => ({
        siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
        name: site.name || "Unnamed Site",
        vendor: site.vendor || "Unknown",
        latitude: parseFloat(site.latitude || site.lat || 11.0),
        longitude: parseFloat(site.longitude || site.lon || 125.0),
      }));
      setSites(normalized);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    // Dynamically import leaflet only on client
    import("leaflet").then(mod => setLeaflet(mod));
    
    // Initial fetch
    fetchSites();
  }, []);

  // Fetch devices for a specific site
  const fetchSiteDevices = async (siteId, vendor) => {
    try {
      const res = await fetch(`/api/devices?siteId=${siteId}&vendor=${vendor.toLowerCase()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error("Failed to fetch devices");
      const data = await res.json();
      
      if (data.success) {
        setDevicesData(prev => ({
          ...prev,
          [siteId]: data.data
        }));
      }
    } catch (err) {
      console.error(`Error fetching devices for site ${siteId}:`, err);
    }
  };

  // Calculate device statistics
  const getDeviceStats = (siteId) => {
    const devices = devicesData[siteId] || [];
    const onlineCount = devices.filter(device => device.status === 'Online').length;
    const offlineCount = devices.filter(device => device.status === 'Offline').length;
    const totalCount = devices.length;

    return { onlineCount, offlineCount, totalCount };
  };

  const getMarkerIcon = () => {
    if (!L) return null;
    return L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  const isMapReady = L && sites.length > 0;

  const handleSiteSelect = (siteId) => {
    setSelectedSite(siteId);
    const selectedSiteData = sites.find(site => site.siteId === siteId);
    if (selectedSiteData && !devicesData[siteId]) {
      fetchSiteDevices(siteId, selectedSiteData.vendor);
    }
  };

  const handleSearchChange = (term) => {
    setSearchTerm(term);
  };

  const filteredSites = useMemo(() => {
    if (!searchTerm) return sites;
    return sites.filter(site =>
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.vendor.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sites, searchTerm]);

  return (
    <main className="bg-gradient-to-br from-gray-900 via-gray-800 to-black h-screen text-white flex flex-col overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden gap-4 p-4">
        {/* Map Container - 70% */}
        <div className="w-[70%] overflow-hidden relative z-0">
          <div className="bg-white/10 rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
            <div className="flex-1 h-full w-full">
              {isMapReady ? (
              <MapContainer
                center={[11.0, 125.0]}
                zoom={8}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  subdomains={['a','b','c']}
                  attribution="&copy; OpenStreetMap contributors"
                />
                {filteredSites.map(site => {
                  const icon = getMarkerIcon();
                  const stats = getDeviceStats(site.siteId);
                  
                  return site.latitude && site.longitude && icon ? (
                    <Marker
                      key={site.siteId}
                      position={[site.latitude, site.longitude]}
                      icon={icon}
                      eventHandlers={{
                        click: () => {
                          setSelectedSite(site.siteId);
                          if (!devicesData[site.siteId]) {
                            fetchSiteDevices(site.siteId, site.vendor);
                          }
                        },
                        popupopen: () => {
                          if (!devicesData[site.siteId]) {
                            fetchSiteDevices(site.siteId, site.vendor);
                          }
                        }
                      }}
                    >
                      <Popup>
                        <div className="min-w-[200px]">
                          <strong className="text-lg">{site.name}</strong>
                          <div className="mt-2">
                            <div className="flex justify-between items-center mb-1">
                              <span>Vendor:</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  site.vendor?.toLowerCase().includes('ruijie') 
                                      ? 'bg-blue-500 text-white' 
                                      : site.vendor?.toLowerCase() === 'huawei'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-gray-500 text-white'
                              }`}>
                                  {site.vendor}
                              </span>
                            </div>
                            
                            <div className="border-t border-gray-300 my-2"></div>
                            
                            <div className="text-sm">
                              <div className="flex justify-between items-center mb-1">
                                <span>Total Devices:</span>
                                <span className="font-semibold">{stats.totalCount}</span>
                              </div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-green-500">Online:</span>
                                <span className="font-semibold text-green-500">{stats.onlineCount}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-red-500">Offline:</span>
                                <span className="font-semibold text-red-500">{stats.offlineCount}</span>
                              </div>
                            </div>
                            
                            {stats.totalCount === 0 && (
                              <div className="text-xs text-gray-500 mt-2 text-center">
                                Click to load devices
                              </div>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ) : null;
                })}
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gray-800/50 rounded-lg">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                  <p className="text-gray-400">Loading map...</p>
                </div>
              </div>
            )}
            
            {/* Loading/Error States */}
            {error && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-500/20 text-red-300 p-3 rounded-lg text-sm border border-red-500/30">
                {error}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Right Side Panel - Site Management & Selected Site Details - 30% */}
        <div className="w-[30%] h-full bg-gradient-to-b from-gray-800/95 to-gray-900/95 backdrop-blur border border-gray-700 shadow-2xl rounded-xl overflow-hidden flex flex-col z-50 pointer-events-auto">
          {/* Toolbar Header */}
          <div className="border-b border-gray-700 p-3 space-y-2 flex-shrink-0">
            <h2 className="text-lg font-bold">Site Management</h2>
            <input
              type="text"
              placeholder="Search sites..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none text-white placeholder-gray-400 text-xs"
            />
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="w-full flex items-center justify-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition font-medium text-sm"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            
            {/* Sync Message */}
            {syncMessage && (
              <div className={`p-2 rounded-lg text-xs ${
                syncMessage.type === 'success' 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {syncMessage.text}
              </div>
            )}
          </div>

          {/* Site Details Section */}
          <div className="flex-1 overflow-y-auto p-3">
            {selectedSite ? (
              (() => {
                const selectedSiteData = sites.find(site => site.siteId === selectedSite);
                const stats = getDeviceStats(selectedSite);
                const devices = devicesData[selectedSite] || [];
                
                return selectedSiteData ? (
                  <div className="space-y-4">
                    {/* Close button */}
                    <button
                      onClick={() => setSelectedSite(null)}
                      className="text-gray-400 hover:text-white transition text-sm"
                    >
                      ← Back
                    </button>

                    {/* Site Info Card */}
                    <div className="bg-white/5 border border-gray-700 rounded-lg p-3">
                      <h4 className="font-bold text-base mb-2">{selectedSiteData.name}</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Vendor:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            selectedSiteData.vendor?.toLowerCase().includes('ruijie') 
                              ? 'bg-blue-500/20 text-blue-300' 
                              : selectedSiteData.vendor?.toLowerCase() === 'huawei'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-gray-500/20 text-gray-300'
                          }`}>
                            {selectedSiteData.vendor}
                          </span>
                        </div>
                        <div className="text-gray-400">
                          <span className="text-xs">Location:</span>
                          <p className="text-white font-mono text-xs">{selectedSiteData.latitude.toFixed(4)}, {selectedSiteData.longitude.toFixed(4)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Device Stats */}
                    <div className="grid grid-cols-3 gap-1">
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-blue-400">{stats.totalCount}</div>
                        <div className="text-xs text-gray-400">Total</div>
                      </div>
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-green-400">{stats.onlineCount}</div>
                        <div className="text-xs text-gray-400">Online</div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-red-400">{stats.offlineCount}</div>
                        <div className="text-xs text-gray-400">Offline</div>
                      </div>
                    </div>

                    {/* Devices List */}
                    {devices.length > 0 ? (
                      <div>
                        <h5 className="font-semibold text-xs mb-2 text-gray-300">Devices ({devices.length})</h5>
                        <div className="space-y-1">
                          {devices.map(device => (
                            <div key={device.id || device.deviceId} className="bg-white/5 border border-gray-700 rounded-lg p-2 text-xs">
                              <div className="flex items-start justify-between mb-0.5">
                                <span className="font-semibold text-white truncate text-xs">{device.name || device.deviceName || 'Unknown'}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap ml-1 ${
                                  device.status === 'Online' 
                                    ? 'bg-green-500/20 text-green-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {device.status || 'Unknown'}
                                </span>
                              </div>
                              {device.model && (
                                <div className="text-gray-400 text-xs">{device.model}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-dashed border-gray-700 rounded-lg p-3 text-center text-xs text-gray-400">
                        No devices loaded yet
                      </div>
                    )}
                  </div>
                ) : null;
              })()
            ) : (
              <div className="text-center text-gray-400 py-8">
                <p className="text-xs">Click on a marker on the map to view site details and device status</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
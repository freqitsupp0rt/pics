'use client';

import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Search, RefreshCw } from "lucide-react";
import SiteList from "@/components/SiteList";
import { useAuth } from '@/hooks/useAuth';

export default function SiteDevices() {
  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const [deviceSearchTerm, setDeviceSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const { getToken } = useAuth();
  const token = getToken();

  // Fetch sites function
  const fetchSites = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sites", {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch sites");
      const data = await res.json();
      const normalized = (data.data || []).map(site => ({
        siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
        name: site.name || "Unnamed Site",
        vendor: site.vendor || "Unknown",
        latitude: site.latitude || site.lat || 14.5995,
        longitude: site.longitude || site.lon || 120.9842,
      }));
      setSites(normalized);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // Handle sync action
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch('/api/sites/sync', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      
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

  // Fetch devices when a site is selected
  useEffect(() => {
    if (!selectedSite) {
      setDevices([]);
      return;
    }

    async function fetchDevicesForSite() {
      setDevicesLoading(true);
      try {
        const site = sites.find(s => s.siteId === selectedSite);
        if (!site) return;

        const res = await fetch(`/api/devices?siteId=${selectedSite}&vendor=${site.vendor}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!res.ok) throw new Error("Failed to fetch devices");
        
        const data = await res.json();
        const devicesData = data.data || [];
        
        setDevices(devicesData);
      } catch (err) {
        console.error("Error fetching devices:", err);
        setError(`Failed to load devices: ${err.message}`);
        setDevices([]);
      } finally {
        setDevicesLoading(false);
      }
    }

    fetchDevicesForSite();
  }, [selectedSite, sites]);

  // Filter devices based on search term
  const filteredDevices = useMemo(() => {
    if (!deviceSearchTerm) return devices;
    return devices.filter(device =>
      (device.name && device.name.toLowerCase().includes(deviceSearchTerm.toLowerCase())) ||
      (device.serialNumber && device.serialNumber.toLowerCase().includes(deviceSearchTerm.toLowerCase())) ||
      (device.model && device.model.toLowerCase().includes(deviceSearchTerm.toLowerCase())) ||
      (device.ipAddress && device.ipAddress.toLowerCase().includes(deviceSearchTerm.toLowerCase())) ||
      (device.type && device.type.toLowerCase().includes(deviceSearchTerm.toLowerCase())) ||
      (device.status && device.status.toLowerCase().includes(deviceSearchTerm.toLowerCase()))
    );
  }, [devices, deviceSearchTerm]);

  const deviceColumns = useMemo(() => [
    { 
      accessorKey: "name", 
      header: "Device Name",
      cell: ({ row }) => {
        return row.original.name || 'N/A';
      }
    },
    { 
      accessorKey: "model", 
      header: "Model",
      cell: ({ row }) => {
        return row.original.model || 'N/A';
      }
    },
    { 
      accessorKey: "serialNumber", 
      header: "Serial Number",
      cell: ({ row }) => {
        return row.original.serialNumber || 'N/A';
      }
    },
    { 
      accessorKey: "macAddress", 
      header: "MAC",
      cell: ({ row }) => {
        return row.original.macAddress || 'N/A';
      }
    },
    { 
      accessorKey: "type", 
      header: "Type",
      cell: ({ row }) => {
        return row.original.type || 'N/A';
      }
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || 'Unknown';
        const statusColor = status === 'Online' ? 'text-green-400' : 
                          status === 'Offline' ? 'text-red-400' : 
                          status === 'Warning' ? 'text-yellow-400' : 
                          'text-gray-400';
        return <span className={`${statusColor} font-medium`}>{status}</span>;
      }
    },
  ], []);

  const deviceTable = useReactTable({ 
    data: filteredDevices, 
    columns: deviceColumns, 
    getCoreRowModel: getCoreRowModel() 
  });

  // Get selected site info
  const selectedSiteInfo = selectedSite 
    ? sites.find(site => site.siteId === selectedSite) 
    : null;

  // Handle site selection from SiteList
  const handleSiteSelect = (siteId) => {
    setSelectedSite(siteId);
  };

  // Handle site search term change
  const handleSiteSearchChange = (term) => {
    setSiteSearchTerm(term);
  };

  // Refresh devices for selected site
  const handleRefreshDevices = () => {
    if (selectedSite) {
      const site = sites.find(s => s.siteId === selectedSite);
      if (site) {
        async function refreshDevices() {
          setDevicesLoading(true);
          try {
            const res = await fetch(`/api/devices?siteId=${selectedSite}&vendor=${site.vendor}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!res.ok) throw new Error("Failed to refresh devices");
            
            const data = await res.json();
            const devicesData = data.data || [];
            
            setDevices(devicesData);
            setError(null);
          } catch (err) {
            console.error("Error refreshing devices:", err);
            setError(`Failed to refresh devices: ${err.message}`);
          } finally {
            setDevicesLoading(false);
          }
        }
        refreshDevices();
      }
    }
  };

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col md:flex-row md:gap-6">
        {/* Left Column - SiteList Component */}
        <div className="w-full md:w-1/3 mb-4 md:mb-0 mt-2">
          <SiteList 
            sites={sites}
            loading={loading || syncing}
            error={error}
            selectedSite={selectedSite}
            searchTerm={siteSearchTerm}
            onSiteSelect={handleSiteSelect}
            onSearchChange={handleSiteSearchChange}
            onSync={handleSync}
            syncing={syncing}
            syncMessage={syncMessage}
          />
        </div>

        {/* Right Column - Site Devices List */}
        <div className="w-full md:w-2/3 bg-white/10 p-4 rounded-xl shadow-lg mt-2 flex flex-col">
          {/* Devices Header with Search */}
          <div className="flex flex-col mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">Site Devices</h2>
              {selectedSite && (
                <button
                  onClick={handleRefreshDevices}
                  disabled={devicesLoading}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-400 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh devices"
                >
                  <RefreshCw size={16} className={devicesLoading ? 'animate-spin' : ''} />
                  Refresh Devices
                </button>
              )}
            </div>

            {/* Device Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search devices by name, model, serial, IP, or status..."
                value={deviceSearchTerm}
                onChange={(e) => setDeviceSearchTerm(e.target.value)}
                disabled={!selectedSite || devicesLoading}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {/* Device search results count */}
            {deviceSearchTerm && selectedSite && (
              <div className="text-sm text-gray-400 mt-2">
                Found {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[400px]">
            <div className="h-full">
              <div className="mb-4">
                {selectedSite ? (
                  <div>
                    <h3 className="text-lg font-medium mb-2">
                      Devices for: {selectedSiteInfo?.name} 
                      <span className={`ml-2 text-sm px-2 py-1 rounded ${
                        selectedSiteInfo?.vendor?.toLowerCase().includes('ruijie') 
                          ? 'bg-blue-500 text-white' 
                          : selectedSiteInfo?.vendor?.toLowerCase() === 'huawei'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}>
                        {selectedSiteInfo?.vendor}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedSite(null);
                          setDeviceSearchTerm('');
                        }}
                        className="ml-2 px-2 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500 transition"
                        title="Click to deselect site"
                      >
                        X
                      </button>
                    </h3>
                    <p className="text-sm text-gray-400">
                      {devices.length} device(s) found {deviceSearchTerm && `(${filteredDevices.length} filtered)`}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400">Please select a site to view its devices.</p>
                )}
              </div>
              
              {devicesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
                    <p className="text-gray-400">Loading devices...</p>
                  </div>
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-gray-400">
                    {selectedSite 
                      ? deviceSearchTerm 
                        ? 'No devices found matching your search' 
                        : 'No devices found for this site' 
                      : 'No site selected'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[600px]">
                  <table className="min-w-full border-collapse">
                    <thead>
                      {deviceTable.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="bg-white/20">
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className="px-3 py-2 text-left text-gray-200 sticky top-0 bg-white/20 z-10">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {deviceTable.getRowModel().rows.map((row, index) => {
                        const rowBg = index % 2 === 0 ? "bg-white/10" : "bg-white/5";
                        
                        return (
                          <tr
                            key={`${selectedSite}-device-${index}`}
                            className={`${rowBg} hover:bg-white/20 transition`}
                          >
                            {row.getVisibleCells().map(cell => (
                              <td 
                                key={cell.id} 
                                className="px-3 py-2"
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
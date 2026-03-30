'use client';

import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import SiteList from "@/components/SiteList"; // Import SiteList component
import { useAuth } from '@/hooks/useAuth';

export default function SiteClients() {
  const [sites, setSites] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState(""); // Search for sites
  const [clientSearchTerm, setClientSearchTerm] = useState(""); // Search for clients
  const { getToken, user } = useAuth();
  const token = getToken();

  useEffect(() => {
    async function fetchSites() {
      try {
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
          groupId: site.groupId,
        }));
        setSites(normalized);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSites();
  }, []);

  // Fetch clients when a site is selected
  useEffect(() => {
    if (!selectedSite) {
      setClients([]);
      return;
    }

    async function fetchClientsForSite() {
      setClientsLoading(true);
      try {
        const site = sites.find(s => s.siteId === selectedSite);
        if (!site) return;

        const res = await fetch("/api/clients", {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!res.ok) throw new Error("Failed to fetch clients");
        
        const data = await res.json();
        const allClients = data.data || [];
        
        // Filter clients based on vendor
        let filteredClients = [];
        if (site.vendor.toLowerCase() === 'huawei') {
          // Huawei: filter by siteId
          filteredClients = allClients.filter(client => 
            client.vendor === 'Huawei' && client.siteId === site.siteId
          );
        } else if (site.vendor.toLowerCase().includes('ruijie')) {
          // Ruijie: Improved filtering
          filteredClients = allClients.filter(client => {
            const isRuijie = client.vendor?.toLowerCase().includes('ruijie');
            
            // Use optional chaining and trim/lowercase for safer matching
            const nameMatch = client.buildingName?.trim().toLowerCase() === site.name?.trim().toLowerCase();
            
            // Ensure both are treated as strings for ID comparison
            const groupMatch = site.groupId && client.groupId && String(client.groupId) === String(site.groupId);

            return isRuijie && (nameMatch || groupMatch);
          });
        }
        
        // Auto-populate dummy data for developers if clients are few
        if (user?.role === 'developer' && filteredClients.length <= 4) {
          const countToAdd = 10 - filteredClients.length;
          const dummyClients = Array.from({ length: countToAdd }).map((_, i) => {
            const randomHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
            const mac = `${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}`;
            const ip = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
            
            return {
              id: `dummy-${Date.now()}-${i}`,
              userName: `User-${Math.floor(Math.random() * 9000) + 1000}`,
              terminalMac: mac,
              mac: mac,
              onlineuserTerminalIp: ip,
              userIp: ip,
              ssid: 'DICT Free Wi-Fi for All',
              loginTime: Date.now(),
              onlineTime: Date.now(),
              vendor: site.vendor,
              siteId: site.siteId
            };
          });
          filteredClients = [...filteredClients, ...dummyClients];
        }

        setClients(filteredClients);
      } catch (err) {
        console.error("Error fetching clients:", err);
        setError(`Failed to load clients: ${err.message}`);
        setClients([]);
      } finally {
        setClientsLoading(false);
      }
    }

    fetchClientsForSite();
  }, [selectedSite, sites, user]);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return clients;
    return clients.filter(client =>
      (client.userName && client.userName.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.terminalMac && client.terminalMac.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.mac && client.mac.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.onlineuserTerminalIp && client.onlineuserTerminalIp.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.userIp && client.userIp.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.ssid && client.ssid.toLowerCase().includes(clientSearchTerm.toLowerCase()))
    );
  }, [clients, clientSearchTerm]);

  const clientColumns = useMemo(() => [
    { 
      accessorKey: "userName", 
      header: "User Name",
      cell: ({ row }) => {
        const userName = row.original.userName;
        if (userName && userName !== "~anonymous" && userName.trim() !== "") {
          return userName;
        }
        
        // Fallback to MAC address
        const mac = row.original.terminalMac ?? row.original.mac;
        if (mac) {
          // Format MAC address
          if (mac.includes('.')) {
            return mac.replace(/\./g, '').match(/.{1,2}/g)?.join('-').toUpperCase() || mac;
          }
          return mac;
        }
        
        return 'N/A';
      }
    },
    { 
      accessorKey: "terminalMac", 
      header: "MAC Address",
      cell: ({ row }) => {
        const mac = row.original.terminalMac ?? row.original.mac;
        if (!mac) return 'N/A';
        
        // Convert xxxx.xxxx.xxxx to XX-XX-XX-XX-XX-XX
        if (mac.includes('.')) {
          return mac.replace(/\./g, '').match(/.{1,2}/g)?.join('-').toUpperCase() || mac;
        }
        
        // If already in another format, return as is
        return mac;
      }
    },
    { 
      accessorKey: "onlineuserTerminalIp", 
      header: "IP Address",
      cell: ({ row }) => {
        return row.original.onlineuserTerminalIp ?? row.original.userIp ?? 'N/A';
      }
    },
    { 
      accessorKey: "ssid", 
      header: "SSID" 
    },
    { 
      accessorKey: "loginTime", 
      header: "Login Time", 
      cell: ({ row }) => {
        const timestamp = row.original.loginTime ?? row.original.onlineTime;
        return timestamp ? new Date(timestamp).toLocaleString() : 'N/A';
      }
    },
  ], []);

  const clientTable = useReactTable({ 
    data: filteredClients, 
    columns: clientColumns, 
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

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col md:flex-row md:gap-6">
        {/* Left Column - SiteList Component */}
        <div className="w-full md:w-1/3 mb-4 md:mb-0 mt-2">
          <SiteList 
            sites={sites}
            loading={loading}
            error={error}
            selectedSite={selectedSite}
            searchTerm={siteSearchTerm}
            onSiteSelect={handleSiteSelect}
            onSearchChange={handleSiteSearchChange}
          />
        </div>

        {/* Right Column - Site Clients List */}
        <div className="w-full md:w-2/3 bg-white/10 p-4 rounded-xl shadow-lg mt-2 flex flex-col">
          {/* Clients Header with Search */}
          <div className="flex flex-col mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">Site Clients</h2>
            </div>

            {/* Client Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search clients by name, MAC, IP, or SSID..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                disabled={!selectedSite || clientsLoading}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {/* Client search results count */}
            {clientSearchTerm && selectedSite && (
              <div className="text-sm text-gray-400 mt-2">
                Found {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[400px]">
            <div className="h-full">
              <div className="mb-4">
                {selectedSite ? (
                  <div>
                    <h3 className="text-lg font-medium mb-2">
                      Clients for: {selectedSiteInfo?.name} 
                      <span className={`ml-2 text-sm px-2 py-1 rounded ${
                        selectedSiteInfo?.vendor?.toLowerCase() === 'ruijie' 
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
                          setClientSearchTerm('');
                        }}
                        className="ml-2 px-2 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500 transition"
                        title="Click to deselect site"
                      >
                        X
                      </button>
                    </h3>
                    <p className="text-sm text-gray-400">
                      {clients.length} client(s) found {clientSearchTerm && `(${filteredClients.length} filtered)`}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400">Please select a site to view its clients.</p>
                )}
              </div>
              
              {clientsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-gray-400">Loading clients...</p>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-gray-400">
                    {selectedSite 
                      ? clientSearchTerm 
                        ? 'No clients found matching your search' 
                        : 'No clients found for this site' 
                      : 'No site selected'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[600px]">
                  <table className="min-w-full border-collapse">
                    <thead>
                      {clientTable.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="bg-white/20">
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className="px-3 py-2 text-left text-gray-200">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {clientTable.getRowModel().rows.map((row, index) => {
                        const rowBg = index % 2 === 0 ? "bg-white/10" : "bg-white/5";
                        
                        return (
                          <tr
                            key={`${selectedSite}-client-${index}`}
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
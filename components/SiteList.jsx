'use client';

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Search, RefreshCw } from "lucide-react";
import { motion } from 'framer-motion';

// Helper function to parse site name and code from full name
const parseSiteInfo = (siteName) => {
  if (!siteName) return { siteName: '', siteCode: '' };
  
  const trimmedName = siteName.trim();
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
  
  return {
    siteCode: '',
    siteName: trimmedName
  };
};

export default function SiteList({ 
  sites = [], 
  loading = false, 
  error = null, 
  selectedSite = null,
  searchTerm = "",
  onSiteSelect = () => {},
  onSearchChange = () => {},
  onSync = () => {}, 
  syncing = false,
  syncMessage = null
}) {
  
  // Filter sites based on search term
  const filteredSites = useMemo(() => {
    if (!searchTerm) return sites;
    
    const searchLower = searchTerm.toLowerCase();
    
    return sites.filter(site => {
      const fullName = site.name || site.displayName || '';
      const vendor = site.vendor || '';
      
      const parsed = parseSiteInfo(fullName);
      
      return (
        fullName.toLowerCase().includes(searchLower) ||
        parsed.siteName.toLowerCase().includes(searchLower) ||
        parsed.siteCode.toLowerCase().includes(searchLower) ||
        vendor.toLowerCase().includes(searchLower)
      );
    });
  }, [sites, searchTerm]);

  // Normalize sites data for display
  const normalizedSites = useMemo(() => {
    return (filteredSites || []).map(site => {
      const parsedInfo = parseSiteInfo(site.name || '');
      
      return {
        siteId: site.siteId || site.id || site.groupId || Math.random().toString(36),
        displayName: parsedInfo.siteName || site.name || "Unnamed Site",
        siteCode: parsedInfo.siteCode || '',
        vendor: site.vendor || "Unknown",
        latitude: site.latitude || site.lat || 11.0,
        longitude: site.longitude || site.lon || 125.0,
        originalName: site.name || ''
      };
    });
  }, [filteredSites]);

  // Update columns
  const columns = useMemo(() => [
    { 
      accessorKey: "displayName", 
      header: "Site Name",
      cell: ({ row }) => (
       <div className="flex flex-col">
  <span className={isSelected ? "drop-shadow-[0_1px_1px_rgba(0,0,0,1)]" : ""}>
    {row.original.displayName}
  </span>
  {row.original.siteCode && (
    <span className={`text-xs mt-1 ${isSelected ? "text-white drop-shadow-[0_3px_3px_rgba(0,0,0,1)]" : "text-gray-300"}`}>
      {row.original.siteCode}
    </span>
  )}
</div>
      )
    }
  ], []);

  const getVendorBadgeColor = (vendor) => {
    const v = vendor?.toLowerCase() || '';
    
    if (v.includes('ruijie')) return 'bg-blue-500 text-white';
    if (v === 'huawei') return 'bg-red-500 text-white';
    
    return 'bg-gray-500 text-white';
  };

  const table = useReactTable({ 
    data: normalizedSites, 
    columns, 
    getCoreRowModel: getCoreRowModel() 
  });

  const handleRowClick = (siteId) => {
    onSiteSelect(siteId);
  };

  return (
    <div className="w-full h-full bg-white/10 p-4 rounded-xl shadow-lg flex flex-col">
      {/* Header with title and search bar - UPDATED */}
      <div className="flex flex-col mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold">Site List</h2>
          
          {/* Sync Button - Always visible now */}
          <div className="flex items-center space-x-2">
            {syncMessage && (
              <div className={`text-xs px-2 py-1 rounded ${
                syncMessage.type === 'success' 
                  ? 'bg-green-500/20 text-green-400' 
                  : syncMessage.type === 'warning'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {syncMessage.text}
              </div>
            )}
            <button
              onClick={onSync}
              disabled={syncing || loading}
              className={`relative group overflow-hidden flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all active:scale-95 text-white shadow-xl ${
                syncing 
                  ? 'bg-slate-800 opacity-60 cursor-not-allowed' 
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
              title="Refresh sites from external APIs"
            >
              {/* The Aesthetic Bottom Accent Bar */}
              <div className={`absolute bottom-0 left-0 w-full h-[2px] flex transition-opacity duration-300 ${syncing ? 'opacity-0' : 'opacity-100'}`}>
                <div className="w-1/2 h-full bg-red-500 shadow-[0_-4px_10px_rgba(239,68,68,0.5)]" />
                <div className="w-1/2 h-full bg-blue-500 shadow-[0_-4px_10px_rgba(59,130,246,0.5)]" />
              </div>

              <RefreshCw 
                size={16} 
                className={`transition-transform duration-700 ${
                  syncing ? 'animate-spin' : 'group-hover:rotate-180'
                }`} 
              />
              
              <span className="relative z-10">Sync Sites</span>

              {/* Subtle Glow Effect on Hover */}
              {!syncing && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r from-red-500 to-blue-500 pointer-events-none" />
              )}
            </button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search sites (name, code, or vendor)..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        
        {/* Search results count */}
        {searchTerm && !loading && (
          <div className="text-sm text-gray-400 mt-2">
            Found {filteredSites.length} site{filteredSites.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
            <p className="text-gray-400">
              {syncing ? 'Refreshing sites from external APIs...' : 'Loading sites...'}
            </p>
            {syncing && (
              <p className="text-xs text-gray-500 mt-2">
                This may take a few moments...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-4 bg-red-500/20 rounded-lg border border-red-500/30"
          >
            <p className="text-red-400 font-medium mb-2">Error Loading Sites</p>
            <p className="text-red-300 text-sm">{error}</p>
          </motion.div>
        </div>
      )}

      {/* Site List Table - Scrollable Container */}
      {!loading && !error && (
        <div className="overflow-y-auto max-h-[800px] flex-1">
          <table className="min-w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-white/20">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-3 py-2 text-left text-gray-200 sticky top-0 bg-blue/80 backdrop-blur-sm z-10">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, index) => {
                const isSelected = selectedSite === row.original.siteId;
                const rowBg = index % 2 === 0 ? "bg-white/10" : "bg-white/5";
                
                return (
                  <tr
               key={row.original.siteId}
                onClick={() => handleRowClick(row.original.siteId)}
                className={`cursor-pointer transition-all duration-300 border-l-4 ${
                 isSelected ? "border-white" : "border-transparent"
                } ${rowBg} ${
                 isSelected 
                ? "bg-green-500 text-white font-semibold scale-[1.04] ring-1 ring-gray-300/50 shadow-lg" 
                : "text-white"
                } hover:bg-white/20`}
                  > 
                    <td className="px-3 py-2">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span>{row.original.displayName}</span>
                          {row.original.siteCode && (
                            <span className="text-xs text-gray-300 mt-1">{row.original.siteCode}</span>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getVendorBadgeColor(row.original.vendor)}`}>
                          {row.original.vendor}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Empty State */}
          {normalizedSites.length === 0 && !loading && (
            <div className="text-center text-gray-400 py-8">
              {searchTerm ? 'No sites found matching your search' : 'No sites available'}
            </div>
          )}
        </div>
      )}

      {/* Footer Stats */}
      {!loading && !error && normalizedSites.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20 text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Total Sites: {sites.length}</span>
            <span>Showing: {normalizedSites.length}</span>
            <span>Selected: {selectedSite ? '1' : 'None'}</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <span>Click Refresh button to sync sites from external APIs</span>
          </div>
        </div>
      )}
    </div>
  );
}
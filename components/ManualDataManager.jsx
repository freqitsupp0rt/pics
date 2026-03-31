'use client';

import { useState, useEffect, useRef } from "react";
import { 
  Search, Edit, Trash2, Plus, Calendar, Download, Upload, 
  FileSpreadsheet, RefreshCw, Filter, AlertCircle, CheckSquare,
  Square, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  X
} from "lucide-react";
import dayjs from "dayjs";
import CSVPreviewModal from "./Modals/CSVPreviewModal";
import Swal from "sweetalert2";

export default function ManualDataManager() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [dataType, setDataType] = useState("users");
  
  const [manualData, setManualData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Batch selection
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;
  
  const [editMode, setEditMode] = useState(false);
  const [currentData, setCurrentData] = useState({
    id: null,
    site_id: "",
    date: dayjs().format('YYYY-MM-DD'),
    data_type: "users",
    total_users: 0,
    active_users: 0,
    download_bytes: 0,
    upload_bytes: 0,
    notes: ""
  });

  // Search states for site dropdowns
  const [filterSiteSearch, setFilterSiteSearch] = useState("");
  const [formSiteSearch, setFormSiteSearch] = useState("");
  
  // Dropdown visibility states
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [formDropdownOpen, setFormDropdownOpen] = useState(false);

  // New states for CSV Preview
  const [csvPreviewData, setCsvPreviewData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [showCsvPreviewModal, setShowCsvPreviewModal] = useState(false);

  const token = localStorage.getItem('token');
  const fileInputRef = useRef(null);
  
  // Refs for dropdown containers
  const filterDropdownRef = useRef(null);
  const formDropdownRef = useRef(null);

  const BYTES_PER_GB = 1024 * 1024 * 1024;

  // Fetch sites on component mount
  useEffect(() => {
    fetchSites();
  }, []);

  // Fetch manual data when filters change
  useEffect(() => {
    if (selectedSite) {
      fetchManualData();
    }
  }, [currentPage, selectedSite, startDate, endDate, dataType]);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedItems([]);
    setSelectAll(false);
  }, [manualData]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterDropdownOpen(false);
      }
      if (formDropdownRef.current && !formDropdownRef.current.contains(event.target)) {
        setFormDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchSites = async () => {
    try {
      const res = await fetch("/api/sites", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      
      const sitesWithIds = (data.data || []).map((site, index) => ({
        ...site,
        uniqueId: site.id || site.siteId || site.groupId || `site-${index}`
      }));
      
      setSites(sitesWithIds);
    } catch (err) {
      console.error("Failed to fetch sites", err);
      setError("Failed to load sites");
    }
  };

  // Filtered sites for dropdowns
  const getFilteredFilterSites = () => {
    return sites.filter(site => 
      site.name.toLowerCase().includes(filterSiteSearch.toLowerCase()) ||
      (site.description && site.description.toLowerCase().includes(filterSiteSearch.toLowerCase()))
    );
  };

  const getFilteredFormSites = () => {
    return sites.filter(site => 
      site.name.toLowerCase().includes(formSiteSearch.toLowerCase()) ||
      (site.description && site.description.toLowerCase().includes(formSiteSearch.toLowerCase()))
    );
  };

  // Fetch manual data with pagination
  const fetchManualData = async () => {
    if (!selectedSite) return;

    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        siteId: selectedSite,
        startDate: startDate,
        endDate: endDate,
        dataType: dataType,
        page: currentPage.toString(),
        limit: pageSize.toString()
      });

      const res = await fetch(`/api/manual-data?${params}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      
      if (data.success) {
        setManualData(data.data || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalItems(data.pagination?.total || 0);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error("Failed to fetch manual data", err);
      setError(err.message);
      setManualData([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle form submit (create/update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!currentData.site_id || !currentData.date) {
      setError("Please fill all required fields");
      return;
    }

    const method = editMode ? "PUT" : "POST";
    const url = "/api/manual-data";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...(editMode ? { id: currentData.id } : {}),
          site_id: currentData.site_id,
          date: currentData.date,
          data_type: currentData.data_type,
          total_users: currentData.total_users,
          active_users: currentData.active_users,
          download_bytes: Math.round(parseFloat(currentData.download_gb || 0) * BYTES_PER_GB),
          upload_bytes: Math.round(parseFloat(currentData.upload_gb || 0) * BYTES_PER_GB),
          notes: currentData.notes
        })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        await Swal.fire({
          title: 'Success!',
          text: editMode ? 'Data updated successfully' : 'Data added successfully',
          icon: 'success',
          confirmButtonText: 'OK',
          timer: 2000,
          timerProgressBar: true
        });
        resetForm();
        fetchManualData();
      } else {
        throw new Error(data.error || 'Failed to save data');
      }
    } catch (err) {
      console.error("Error saving data", err);
      setError(err.message);
    }
  };

  // Edit data
  const handleEdit = (data) => {
    setEditMode(true);
    setCurrentData({
      id: data.id,
      site_id: data.site_id,
      date: dayjs(data.date).format("YYYY-MM-DD"),
      data_type: data.data_type,
      total_users: data.total_users || 0,
      active_users: data.active_users || 0,
      download_bytes: data.download_bytes || 0,
      upload_bytes: data.upload_bytes || 0,
      download_gb: (data.download_bytes / BYTES_PER_GB).toFixed(2),
      upload_gb: (data.upload_bytes / BYTES_PER_GB).toFixed(2),
      notes: data.notes || ""
    });
    
    // Scroll to form
    document.getElementById('data-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Delete single data item
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setError(null);
    
    try {
      const res = await fetch(`/api/manual-data?id=${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        await Swal.fire({
          title: 'Deleted!',
          text: 'Data has been deleted.',
          icon: 'success',
          timer: 1500,
          timerProgressBar: true
        });
        fetchManualData();
      } else {
        throw new Error(data.error || 'Failed to delete data');
      }
    } catch (err) {
      console.error("Error deleting data", err);
      setError(err.message);
    }
  };

  // Batch delete selected items
  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {
      await Swal.fire({
        title: 'No Selection',
        text: 'Please select items to delete.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    const result = await Swal.fire({
      title: `Delete ${selectedItems.length} items?`,
      text: "This action cannot be undone!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: `Yes, delete ${selectedItems.length} items`,
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/manual-data/batch", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedItems })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        await Swal.fire({
          title: 'Success!',
          text: `Successfully deleted ${selectedItems.length} items`,
          icon: 'success',
          timer: 2000,
          timerProgressBar: true
        });
        setSelectedItems([]);
        setSelectAll(false);
        fetchManualData();
      } else {
        throw new Error(data.error || 'Failed to delete items');
      }
    } catch (err) {
      console.error("Error batch deleting data", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle individual selection
  const toggleSelection = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(manualData.filter(item => item.id).map(item => item.id));
    }
    setSelectAll(!selectAll);
  };

  // Reset form
  const resetForm = () => {
    setEditMode(false);
    setCurrentData({
      id: null,
      site_id: selectedSite || "",
      date: dayjs().format('YYYY-MM-DD'),
      data_type: "users",
      total_users: 0,
      active_users: 0,
      download_bytes: 0,
      upload_bytes: 0,
      download_gb: "",
      upload_gb: "",
      notes: ""
    });
    setFormSiteSearch("");
  };

  // Clear filter site search
  const clearFilterSearch = () => {
    setFilterSiteSearch("");
    setFilterDropdownOpen(true);
  };

  // Clear form site search
  const clearFormSearch = () => {
    setFormSiteSearch("");
    setFormDropdownOpen(true);
  };

  // Select site in filter
  const handleFilterSiteSelect = (siteName) => {
    setSelectedSite(siteName);
    setFilterDropdownOpen(false);
    setFilterSiteSearch("");
  };

  // Select site in form
  const handleFormSiteSelect = (siteName) => {
    setCurrentData({...currentData, site_id: siteName});
    setFormDropdownOpen(false);
    setFormSiteSearch("");
  };

  // Export to CSV
  const exportToCSV = () => {
    if (manualData.length === 0) {
      setError("No data to export");
      return;
    }

    const headers = ["Date", "Data Type", "Total Users", "Active Users", "Download (GB)", "Upload (GB)", "Notes"];
    const csvData = manualData.map(item => [
      dayjs(item.date).format("YYYY-MM-DD"),
      item.data_type,
      item.total_users,
      item.active_users,
      (item.download_bytes / BYTES_PER_GB).toFixed(2),
      (item.upload_bytes / BYTES_PER_GB).toFixed(2),
      `"${(item.notes || "").replace(/"/g, '""')}"` // Escape quotes in CSV
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manual-data-${dayjs().format("YYYY-MM-DD-HH-mm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    Swal.fire({
      title: 'Export Complete!',
      text: `${manualData.length} records exported successfully`,
      icon: 'success',
      timer: 1500,
      timerProgressBar: true
    });
  };

  const confirmCsvImport = async () => {
    setLoading(true);
    setError(null);
    setShowCsvPreviewModal(false);

    try {
      const lowerCaseHeaders = csvHeaders.map(h => h.toLowerCase());
      const headerMapping = {
        'date': 'date',
        'data type': 'data_type',
        'total users': 'total_users',
        'active users': 'active_users',
        'download (gb)': 'download_gb',
        'upload (gb)': 'upload_gb',
        'download (bytes)': 'download_bytes_raw',
        'upload (bytes)': 'upload_bytes_raw',
        'notes': 'notes'
      };

      const importData = [];

      for (let i = 0; i < csvPreviewData.length; i++) {
        const columns = csvPreviewData[i];
        if (!columns || columns.length === 0 || columns.every(c => !c)) continue;

        const rowData = {};
        columns.forEach((value, index) => {
          if (index < lowerCaseHeaders.length) {
            const originalHeader = lowerCaseHeaders[index];
            const mappedField = headerMapping[originalHeader];
            if (mappedField) {
              rowData[mappedField] = value;
            }
          }
        });

        if (!rowData.date || !rowData.data_type) {
          console.warn(`Skipping row ${i}: missing date or data_type`, rowData);
          continue;
        }

        try {
          const dateParts = rowData.date.split('/');
          if (dateParts.length === 3) {
            const month = dateParts[0].padStart(2, '0');
            const day = dateParts[1].padStart(2, '0');
            const year = dateParts[2];
            rowData.date = `${year}-${month}-${day}`;
          }
        } catch (err) {
          console.warn(`Failed to parse date: ${rowData.date}`, err);
          continue;
        }

        const numericFields = ['total_users', 'active_users'];
        numericFields.forEach(field => {
          if (rowData[field] !== undefined && rowData[field] !== '') {
            const numValue = parseInt(String(rowData[field]).replace(/,/g, ''));
            rowData[field] = isNaN(numValue) ? 0 : numValue;
          } else {
            rowData[field] = 0;
          }
        });

        if (rowData.download_gb !== undefined && rowData.download_gb !== '') {
          const gbValue = parseFloat(String(rowData.download_gb).replace(/,/g, ''));
          rowData.download_bytes = isNaN(gbValue) ? 0 : Math.round(gbValue * BYTES_PER_GB);
        } else if (rowData.download_bytes_raw !== undefined && rowData.download_bytes_raw !== '') {
          const bytesValue = parseFloat(String(rowData.download_bytes_raw).replace(/,/g, ''));
          rowData.download_bytes = isNaN(bytesValue) ? 0 : Math.round(bytesValue);
        } else {
          rowData.download_bytes = 0;
        }

        if (rowData.upload_gb !== undefined && rowData.upload_gb !== '') {
          const gbValue = parseFloat(String(rowData.upload_gb).replace(/,/g, ''));
          rowData.upload_bytes = isNaN(gbValue) ? 0 : Math.round(gbValue * BYTES_PER_GB);
        } else if (rowData.upload_bytes_raw !== undefined && rowData.upload_bytes_raw !== '') {
          const bytesValue = parseFloat(String(rowData.upload_bytes_raw).replace(/,/g, ''));
          rowData.upload_bytes = isNaN(bytesValue) ? 0 : Math.round(bytesValue);
        } else {
          rowData.upload_bytes = 0;
        }

        delete rowData.download_gb;
        delete rowData.upload_gb;
        delete rowData.download_bytes_raw;
        delete rowData.upload_bytes_raw;

        rowData.data_type = (rowData.data_type || 'users').toLowerCase();
        rowData.site_id = selectedSite;

        importData.push(rowData);
      }

      if (importData.length === 0) {
        throw new Error("No valid data to import after processing.");
      }

      const res = await fetch("/api/manual-data/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ data: importData })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        await Swal.fire({
          title: 'Import Successful!',
          text: `Successfully imported ${result.results?.length || importData.length} records`,
          icon: 'success',
          timer: 2000,
          timerProgressBar: true
        });
        fetchManualData();
      } else {
        throw new Error(result.error || 'Import failed on the server.');
      }
    } catch (err) {
      console.error("Confirm Import error", err);
      await Swal.fire({
        title: 'Import Failed',
        text: err.message,
        icon: 'error'
      });
      setError(`Import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError("Please upload a CSV file");
      return;
    }

    if (!selectedSite) {
      Swal.fire({
        title: 'Site Required',
        text: 'Please select a site before importing CSV',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      e.target.value = null;
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvText = event.target.result;
          const rows = csvText.split("\n").filter(row => row.trim());

          if (rows.length < 2) {
            throw new Error("CSV file is empty or has no data rows");
          }

          const hasTabs = rows[0].includes('\t');
          const delimiter = hasTabs ? '\t' : ',';

          const headers = rows[0].split(delimiter).map(h => h.trim());
          const dataRows = rows.slice(1).map(row => {
            let columns;
            if (delimiter === '\t') {
              columns = row.split('\t').map(col => col.trim());
            } else {
              columns = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(col => col.replace(/^"|"$/g, '').trim()) || 
                      row.split(',').map(col => col.trim());
            }
            return columns;
          });

          setCsvHeaders(headers);
          setCsvPreviewData(dataRows);
          setShowCsvPreviewModal(true);

        } catch (err) {
          console.error("Import processing error", err);
          await Swal.fire({
            title: 'Import Failed',
            text: err.message,
            icon: 'error',
            confirmButtonText: 'OK'
          });
          setError(`Import failed: ${err.message}`);
        } finally {
          setLoading(false);
          e.target.value = null;
        }
      };

      reader.onerror = () => {
        setError("Failed to read file");
        setLoading(false);
        e.target.value = null;
      };

      reader.readAsText(file);
    } catch (err) {
      console.error("Import error", err);
      setError(err.message);
      setLoading(false);
      e.target.value = null;
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Handle pagination
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Clear filters
  const clearFilters = async () => {
    if (selectedItems.length > 0) {
      const result = await Swal.fire({
        title: 'Clear Filters?',
        text: 'You have selected items. Clearing filters will deselect them.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Clear Anyway',
        cancelButtonText: 'Cancel'
      });

      if (!result.isConfirmed) return;
    }

    setSelectedSite("");
    setStartDate(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
    setEndDate(dayjs().format('YYYY-MM-DD'));
    setDataType("users");
    setCurrentPage(1);
    setSelectedItems([]);
    setSelectAll(false);
    setFilterSiteSearch("");
  };

  return (
    <main className="p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Manual Data Manager</h1>
            <p className="text-gray-300">Manage manual entries for reports data</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-400" />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="ml-auto text-red-300 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Search/Filter Section */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Filter size={20} />
              Filter Data
            </h2>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Site Dropdown with Search - Filter Section */}
            <div className="relative" ref={filterDropdownRef}>
              <label className="block text-sm font-medium mb-2">Site</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex justify-between items-center"
                >
                  <span className="truncate">
                    {selectedSite || "Select Site"}
                  </span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {filterDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-gray-600">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={filterSiteSearch}
                          onChange={(e) => setFilterSiteSearch(e.target.value)}
                          placeholder="Search sites..."
                          className="w-full pl-9 pr-8 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        {filterSiteSearch && (
                          <button
                            onClick={clearFilterSearch}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Site List */}
                    <div className="overflow-y-auto max-h-48">
                      {getFilteredFilterSites().length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                          No sites found
                        </div>
                      ) : (
                        getFilteredFilterSites().map(site => (
                          <button
                            key={`filter-${site.uniqueId}`}
                            type="button"
                            onClick={() => handleFilterSiteSelect(site.name)}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-600 ${selectedSite === site.name ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                          >
                            <div className="font-medium">{site.name}</div>
                            {site.description && (
                              <div className="text-xs text-gray-400 truncate">{site.description}</div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Data Type</label>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="users">Users Data</option>
                <option value="traffic">Traffic Data</option>
                <option value="all">All Data</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={fetchManualData}
              disabled={loading || !selectedSite}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Loading...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Search Data
                </>
              )}
            </button>
            
            <button
              onClick={exportToCSV}
              disabled={manualData.length === 0}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium flex items-center gap-2"
            >
              <Download size={18} />
              Export CSV
            </button>

            <label className="px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium flex items-center gap-2 cursor-pointer disabled:bg-gray-700 disabled:cursor-not-allowed">
              <Upload size={18} />
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
                disabled={!selectedSite || loading}
                ref={fileInputRef}
              />
            </label>
          </div>
        </div>

        {/* Batch Actions Bar */}
        {selectedItems.length > 0 && (
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="text-blue-400" size={20} />
              <span className="font-medium">
                {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <button
              onClick={handleBatchDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg font-medium flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete Selected
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-1" id="data-form">
            <div className="bg-gray-800 rounded-xl p-6 sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editMode ? "Edit Data" : "Add New Data"}
                </h2>
                {editMode && (
                  <button
                    onClick={resetForm}
                    className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Site Dropdown with Search - Form Section */}
                <div className="relative" ref={formDropdownRef}>
                  <label className="block text-sm font-medium mb-1">Site *</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setFormDropdownOpen(!formDropdownOpen)}
                      disabled={editMode}
                      className={`w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex justify-between items-center ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="truncate">
                        {sites.find(s => s.name === currentData.site_id)?.name || "Select Site"}
                      </span>
                      <svg 
                        className={`w-4 h-4 transition-transform ${formDropdownOpen ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {formDropdownOpen && !editMode && (
                      <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-2 border-b border-gray-600">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="text"
                              value={formSiteSearch}
                              onChange={(e) => setFormSiteSearch(e.target.value)}
                              placeholder="Search sites..."
                              className="w-full pl-9 pr-8 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                            {formSiteSearch && (
                              <button
                                onClick={clearFormSearch}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Site List */}
                        <div className="overflow-y-auto max-h-48">
                          {getFilteredFormSites().length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm">
                              No sites found
                            </div>
                          ) : (
                            getFilteredFormSites().map(site => (
                              <button
                                key={`form-${site.uniqueId}`}
                                type="button"
                                onClick={() => handleFormSiteSelect(site.name)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-600 ${currentData.site_id === site.name ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                              >
                                <div className="font-medium">{site.name}</div>
                                {site.description && (
                                  <div className="text-xs text-gray-400 truncate">{site.description}</div>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    value={currentData.date}
                    onChange={(e) => setCurrentData({...currentData, date: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={editMode}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Data Type *</label>
                  <select
                    value={currentData.data_type}
                    onChange={(e) => setCurrentData({...currentData, data_type: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={editMode}
                  >
                    <option value="users">Users</option>
                    <option value="traffic">Traffic</option>
                  </select>
                </div>

                {currentData.data_type === "users" ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Total Users</label>
                      <input
                        type="number"
                        min="0"
                        value={currentData.total_users}
                        onChange={(e) => setCurrentData({...currentData, total_users: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Active Users</label>
                      <input
                        type="number"
                        min="0"
                        value={currentData.active_users}
                        onChange={(e) => setCurrentData({...currentData, active_users: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Download (GB)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentData.download_gb || ""}
                        onChange={(e) => {
                          const gb = e.target.value;
                          const bytes = Math.round((parseFloat(gb) || 0) * BYTES_PER_GB);
                          setCurrentData({...currentData, download_gb: gb, download_bytes: bytes});
                        }}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        {formatBytes(currentData.download_bytes)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Upload (GB)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentData.upload_gb || ""}
                        onChange={(e) => {
                          const gb = e.target.value;
                          const bytes = Math.round((parseFloat(gb) || 0) * BYTES_PER_GB);
                          setCurrentData({...currentData, upload_gb: gb, upload_bytes: bytes});
                        }}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        {formatBytes(currentData.upload_bytes)}
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={currentData.notes || ""}
                    onChange={(e) => setCurrentData({...currentData, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Add any notes about this data entry..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
                >
                  {editMode ? "Update Data" : "Add Data"}
                </button>
              </form>
            </div>
          </div>

          {/* Data Table Section */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Manual Data Entries</h2>
                  <div className="text-sm text-gray-300">
                    {loading ? (
                      "Loading..."
                    ) : (
                      `Showing ${manualData.length} of ${totalItems} entries`
                    )}
                  </div>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded"
                      title="First Page"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded"
                      title="Previous Page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded"
                      title="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded"
                      title="Last Page"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="mx-auto mb-4 animate-spin" size={48} />
                  <p className="text-gray-400">Loading data...</p>
                </div>
              ) : manualData.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileSpreadsheet className="mx-auto mb-4" size={48} />
                  <p>No manual data found for the selected criteria</p>
                  <p className="text-sm mt-2">Select a site and date range, then click "Search Data"</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-750">
                          <th className="text-left py-3 px-4 font-medium w-12">
                            <button
                              onClick={toggleSelectAll}
                              className="p-1 hover:bg-gray-600 rounded"
                              title={selectAll ? "Deselect all" : "Select all"}
                            >
                              {selectAll ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                          </th>
                          <th className="text-left py-3 px-4 font-medium">Date</th>
                          <th className="text-left py-3 px-4 font-medium">Type</th>
                          <th className="text-left py-3 px-4 font-medium">Total Users</th>
                          <th className="text-left py-3 px-4 font-medium">Active Users</th>
                          <th className="text-left py-3 px-4 font-medium">Download</th>
                          <th className="text-left py-3 px-4 font-medium">Upload</th>
                          <th className="text-left py-3 px-4 font-medium">Notes</th>
                          <th className="text-left py-3 px-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualData.map((item) => (
                          <tr 
                            key={`data-${item.id || item.date}-${item.site_id}`}
                            className="border-t border-gray-700 hover:bg-gray-750/50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => toggleSelection(item.id)}
                                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">
                                {dayjs(item.date).format("MMM D, YYYY")}
                              </div>
                              <div className="text-xs text-gray-400">
                                {dayjs(item.date).format("dddd")}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.data_type === 'users' 
                                  ? 'bg-blue-900/30 text-blue-300 border border-blue-700' 
                                  : 'bg-purple-900/30 text-purple-300 border border-purple-700'
                              }`}>
                                {item.data_type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{item.total_users || 0}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{item.active_users || 0}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{formatBytes(item.download_bytes)}</div>
                              <div className="text-xs text-gray-400">
                                {item.download_bytes > 0 ? `${item.download_bytes.toLocaleString()} bytes` : '-'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{formatBytes(item.upload_bytes)}</div>
                              <div className="text-xs text-gray-400">
                                {item.upload_bytes > 0 ? `${item.upload_bytes.toLocaleString()} bytes` : '-'}
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <div className="truncate" title={item.notes}>
                                {item.notes || '-'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination footer */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-700">
                      <div className="text-sm text-gray-400">
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Go to page:</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={currentPage}
                          onChange={(e) => {
                            const page = parseInt(e.target.value);
                            if (page >= 1 && page <= totalPages) {
                              handlePageChange(page);
                            }
                          }}
                          className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <CSVPreviewModal
          isOpen={showCsvPreviewModal}
          onClose={() => setShowCsvPreviewModal(false)}
          onConfirm={confirmCsvImport}
          headers={csvHeaders}
          data={csvPreviewData}
          siteName={sites.find(s => s.name === selectedSite)?.name || 'Unknown Site'}
          isImporting={loading}
        />
      </div>
    </main>
  );
}
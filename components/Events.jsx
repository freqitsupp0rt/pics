'use client';

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit2,
  CheckCircle,
  RefreshCw,
  MapPin,
  Building,
  Wifi,
  EyeOff,
  Loader2
} from "lucide-react";

import EventModal from '@/components/Modals/EventModal';
import DeleteModal from '@/components/Modals/DeleteModal';
import EventCard from '@/components/Cards/EventCard';

export default function EventsPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deletingMultipleEvents, setDeletingMultipleEvents] = useState(false);
  const [selectedSites, setSelectedSites] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [expandedSite, setExpandedSite] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("add");
  const [formData, setFormData] = useState({
    id: null,
    site_ids: [],
    event: "",
    start: "",
    end: "",
    image: ""
  });
  const [formErrors, setFormErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const token = localStorage.getItem('token');

  const fetchSites = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sites", {
        headers: {
          "Authorization": `Bearer ${token}`,
        }
      });
      if (!res.ok) throw new Error("Failed to fetch sites");
      const data = await res.json();
      
      const normalized = (data.data || [])
        .filter(site => site.vendor === "Huawei" || site.vendor?.toLowerCase().includes("ruijie"))
        .map(site => {
          // Create an array of all possible IDs for this site
          const possibleIds = [];
          
          // Add all possible ID fields
          if (site.id) possibleIds.push(site.id.toString());
          if (site.groupId) possibleIds.push(site.groupId.toString());
          if (site.siteId) possibleIds.push(site.siteId.toString());
          
          // Remove duplicates
          const uniqueIds = [...new Set(possibleIds)];
          
          // Use the first ID as the main ID
          const mainId = uniqueIds[0] || 'unknown';
          
          return {
            id: mainId,
            originalId: site.id,
            groupId: site.groupId,
            siteId: site.siteId,
            name: site.name || "Unnamed Site",
            vendor: site.vendor || "Unknown",
            latitude: parseFloat(site.latitude || site.lat || 11.0),
            longitude: parseFloat(site.longitude || site.lon || 125.0),
            description: site.description || "",
            selected: false,
            hasEvents: false,
            eventCount: 0, // Initialize eventCount
            // Store all possible IDs for matching
            allPossibleIds: uniqueIds
          };
        });
      
      console.log('Normalized sites:', normalized);
      setSites(normalized);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setEventsLoading(true);
      const res = await fetch("/api/events", {
        headers: {
          "Authorization": `Bearer ${token}`,
        }
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      console.log('Raw events data:', data.data);
      setEvents(data.data || []);
      
      // Update sites with hasEvents flag
      setSites(prev => prev.map(site => {
        let hasEvents = false;
        let eventCount = 0;
        
        // Check if any event matches this site
        if (data.data && data.data.length > 0) {
          data.data.forEach(event => {
            const eventSiteId = event.site_id?.toString();
            
            // If site has an array of all possible IDs, check against all of them
            if (site.allPossibleIds && site.allPossibleIds.length > 0) {
              if (site.allPossibleIds.some(id => 
                id === eventSiteId || 
                id === event.groupId?.toString() || 
                id === event.siteId?.toString()
              )) {
                hasEvents = true;
                eventCount++;
              }
            } else {
              // Fallback to individual checks
              if (site.vendor === "Huawei") {
                if (eventSiteId === site.groupId?.toString() ||
                    event.groupId?.toString() === site.groupId?.toString() ||
                    eventSiteId === site.id?.toString()) {
                  hasEvents = true;
                  eventCount++;
                }
              } else if (site.vendor?.toLowerCase().includes("ruijie")) {
                if (eventSiteId === site.groupId?.toString() ||
                    event.groupId?.toString() === site.groupId?.toString() ||
                    eventSiteId === site.siteId?.toString() ||
                    event.siteId?.toString() === site.siteId?.toString() ||
                    eventSiteId === site.id?.toString()) {
                  hasEvents = true;
                  eventCount++;
                }
              } else if (eventSiteId === site.id?.toString()) {
                hasEvents = true;
                eventCount++;
              }
            }
          });
        }
        
        console.log(`Site ${site.name} (${site.vendor}): hasEvents=${hasEvents}, count=${eventCount}`);
        
        return {
          ...site,
          hasEvents,
          eventCount // Add eventCount to track how many events
        };
      }));
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
    fetchEvents();
  }, []);

  // Add this useEffect to see what data you're working with
  useEffect(() => {
    if (events.length > 0 && sites.length > 0) {
      console.log('=== DEBUGGING EVENTS/SITES MATCHING ===');
      
      // Log Huawei sites and events
      const HuaweiSites = sites.filter(s => s.vendor === "Huawei");
      console.log('Huawei Sites:', HuaweiSites);
      
      const HuaweiEvents = events.filter(e => e.vendor === "Huawei");
      console.log('Huawei Events:', HuaweiEvents);
      
      // Check each Huawei site for matching events
      HuaweiSites.forEach(site => {
        const matchingEvents = HuaweiEvents.filter(event => {
          return event.site_id === site.groupId || 
                event.groupId === site.groupId ||
                event.site_id === site.id ||
                event.site_id === site.siteId;
        });
      });
    }
  }, [events, sites]);

  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      const matchesSearch = !searchTerm || 
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVendor = vendorFilter === "all" || site.vendor === vendorFilter;
      let matchesEvent = true;
      if (eventTypeFilter === "with_events") {
        matchesEvent = site.hasEvents;
      } else if (eventTypeFilter === "without_events") {
        matchesEvent = !site.hasEvents;
      }
      return matchesSearch && matchesVendor && matchesEvent;
    });
  }, [sites, searchTerm, vendorFilter, eventTypeFilter]);

  const filteredEvents = useMemo(() => {
    if (selectedSites.length === 0) return events;
    
    return events.filter(event => {
      // Check if event matches any selected site
      return selectedSites.some(siteId => {
        const site = sites.find(s => s.id === siteId);
        if (!site) return false;
        
        const eventSiteId = event.site_id?.toString();
        
        // If site has an array of all possible IDs, check against all of them
        if (site.allPossibleIds && site.allPossibleIds.length > 0) {
          return site.allPossibleIds.some(id => 
            id === eventSiteId || 
            id === event.groupId?.toString() || 
            id === event.siteId?.toString()
          );
        }
        
        // Vendor-specific matching
        if (site.vendor === "Huawei") {
          return eventSiteId === site.groupId?.toString() ||
                event.groupId?.toString() === site.groupId?.toString() ||
                eventSiteId === site.id?.toString();
        } else if (site.vendor?.toLowerCase().includes("ruijie")) {
          return eventSiteId === site.groupId?.toString() ||
                event.groupId?.toString() === site.groupId?.toString() ||
                eventSiteId === site.siteId?.toString() ||
                event.siteId?.toString() === site.siteId?.toString() ||
                eventSiteId === site.id?.toString();
        }
        return eventSiteId === site.id?.toString();
      });
    });
  }, [events, selectedSites, sites]);

  const toggleSiteSelection = (siteId) => {
    setSelectedSites(prev => {
      if (prev.includes(siteId)) {
        return prev.filter(id => id !== siteId);
      } else {
        return [...prev, siteId];
      }
    });
  };

  const selectAllSites = () => {
    const allIds = filteredSites.map(site => site.id);
    setSelectedSites(allIds);
  };

  const clearSelections = () => {
    setSelectedSites([]);
    setSelectedEvent(null);
  };

  const toggleSiteExpansion = (siteId) => {
    if (expandedSite === siteId) {
      setExpandedSite(null);
    } else {
      setExpandedSite(siteId);
    }
  };

  const openAddModal = () => {
    setModalType("add");
    setFormData({
      id: null,
      site_ids: selectedSites.length > 0 ? [...selectedSites] : [],
      event: "",
      start: new Date().toISOString().slice(0, 16),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
      image: ""
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setModalType("edit");
    
    // Find the correct site ID for this event
    const eventSite = sites.find(site => {
      if (event.vendor === "Huawei") {
        return site.groupId === event.site_id || site.id === event.site_id;
      } else if (event.vendor?.toLowerCase().includes("ruijie")) {
        return site.groupId === event.site_id || site.id === event.site_id;
      }
      return site.id === event.site_id;
    });
    
    setFormData({
      id: event.id,
      site_ids: eventSite ? [eventSite.id] : [event.site_id],
      event: event.event,
      start: new Date(event.start).toISOString().slice(0, 16),
      end: new Date(event.end).toISOString().slice(0, 16),
      image: event.image || ""
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openDeleteModal = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const toggleSiteInForm = (siteId) => {
    setFormData(prev => {
      const currentIds = [...prev.site_ids];
      const index = currentIds.indexOf(siteId);
      if (index > -1) {
        currentIds.splice(index, 1);
      } else {
        currentIds.push(siteId);
      }
      return {
        ...prev,
        site_ids: currentIds
      };
    });
    if (formErrors.site_ids) {
      setFormErrors(prev => ({
        ...prev,
        site_ids: ""
      }));
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image size should be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result;
      setFormData(prev => ({
        ...prev,
        image: base64String
      }));
      if (formErrors.image) {
        setFormErrors(prev => ({
          ...prev,
          image: ""
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      image: ""
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (formData.site_ids.length === 0) {
      errors.site_ids = "Please select at least one site";
    }
    if (!formData.event.trim()) {
      errors.event = "Event description is required";
    }
    if (!formData.start) {
      errors.start = "Start time is required";
    }
    if (!formData.end) {
      errors.end = "End time is required";
    }
    if (formData.start && formData.end) {
      const startTime = new Date(formData.start);
      const endTime = new Date(formData.end);
      if (endTime <= startTime) {
        errors.end = "End time must be after start time";
      }
    }
    return errors;
  };

  const submitForm = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    try {
      setSavingEvent(true);
      let payload;
      
      if (modalType === "add") {
        payload = {
          events: formData.site_ids.map(siteId => {
            const site = sites.find(s => s.id === siteId);
            
            // Use the correct ID based on vendor
            const eventSiteId = site.vendor === "Huawei" ? (site.groupId || site.id) :
                               site.vendor?.toLowerCase().includes("ruijie") ? (site.groupId || site.siteId || site.id) :
                               site.id;
            
            return {
              site_id: eventSiteId,
              event: formData.event,
              start: formData.start,
              end: formData.end,
              vendor: site.vendor || "Unknown",
              image: formData.image
            };
          })
        };
      } else {
        const site = sites.find(s => s.id === formData.site_ids[0]);
        const eventSiteId = site.vendor === "Huawei" ? (site.groupId || site.id) :
                           site.vendor?.toLowerCase().includes("ruijie") ? (site.groupId || site.siteId || site.id) :
                           site.id;
        
        payload = {
          site_id: eventSiteId,
          event: formData.event,
          start: formData.start,
          end: formData.end,
          vendor: site.vendor || "Unknown",
          image: formData.image
        };
      }
      
      const url = modalType === "add" ? "/api/events" : `/api/events/${formData.id}`;
      const method = modalType === "add" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save event");
      }
      await fetchEvents();
      setShowModal(false);
      await Swal.fire({
        title: 'Success!',
        text: `Event ${modalType === "add" ? "added" : "updated"} successfully!`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#fff'
      });
    } catch (err) {
      console.error("Error saving event:", err);
      await Swal.fire({
        title: 'Error!',
        text: err.message || 'Failed to save event. Please try again.',
        icon: 'error',
        background: '#1f2937',
        color: '#fff'
      });
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteEvent = async () => {
    try {
      setDeletingEvent(true);
      const res = await fetch(`/api/events/${deleteId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        }
      });
      if (!res.ok) throw new Error("Failed to delete event");
      fetchEvents();
      setShowDeleteModal(false);
      await Swal.fire({
        title: 'Deleted!',
        text: 'Event deleted successfully!',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#fff'
      });
    } catch (err) {
      console.error("Error deleting event:", err);
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to delete event. Please try again.',
        icon: 'error',
        background: '#1f2937',
        color: '#fff'
      });
    } finally {
      setDeletingEvent(false);
    }
  };

  const deleteMultipleEvents = async () => {
    if (selectedSites.length === 0) {
      await Swal.fire({
        title: 'No Sites Selected',
        text: 'Please select sites to delete events from',
        icon: 'warning',
        background: '#1f2937',
        color: '#fff'
      });
      return;
    }
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `This will delete all events for ${selectedSites.length} selected site(s). This action cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete them!',
      background: '#1f2937',
      color: '#fff',
      customClass: {
        cancelButton: 'bg-gray-600 hover:bg-gray-700 text-white',
        confirmButton: 'bg-red-600 hover:bg-red-700 text-white'
      }
    });
    if (!result.isConfirmed) return;
    try {
      setDeletingMultipleEvents(true);
      
      // Get the actual site IDs (groupId for Huawei, siteId for Omada) to delete
      const siteIdsToDelete = selectedSites.map(siteId => {
        const site = sites.find(s => s.id === siteId);
        if (!site) return null;
        
        if (site.vendor === "Huawei") {
          return site.groupId || site.id;
        } else if (site.vendor?.toLowerCase().includes("ruijie")) {
          return site.groupId || site.id;
        }
        return site.id;
      }).filter(id => id !== null);
      
      const res = await fetch("/api/events/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ site_ids: siteIdsToDelete })
      });
      if (!res.ok) throw new Error("Failed to delete events");
      fetchEvents();
      clearSelections();
      await Swal.fire({
        title: 'Deleted!',
        text: `${selectedSites.length} site(s) events deleted successfully!`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#fff'
      });
    } catch (err) {
      console.error("Error deleting events:", err);
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to delete events. Please try again.',
        icon: 'error',
        background: '#1f2937',
        color: '#fff'
      });
    } finally {
      setDeletingMultipleEvents(false);
    }
  };

  const getVendorColor = (vendor) => {
    const v = vendor?.toLowerCase();
    if (v === "huawei") return "bg-green-500";
    if (v?.includes("ruijie")) return "bg-blue-500";
    return "bg-gray-500";
  };

  const getVendorIcon = (vendor) => {
    const v = vendor?.toLowerCase();
    if (v === "huawei") return <Building className="h-4 w-4" />;
    if (v?.includes("ruijie")) return <Wifi className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (now < start) return "upcoming";
    if (now >= start && now <= end) return "ongoing";
    return "completed";
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (startDate.toDateString() === endDate.toDateString()) {
      return `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    return `${formatDateTime(start)} - ${formatDateTime(end)}`;
  };

  const EventStatusBadge = ({ event }) => {
    const status = getEventStatus(event);
    const config = {
      upcoming: { 
        text: "Upcoming", 
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        icon: <Clock className="h-3 w-3" />
      },
      ongoing: { 
        text: "Ongoing", 
        color: "bg-red-500/20 text-red-400 border-red-500/30",
        icon: <AlertTriangle className="h-3 w-3" />
      },
      completed: { 
        text: "Completed", 
        color: "bg-green-500/20 text-green-400 border-green-500/30",
        icon: <CheckCircle className="h-3 w-3" />
      }
    };
    const { text, color, icon } = config[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${color}`}>
        {icon}
        {text}
      </span>
    );
  };

  const getSiteEvents = (siteId) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return [];
    
    const matchedEvents = events.filter(event => {
      const eventSiteId = event.site_id?.toString();
      
      // If site has an array of all possible IDs, check against all of them
      if (site.allPossibleIds && site.allPossibleIds.length > 0) {
        return site.allPossibleIds.some(id => 
          id === eventSiteId || 
          id === event.groupId?.toString() || 
          id === event.siteId?.toString()
        );
      }
      
      // Fallback to individual checks with better debugging
      console.log(`Checking event for site ${site.name}:`, {
        siteVendor: site.vendor,
        siteGroupId: site.groupId,
        siteSiteId: site.siteId,
        siteId: site.id,
        eventSiteId: event.site_id,
        eventGroupId: event.groupId,
        eventSiteIdProp: event.siteId,
        eventVendor: event.vendor
      });
      
      if (site.vendor === "Huawei") {
        return eventSiteId === site.groupId?.toString() ||
              event.groupId?.toString() === site.groupId?.toString() ||
              eventSiteId === site.id?.toString();
      } else if (site.vendor?.toLowerCase().includes("ruijie")) {
        return eventSiteId === site.groupId?.toString() ||
              event.groupId?.toString() === site.groupId?.toString() ||
              eventSiteId === site.id?.toString();
      }
      return eventSiteId === site.id?.toString();
    });
    return matchedEvents;
  };

  const uniqueVendors = useMemo(() => {
    const vendors = [...new Set(sites.map(site => site.vendor))];
    return vendors.filter(v => v);
  }, [sites]);

  return (
    <main className="p-4 md:p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Events & Blackouts Management</h1>
        <p className="text-sm md:text-base text-gray-300 mt-1">Manage network events, maintenance schedules, and outages</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={openAddModal}
                  disabled={savingEvent || deletingEvent || deletingMultipleEvents}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEvent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {savingEvent ? 'Saving...' : 'Add Event'}
                </button>
                
                {selectedSites.length > 0 && (
                  <button
                    onClick={deleteMultipleEvents}
                    disabled={deletingMultipleEvents || savingEvent || deletingEvent}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingMultipleEvents ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {deletingMultipleEvents ? 'Deleting...' : `Delete Events (${selectedSites.length})`}
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setEventsLoading(true);
                      await fetchSites();
                      await fetchEvents();
                      await Swal.fire({
                        title: 'Refreshed!',
                        text: 'Data refreshed successfully',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        background: '#1f2937',
                        color: '#fff'
                      });
                    } catch (error) {
                      await Swal.fire({
                        title: 'Error!',
                        text: 'Failed to refresh data',
                        icon: 'error',
                        background: '#1f2937',
                        color: '#fff'
                      });
                    } finally {
                      setLoading(false);
                      setEventsLoading(false);
                    }
                  }}
                  disabled={loading || eventsLoading}
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading || eventsLoading ? 'animate-spin' : ''}`} />
                </button>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sites..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-full md:w-64"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Vendor</label>
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Vendors</option>
                  {uniqueVendors.map(vendor => (
                    <option key={`vendor-option-${vendor}`} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-300 mb-1">Event Status</label>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Sites</option>
                  <option value="with_events">With Events</option>
                  <option value="without_events">Without Events</option>
                </select>
              </div>
            </div>
            
            {selectedSites.length > 0 && (
              <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{selectedSites.length} site(s) selected</span>
                    <button
                      onClick={clearSelections}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <button
                    onClick={selectAllSites}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Select all filtered
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 h-[800px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sites ({filteredSites.length})</h2>
              <span className="text-sm text-gray-300">
                Showing {filteredSites.length} of {sites.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`site-skeleton-${i}`} className="animate-pulse p-4 rounded-lg bg-white/5">
                    <div className="h-24 bg-gray-700 rounded-lg"></div>
                  </div>
                ))
              ) : filteredSites.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MapPin className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No sites found</p>
                  {searchTerm && (
                    <p className="text-xs mt-2">Try changing your search or filters</p>
                  )}
                </div>
              ) : filteredSites.map((site) => {
                const siteEvents = getSiteEvents(site.id);
                const isExpanded = expandedSite === site.id;
                const isSelected = selectedSites.includes(site.id);
                
                return (
                  <div
                    key={`site-${site.id}`}
                    className={`rounded-lg border transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/20 bg-white/5"
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleSiteExpansion(site.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSiteSelection(site.id)}
                              className="h-4 w-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-white">{site.name}</h3>
                                {site.hasEvents && (
                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                                    {siteEvents.length} event(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <div className={`p-1 rounded ${getVendorColor(site.vendor)}`}>
                                  {getVendorIcon(site.vendor)}
                                </div>
                                <span>{site.vendor}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <MapPin className="h-3 w-3" />
                                <span>{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAddModal();
                                }}
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                              >
                                Add Event
                              </button>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <div className="overflow-hidden">
                          <div className="px-4 pb-4 border-t border-white/20 pt-4">
                            {siteEvents.length === 0 ? (
                              <div className="text-center py-4 text-gray-400">
                                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No events for this site</p>
                                <button
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      site_ids: [site.id]
                                    }));
                                    setModalType("add");
                                    setShowModal(true);
                                  }}
                                  className="mt-2 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                                >
                                  Add First Event
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <h4 className="font-medium text-sm mb-2">Events for this site:</h4>
                                {siteEvents.map((event) => (
                                  <div
                                    key={`event-${event.id}`}
                                    className={`p-3 rounded-lg border ${
                                      selectedEvent === event.id
                                        ? "border-blue-500 bg-blue-500/10"
                                        : "border-white/10 bg-white/5"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                          <EventStatusBadge event={event} />
                                          <span className="font-medium text-sm">{event.event}</span>
                                        </div>
                                        <div className="text-xs space-y-1">
                                          <div className="flex items-center gap-2 text-gray-300">
                                            <Clock className="h-3 w-3" />
                                            <span>{formatDateRange(event.start, event.end)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => openEditModal(event)}
                                          className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors"
                                          title="Edit"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => openDeleteModal(event.id)}
                                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
            <h2 className="text-lg font-semibold mb-4">Events Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-300">Total Events</p>
                    <p className="text-2xl font-bold">{events.length}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-400" />
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-300">Upcoming</p>
                    <p className="text-2xl font-bold">
                      {events.filter(e => getEventStatus(e) === "upcoming").length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
                </div>
              </div>
              
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-300">Ongoing</p>
                    <p className="text-2xl font-bold">
                      {events.filter(e => getEventStatus(e) === "ongoing").length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-medium mb-3">Events by Vendor</h3>
              <div className="space-y-2">
                {uniqueVendors.map(vendor => {
                  const vendorEvents = events.filter(e => e.vendor === vendor);
                  const percentage = events.length > 0 ? (vendorEvents.length / events.length) * 100 : 0;
                  
                  return (
                    <div key={`vendor-dist-${vendor}`} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${getVendorColor(vendor)}`}></div>
                          <span>{vendor}</span>
                        </div>
                        <span>{vendorEvents.length} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getVendorColor(vendor)}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 h-[400px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Events</h2>
              <span className="text-sm text-gray-300">
                {selectedSites.length > 0 ? `For ${selectedSites.length} selected site(s)` : "All events"}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {eventsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={`event-skeleton-${i}`} className="animate-pulse p-4 rounded-lg bg-white/5">
                    <div className="h-20 bg-gray-700 rounded-lg"></div>
                  </div>
                ))
              ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No events found</p>
                  {selectedSites.length > 0 && (
                    <p className="text-xs mt-2">Try adding events to selected sites</p>
                  )}
                </div>
              ) : filteredEvents.slice(0, 10).map((event) => {
                // Find the site that matches this event
                const site = sites.find(site => {
                  if (event.vendor === "Huawei") {
                    return site.groupId === event.site_id || site.id === event.site_id;
                  } else if (event.vendor?.toLowerCase().includes("ruijie")) {
                    return site.groupId === event.site_id || site.id === event.site_id;
                  }
                  return site.id === event.site_id;
                });
                
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    site={site}
                    isSelected={selectedEvent === event.id}
                    EventStatusBadge={EventStatusBadge}
                    formatDateRange={formatDateRange}
                    getVendorColor={getVendorColor}
                    openEditModal={openEditModal}
                    openDeleteModal={openDeleteModal}
                  />
                );
              })}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
            <h3 className="font-medium mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={openAddModal}
                className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex flex-col items-center justify-center gap-2"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">Add Event</span>
              </button>
              
              <button
                onClick={() => {
                  if (selectedSites.length > 0) {
                    deleteMultipleEvents();
                  } else {
                    alert("Please select sites first");
                  }
                }}
                className="p-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex flex-col items-center justify-center gap-2"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-sm">Delete Selected</span>
              </button>
              
              <button
                onClick={fetchEvents}
                disabled={eventsLoading}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex flex-col items-center justify-center gap-2"
              >
                <RefreshCw className={`h-5 w-5 ${eventsLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm">Refresh Events</span>
              </button>
              
              <button
                onClick={clearSelections}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex flex-col items-center justify-center gap-2"
              >
                <EyeOff className="h-5 w-5" />
                <span className="text-sm">Clear Selection</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <EventModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        modalType={modalType}
        formData={formData}
        formErrors={formErrors}
        filteredSites={filteredSites}
        getVendorColor={getVendorColor}
        handleInputChange={handleInputChange}
        toggleSiteInForm={toggleSiteInForm}
        handleImageUpload={handleImageUpload}
        removeImage={removeImage}
        submitForm={submitForm}
        saving={savingEvent}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={deleteEvent}
        deleting={deletingEvent}
      />
    </main>
  );
}
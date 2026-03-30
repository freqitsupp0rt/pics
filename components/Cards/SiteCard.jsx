'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, ChevronUp, Calendar, Edit2, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function SiteCard({
  site,
  isExpanded,
  isSelected,
  siteEvents,
  getVendorColor,
  getVendorIcon,
  EventStatusBadge,
  formatDateRange,
  toggleSiteExpansion,
  toggleSiteSelection,
  openAddModal,
  openEditModal,
  openDeleteModal,
  selectedEvent
}) {
  
  const handleDeleteClick = (eventId, eventDescription) => {
    Swal.fire({
      title: 'Delete Event?',
      text: `Are you sure you want to delete "${eventDescription}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      background: '#1f2937',
      color: '#fff',
      customClass: {
        cancelButton: 'bg-gray-600 hover:bg-gray-700 text-white',
        confirmButton: 'bg-red-600 hover:bg-red-700 text-white'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        openDeleteModal(eventId);
      }
    });
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : "border-white/20 bg-white/5"
      }`}
    >
      {/* Site Header */}
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
                <p className="text-xs text-gray-300">{site.description || "No description"}</p>
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
      
      {/* Site Events (Expanded View) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/20 pt-4">
              {siteEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No events for this site</p>
                  <button
                    onClick={() => {
                      openAddModal();
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
                      key={event.id}
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
                              <Calendar className="h-3 w-3" />
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(event.id, event.event);
                            }}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
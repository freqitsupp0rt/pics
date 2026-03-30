'use client';

import { MapPin, Clock, Edit2, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function EventCard({
  event,
  site,
  isSelected,
  EventStatusBadge,
  formatDateRange,
  getVendorColor,
  openEditModal,
  openDeleteModal
}) {
  
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    
    Swal.fire({
      title: 'Delete Event?',
      text: `Are you sure you want to delete "${event.event}"?`,
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
        openDeleteModal(event.id);
      }
    });
  };

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : "border-white/20 bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <EventStatusBadge event={event} />
            <h3 className="font-semibold text-white text-sm">{event.event}</h3>
          </div>
          
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-gray-300">{formatDateRange(event.start, event.end)}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <span className="text-gray-300">{site?.name || "Unknown Site"}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${getVendorColor(event.vendor)}`}>
                {event.vendor}
              </span>
              <span className="text-gray-400 text-xs">
                Created: {new Date(event.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(event);
            }}
            className="p-2 bg-white/10 hover:bg-white/20 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
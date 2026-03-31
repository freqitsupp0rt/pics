'use client';

import { motion } from 'framer-motion';
import { XCircle, Upload, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';

export default function EventModal({
  isOpen,
  onClose,
  modalType,
  formData,
  formErrors,
  filteredSites,
  getVendorColor,
  handleInputChange,
  toggleSiteInForm,
  handleImageUpload,
  removeImage,
  submitForm,
  saving
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 rounded-xl border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">
              {modalType === "add" ? "Add New Event" : "Edit Event"}
            </h3>
            <button
              onClick={onClose}
              disabled={saving} // Disable close while saving
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Site Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Site(s) *</label>
              {formErrors.site_ids && (
                <p className="text-red-400 text-xs mb-2">{formErrors.site_ids}</p>
              )}
              <div className="max-h-40 overflow-y-auto border border-white/20 rounded-lg p-2 bg-white/5">
                {filteredSites.length === 0 ? (
                  <p className="text-gray-400 text-sm p-2">No sites available</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredSites.map(site => (
                      <label
                        key={site.id}
                        className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.site_ids.includes(site.id)}
                          onChange={() => toggleSiteInForm(site.id)}
                          className="h-4 w-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{site.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded ${getVendorColor(site.vendor)}`}>
                              {site.vendor}
                            </span>
                            <span>{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {formData.site_ids.length} site(s) selected
              </div>
            </div>
            
            {/* Event Description */}
            <div>
              <label className="block text-sm font-medium mb-2">Event Description *</label>
              {formErrors.event && (
                <p className="text-red-400 text-xs mb-2">{formErrors.event}</p>
              )}
              <input
                type="text"
                name="event"
                value={formData.event}
                onChange={handleInputChange}
                placeholder="E.g., Network maintenance, Power outage, Software upgrade..."
                className="w-full px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date & Time *</label>
                {formErrors.start && (
                  <p className="text-red-400 text-xs mb-2">{formErrors.start}</p>
                )}
                <input
                  type="datetime-local"
                  name="start"
                  value={formData.start}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">End Date & Time *</label>
                {formErrors.end && (
                  <p className="text-red-400 text-xs mb-2">{formErrors.end}</p>
                )}
                <input
                  type="datetime-local"
                  name="end"
                  value={formData.end}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Upload Reference Image (Optional)
              </label>
              {formErrors.image && (
                <p className="text-red-400 text-xs mb-2">{formErrors.image}</p>
              )}
              
              {formData.image ? (
                <div className="space-y-3">
                  <div className="relative border border-white/20 rounded-lg overflow-hidden">
                    <img
                      src={formData.image}
                      alt="Event reference"
                      className="w-full h-48 object-contain bg-black"
                    />
                    <button
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                      title="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-400">
                    Image uploaded successfully. Click "Remove" to change.
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-white/20 rounded-lg p-6 bg-white/5 hover:bg-white/10 transition-colors">
                  <label className="flex flex-col items-center justify-center cursor-pointer">
                    <div className="p-3 bg-blue-500/20 rounded-full mb-3">
                      <Upload className="h-6 w-6 text-blue-400" />
                    </div>
                    <p className="text-sm font-medium mb-1">Click to upload image</p>
                    <p className="text-xs text-gray-400 mb-3">
                      JPEG, PNG, GIF, WebP (Max 5MB)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm">
                      Choose File
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions - Update button with loading state */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/20">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-white/30 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={submitForm}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {modalType === "add" ? "Adding..." : "Updating..."}
                </>
              ) : (
                modalType === "add" ? "Add Event" : "Update Event"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
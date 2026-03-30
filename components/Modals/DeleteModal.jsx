'use client';

import { motion } from 'framer-motion';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteModal({ isOpen, onClose, onConfirm, deleting }) {
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
        className="bg-gray-800 rounded-xl border border-white/20 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              {deleting ? (
                <Loader2 className="h-6 w-6 text-red-400 animate-spin" />
              ) : (
                <Trash2 className="h-6 w-6 text-red-400" />
              )}
            </div>
            <h3 className="text-xl font-semibold">
              {deleting ? 'Deleting...' : 'Delete Event'}
            </h3>
          </div>
          
          <p className="text-gray-300 mb-6">
            {deleting 
              ? 'Deleting event, please wait...' 
              : 'Are you sure you want to delete this event? This action cannot be undone.'
            }
          </p>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 border border-white/30 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
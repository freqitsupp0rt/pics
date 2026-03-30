import { X, FileSpreadsheet, Check, Loader2 } from 'lucide-react';

export default function CSVPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  headers = [],
  data = [],
  siteName,
  isImporting = false,
}) {
  if (!isOpen) return null;

  const previewRowCount = 10;
  const hasMoreRows = data.length > previewRowCount;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-blue-400" size={24} />
            <h2 className="text-xl font-bold text-white">CSV Import Preview</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 mb-6">
            <h3 className="font-semibold text-lg">Import Summary</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
              <p className="text-gray-300">Site:</p>
              <p className="font-medium text-white truncate">{siteName}</p>
              <p className="text-gray-300">Total Records Found:</p>
              <p className="font-medium text-white">{data.length}</p>
            </div>
            <p className="text-xs text-yellow-400 mt-4 bg-yellow-900/30 p-2 rounded border border-yellow-700/50">
              Note: Existing data for the same dates will be overwritten by the imported data.
            </p>
          </div>

          <h3 className="font-semibold text-lg mb-3">Data Preview (first {previewRowCount} rows)</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  {headers.map((header, index) => (
                    <th key={index} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-800">
                {data.slice(0, previewRowCount).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-gray-700">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-2 whitespace-nowrap truncate max-w-xs">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMoreRows && (
            <p className="text-center text-gray-400 text-sm mt-4">
              ... and {data.length - previewRowCount} more row(s)
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-4 border-t border-gray-700 gap-4">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isImporting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
          >
            {isImporting ? <><Loader2 className="animate-spin" size={18} /> Importing...</> : <><Check size={18} /> Confirm and Import</>}
          </button>
        </div>
      </div>
    </div>
  );
}
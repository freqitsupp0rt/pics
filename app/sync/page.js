'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function AdminSyncPage() {
  const { getToken, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Only allow admin users to see this page
  if (!user || user.role !== 'admin') {
    return (
      <div className="p-8 text-red-400">
        You are not authorized to access this page.
      </div>
    );
  }

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = getToken(); // JWT from localStorage

      const res = await fetch('/api/sites/sync', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`✅ ${data.message}`);
      } else {
        setMessage(`❌ ${data.message || data.error}`);
      }
    } catch (err) {
      setMessage(`❌ Sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-8 min-h-screen bg-gray-900 text-white flex flex-col items-center justify-start">
      <h1 className="text-2xl font-bold mb-6">Admin: Sync Sites</h1>

      <button
        onClick={handleSync}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded font-semibold disabled:opacity-50"
      >
        {loading ? 'Syncing...' : 'Sync Sites'}
      </button>

      {message && (
        <p className="mt-4 text-center text-lg">
          {message}
        </p>
      )}
    </main>
  );
}

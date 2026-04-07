'use client';

import { useState, useEffect } from "react";
import SiteList from "@/components/SiteList";
import { useAuth } from "@/hooks/useAuth";
import Swal from "sweetalert2";
import { X, Calendar, Flag, MessageSquare } from "lucide-react";
import dayjs from "dayjs";

export default function ImageGalleryManager() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const [loadingSites, setLoadingSites] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [images, setImages] = useState([]);
  const [viewingImage, setViewingImage] = useState(null);

  const { getToken } = useAuth();

  useEffect(() => {
    async function fetchSites() {
      try {
        setLoadingSites(true);
        const token = await getToken(); 
        if (!token) return;

        const res = await fetch("/api/sites", {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });

        const data = await res.json();
        const normalized = (data.data || []).map(site => ({
          siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
          name: site.name || "Unnamed Site",
          vendor: site.vendor || "Unknown",
          groupId: site.groupId || site.siteId || site.id,
        }));

        setSites(normalized);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSites(false);
      }
    }
    fetchSites();
  }, [getToken]);

  // Fetch existing images when a site is selected
  useEffect(() => {
    if (!selectedSite) {
      setImages([]);
      return;
    }

    async function fetchSiteImages() {
      try {
        setIsFetching(true);
        const token = await getToken();
        const res = await fetch(`/api/sites/images?siteId=${selectedSite}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setImages(data.data || []);
        }
      } catch (err) {
        console.error("Error fetching images:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchSiteImages();
  }, [selectedSite, getToken]);

  const handleSaveGallery = async () => {
    if (!selectedSite) return;

    try {
      setIsSaving(true);
      const token = await getToken();
      const res = await fetch("/api/sites/images", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          siteId: selectedSite,
          images: images // Now sending the whole object with description and isMir
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire('Saved!', 'Site gallery updated successfully.', 'success');
      } else {
        throw new Error(data.message || 'Failed to save gallery');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Failed to save gallery', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => [...prev, { 
          url: event.target.result, 
          description: "",
          isMir: false,
          updatedAt: new Date().toISOString() 
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const updateImage = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImages(prev => {
        const newArr = [...prev];
        newArr[index] = { 
          ...newArr[index],
          url: event.target.result, 
          updatedAt: new Date().toISOString() 
        };
        return newArr;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateMetadata = (index, field, value) => {
    setImages(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* Left Sidebar: Site List */}
        <div className="w-full lg:w-1/3">
          <div className="sticky top-8">
            <SiteList 
              sites={sites} 
              loading={loadingSites} 
              selectedSite={selectedSite} 
              searchTerm={siteSearchTerm} 
              onSiteSelect={(id) => { setSelectedSite(id); setImages([]); }} 
              onSearchChange={setSiteSearchTerm} 
            />
          </div>
        </div>

        {/* Right Content: Simple Gallery */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <header className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Site Gallery
              </h1>
              <p className="text-gray-400 text-sm mt-1">Simple tile view for facility photos</p>
            </div>
            {selectedSite && (
              <div className="flex gap-3">
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-bold uppercase tracking-wider">
                  + Add Photos
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </label>
                <button
                  onClick={handleSaveGallery}
                  disabled={isSaving || isFetching}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-green-900/20 font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {isSaving ? "Saving..." : "Save Gallery"}
                </button>
              </div>
            )}
          </header>

          {!selectedSite ? (
            <div className="bg-white/10 backdrop-blur-md py-32 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <p className="text-gray-400 italic">Select a site to view the gallery.</p>
            </div>
          ) : isFetching ? (
            <div className="bg-white/10 backdrop-blur-md py-32 text-center border border-white/10 rounded-2xl">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-400">Loading site photos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-black/20 group border border-white/10 hover:border-blue-500/50 transition-all shadow-lg">
                  <img src={typeof img === 'string' ? img : img.url} className="w-full h-full object-cover" alt={`Gallery item ${idx}`} />
                  
                  {/* UpdatedAt Badge */}
                  <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[9px] text-gray-300 flex items-center gap-1 border border-white/10">
                    <Calendar size={10} />
                    {img.updatedAt ? dayjs(img.updatedAt).format('MMM D, HH:mm') : 'New'}
                  </div>

                  {img.isMir && (
                    <div className="absolute top-2 right-2 z-10 bg-blue-600/80 backdrop-blur-md p-1 rounded-full text-white border border-blue-400/50 shadow-lg">
                      <Flag size={10} fill="currentColor" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-3">
                    <div className="w-full space-y-2 mb-2">
                      <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded border border-white/10">
                        <MessageSquare size={12} className="text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Add description..." 
                          value={img.description || ""}
                          onChange={(e) => updateMetadata(idx, 'description', e.target.value)}
                          className="bg-transparent text-[10px] w-full outline-none text-white"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer group/flag">
                        <input 
                          type="checkbox" 
                          checked={img.isMir || false}
                          onChange={(e) => updateMetadata(idx, 'isMir', e.target.checked)}
                          className="w-3 h-3 rounded bg-gray-700 border-gray-600 text-blue-500"
                        />
                        <span className="text-[10px] text-gray-300 group-hover/flag:text-white transition-colors">Flag for MIR</span>
                      </label>
                    </div>
                    <button 
                      onClick={() => setViewingImage(typeof img === 'string' ? img : img.url)}
                      className="w-full text-[10px] font-bold bg-blue-600/40 hover:bg-blue-600/60 text-white py-2 rounded uppercase tracking-wider transition-colors border border-blue-500/20"
                    >
                      View
                    </button>
                    <label className="w-full text-center cursor-pointer text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white py-2 rounded uppercase tracking-wider transition-colors border border-white/10">
                      Update
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => updateImage(e, idx)} />
                    </label>
                    <button 
                      onClick={() => removeImage(idx)} 
                      className="w-full text-[10px] font-bold bg-red-600/40 hover:bg-red-600/60 py-2 rounded uppercase tracking-wider transition-colors text-red-100 border border-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Empty state add button */}
              <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-white/10 rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-all group">
                <span className="text-3xl text-gray-500 group-hover:text-blue-400 transition-colors">+</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase mt-1 group-hover:text-blue-400 transition-colors">Add Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Image View Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300"
          onClick={() => setViewingImage(null)}
        >
          <div 
            className="relative max-w-5xl w-full flex items-center justify-center" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setViewingImage(null)}
              className="absolute -top-12 right-0 md:-right-12 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X size={32} />
            </button>
            <img 
              src={viewingImage} 
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-white/10" 
              alt="Gallery preview" 
            />
          </div>
        </div>
      )}
    </main>
  );
}
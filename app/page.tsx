"use client";

import React, { useState } from "react";
// Use NEXT_PUBLIC_API_URL so deployments can point to the backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
import { Upload, Search, X, CheckCircle, Calendar, Users, Plane, Clock, FileText, User, Baby, PlaneTakeoff } from "lucide-react";

export default function BookingSearch() {
  const [file, setFile] = useState<File | null>(null);
  const [booking, setBooking] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pagesCount, setPagesCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // --- File input handler ---
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;

    if (f && f.size > 10 * 1024 * 1024) {
    setError("File too large! Maximum 10MB");
    return;
  }
    setFile(f);
    setError(null);
  };

  // --- Upload PDF & cache ---
  const onUpload = async () => {
    setError(null);
    if (!file) {
      setError("Please pick a PDF file to upload");
      return;
    }
    
    setUploading(true);
    
    try {
      const form = new FormData();
      form.append("file", file);
      
      console.log("📤 Uploading to:", `${API_BASE}/api/upload`);
      console.log("📄 File:", file.name, file.type, file.size);
      
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
        // ⚠️ ไม่ต้องใส่ headers เพราะ browser จะใส่ให้เองพร้อม boundary
      });
      
      console.log("📥 Response status:", res.status);
      console.log("📥 Response headers:", Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Error response:", errorText);
        
        let errorDetail;
        try {
          errorDetail = JSON.parse(errorText).detail;
        } catch {
          errorDetail = errorText || res.statusText;
        }
        
        throw new Error(errorDetail || "Upload failed");
      }
      
      const data = await res.json();
      console.log("✅ Upload success:", data);
      
      setSessionId(data.sessionId);
      setPagesCount(data.pages ?? null);
      setResult(null);
      setError(null);
      
    } catch (err) {
      console.error("❌ Upload error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  // --- Clear cached session ---
  const clearSession = () => {
    setSessionId(null);
    setPagesCount(null);
    setFile(null);
    setResult(null);
    setError(null);
  };

  // --- Search booking (uses cached PDF if available) ---
  const onSearch = async () => {
    setError(null);
    if (!booking) {
      setError("Please enter booking number");
      return;
    }
    
    setLoading(true);
    
    try {
      const form = new FormData();
      form.append("booking", booking);
      
      if (sessionId) {
        // Search from cache
        form.append("sessionId", sessionId);
        console.log("🔍 Searching cache:", booking, sessionId);
        
        const res = await fetch(`${API_BASE}/api/search`, {
          method: "POST",
          body: form,
        });
        
        console.log("📥 Search response:", res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          let errorDetail;
          try {
            errorDetail = JSON.parse(errorText).detail;
          } catch {
            errorDetail = errorText || res.statusText;
          }
          throw new Error(errorDetail || "Search failed");
        }
        
        const data = await res.json();
        setResult(data);
        
      } else if (file) {
        // Parse without cache
        form.append("file", file);
        console.log("🔍 Parsing file:", booking);
        
        const res = await fetch(`${API_BASE}/api/parse`, {
          method: "POST",
          body: form,
        });
        
        console.log("📥 Parse response:", res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          let errorDetail;
          try {
            errorDetail = JSON.parse(errorText).detail;
          } catch {
            errorDetail = errorText || res.statusText;
          }
          throw new Error(errorDetail || "Parse failed");
        }
        
        const data = await res.json();
        setResult(data);
        
      } else {
        setError("Please upload a PDF first");
      }
    } catch (err) {
      console.error("❌ Search error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto p-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Plane className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Flight Booking Parser</h1>
          <p className="text-gray-600">Upload your booking PDF and search for booking details instantly</p>
          {/* ⚠️ Debug info */}
          <p className="text-xs text-gray-400 mt-2">API: {API_BASE}</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Upload Section */}
          <div className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="grid md:grid-cols-2 gap-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FileText className="inline w-4 h-4 mr-2" />
                  Upload Booking PDF
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={onFileChange}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer border border-gray-200 rounded-xl bg-white"
                  />
                </div>
                
                {file && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200 text-sm text-gray-700">
                    <span className="font-medium">Selected:</span> {file.name}
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={onUpload}
                    disabled={uploading || !file}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload & Cache'}
                  </button>
                  <button
                    onClick={clearSession}
                    className="px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {sessionId && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-900">PDF Cached Successfully</p>
                        <p className="text-xs text-green-700 mt-1">Session: <code className="bg-green-100 px-2 py-0.5 rounded">{sessionId.substring(0, 12)}...</code></p>
                        <p className="text-xs text-green-700">Pages: {pagesCount ?? '?'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Booking Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <Search className="inline w-4 h-4 mr-2" />
                  Booking Reference Number
                </label>
                <input
                  value={booking}
                  onChange={(e) => setBooking(e.target.value)}
                  placeholder="Enter booking number (e.g., 13412426)"
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-lg"
                />
                
                <button
                  onClick={onSearch}
                  disabled={loading || !booking}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:from-slate-900 hover:to-black disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl text-lg"
                >
                  <Search className="w-5 h-5" />
                  {loading ? "Searching..." : "Search Booking"}
                </button>

                <p className="text-xs text-gray-500 mt-3 text-center">
                  💡 Upload PDF first for faster search, or leave empty to use server sample
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-8 mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-center gap-3">
                <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mx-8 mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-center gap-3">
                <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                    <User className="w-5 h-5 text-blue-700" />
                    <span className="font-bold text-blue-900">{result.pax_adult || 0}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 rounded-full">
                    <Baby className="w-5 h-5 text-pink-700" />
                    <span className="font-bold text-pink-900">{result.pax_child || 0}</span>
                  </div>
                  <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {result.status || 'Completed'}
                  </span>
                </div>
              </div>

              {/* Booking Info Card - NOW WITH 3 COLUMNS INCLUDING AIRLINE */}
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                {/* Booking Reference */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 font-medium">Booking Reference</p>
                      <p className="text-xl font-bold text-blue-900">{result.booking}</p>
                    </div>
                  </div>
                </div>

                {/* Passengers */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs text-purple-700 font-medium">Passengers</p>
                  </div>
                  <div className="space-y-1.5">
                    {result.passengers?.map((passenger: string, idx: number) => (
                      <div key={idx} className="bg-white/70 px-3 py-2 rounded-lg text-sm font-semibold text-purple-900">
                        {idx + 1}. {passenger}
                      </div>
                    )) || <p className="text-sm text-purple-700">N/A</p>}
                  </div>
                </div>

                {/* Airline - NEW SECTION */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                      <PlaneTakeoff className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-orange-700 font-medium">Airline</p>
                      <p className="text-xl font-bold text-orange-900">{result.airline?.arrival || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flight Details */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Arrival */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-2 mb-4">
                    <Plane className="w-5 h-5 text-blue-600 transform rotate-45" />
                    <h3 className="font-bold text-gray-900">Arrival Flight</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-gray-900">{result.arrival?.flight || "N/A"}</p>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <p className="text-sm">{result.arrival?.time || "N/A"}</p>
                    </div>
                    <p className="text-xs text-gray-500">Page {result.arrival?.page || "?"}</p>
                  </div>
                </div>

                {/* Departure */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-2 mb-4">
                    <Plane className="w-5 h-5 text-indigo-600 transform -rotate-45" />
                    <h3 className="font-bold text-gray-900">Departure Flight</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-gray-900">{result.departure?.flight || "N/A"}</p>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <p className="text-sm">{result.departure?.time || "N/A"}</p>
                    </div>
                    <p className="text-xs text-gray-500">Page {result.departure?.page || "?"}</p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase">Start Date</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{result.start_date || "N/A"}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase">End Date</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{result.end_date || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Service Type</p>
                    <p className="text-lg font-bold text-gray-900">{result.service || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by Flight Booking Parser • Upload PDF and search instantly</p>
        </div>
      </div>
    </div>
  );
}
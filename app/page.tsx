"use client";

import React, { useState } from "react";
import { Upload, Search, X, CheckCircle, Calendar, Users, Plane, Clock, FileText, User, Baby, PlaneTakeoff, RefreshCw } from "lucide-react";

// ใช้ NEXT_PUBLIC_API_URL เพื่อให้สามารถชี้ไปที่ backend ได้
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://backend-bookingapp-production.up.railway.app";

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
      });

      console.log("📥 Response status:", res.status);

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
        // Fallback for demo/server sample use
        console.log("🔍 Searching without file (using server sample/demo mode):", booking);
        const res = await fetch(`${API_BASE}/api/search`, {
          method: "POST",
          body: form, // ส่ง booking number ไปเท่านั้น
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorDetail;
          try {
            errorDetail = JSON.parse(errorText).detail;
          } catch {
            errorDetail = errorText || res.statusText;
          }
          throw new Error(errorDetail || "Search failed. Did you forget to upload a PDF?");
        }
        
        const data = await res.json();
        setResult(data);
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
    <div className="min-h-screen bg-gray-50"> {/* เปลี่ยนพื้นหลังหลักเป็นสีเทาอ่อน */}
      <div className="max-w-6xl mx-auto p-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-700 to-blue-600 rounded-3xl mb-4 shadow-xl"> {/* ปรับสีและขอบมน */}
            <Plane className="w-10 h-10 text-white" /> {/* เพิ่มขนาดไอคอน */}
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Booking Data Extractor</h1> {/* เปลี่ยนชื่อและเน้น Font */}
          <p className="text-gray-600">Instantly parse and retrieve flight booking details from PDF documents.</p>
          {/* ⚠️ Debug info */}
          <p className="text-xs text-gray-400 mt-2">API: {API_BASE}</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Upload Section */}
          <div className="p-8 bg-gray-50 border-b border-gray-200"> {/* เปลี่ยนพื้นหลังเป็นสีเทาอ่อน */}
            <div className="grid md:grid-cols-2 gap-8"> {/* เพิ่มระยะห่าง */}
              {/* File Upload */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3"> {/* เน้น Font Bold */}
                  <FileText className="inline w-4 h-4 mr-2 text-indigo-500" />
                  Upload Booking PDF
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={onFileChange}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer border-2 border-gray-200 rounded-xl bg-white focus:border-indigo-500"
                  />
                </div>

                {file && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-blue-200 text-sm text-gray-700 shadow-sm"> {/* ปรับ Card File */}
                    <span className="font-semibold">Selected:</span> {file.name}
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={onUpload}
                    disabled={uploading || !file}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl" // ปรับเป็นสี Indigo
                  >
                    {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Processing...' : 'Upload & Cache'}
                  </button>
                  <button
                    onClick={clearSession}
                    className="px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-white transition-all shadow-sm"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {sessionId && (
                  <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400 rounded-xl shadow-md"> {/* ใช้ border-l-4 เน้นสถานะ */}
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-green-900">PDF Cached Successfully</p>
                        <p className="text-xs text-green-700 mt-1">Session: <code className="bg-green-100 px-2 py-0.5 rounded font-mono">{sessionId.substring(0, 12)}...</code></p>
                        <p className="text-xs text-green-700">Pages: {pagesCount ?? '?'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Booking Search */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  <Search className="inline w-4 h-4 mr-2 text-slate-700" />
                  Booking Reference Number
                </label>
                <input
                  value={booking}
                  onChange={(e) => setBooking(e.target.value)}
                  placeholder="Enter booking number (e.g., 13412426)"
                  className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-lg font-semibold"
                />

                <button
                  onClick={onSearch}
                  disabled={loading || !booking}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 rounded-xl font-extrabold hover:from-slate-900 hover:to-black disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl text-lg" // ปุ่มพรีเมียมสี Slate/Black
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  {loading ? "Searching..." : "Search Booking"}
                </button>

                <p className="text-xs text-gray-500 mt-3 text-center">
                  💡 **Tip:** Upload PDF first to speed up the process.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-8">
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md">
                <div className="flex items-center gap-3">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="p-8">
              {/* --- Summary Bar --- */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                <h2 className="text-3xl font-extrabold text-gray-900">Booking Details</h2>
                <div className="flex items-center gap-4">
                  {/* Status Badge */}
                  <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm">
                    <CheckCircle className="w-4 h-4" />
                    {result.status || 'COMPLETED'}
                  </span>
                  {/* Pax Adult Chip */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full shadow-sm">
                    <User className="w-5 h-5 text-gray-700" />
                    <span className="font-bold text-gray-900">{result.pax_adult || 0} Adult</span>
                  </div>
                  {/* Pax Child Chip */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full shadow-sm">
                    <Baby className="w-5 h-5 text-gray-700" />
                    <span className="font-bold text-gray-900">{result.pax_child || 0} Child</span>
                  </div>
                </div>
              </div>
              {/* --- Main Info Cards (3 Columns) --- */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Booking Reference Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-blue-100 p-6 rounded-2xl border border-indigo-200 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-indigo-700 font-semibold uppercase tracking-wider">Booking Reference</p>
                      <p className="text-3xl font-extrabold text-indigo-900 mt-1">{result.booking}</p>
                    </div>
                  </div>
                </div>

                {/* Airline Card */}
                <div className="bg-gradient-to-br from-orange-50 to-yellow-100 p-6 rounded-2xl border border-orange-200 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <PlaneTakeoff className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-orange-700 font-semibold uppercase tracking-wider">Airline</p>
                      <p className="text-xl font-bold text-orange-900 mt-1">{result.airline?.arrival || "N/A"}</p>
                      <p className="text-sm text-orange-600 mt-1">Service: {result.service || "Flight"}</p>
                    </div>
                  </div>
                </div>

                {/* Passengers Card */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-100 p-6 rounded-2xl border border-purple-200 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-purple-700 font-semibold uppercase tracking-wider mb-2">Primary Passengers</p>
                      <div className="space-y-1">
                        {result.passengers?.slice(0, 2).map((passenger: string, idx: number) => (
                          <div key={idx} className="bg-white/70 px-3 py-1.5 rounded-lg text-sm font-semibold text-purple-900 shadow-sm border border-white">
                            {idx + 1}. {passenger}
                          </div>
                        )) || <p className="text-sm text-purple-700">N/A</p>}
                        {result.passengers && result.passengers.length > 2 && (
                          <p className="text-xs text-purple-600 mt-1">... and {result.passengers.length - 2} more</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Flight Details (Arrival/Departure) --- */}
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PlaneTakeoff className="w-5 h-5 text-indigo-500" />
                Flight Itinerary
              </h3>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Arrival Card (ใช้โทนเย็น) */}
                <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 hover:border-indigo-400 transition-all shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Plane className="w-5 h-5 text-white transform rotate-45" />
                    </div>
                    <h4 className="font-bold text-xl text-gray-900">Arrival Flight</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-3xl font-extrabold text-indigo-800">{result.arrival?.flight || "N/A"}</p>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-5 h-5 text-gray-500" />
                      <p className="text-lg font-semibold">{result.arrival?.time || "N/A"}</p>
                    </div>
                    <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">Page Reference: {result.arrival?.page || "?"}</p>
                  </div>
                </div>

                {/* Departure Card (ใช้โทนเย็น) */}
                <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 hover:border-blue-400 transition-all shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <Plane className="w-5 h-5 text-white transform -rotate-45" />
                    </div>
                    <h4 className="font-bold text-xl text-gray-900">Departure Flight</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-3xl font-extrabold text-blue-800">{result.departure?.flight || "N/A"}</p>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-5 h-5 text-gray-500" />
                      <p className="text-lg font-semibold">{result.departure?.time || "N/A"}</p>
                    </div>
                    <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">Page Reference: {result.departure?.page || "?"}</p>
                  </div>
                </div>
              </div>

              {/* --- Additional Info --- */}
              <div className="bg-gray-100 rounded-2xl p-6 border border-gray-200 shadow-inner"> {/* พื้นหลัง Card Info */}
                <h4 className="text-lg font-bold text-gray-800 mb-4">Trip Timeline</h4>
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Start Date */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Start Date</p>
                    </div>
                    <p className="text-xl font-extrabold text-gray-900">{result.start_date || "N/A"}</p>
                  </div>
                  {/* End Date */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">End Date</p>
                    </div>
                    <p className="text-xl font-extrabold text-gray-900">{result.end_date || "N/A"}</p>
                  </div>
                  {/* Service Type */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Document Type</p>
                    </div>
                    <p className="text-xl font-extrabold text-gray-900">{result.service || "Flight Ticket"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {/* <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by</p>
        </div> */}
      </div>
    </div>
  );
}
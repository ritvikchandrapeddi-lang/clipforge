import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileVideo,
  Play,
  Pause,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Building,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface UploadCenterPageProps {
  onNavigate: (page: PageId) => void;
}

export const UploadCenterPage: React.FC<UploadCenterPageProps> = ({ onNavigate }) => {
  const {
    departments,
    uploadingFiles,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
  } = useSocket();

  const [selectedDept, setSelectedDept] = useState<string>(departments[0]?.id || 'dept-cs');
  const [priority, setPriority] = useState<'urgent' | 'standard'>('standard');
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateDetected, setDuplicateDetected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    // Check duplicate simulation
    const dup = files.find((f) => f.name.includes('duplicate'));
    if (dup) {
      setDuplicateDetected(dup.name);
      return;
    }
    setDuplicateDetected(null);
    startUpload(files, selectedDept, priority);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Duplicate / Hash alert */}
      {duplicateDetected && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-200">
                Idempotency Deduplication Match Found
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                File <span className="font-mono">{duplicateDetected}</span> matches an existing SHA-256 payload in the repository. Instant reference created without duplicate processing.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDuplicateDetected(null)}
            className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Setup Configuration Bar */}
      <div className="p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Department Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-400" />
              Department Quota Allocator
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-electric-500"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.usedHours.toFixed(1)} / {d.quotaHours}h quota)
                </option>
              ))}
            </select>
          </div>

          {/* Priority Tier Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Scheduling Priority Tier
            </label>
            <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setPriority('standard')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  priority === 'standard'
                    ? 'bg-slate-800 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Standard (Fair-Share)
              </button>
              <button
                type="button"
                onClick={() => setPriority('urgent')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                  priority === 'urgent'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <Zap className="w-3 h-3" />
                Urgent Lecture
              </button>
            </div>
          </div>
        </div>

        {/* Resumable Guarantees Pill */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Chunk-Size: 5MB | SHA-256 Verified | Auto-Resume</span>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition ${
          isDragging
            ? 'border-electric-400 bg-electric-500/10 scale-[1.005]'
            : 'border-slate-700/80 hover:border-slate-600 bg-[#0E1424]/60 hover:bg-[#0E1424]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,.mp4,.mov,.mkv,.avi"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-electric-600 to-cyan-400 flex items-center justify-center shadow-glow-md mb-4">
          <UploadCloud className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          Drop lecture recordings here or click to browse
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-4">
          Supports MP4, MOV, MKV, AVI. Files are sliced into 5MB byte-level chunks and can safely survive network disconnects and web instance failures.
        </p>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-electric-400"></span> Chunk Slicing
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Checksum Verification
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Deduplication Engine
          </span>
        </div>
      </div>

      {/* Active In-Progress Uploads Queue */}
      <div className="p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Active Resumable Upload Streams</h3>
            <p className="text-xs text-slate-400">State persisted in Redis chunks registry</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {uploadingFiles.length} stream(s)
          </span>
        </div>

        {uploadingFiles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No active uploads currently in flight. Drag and drop video files above to start.
          </div>
        ) : (
          <div className="space-y-3">
            {uploadingFiles.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <FileVideo className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{item.name}</span>
                        <span
                          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                            item.priority === 'urgent'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatBytes(item.size)} • Status: {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Pause, Resume, Cancel */}
                  <div className="flex items-center gap-2">
                    {item.status === 'uploading' && (
                      <button
                        onClick={() => pauseUpload(item.id)}
                        title="Pause upload"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {item.status === 'paused' && (
                      <button
                        onClick={() => resumeUpload(item.id)}
                        title="Resume chunk stream"
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => cancelUpload(item.id)}
                      title="Cancel & cleanup chunks"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>{item.progress}% Completed</span>
                    <span>
                      {item.status === 'completed'
                        ? 'Assembled & Queued'
                        : `${formatBytes(Math.round((item.size * item.progress) / 100))} of ${formatBytes(item.size)}`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.status === 'completed'
                          ? 'bg-emerald-500'
                          : item.status === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-gradient-to-r from-electric-500 to-cyan-400'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

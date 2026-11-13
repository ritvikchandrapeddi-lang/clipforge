import React, { useState } from 'react';
import {
  Search,
  Filter,
  Play,
  Clock,
  HardDrive,
  Building,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  Film,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { VideoItem } from '../types';
import { PageId } from '../components/Sidebar';

interface VideoLibraryPageProps {
  onNavigate: (page: PageId) => void;
}

export const VideoLibraryPage: React.FC<VideoLibraryPageProps> = ({ onNavigate }) => {
  const { videos, departments, setSelectedVideoForPlayer } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  const filteredVideos = videos.filter((v) => {
    const matchesQuery =
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.originalName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDeptFilter === 'all' || v.departmentId === selectedDeptFilter;
    const matchesStatus = selectedStatusFilter === 'all' || v.status === selectedStatusFilter;
    return matchesQuery && matchesDept && matchesStatus;
  });

  const handlePlayVideo = (video: VideoItem) => {
    setSelectedVideoForPlayer(video);
    onNavigate('player');
  };

  const formatSeconds = (sec?: number) => {
    if (!sec) return 'Processing...';
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins}:${remainingSec < 10 ? '0' : ''}${remainingSec}`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search lectures by course code, topic or filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-electric-500"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-electric-500"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-electric-500"
          >
            <option value="all">All Stages</option>
            <option value="ready">Ready (Transcoded)</option>
            <option value="conversion">Transcoding</option>
            <option value="validation">Validating</option>
            <option value="thumbnail">Thumbnailing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Video Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVideos.map((video) => (
          <div
            key={video.id}
            className="rounded-2xl bg-[#0E1424] border border-slate-800 hover:border-slate-700 transition overflow-hidden group shadow-sm flex flex-col justify-between"
          >
            {/* Thumbnail Poster / Preview */}
            <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-600 gap-2">
                  <Film className="w-10 h-10 animate-pulse" />
                  <span className="text-[11px] font-mono">Generating Sprite Poster...</span>
                </div>
              )}

              {/* Status Badge overlay */}
              <div className="absolute top-3 left-3">
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold shadow-md ${
                    video.status === 'ready'
                      ? 'bg-emerald-500 text-slate-950'
                      : video.status === 'failed'
                      ? 'bg-rose-500 text-white'
                      : 'bg-electric-500 text-white'
                  }`}
                >
                  {video.status}
                </span>
              </div>

              {/* Priority Badge */}
              {video.priority === 'urgent' && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold shadow-md">
                    Urgent
                  </span>
                </div>
              )}

              {/* Play overlay button */}
              {video.status === 'ready' && (
                <button
                  onClick={() => handlePlayVideo(video)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-semibold text-xs"
                >
                  <div className="w-12 h-12 rounded-full bg-electric-600 flex items-center justify-center shadow-glow-md">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </button>
              )}
            </div>

            {/* Video Metadata Body */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-electric-400 transition-colors">
                  {video.title}
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">
                  {video.originalName}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-400" />
                    {video.departmentName || 'Computer Science'}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {formatSeconds(video.duration)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
                  <span>{formatBytes(video.size)}</span>
                  <span>{video.totalChunks} chunks (5MB)</span>
                </div>

                {/* Transcoded Quality Badges */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-mono text-slate-500">Profiles:</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      video.resolutions['360p']
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    360p
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      video.resolutions['720p']
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    720p
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      video.resolutions['1080p']
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    1080p
                  </span>
                </div>
              </div>

              {/* Action footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => handlePlayVideo(video)}
                  className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-electric-600 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Launch Player</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Settings,
  ArrowLeft,
  ShieldCheck,
  Building,
  Clock,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface VideoPlayerPageProps {
  onNavigate: (page: PageId) => void;
}

export const VideoPlayerPage: React.FC<VideoPlayerPageProps> = ({ onNavigate }) => {
  const { selectedVideoForPlayer, videos } = useSocket();
  const currentVideo = selectedVideoForPlayer || videos[0];

  const [activeQuality, setActiveQuality] = useState<'360p' | '720p' | '1080p'>('1080p');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(342); // 5m 42s
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);

  const duration = currentVideo?.duration || 3420;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const qualities: ('360p' | '720p' | '1080p')[] = ['360p', '720p', '1080p'];

  return (
    <div className="space-y-6">
      {/* Top back bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('library')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Video Library</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Stream Profile:</span>
          <span className="px-2 py-0.5 rounded bg-electric-500/20 text-electric-300 border border-electric-500/30 text-xs font-mono font-semibold">
            H.264 / AAC • {activeQuality}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Video Viewport & Controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-end group">
            {/* Visual Screen Poster / Video Element */}
            <div className="absolute inset-0 flex items-center justify-center">
              {currentVideo?.thumbnailUrl ? (
                <img
                  src={currentVideo.thumbnailUrl}
                  alt={currentVideo.title}
                  className="w-full h-full object-cover opacity-85"
                />
              ) : (
                <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-600 font-mono text-xs">
                  Transcoded Video Stream
                </div>
              )}
            </div>

            {/* Quality Watermark badge */}
            <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-white font-mono text-xs font-bold tracking-wider">
              {activeQuality}
            </div>

            {/* Big center play icon if paused */}
            {!isPlaying && (
              <button
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-electric-600/90 text-white flex items-center justify-center shadow-glow-md hover:scale-110 transition-transform z-10"
              >
                <Play className="w-7 h-7 ml-1" />
              </button>
            )}

            {/* Custom Video Controls Bar */}
            <div className="relative z-10 p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent space-y-2 opacity-95 group-hover:opacity-100 transition-opacity">
              {/* Scrub timeline */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={(e) => setCurrentTime(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-electric-500"
                />
              </div>

              {/* Lower Buttons Bar */}
              <div className="flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 hover:text-electric-400 transition"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1.5 hover:text-electric-400 transition"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>

                  <span className="font-mono text-slate-300 text-xs">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Speed toggle */}
                  <div className="flex items-center gap-1 font-mono text-slate-300 text-xs">
                    {[1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          playbackSpeed === spd
                            ? 'bg-electric-500 text-white font-bold'
                            : 'hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Quality Selector (360p, 720p, 1080p) */}
                  <div className="relative">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 font-mono text-xs font-semibold text-white transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-electric-400" />
                      <span>{activeQuality}</span>
                    </button>

                    {showQualityMenu && (
                      <div className="absolute right-0 bottom-full mb-2 w-36 rounded-xl bg-slate-900 border border-slate-800 p-1.5 shadow-2xl z-20 space-y-1">
                        <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-500 font-bold border-b border-slate-800">
                          Select Stream
                        </div>
                        {qualities.map((q) => (
                          <button
                            key={q}
                            onClick={() => {
                              setActiveQuality(q);
                              setShowQualityMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                              activeQuality === q
                                ? 'bg-electric-600 text-white font-bold'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span>{q}</span>
                            {activeQuality === q && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button className="p-1.5 hover:text-electric-400 transition">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video Metadata Header */}
          <div className="p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-2">
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {currentVideo?.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                {currentVideo?.departmentName || 'Computer Science'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Duration: {formatTime(duration)}
              </span>
              <span>•</span>
              <span className="font-mono text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero-Lost Chunk Assembly
              </span>
            </div>
          </div>
        </div>

        {/* Video Specs & Transcoding Diagnostics Sidebar */}
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-electric-400" />
              Stream Diagnostics & Codecs
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Current Stream</span>
                <span className="font-mono font-bold text-electric-400">{activeQuality} HD</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Video Encoding</span>
                <span className="font-mono text-slate-200">H.264 / AVC (libx264)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Audio Encoding</span>
                <span className="font-mono text-slate-200">AAC 128kbps Stereo</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Color Sampling</span>
                <span className="font-mono text-slate-200">yuv420p (8-bit)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Target Bitrate</span>
                <span className="font-mono text-slate-200">
                  {activeQuality === '1080p'
                    ? '4,500 kbps'
                    : activeQuality === '720p'
                    ? '2,200 kbps'
                    : '850 kbps'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Ingestion Hash</span>
                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                  {currentVideo?.hash || 'e3b0c44298fc1c149afbf4c8'}
                </span>
              </div>
            </div>

            {/* Quality Switcher Pills */}
            <div className="pt-2">
              <label className="text-[11px] font-mono text-slate-400 block mb-2 uppercase">
                Switch Target Profile:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {qualities.map((q) => (
                  <button
                    key={q}
                    onClick={() => setActiveQuality(q)}
                    className={`py-2 rounded-lg text-xs font-mono font-bold transition border ${
                      activeQuality === q
                        ? 'bg-electric-600 text-white border-electric-400 shadow-glow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Scrub Sprite Preview Info */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Timeline Preview Strips Active</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Hover scrub tiles are rendered from a lightweight 100-tile VTT sprite grid generated during Stage 3 transcoding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import {
  Server,
  Radio,
  Layers,
  Database,
  RefreshCw,
  Zap,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from './Sidebar';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate }) => {
  const { isConnected, activeWebInstance, stats, refreshData } = useSocket();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getPageTitle = (page: PageId) => {
    switch (page) {
      case 'overview':
        return { title: 'Operations Dashboard', subtitle: 'Real-time telemetry, queue health and transcode throughput' };
      case 'upload':
        return { title: 'Chunked Upload Center', subtitle: 'Resumable 5MB chunk transport with SHA-256 deduplication' };
      case 'pipeline':
        return { title: 'Multi-Stage Processing Pipeline', subtitle: 'Live video state machine from ingestion to 1080p multi-bitrate' };
      case 'library':
        return { title: 'Lecture Video Library', subtitle: 'Searchable repository with multi-resolution transcoding artifacts' };
      case 'player':
        return { title: 'Adaptive Quality Player', subtitle: 'Instant 360p, 720p, 1080p stream switching with preview scrub' };
      case 'workers':
        return { title: 'Worker Fleet Management', subtitle: 'Decoupled worker pools with dynamic scaling and lease heartbeats' };
      case 'queues':
        return { title: 'RabbitMQ Enterprise Queue Topology', subtitle: 'Durable stage exchanges, backpressure metrics and unacked messages' };
      case 'deadletter':
        return { title: 'Dead Letter & Failure Recovery', subtitle: '3-tier retry dead-letter sink with payload triage and re-injection' };
      case 'departments':
        return { title: 'Department Fair Scheduling & Quotas', subtitle: 'Token bucket allocation, compute limits and urgent priority fast-tracks' };
      case 'loadtest':
        return { title: 'Distributed Load Testing Lab', subtitle: 'Synthetic 500-job stress injector, worker crash simulation & chaos' };
      case 'observatory':
        return { title: 'Smart Processing Observatory', subtitle: 'Rule-based bottleneck detection & proactive auto-scale recommendations' };
      default:
        return { title: 'ClipForge Control Center', subtitle: 'Distributed Video Pipeline' };
    }
  };

  const { title, subtitle } = getPageTitle(currentPage);

  return (
    <header className="h-16 bg-[#0E1424]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          {title}
        </h1>
        <p className="text-xs text-slate-400 hidden sm:block">{subtitle}</p>
      </div>

      {/* Cluster Telemetry & Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Dual Stateless Web Instance Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
          <Server className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400 font-mono text-[11px]">Instance:</span>
          <span className="text-blue-300 font-mono font-medium text-[11px]">{activeWebInstance}</span>
        </div>

        {/* RabbitMQ Status */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400 font-mono text-[11px]">RabbitMQ:</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-emerald-400 font-mono text-[11px]">Ready</span>
        </div>

        {/* Redis Real-Time Socket */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400 font-mono text-[11px]">Live Sync:</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
            }`}
          ></span>
          <span className="text-slate-200 font-mono text-[11px]">
            {isConnected ? 'WebSocket' : 'Simulated'}
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          title="Refresh telemetry"
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-electric-400' : ''}`} />
        </button>

        {/* Quick Upload action */}
        {currentPage !== 'upload' && (
          <button
            onClick={() => onNavigate('upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-electric-600 hover:bg-electric-500 text-white text-xs font-semibold shadow-glow-sm transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload</span>
          </button>
        )}

        {/* Quick Simulator action */}
        {currentPage !== 'loadtest' && (
          <button
            onClick={() => onNavigate('loadtest')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition"
          >
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>500 Load Test</span>
          </button>
        )}
      </div>
    </header>
  );
};

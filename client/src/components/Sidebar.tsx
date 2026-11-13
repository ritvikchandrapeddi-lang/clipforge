import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Workflow,
  Film,
  PlaySquare,
  Cpu,
  Layers,
  AlertOctagon,
  Building2,
  Zap,
  Activity,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export type PageId =
  | 'overview'
  | 'upload'
  | 'pipeline'
  | 'library'
  | 'player'
  | 'workers'
  | 'queues'
  | 'deadletter'
  | 'departments'
  | 'loadtest'
  | 'observatory';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage }) => {
  const { queues, deadLetters, observatory } = useSocket();

  const totalQueueReady = queues.reduce((sum, q) => sum + q.messagesReady, 0);
  const unreplayedDLQ = deadLetters.filter((d) => !d.replayed).length;
  const criticalRecommendations = observatory.recommendations.filter(
    (r) => r.severity === 'critical'
  ).length;

  const navItems: {
    id: PageId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
    category?: string;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, category: 'Core' },
    { id: 'upload', label: 'Upload Center', icon: UploadCloud, category: 'Core' },
    { id: 'pipeline', label: 'Pipeline Stage', icon: Workflow, badge: totalQueueReady, badgeColor: 'bg-blue-600', category: 'Core' },
    { id: 'library', label: 'Video Library', icon: Film, category: 'Media' },
    { id: 'player', label: 'Video Player', icon: PlaySquare, category: 'Media' },
    { id: 'workers', label: 'Worker Fleet', icon: Cpu, category: 'Infrastructure' },
    { id: 'queues', label: 'RabbitMQ Queues', icon: Layers, badge: totalQueueReady, badgeColor: 'bg-indigo-600', category: 'Infrastructure' },
    { id: 'deadletter', label: 'Dead Letter Center', icon: AlertOctagon, badge: unreplayedDLQ, badgeColor: 'bg-rose-600', category: 'Reliability' },
    { id: 'departments', label: 'Departments & Fair', icon: Building2, category: 'Reliability' },
    { id: 'loadtest', label: 'Load Testing Lab', icon: Zap, category: 'Observability' },
    {
      id: 'observatory',
      label: 'Smart Observatory',
      icon: Activity,
      badge: criticalRecommendations > 0 ? `${criticalRecommendations} Alert` : undefined,
      badgeColor: 'bg-amber-500 text-slate-950 font-bold',
      category: 'Observability',
    },
  ];

  return (
    <aside className="w-64 bg-[#0E1424] border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 select-none z-30">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/80 gap-3 bg-[#0B0F1D]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-electric-600 to-cyan-400 flex items-center justify-center shadow-glow-sm">
          <Flame className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg tracking-tight text-white">ClipForge</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-electric-500/20 text-electric-400 border border-electric-500/30">
              v2.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Distributed Transcoding</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {['Core', 'Media', 'Infrastructure', 'Reliability', 'Observability'].map((category) => {
          const items = navItems.filter((item) => item.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category} className="space-y-1">
              <h3 className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold mb-1">
                {category}
              </h3>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectPage(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-electric-600/15 text-electric-400 border border-electric-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-electric-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
                          item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Cluster Health Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0B0F1D]/80">
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/90 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              HA Node Cluster
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold">2 / 2 Web</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-full rounded-full animate-pulse-subtle"></div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Nginx LB :4000</span>
            <span className="text-slate-400">AMQP + Redis Sync</span>
          </div>
        </div>
      </div>
    </aside>
  );
};


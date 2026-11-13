import React from 'react';
import {
  Video,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Cpu,
  TrendingUp,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface OverviewPageProps {
  onNavigate: (page: PageId) => void;
}

const mockThroughputTrend = [
  { time: '10:00', throughput: 28, latency: 13.2 },
  { time: '10:10', throughput: 34, latency: 14.1 },
  { time: '10:20', throughput: 42, latency: 15.0 },
  { time: '10:30', throughput: 39, latency: 14.6 },
  { time: '10:40', throughput: 48, latency: 16.2 },
  { time: '10:50', throughput: 43, latency: 14.8 },
];

const COLORS = ['#0066FF', '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B'];

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const { stats, observatory } = useSocket();

  const statCards = [
    {
      label: 'Total Videos Ingested',
      value: stats.totalVideos.toLocaleString(),
      change: '+14% vs yesterday',
      trend: 'up',
      icon: Video,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      link: 'library' as PageId,
    },
    {
      label: 'Completed Jobs',
      value: stats.completedJobs.toLocaleString(),
      change: '98.2% completion rate',
      trend: 'up',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      link: 'pipeline' as PageId,
    },
    {
      label: 'In-Flight Processing',
      value: stats.processingJobs.toString(),
      change: 'Active on worker fleet',
      trend: 'neutral',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      link: 'pipeline' as PageId,
    },
    {
      label: 'Failed / Dead Letters',
      value: stats.failedJobs.toString(),
      change: '3 retries exhausted',
      trend: 'down',
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      link: 'deadletter' as PageId,
    },
    {
      label: 'RabbitMQ Queue Depth',
      value: stats.queueDepth.toString(),
      change: 'Across all stages',
      trend: 'neutral',
      icon: Layers,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      link: 'queues' as PageId,
    },
    {
      label: 'Active Worker Fleet',
      value: stats.activeWorkers.toString(),
      change: '3 decoupled stages',
      trend: 'up',
      icon: Cpu,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      link: 'workers' as PageId,
    },
    {
      label: 'Throughput (Jobs/Min)',
      value: `${stats.jobsPerMinute}`,
      change: '+6.4/min current pace',
      trend: 'up',
      icon: TrendingUp,
      color: 'text-electric-400',
      bg: 'bg-electric-500/10 border-electric-500/20',
      link: 'observatory' as PageId,
    },
    {
      label: 'p95 Processing Latency',
      value: `${stats.p95LatencySec}s`,
      change: 'SLA target: < 30s',
      trend: 'up',
      icon: Gauge,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      link: 'observatory' as PageId,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Observatory Recommendation Banner */}
      {observatory.recommendations.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-amber-950/40 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100 text-sm">
                  Smart Observatory Recommendation
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {observatory.recommendations[0].severity}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {observatory.recommendations[0].message}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('observatory')}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow-sm whitespace-nowrap"
          >
            Review Bottleneck Analysis
          </button>
        </div>
      )}

      {/* 8 Primary Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigate(card.link)}
              className="p-4 rounded-xl bg-[#0E1424] hover:bg-[#131B2E] border border-slate-800 hover:border-slate-700 transition cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg} border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-white tracking-tight">
                  {card.value}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
                  {card.trend === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />}
                  {card.trend === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
                  <span>{card.change}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section: Throughput Over Time + Department Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-Time Processing Throughput Trend */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Transcoding Throughput & Latency</h2>
              <p className="text-xs text-slate-400">Jobs completed per minute vs p95 processing duration (sec)</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-electric-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-electric-500"></span> Throughput
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span> p95 Latency
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockThroughputTrend}>
                <defs>
                  <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066FF" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0066FF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="throughput"
                  stroke="#0066FF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorThroughput)"
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLatency)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department-wise Workload Distribution */}
        <div className="p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white mb-1">Department Workload Allocation</h2>
            <p className="text-xs text-slate-400 mb-4">Total videos submitted across academic faculties</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.departmentWorkload} layout="vertical">
                  <XAxis type="number" stroke="#475569" fontSize={10} hide />
                  <YAxis
                    type="category"
                    dataKey="department"
                    stroke="#94A3B8"
                    fontSize={10}
                    width={90}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.departmentWorkload.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Fair-Share Allocator: Active</span>
            <button
              onClick={() => onNavigate('departments')}
              className="text-electric-400 hover:text-electric-300 font-medium"
            >
              Manage Quotas →
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Live Cluster Pipeline Activity</h2>
            <p className="text-xs text-slate-400">Streamed from Redis Pub/Sub events</p>
          </div>
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-xs text-electric-400 hover:text-electric-300 font-medium"
          >
            View Live Stage Visualizer →
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {stats.recentActivity.map((act) => (
            <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    act.status === 'success'
                      ? 'bg-emerald-400'
                      : act.status === 'error'
                      ? 'bg-rose-400'
                      : act.status === 'warning'
                      ? 'bg-amber-400'
                      : 'bg-blue-400'
                  }`}
                ></span>
                <span className="font-semibold text-slate-200">{act.action}</span>
                <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs sm:max-w-md">
                  {act.target}
                </span>
              </div>
              <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
                {act.timestamp}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


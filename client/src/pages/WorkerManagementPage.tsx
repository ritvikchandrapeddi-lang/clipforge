import React from 'react';
import {
  Cpu,
  Plus,
  Minus,
  Activity,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface WorkerManagementPageProps {
  onNavigate: (page: PageId) => void;
}

export const WorkerManagementPage: React.FC<WorkerManagementPageProps> = ({ onNavigate }) => {
  const { workers, scaleWorkers } = useSocket();

  const stages: ('validation' | 'conversion' | 'thumbnail')[] = [
    'validation',
    'conversion',
    'thumbnail',
  ];

  return (
    <div className="space-y-6">
      {/* Pool Scaling Overview Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stages.map((stage) => {
          const stageWorkers = workers.filter((w) => w.stage === stage);
          const busyCount = stageWorkers.filter((w) => w.status === 'busy').length;
          const avgCpu =
            stageWorkers.length > 0
              ? Math.round(
                  stageWorkers.reduce((acc, curr) => acc + curr.cpuUsage, 0) / stageWorkers.length
                )
              : 0;

          return (
            <div
              key={stage}
              className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    {stage} Pool
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {stageWorkers.length} nodes • {busyCount} active leases
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => scaleWorkers(stage, -1)}
                    disabled={stageWorkers.length <= 1}
                    title="Scale down pool"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => scaleWorkers(stage, 1)}
                    title="Scale up pool (+1 worker)"
                    className="p-1.5 rounded-lg bg-electric-600 hover:bg-electric-500 text-white transition shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Pool CPU Gauge */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Average CPU Utilization</span>
                  <span
                    className={`font-bold ${
                      avgCpu > 85
                        ? 'text-rose-400'
                        : avgCpu > 60
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {avgCpu}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      avgCpu > 85
                        ? 'bg-rose-500'
                        : avgCpu > 60
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${avgCpu}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Individual Worker Nodes Grid */}
      <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Active Worker Nodes & Telemetry</h3>
            <p className="text-xs text-slate-400">
              Heartbeats published every 2s with auto-recovery on crash
            </p>
          </div>
          <button
            onClick={() => onNavigate('loadtest')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Simulate Crash & Test Failover</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-3"
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      worker.status === 'busy'
                        ? 'bg-amber-400 animate-pulse'
                        : worker.status === 'idle'
                        ? 'bg-emerald-400'
                        : 'bg-slate-500'
                    }`}
                  ></div>
                  <span className="text-xs font-bold text-white">{worker.name}</span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {worker.stage}
                </span>
              </div>

              {/* Current Job Assignment */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs space-y-1">
                <span className="text-[10px] font-mono text-slate-500 block uppercase">
                  Current Execution Lease:
                </span>
                {worker.currentJobId ? (
                  <div>
                    <span className="text-slate-200 font-semibold truncate block">
                      {worker.currentVideoTitle || worker.currentJobId}
                    </span>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                      <span>Progress: {worker.currentJobProgress || 0}%</span>
                      <span>AMQP Ack Pending</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 italic font-mono text-[11px]">
                    Idle • Polling RabbitMQ prefetch...
                  </span>
                )}
              </div>

              {/* Resource Metrics & Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CPU Load</span>
                  <span className="font-bold text-slate-200">{worker.cpuUsage}%</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Memory RSS</span>
                  <span className="font-bold text-slate-200">{worker.memoryMb} MB</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Completed</span>
                  <span className="font-bold text-emerald-400">{worker.jobsCompleted}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Heartbeat</span>
                  <span className="font-bold text-slate-400">{worker.lastHeartbeat}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


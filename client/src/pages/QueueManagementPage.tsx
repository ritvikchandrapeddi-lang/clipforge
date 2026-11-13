import React from 'react';
import {
  Layers,
  Inbox,
  Clock,
  AlertOctagon,
  ArrowDownUp,
  Cpu,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface QueueManagementPageProps {
  onNavigate: (page: PageId) => void;
}

export const QueueManagementPage: React.FC<QueueManagementPageProps> = ({ onNavigate }) => {
  const { queues } = useSocket();

  const totalReady = queues.reduce((sum, q) => sum + q.messagesReady, 0);
  const totalUnacked = queues.reduce((sum, q) => sum + q.messagesUnacknowledged, 0);

  return (
    <div className="space-y-6">
      {/* Topology summary banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Total Pending Messages</span>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">{totalReady}</div>
            <span className="text-[11px] text-cyan-400 font-mono">Ready in stage buffers</span>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">In-Flight Unacked</span>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">{totalUnacked}</div>
            <span className="text-[11px] text-amber-400 font-mono">Worker lease holding</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Exchange Persistence</span>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">Durable</div>
            <span className="text-[11px] text-slate-400 font-mono">Survives RabbitMQ Restart</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* RabbitMQ Queues Table */}
      <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Durable AMQP Queue Topology</h3>
            <p className="text-xs text-slate-400">
              Direct and Dead-Letter Exchanges with manual channel prefetch=1
            </p>
          </div>
          <button
            onClick={() => onNavigate('deadletter')}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium"
          >
            Manage Dead Letters →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                <th className="py-2.5 px-3">Queue Identifier</th>
                <th className="py-2.5 px-3">Stage / Role</th>
                <th className="py-2.5 px-3">Messages Ready</th>
                <th className="py-2.5 px-3">Unacknowledged</th>
                <th className="py-2.5 px-3">Total Messages</th>
                <th className="py-2.5 px-3">Active Consumers</th>
                <th className="py-2.5 px-3">In Rate</th>
                <th className="py-2.5 px-3">Out Rate</th>
                <th className="py-2.5 px-3">Backpressure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {queues.map((q) => {
                const backpressureLevel =
                  q.messagesReady > 20 ? 'high' : q.messagesReady > 5 ? 'moderate' : 'low';

                return (
                  <tr key={q.name} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-3 font-mono font-medium text-white flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>{q.name}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="capitalize px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300">
                        {q.stage}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-white font-bold">
                      {q.messagesReady}
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-400">
                      {q.messagesUnacknowledged}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {q.totalMessages}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-purple-400" />
                      <span>{q.consumers} workers</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {q.inRatePerSec} msg/s
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {q.outRatePerSec} msg/s
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                          backpressureLevel === 'high'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : backpressureLevel === 'moderate'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {backpressureLevel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

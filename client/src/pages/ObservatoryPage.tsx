import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Cpu,
  Layers,
  Zap,
  TrendingUp,
  Gauge,
  Plus,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface ObservatoryPageProps {
  onNavigate: (page: PageId) => void;
}

export const ObservatoryPage: React.FC<ObservatoryPageProps> = ({ onNavigate }) => {
  const { observatory, queues, workers, scaleWorkers } = useSocket();

  const handleApplyRecommendation = (rec: any) => {
    if (rec.stage === 'conversion') {
      scaleWorkers('conversion', 2);
    } else if (rec.stage === 'validation') {
      scaleWorkers('validation', 1);
    } else if (rec.stage === 'dlq') {
      onNavigate('deadletter');
    } else if (rec.stage === 'departments') {
      onNavigate('departments');
    }
  };

  return (
    <div className="space-y-6">
      {/* Smart Observatory Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-electric-600/20 text-electric-400 border border-electric-500/30">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Smart Processing Observatory & Bottleneck Engine
              </h2>
              <p className="text-xs text-slate-400">
                Deterministic rule-based heuristics evaluating RabbitMQ queue depths, worker CPU saturation and SLA breach risks
              </p>
            </div>
          </div>
        </div>

        {/* Health status pill */}
        <div className="flex items-center gap-3">
          <div
            className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-mono font-bold uppercase shadow-sm ${
              observatory.overallHealth === 'optimal'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : observatory.overallHealth === 'degraded'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                observatory.overallHealth === 'optimal'
                  ? 'bg-emerald-400'
                  : observatory.overallHealth === 'degraded'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500 animate-ping'
              }`}
            ></span>
            <span>Cluster Status: {observatory.overallHealth}</span>
          </div>
        </div>
      </div>

      {/* Primary Diagnostic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overall Fleet Utilization</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-2">
            {observatory.overallUtilizationPct}%
          </div>
          <span className="text-[11px] text-amber-400 font-mono">
            {observatory.activeWorkerCount} active transcoding workers
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Aggregated Queue Backlog</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-2">
            {observatory.totalQueueDepth} msg
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Across 5 durable queues</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Current Transcode Rate</span>
            <TrendingUp className="w-4 h-4 text-electric-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-2">
            {observatory.throughputPerMinute} /min
          </div>
          <span className="text-[11px] text-emerald-400 font-mono">H.264 profiles generated</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>p95 Turnaround Latency</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-2">
            {observatory.p95ProcessingTimeSeconds}s
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Within 30s SLA target</span>
        </div>
      </div>

      {/* Identified Bottlenecks List */}
      <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Identified Pipeline Bottlenecks
        </h3>

        <div className="space-y-2">
          {observatory.bottlenecks.map((bottleneck, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-amber-200 font-medium">{bottleneck}</span>
              </div>
              <span className="text-[10px] font-mono text-amber-300/80 uppercase">
                Active Constriction
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Proactive Rule-Based Recommendations */}
      <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-electric-400" />
            Deterministic Actionable Recommendations
          </h3>
          <p className="text-xs text-slate-400">
            Transparent heuristic engine evaluates thresholds and produces immediate mitigation actions
          </p>
        </div>

        <div className="space-y-4">
          {observatory.recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition ${
                rec.severity === 'critical'
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : rec.severity === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-blue-500/5 border-blue-500/30'
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                      rec.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-300'
                        : rec.severity === 'warning'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {rec.severity}
                  </span>
                  <h4 className="text-xs font-bold text-white">{rec.title}</h4>
                </div>

                <p className="text-xs text-slate-300">{rec.message}</p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 pt-1">
                  <span>
                    <strong>Rule Trigger:</strong> {rec.metricTrigger}
                  </span>
                  <span>•</span>
                  <span className="text-electric-300">
                    <strong>Suggested Action:</strong> {rec.action}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleApplyRecommendation(rec)}
                className="px-4 py-2 rounded-lg bg-electric-600 hover:bg-electric-500 text-white font-semibold text-xs shadow-glow-sm transition whitespace-nowrap flex items-center gap-1.5"
              >
                <span>Execute Recommendation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

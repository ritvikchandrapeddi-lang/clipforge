import React from 'react';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Film,
  Image,
  Sparkles,
  AlertCircle,
  Cpu,
  Layers,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface ProcessingPipelinePageProps {
  onNavigate: (page: PageId) => void;
}

export const ProcessingPipelinePage: React.FC<ProcessingPipelinePageProps> = ({ onNavigate }) => {
  const { jobs, queues, workers } = useSocket();

  const stages = [
    {
      id: 'validation',
      name: '1. Validation',
      desc: 'Container, codecs, mime & corruption check',
      icon: ShieldCheck,
      color: 'blue',
      activeJobs: jobs.filter((j) => j.stage === 'validation' && j.status === 'processing').length,
      queueReady: queues.find((q) => q.stage === 'validation')?.messagesReady || 0,
      workerCount: workers.filter((w) => w.stage === 'validation').length,
    },
    {
      id: 'conversion',
      name: '2. Conversion',
      desc: 'Transcoding 360p, 720p, 1080p H.264',
      icon: Film,
      color: 'purple',
      activeJobs: jobs.filter((j) => j.stage === 'conversion' && j.status === 'processing').length,
      queueReady: queues.find((q) => q.stage === 'conversion')?.messagesReady || 0,
      workerCount: workers.filter((w) => w.stage === 'conversion').length,
    },
    {
      id: 'thumbnail',
      name: '3. Thumbnail',
      desc: 'Poster capture at keyframe offset',
      icon: Image,
      color: 'cyan',
      activeJobs: jobs.filter((j) => j.stage === 'thumbnail' && j.status === 'processing').length,
      queueReady: queues.find((q) => q.stage === 'thumbnail')?.messagesReady || 0,
      workerCount: workers.filter((w) => w.stage === 'thumbnail').length,
    },
    {
      id: 'preview_strip',
      name: '4. Preview Strip',
      desc: 'Timestamped timeline scrub sprite montage',
      icon: Sparkles,
      color: 'emerald',
      activeJobs: 1,
      queueReady: 0,
      workerCount: 2,
    },
    {
      id: 'ready',
      name: '5. Ready',
      desc: 'Published to video library for multi-bitrate streaming',
      icon: CheckCircle2,
      color: 'green',
      activeJobs: 0,
      queueReady: 0,
      workerCount: 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Visual Pipeline Flow Header */}
      <div className="p-6 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm overflow-x-auto">
        <h3 className="text-sm font-bold text-white mb-1">
          Stage State Machine & Message Distribution
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Durable RabbitMQ message passing between decoupled worker pools with manual acks
        </p>

        <div className="flex items-center min-w-[850px] justify-between relative">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <React.Fragment key={stage.id}>
                {/* Stage Node */}
                <div className="flex-1 max-w-[170px] p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col items-center text-center group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white mb-2 shadow-sm group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5 text-electric-400" />
                  </div>
                  <h4 className="text-xs font-bold text-white">{stage.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                    {stage.desc}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 w-full flex items-center justify-around text-[10px] font-mono">
                    <span className="text-amber-400" title="Active Jobs in Stage">
                      {stage.activeJobs} Active
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-cyan-400" title="Messages Waiting in Queue">
                      {stage.queueReady} Queue
                    </span>
                  </div>
                </div>

                {/* Arrow connector */}
                {idx < stages.length - 1 && (
                  <div className="flex flex-col items-center px-2 text-slate-600">
                    <ArrowRight className="w-5 h-5 text-electric-500 animate-pulse" />
                    <span className="text-[9px] font-mono text-slate-500 mt-1">Durable AMQP</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Active Pipeline Jobs Table */}
      <div className="p-5 rounded-xl bg-[#0E1424] border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">In-Flight Stage Executions</h3>
            <p className="text-xs text-slate-400">Atomic worker leases tracked via Redis</p>
          </div>
          <button
            onClick={() => onNavigate('workers')}
            className="text-xs text-electric-400 hover:text-electric-300 font-medium"
          >
            Worker Pool Scaling Controls →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                <th className="py-2.5 px-3">Job ID</th>
                <th className="py-2.5 px-3">Lecture Title</th>
                <th className="py-2.5 px-3">Current Stage</th>
                <th className="py-2.5 px-3">Assigned Worker</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Progress</th>
                <th className="py-2.5 px-3">Attempts</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-900/50 transition">
                  <td className="py-3 px-3 font-mono text-slate-400">{job.id}</td>
                  <td className="py-3 px-3 font-medium text-white max-w-xs truncate">
                    {job.videoTitle || 'Lecture Video Asset'}
                  </td>
                  <td className="py-3 px-3">
                    <span className="capitalize px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300">
                      {job.stage}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                    {job.workerId || 'Pending Worker Claim'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        job.priority === 'urgent'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {job.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          job.status === 'failed' ? 'bg-rose-500' : 'bg-electric-500'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                      {job.progress}%
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {job.attempts} / {job.maxAttempts}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        job.status === 'processing'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : job.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : job.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


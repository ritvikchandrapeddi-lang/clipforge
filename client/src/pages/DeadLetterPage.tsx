import React, { useState } from 'react';
import {
  AlertOctagon,
  RotateCcw,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface DeadLetterPageProps {
  onNavigate: (page: PageId) => void;
}

export const DeadLetterPage: React.FC<DeadLetterPageProps> = ({ onNavigate }) => {
  const { deadLetters, replayDeadLetter } = useSocket();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleReplayAll = () => {
    deadLetters.forEach((dl) => {
      if (!dl.replayed) replayDeadLetter(dl.id);
    });
  };

  const unreplayedCount = deadLetters.filter((d) => !d.replayed).length;

  return (
    <div className="space-y-6">
      {/* Policy and Replay Controls Banner */}
      <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Dead Letter Exchange (DLX) Quarantine</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Max 3 Retries Exhausted
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Jobs that repeatedly crash workers or fail validation are isolated to prevent cluster poisoning.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReplayAll}
            disabled={unreplayedCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-electric-600 hover:bg-electric-500 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay All Eligible ({unreplayedCount})</span>
          </button>
        </div>
      </div>

      {/* Dead Letter Records List */}
      <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-4">
        <h4 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
          Quarantined Message Payloads ({deadLetters.length})
        </h4>

        {deadLetters.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Dead Letter Sink is clean. Zero jobs currently in quarantine.
          </div>
        ) : (
          <div className="space-y-3">
            {deadLetters.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition overflow-hidden"
              >
                {/* Header row */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                  >
                    <button className="text-slate-400 hover:text-white">
                      {expandedId === item.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <AlertOctagon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{item.videoTitle}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.stage}
                        </span>
                        {item.replayed && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Replayed to AMQP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-300 font-mono mt-0.5">{item.error}</p>
                    </div>
                  </div>

                  {/* Replay action */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                      {item.attempts} attempts • {item.timestamp}
                    </span>
                    {!item.replayed ? (
                      <button
                        onClick={() => replayDeadLetter(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-electric-600 text-slate-200 hover:text-white text-xs font-semibold transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Replay</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">Dispatched</span>
                    )}
                  </div>
                </div>

                {/* Expanded Payload & Diagnostics */}
                {expandedId === item.id && (
                  <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 space-y-3 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-blue-400" />
                        Original Message Payload Envelope
                      </span>
                      <span>Job ID: {item.jobId}</span>
                    </div>
                    <pre className="p-3 rounded-lg bg-black/60 border border-slate-800 text-slate-300 text-[11px] overflow-x-auto">
                      {JSON.stringify(
                        {
                          jobId: item.jobId,
                          videoId: item.videoId,
                          failedStage: item.stage,
                          deathReason: item.error,
                          attempts: item.attempts,
                          routingKey: `clipforge.stage.${item.stage}`,
                          payload: item.payload,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

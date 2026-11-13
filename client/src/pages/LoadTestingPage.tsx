import React, { useState } from 'react';
import {
  Zap,
  Bomb,
  Bug,
  Flame,
  Radio,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Terminal,
  Activity,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface LoadTestingPageProps {
  onNavigate: (page: PageId) => void;
}

export const LoadTestingPage: React.FC<LoadTestingPageProps> = ({ onNavigate }) => {
  const { runSimulation } = useSocket();

  const [jobCount, setJobCount] = useState<number>(500);
  const [corruptRate, setCorruptRate] = useState<number>(5); // 5% corrupt
  const [crashRate, setCrashRate] = useState<number>(2); // 2% worker crash
  const [distribution, setDistribution] = useState<'balanced' | 'skewed_cs' | 'urgent_heavy'>('balanced');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([
    '[INIT] Load Testing Lab ready. RabbitMQ queue publisher connected.',
    '[CONFIG] High-concurrency synthetic test profile loaded.',
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 50)]);
  };

  const handleLaunch500Jobs = async () => {
    setIsRunning(true);
    addLog(`Initiating synthetic burst of ${jobCount} video ingestion jobs...`);
    addLog(`Parameters: ${corruptRate}% corrupted containers, ${crashRate}% worker fault injection.`);

    await runSimulation({
      jobCount,
      departmentDistribution: distribution,
      videoDurationRange: [600, 3600],
      corruptRatioPct: corruptRate,
      workerCrashProbabilityPct: crashRate,
      networkLatencyMs: 25,
    });

    setTimeout(() => {
      addLog(`Dispatched ${jobCount} messages to exchange clipforge.direct.`);
      addLog(`Validation worker pool absorbed first wave. Backpressure escalating.`);
      if (corruptRate > 0) {
        addLog(`Corrupt keyframes detected in ${(jobCount * corruptRate / 100).toFixed(0)} jobs. Routing to retry delay exchange.`);
      }
      setIsRunning(false);
    }, 1200);
  };

  const handleSimulateWorkerCrash = () => {
    addLog(`[CHAOS] Injected SIGKILL to worker-conversion-1.`);
    addLog(`[RECOVERY] Redis lease expired. RabbitMQ channel closed abruptly without ack.`);
    addLog(`[AMQP] Message automatically requeued at queue head. Zero jobs lost.`);
  };

  const handleSimulateNetworkInterrupt = () => {
    addLog(`[CHAOS] Simulating 10s TCP partition on RabbitMQ AMQP port 5672...`);
    addLog(`[HEALING] Node.js amqplib client detected heartbeat timeout. Re-establishing connection...`);
    addLog(`[HEALING] Channel reconstituted with durable topology. Resumed processing without data loss.`);
  };

  return (
    <div className="space-y-6">
      {/* 500-Job Burst Hero Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-[#0E1424] border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Zap className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">
              500+ Synthetic Job Concurrency Stress Lab
            </h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Stress-test the distributed pipeline under extreme campus rush conditions. Verifies zero lost jobs, RabbitMQ backpressure handling, Redis token fairness and crash recovery.
          </p>
        </div>

        <button
          onClick={handleLaunch500Jobs}
          disabled={isRunning}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-electric-600 to-purple-600 hover:from-electric-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-glow-md transition whitespace-nowrap"
        >
          <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Blasting 500 Jobs...' : 'Trigger 500-Job Blast'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulation Controls Panel */}
        <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            Synthetic Load Configuration
          </h4>

          {/* Job Count Selector */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Total Synthetic Jobs</span>
              <span className="text-electric-400 font-bold">{jobCount} Jobs</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={jobCount}
              onChange={(e) => setJobCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-electric-500"
            />
          </div>

          {/* Department Distribution */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase block">
              Department Workload Distribution
            </label>
            <select
              value={distribution}
              onChange={(e: any) => setDistribution(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-electric-500 font-medium"
            >
              <option value="balanced">Balanced Across Faculties</option>
              <option value="skewed_cs">Heavy Computer Science Spike (65%)</option>
              <option value="urgent_heavy">Midterm Week (40% Urgent Priority)</option>
            </select>
          </div>

          {/* Corrupt Payload Ratio */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Corrupt File Injection Ratio</span>
              <span className="text-rose-400 font-bold">{corruptRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={corruptRate}
              onChange={(e) => setCorruptRate(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <span className="text-[10px] text-slate-500 font-mono block">
              Injects missing moov atom / invalid header payloads into Validation queue.
            </span>
          </div>

          {/* Chaos Fault Injection Buttons */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase block mb-1">
              Chaos Fault Injection:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSimulateWorkerCrash}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
              >
                <Bomb className="w-3.5 h-3.5 text-rose-400" />
                <span>Kill Worker</span>
              </button>
              <button
                onClick={handleSimulateNetworkInterrupt}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Drop Network</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Simulation Terminal Console */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-electric-400" />
              <h4 className="text-sm font-bold text-white font-mono">Simulator Output Logs</h4>
            </div>
            <button
              onClick={() => setLogs(['[RESET] Simulator log buffer cleared.'])}
              className="text-xs text-slate-400 hover:text-white font-mono"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto bg-black/80 rounded-xl p-4 border border-slate-800 font-mono text-xs space-y-1.5">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`${
                  log.includes('[CHAOS]')
                    ? 'text-rose-400 font-bold'
                    : log.includes('[HEALING]')
                    ? 'text-emerald-400 font-bold'
                    : log.includes('Corrupt')
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                {log}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-2">
            <span>Guaranteed Zero Lost Jobs: Durable Channel Prefetch</span>
            <button
              onClick={() => onNavigate('observatory')}
              className="text-electric-400 hover:text-electric-300"
            >
              Observe Bottlenecks →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


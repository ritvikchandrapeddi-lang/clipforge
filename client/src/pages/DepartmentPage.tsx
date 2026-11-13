import React from 'react';
import {
  Building2,
  Clock,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { PageId } from '../components/Sidebar';

interface DepartmentPageProps {
  onNavigate: (page: PageId) => void;
}

export const DepartmentPage: React.FC<DepartmentPageProps> = ({ onNavigate }) => {
  const { departments, updateDepartmentWeight } = useSocket();

  return (
    <div className="space-y-6">
      {/* Fair Scheduling Policy Banner */}
      <div className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Weighted Fair-Share & Quota Governor</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Redis Atomic Token Bucket
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Prevents any single academic department from monopolizing the transcoding worker pool while prioritizing urgent exam reviews.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
          <Scale className="w-4 h-4 text-electric-400" />
          <span>Fairness Multiplier Active</span>
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {departments.map((dept) => {
          const usagePercent = Math.min(100, Math.round((dept.usedHours / dept.quotaHours) * 100));
          const isOverQuota = usagePercent >= 90;

          return (
            <div
              key={dept.id}
              className="p-5 rounded-2xl bg-[#0E1424] border border-slate-800 shadow-sm space-y-4"
            >
              {/* Department title & code */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-electric-400 border border-blue-500/20 flex items-center justify-center font-bold font-mono">
                    {dept.code}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{dept.name}</h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      ID: {dept.id} • {dept.activeJobs} active in-flight jobs
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                    isOverQuota
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isOverQuota ? 'Quota Near Cap' : 'Within Quota'}
                </span>
              </div>

              {/* Quota Usage Gauge */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Compute Hours Consumed</span>
                  <span className="text-white font-bold">
                    {dept.usedHours.toFixed(1)} / {dept.quotaHours}h ({usagePercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isOverQuota
                        ? 'bg-rose-500'
                        : usagePercent > 65
                        ? 'bg-amber-500'
                        : 'bg-electric-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Priority Weight Slider */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5 font-semibold">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    Fairness Weight Multiplier:
                  </span>
                  <span className="text-electric-400 font-bold text-sm">
                    {dept.priorityWeight.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={dept.priorityWeight}
                  onChange={(e) => updateDepartmentWeight(dept.id, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-electric-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>0.5x (Deprioritized)</span>
                  <span>1.0x (Standard)</span>
                  <span>3.0x (Priority Faculty)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

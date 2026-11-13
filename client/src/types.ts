export type VideoPriority = 'urgent' | 'standard';

export type VideoStage = 'validation' | 'conversion' | 'thumbnail' | 'ready' | 'failed';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface VideoResolutionFiles {
  '360p'?: string;
  '720p'?: string;
  '1080p'?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  departmentId: string;
  departmentName?: string;
  priority: VideoPriority;
  status: VideoStage;
  currentStage: VideoStage;
  uploadProgress: number; // 0 - 100
  isUploadComplete: boolean;
  totalChunks: number;
  uploadedChunks: number;
  duration?: number; // seconds
  resolutions: VideoResolutionFiles;
  thumbnailUrl?: string;
  previewStripUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoJob {
  id: string;
  videoId: string;
  videoTitle?: string;
  stage: 'validation' | 'conversion' | 'thumbnail';
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  workerId?: string;
  progress: number;
  departmentId: string;
  priority: VideoPriority;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface WorkerInfo {
  id: string;
  name: string;
  stage: 'validation' | 'conversion' | 'thumbnail';
  status: 'idle' | 'busy' | 'offline';
  concurrency: number;
  currentJobId?: string;
  currentVideoTitle?: string;
  currentJobProgress?: number;
  jobsCompleted: number;
  jobsFailed: number;
  cpuUsage: number;
  memoryMb: number;
  lastHeartbeat: string;
}

export interface QueueStat {
  name: string;
  stage: 'validation' | 'conversion' | 'thumbnail' | 'retry' | 'dlq';
  messagesReady: number;
  messagesUnacknowledged: number;
  totalMessages: number;
  consumers: number;
  inRatePerSec: number;
  outRatePerSec: number;
}

export interface DeadLetterItem {
  id: string;
  jobId: string;
  videoId: string;
  videoTitle: string;
  stage: string;
  error: string;
  attempts: number;
  timestamp: string;
  payload: any;
  replayed: boolean;
}

export interface DepartmentInfo {
  id: string;
  name: string;
  code: string;
  quotaHours: number;
  usedHours: number;
  activeJobs: number;
  priorityWeight: number;
}

export interface Recommendation {
  id: string;
  severity: 'normal' | 'warning' | 'critical';
  stage: string;
  title: string;
  message: string;
  metricTrigger: string;
  action: string;
}

export interface ObservatoryAnalysis {
  overallHealth: 'optimal' | 'degraded' | 'critical';
  totalQueueDepth: number;
  activeWorkerCount: number;
  overallUtilizationPct: number;
  throughputPerMinute: number;
  p95ProcessingTimeSeconds: number;
  bottlenecks: string[];
  recommendations: Recommendation[];
}

export interface SystemOverviewStats {
  totalVideos: number;
  completedJobs: number;
  processingJobs: number;
  failedJobs: number;
  queueDepth: number;
  activeWorkers: number;
  jobsPerMinute: number;
  p95LatencySec: number;
  departmentWorkload: { department: string; count: number }[];
  recentActivity: {
    id: string;
    action: string;
    target: string;
    timestamp: string;
    status: 'success' | 'warning' | 'info' | 'error';
  }[];
}

export interface SimulationParams {
  jobCount: number;
  departmentDistribution: 'balanced' | 'skewed_cs' | 'urgent_heavy';
  videoDurationRange: [number, number];
  corruptRatioPct: number;
  workerCrashProbabilityPct: number;
  networkLatencyMs: number;
}


import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  VideoItem,
  VideoJob,
  WorkerInfo,
  QueueStat,
  DeadLetterItem,
  DepartmentInfo,
  ObservatoryAnalysis,
  SystemOverviewStats,
  SimulationParams,
} from '../types';
import {
  mockOverviewStats,
  mockVideos,
  mockJobs,
  mockWorkers,
  mockQueues,
  mockDeadLetters,
  mockDepartments,
  mockObservatory,
} from '../mockData';

interface SocketContextType {
  isConnected: boolean;
  activeWebInstance: string;
  stats: SystemOverviewStats;
  videos: VideoItem[];
  jobs: VideoJob[];
  workers: WorkerInfo[];
  queues: QueueStat[];
  deadLetters: DeadLetterItem[];
  departments: DepartmentInfo[];
  observatory: ObservatoryAnalysis;
  uploadingFiles: UploadState[];
  selectedVideoForPlayer: VideoItem | null;
  setSelectedVideoForPlayer: (video: VideoItem | null) => void;
  startUpload: (files: File[], departmentId: string, priority: 'urgent' | 'standard') => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  scaleWorkers: (stage: 'validation' | 'conversion' | 'thumbnail', delta: number) => void;
  replayDeadLetter: (id: string) => void;
  runSimulation: (params: SimulationParams) => Promise<void>;
  updateDepartmentWeight: (id: string, weight: number) => void;
  refreshData: () => Promise<void>;
}

export interface UploadState {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  status: 'uploading' | 'paused' | 'completed' | 'error';
  departmentId: string;
  priority: 'urgent' | 'standard';
  errorMessage?: string;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeWebInstance, setActiveWebInstance] = useState<string>('web-instance-1 (Active)');
  const [stats, setStats] = useState<SystemOverviewStats>(mockOverviewStats);
  const [videos, setVideos] = useState<VideoItem[]>(mockVideos);
  const [jobs, setJobs] = useState<VideoJob[]>(mockJobs);
  const [workers, setWorkers] = useState<WorkerInfo[]>(mockWorkers);
  const [queues, setQueues] = useState<QueueStat[]>(mockQueues);
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>(mockDeadLetters);
  const [departments, setDepartments] = useState<DepartmentInfo[]>(mockDepartments);
  const [observatory, setObservatory] = useState<ObservatoryAnalysis>(mockObservatory);
  const [uploadingFiles, setUploadingFiles] = useState<UploadState[]>([]);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<VideoItem | null>(mockVideos[0]);

  // Attempt real WebSocket connection to backend
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      const wsUrl = window.location.protocol === 'https:'
        ? `wss://${window.location.host}/ws`
        : `ws://${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYNC_ALL' || data.type === 'METRICS_UPDATE') {
              if (data.stats) setStats(data.stats);
              if (data.videos) setVideos(data.videos);
              if (data.jobs) setJobs(data.jobs);
              if (data.workers) setWorkers(data.workers);
              if (data.queues) setQueues(data.queues);
              if (data.deadLetters) setDeadLetters(data.deadLetters);
              if (data.departments) setDepartments(data.departments);
              if (data.observatory) setObservatory(data.observatory);
              if (data.instanceId) setActiveWebInstance(data.instanceId);
            } else if (data.type === 'JOB_PROGRESS') {
              setJobs((prev) =>
                prev.map((j) => (j.id === data.jobId ? { ...j, progress: data.progress, status: data.status } : j))
              );
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Try reconnecting after 3 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
          ws?.close();
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Simulated live background pulse when backend is disconnected
  useEffect(() => {
    if (isConnected) return;

    const interval = setInterval(() => {
      // Small simulated throughput and job progress updates
      setStats((prev) => ({
        ...prev,
        jobsPerMinute: +(40 + Math.random() * 5).toFixed(1),
        p95LatencySec: +(14 + Math.random() * 2).toFixed(1),
      }));

      setWorkers((prev) =>
        prev.map((w) => {
          if (w.status === 'busy') {
            const nextProgress = ((w.currentJobProgress || 50) + 3) % 100;
            return {
              ...w,
              currentJobProgress: nextProgress,
              cpuUsage: Math.min(99, Math.max(70, Math.floor(w.cpuUsage + (Math.random() * 6 - 3)))),
            };
          }
          return w;
        })
      );
    }, 2500);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Upload handlers
  const startUpload = useCallback((files: File[], departmentId: string, priority: 'urgent' | 'standard') => {
    const newUploads: UploadState[] = files.map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      status: 'uploading',
      departmentId,
      priority,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploads]);

    // Perform chunked upload simulation or HTTP POST
    newUploads.forEach((uploadItem) => {
      let currentProgress = 0;
      const uploadTimer = setInterval(() => {
        currentProgress += 15;
        if (currentProgress >= 100) {
          clearInterval(uploadTimer);
          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === uploadItem.id ? { ...item, progress: 100, status: 'completed' } : item
            )
          );

          // Add newly uploaded video to videos list and queue validation
          const dept = mockDepartments.find((d) => d.id === departmentId);
          const newVideo: VideoItem = {
            id: `vid-${Date.now()}`,
            title: uploadItem.name.replace(/\.[^/.]+$/, ''),
            originalName: uploadItem.name,
            mimeType: uploadItem.file.type || 'video/mp4',
            size: uploadItem.size,
            hash: 'sha256-' + Math.random().toString(36).substring(2),
            departmentId,
            departmentName: dept ? dept.name : 'Computer Science',
            priority,
            status: 'validation',
            currentStage: 'validation',
            uploadProgress: 100,
            isUploadComplete: true,
            totalChunks: Math.ceil(uploadItem.size / (5 * 1024 * 1024)),
            uploadedChunks: Math.ceil(uploadItem.size / (5 * 1024 * 1024)),
            duration: 1800,
            resolutions: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          setVideos((prev) => [newVideo, ...prev]);

          // Add corresponding job
          const newJob: VideoJob = {
            id: `job-${Date.now()}`,
            videoId: newVideo.id,
            videoTitle: newVideo.title,
            stage: 'validation',
            status: 'processing',
            attempts: 1,
            maxAttempts: 3,
            progress: 15,
            departmentId,
            priority,
            startedAt: new Date().toISOString(),
          };
          setJobs((prev) => [newJob, ...prev]);
        } else {
          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === uploadItem.id ? { ...item, progress: currentProgress } : item
            )
          );
        }
      }, 500);
    });
  }, []);

  const pauseUpload = useCallback((id: string) => {
    setUploadingFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'paused' } : item))
    );
  }, []);

  const resumeUpload = useCallback((id: string) => {
    setUploadingFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'uploading' } : item))
    );
  }, []);

  const cancelUpload = useCallback((id: string) => {
    setUploadingFiles((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const scaleWorkers = useCallback((stage: 'validation' | 'conversion' | 'thumbnail', delta: number) => {
    setWorkers((prev) => {
      if (delta > 0) {
        const count = prev.filter((w) => w.stage === stage).length + 1;
        const newWorker: WorkerInfo = {
          id: `worker-${stage}-${Date.now()}`,
          name: `${stage.charAt(0).toUpperCase() + stage.slice(1)} Worker #${count}`,
          stage,
          status: 'idle',
          concurrency: 2,
          jobsCompleted: 0,
          jobsFailed: 0,
          cpuUsage: 8,
          memoryMb: 120,
          lastHeartbeat: 'just now',
        };
        return [...prev, newWorker];
      } else {
        const index = prev.findIndex((w) => w.stage === stage && w.status === 'idle');
        if (index !== -1) {
          return prev.filter((_, idx) => idx !== index);
        }
        return prev;
      }
    });
  }, []);

  const replayDeadLetter = useCallback((id: string) => {
    setDeadLetters((prev) =>
      prev.map((dl) => (dl.id === id ? { ...dl, replayed: true } : dl))
    );
  }, []);

  const runSimulation = useCallback(async (params: SimulationParams) => {
    // Increase queue depths and stats to reflect heavy load simulation
    setStats((prev) => ({
      ...prev,
      queueDepth: prev.queueDepth + params.jobCount,
      processingJobs: prev.processingJobs + Math.min(20, params.jobCount),
    }));

    setQueues((prev) =>
      prev.map((q) => {
        if (q.stage === 'conversion') {
          return { ...q, messagesReady: q.messagesReady + Math.floor(params.jobCount * 0.5) };
        }
        if (q.stage === 'validation') {
          return { ...q, messagesReady: q.messagesReady + Math.floor(params.jobCount * 0.3) };
        }
        return q;
      })
    );
  }, []);

  const updateDepartmentWeight = useCallback((id: string, weight: number) => {
    setDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, priorityWeight: weight } : d))
    );
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/overview');
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        if (data.videos) setVideos(data.videos);
        if (data.workers) setWorkers(data.workers);
        if (data.queues) setQueues(data.queues);
        if (data.observatory) setObservatory(data.observatory);
      }
    } catch (e) {
      console.log('API refresh skipped, running offline mode');
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        activeWebInstance,
        stats,
        videos,
        jobs,
        workers,
        queues,
        deadLetters,
        departments,
        observatory,
        uploadingFiles,
        selectedVideoForPlayer,
        setSelectedVideoForPlayer,
        startUpload,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        scaleWorkers,
        replayDeadLetter,
        runSimulation,
        updateDepartmentWeight,
        refreshData,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

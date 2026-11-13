# ClipForge — Distributed Lecture Video Processing Platform

ClipForge is an enterprise-grade distributed video processing platform designed to handle massive volumes of university and institutional lecture recordings. It features resumable chunk-based uploads, multi-stage fault-tolerant processing (validation, multi-bitrate H.264 transcoding, thumbnail extraction, and preview strips), independent worker pools, department-wise fair scheduling with priority tiers, real-time WebSocket progress streaming without polling, and the **Smart Processing Observatory** for live bottleneck detection.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   React + Vite Frontend     |
                      |   (Lucide + Recharts + WS)  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |      Nginx Load Balancer    |
                      |     (Port 4000 Reverse Proxy|
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
+-----------------------------+             +-----------------------------+
|    Web Instance 1 (Node)    |             |    Web Instance 2 (Node)    |
|    Port 4001                |             |    Port 4002                |
+--------------+--------------+             +--------------+--------------+
               |                                           |
               +---------------------+---------------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +-------------------+       +-------------------+
|  PostgreSQL 16   |       |   RabbitMQ 3.13   |       |     Redis 7       |
| (Durable Records)|       | (Durable Queues,  |       | (Shared Progress, |
|                  |       |  DLQ, Retries)    |       |  Quotas, Pub/Sub) |
+------------------+       +---------+---------+       +---------+---------+
                                     |                           ^
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +-------------------+       +-------------------+
| Validation Pool  |       |  Conversion Pool  |       |  Thumbnail Pool   |
| (Integrity, FFprobe)     | (360p, 720p, 1080p|       | (Thumbnails,      |
|                  |       |  H.264 Multi-pass)|       |  Preview Strips)  |
+--------+---------+       +---------+---------+       +---------+---------+
         |                           |                           |
         +---------------------------+---------------------------+
                                     |
                                     v
                      +-----------------------------+
                      |    Shared Video Storage     |
                      | (Resumable Chunks & Transcoded)
                      +-----------------------------+
```

---

## Key System Features

1. **Resumable Chunk-based Uploads**: Splits lecture files into standard 5MB chunks with checksum verification, pause/resume, upload recovery, and deduplication detection.
2. **Multi-Stage Processing Pipeline**:
   - **Stage 1 (Validation)**: File integrity check, container format validation, codec verification, audio track detection.
   - **Stage 2 (Conversion)**: Multi-bitrate transcoding to 360p, 720p, and 1080p using FFmpeg.
   - **Stage 3 (Thumbnail & Preview Strips)**: Poster frame capture and timestamped timeline scrubbing preview strips.
3. **Enterprise Queue Architecture**:
   - Pure RabbitMQ (`amqplib`) without external workflow wrappers.
   - Durable queues, persistent messages, publisher confirms, and manual acknowledgements.
   - Dead-letter exchange (`dlx.direct`), retry queues with TTL backing-off, and maximum 3 attempts.
4. **Shared Real-Time State & Fair Scheduling**:
   - Redis for atomic quota verification, department fairness tokens, and Pub/Sub live progress updates.
   - Zero lost jobs on worker crash with message requeueing and lease heartbeats.
5. **High Availability**:
   - Dual stateless web instances behind Nginx load balancer.
   - Full recovery after RabbitMQ restart or web instance crash.
6. **Smart Processing Observatory**:
   - Rule-based bottleneck identification engine computing queue depth, worker utilization, throughput, and p95 latency.
   - Dynamic recommendation alerts (e.g., auto-scale conversion workers, queue congestion warnings).
7. **500-Job Load Simulator**:
   - High-concurrency test lab capable of blasting 500+ synthetic jobs, corrupt payload injections, and simulated worker faults.

---

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts.
- **Backend**: Node.js, Express, PostgreSQL, RabbitMQ (`amqplib`), Redis (`ioredis`), WebSocket (`ws`), FFmpeg (`fluent-ffmpeg` / `@ffmpeg-installer/ffmpeg`).
- **DevOps**: Docker Compose, Nginx, Multi-stage Dockerfiles.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js >= 18
- Docker & Docker Compose (or local PostgreSQL, RabbitMQ, and Redis instances)

### Setup & Run
```bash
# 1. Clone repository
git clone https://github.com/ritvikchandrapeddi-lang/clipforge.git
cd clipforge

# 2. Setup environment
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Start Infrastructure (PostgreSQL, RabbitMQ, Redis, Nginx)
docker-compose up -d

# 5. Start Development Servers
npm run dev
```

---

## License
MIT


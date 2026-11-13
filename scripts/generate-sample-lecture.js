const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ffmpegBin = require('./workers/node_modules/@ffmpeg-installer/ffmpeg').path;
const ffprobeBin = require('./workers/node_modules/@ffprobe-installer/ffprobe').path;

const outputDir = path.join(__dirname, 'test-videos');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'sample-lecture.mp4');

console.log('Testing FFmpeg binary:', ffmpegBin);
console.log('Output path:', outputPath);

// Test font
const fontPath = 'C\\:/Windows/Fonts/segoeui.ttf';

// Build filter graph
// Background: Dark slate gradient / academic canvas 1280x720 for 18 seconds
// Header bar, Presentation Card box, Title, Subtitle, Pipeline, Footer, Progress bar
const vFilters = [
  // Base dark theme canvas (#0b0f19)
  "color=c=#0b132b:s=1280x720:d=18[bg]",
  
  // Outer Presentation Slide Card container (#1c2541)
  "[bg]drawbox=x=80:y=60:w=1120:h=600:color=#1c2541:t=fill[card]",
  
  // Card header accent top line (#3a86ff)
  "[card]drawbox=x=80:y=60:w=1120:h=6:color=#3a86ff:t=fill[accent]",

  // Badge / Header: "CLIPFORGE TEST LECTURE"
  `[accent]drawtext=fontfile='${fontPath}':text='CLIPFORGE TEST LECTURE':fontcolor=#60a5fa:fontsize=28:x=120:y=110:shadowcolor=black@0.6:shadowx=2:shadowy=2[t1]`,

  // Title: "Distributed Video Processing"
  `[t1]drawtext=fontfile='${fontPath}':text='Distributed Video Processing':fontcolor=#ffffff:fontsize=46:x=120:y=170:shadowcolor=black@0.7:shadowx=2:shadowy=2[t2]`,

  // Divider line
  `[t2]drawbox=x=120:y=245:w=1040:h=2:color=#334155:t=fill[div]`,

  // Stage 1 Box: Validation
  `[div]drawbox=x=120:y=300:w=280:h=130:color=#0f172a:t=fill[s1box]`,
  `[s1box]drawbox=x=120:y=300:w=280:h=4:color=#10b981:t=fill[s1top]`,
  `[s1top]drawtext=fontfile='${fontPath}':text='STAGE 1':fontcolor=#10b981:fontsize=18:x=140:y=320[s1lbl]`,
  `[s1lbl]drawtext=fontfile='${fontPath}':text='Validation':fontcolor=#f8fafc:fontsize=30:x=140:y=355[s1txt]`,

  // Arrow 1 ->
  `[s1txt]drawtext=fontfile='${fontPath}':text='-->':fontcolor=#64748b:fontsize=36:x=435:y=345[arr1]`,

  // Stage 2 Box: Conversion
  `[arr1]drawbox=x=500:y=300:w=280:h=130:color=#0f172a:t=fill[s2box]`,
  `[s2box]drawbox=x=500:y=300:w=280:h=4:color=#6366f1:t=fill[s2top]`,
  `[s2top]drawtext=fontfile='${fontPath}':text='STAGE 2':fontcolor=#818cf8:fontsize=18:x=520:y=320[s2lbl]`,
  `[s2lbl]drawtext=fontfile='${fontPath}':text='Conversion':fontcolor=#f8fafc:fontsize=30:x=520:y=355[s2txt]`,

  // Arrow 2 ->
  `[s2txt]drawtext=fontfile='${fontPath}':text='-->':fontcolor=#64748b:fontsize=36:x=815:y=345[arr2]`,

  // Stage 3 Box: Thumbnail
  `[arr2]drawbox=x=880:y=300:w=280:h=130:color=#0f172a:t=fill[s3box]`,
  `[s3box]drawbox=x=880:y=300:w=280:h=4:color=#ec4899:t=fill[s3top]`,
  `[s3top]drawtext=fontfile='${fontPath}':text='STAGE 3':fontcolor=#f472b6:fontsize=18:x=900:y=320[s3lbl]`,
  `[s3lbl]drawtext=fontfile='${fontPath}':text='Thumbnail':fontcolor=#f8fafc:fontsize=30:x=900:y=355[s3txt]`,

  // Pipeline summary banner
  `[s3txt]drawtext=fontfile='${fontPath}':text='Validation -> Conversion -> Thumbnail':fontcolor=#94a3b8:fontsize=22:x=120:y=480[summary]`,

  // Animated Lecture Progress Bar (grows over 18s)
  `[summary]drawbox=x=120:y=540:w=1040:h=10:color=#0f172a:t=fill[progBg]`,
  `[progBg]drawbox=x=120:y=540:w='min(1040, 1040*(t/18))':h=10:color=#38bdf8:t=fill[progFg]`,

  // Timecode / Elapsed counter
  `[progFg]drawtext=fontfile='${fontPath}':text='Time\\: %{pts\\:hms} / 00\\:00\\:18':fontcolor=#64748b:fontsize=16:x=120:y=565[timer]`,

  // Footer: "Powered by VIBEWAVE"
  `[timer]drawtext=fontfile='${fontPath}':text='Powered by VIBEWAVE':fontcolor=#a855f7:fontsize=22:x=920:y=565:shadowcolor=black@0.5:shadowx=1:shadowy=1[outv]`
].join(';');

// Audio Filter: Ambient academic synth chords + chime arpeggios
// C major 9 arpeggio: C4 (261.63Hz), E4 (329.63Hz), G4 (392.00Hz), B4 (493.88Hz), D5 (587.33Hz)
// With pleasant smooth envelopes
const aFilter = [
  "sine=f=261.63:d=18[a1]",
  "sine=f=329.63:d=18[a2]",
  "sine=f=392.00:d=18[a3]",
  "sine=f=523.25:d=18[a4]",
  "[a1]volume=0.15[v1]",
  "[a2]volume=0.12[v2]",
  "[a3]volume=0.10[v3]",
  "[a4]volume=0.08[v4]",
  "[v1][v2][v3][v4]amix=inputs=4:duration=longest[mixed]",
  "[mixed]afade=t=in:ss=0:d=1.5,afade=t=out:st=16.5:d=1.5[outa]"
].join(';');

console.log('Running FFmpeg render...');
const ffmpegArgs = [
  '-y',
  '-filter_complex', `${vFilters};${aFilter}`,
  '-map', '[outv]',
  '-map', '[outa]',
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-b:v', '1500k',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ar', '44100',
  '-t', '18',
  outputPath
];

const res = spawnSync(ffmpegBin, ffmpegArgs, { stdio: 'inherit' });
if (res.status === 0) {
  console.log('FFmpeg render succeeded!');
} else {
  console.error('FFmpeg render failed with exit code', res.status);
}

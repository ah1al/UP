/* ============================================================
   مجهز ستوريات الواتساب — المنطق الذكي للحجم والجودة
   ============================================================ */

const $ = (id) => document.getElementById(id);
const dropzone = $('dropzone');
const fileInput = $('fileInput');
const fileMeta = $('fileMeta');
const fileNameEl = $('fileName');
const fileSizeEl = $('fileSize');
const previewSection = $('previewSection');
const previewVideo = $('previewVideo');
const panelCompress = $('panel-compress');

const runCompress = $('runCompress');
const autoSplitList = $('autoSplitList');
const multiResult = $('multiResult');
const multiSuccess = $('multiSuccess');
const partsList = $('partsList');

const progressCard = $('progressCard');
const progressLabel = $('progressLabel');
const progressPercent = $('progressPercent');
const progressBar = $('progressBar');
const progressDetail = $('progressDetail');
const errorBox = $('errorBox');

let selectedFile = null;
let selectedVideoDur = 0;
let busy = false;
let selectedMode = '60'; // الافتراضي: 60 ثانية (720p)

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 بايت';
  const units = ['بايت', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function setBusy(state) {
  busy = state;
  runCompress.disabled = state;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  progressCard.classList.remove('hidden');
}

function hideError() {
  errorBox.classList.add('hidden');
}

function toggleVisible(el, show) {
  el.classList.toggle('hidden', !show);
}

function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = `(${formatBytes(file.size)})`;
  toggleVisible(fileMeta, true);
  toggleVisible(previewSection, true);
  toggleVisible(panelCompress, true);

  previewVideo.src = URL.createObjectURL(file);
  previewVideo.onloadedmetadata = () => {
    selectedVideoDur = previewVideo.duration || 0;
  };
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

function fmtTime(sec) {
  const s = Math.max(0, parseFloat(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(secs)}` : `${pad(m)}:${pad(secs)}`;
}

function libURL(name) {
  return new URL('lib/' + name, document.baseURI).href;
}

function appendPart(name, start, end, blob) {
  const li = document.createElement('li');
  li.className = 'part-card';

  const info = document.createElement('div');
  info.className = 'part-info';

  const n = document.createElement('span');
  n.className = 'part-name';
  n.textContent = name;

  const meta = document.createElement('span');
  meta.textContent = `${fmtTime(start)} - ${fmtTime(end)}`;

  const size = document.createElement('span');
  size.className = 'part-size';
  size.textContent = formatBytes(blob.size);

  info.appendChild(n);
  info.appendChild(meta);
  info.appendChild(size);

  const dl = document.createElement('a');
  dl.className = 'btn primary';
  dl.href = URL.createObjectURL(blob);
  dl.download = name;
  dl.textContent = '⬇️ تحميل المقطع';

  li.appendChild(info);
  li.appendChild(dl);
  partsList.appendChild(li);
}

// اختيار وضع الواتساب
if (autoSplitList) {
  autoSplitList.querySelectorAll('.split-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      autoSplitList.querySelectorAll('.split-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMode = btn.dataset.mode;
    });
  });
}

// معالجة الفيديو وتقسيمه بحسب أعلى توازن للجودة والحجم للواتساب
async function processWhatsAppVideo() {
  if (!selectedFile) return showError('الرجاء اختيار ملف فيديو أولاً.');
  if (busy) return;

  const total = selectedVideoDur || 0;
  let stepSec = 60;
  let scaleFilter = 'crop=ih*(9/16):ih,scale=720:1280';
  let crf = '28';
  let maxrate = '900k';
  let bufsize = '1200k';

  if (selectedMode === '30') {
    stepSec = 30;
    scaleFilter = 'crop=ih*(9/16):ih,scale=1080:1920';
    crf = '24';
    maxrate = '1800k';
    bufsize = '2400k';
  } else if (selectedMode === '15') {
    stepSec = 15;
    scaleFilter = 'crop=ih*(9/16):ih,scale=1080:1920';
    crf = '22';
    maxrate = '2200k';
    bufsize = '3000k';
  }

  const segs = [];
  let s = 0;
  while (s < total - 0.01) { 
    segs.push({ start: s, end: Math.min(s + stepSec, total) }); 
    s += stepSec; 
  }

  hideError();
  partsList.innerHTML = '';
  multiResult.classList.add('hidden');
  if (multiSuccess) multiSuccess.classList.add('hidden');

  try {
    const modernAPI = window.FFmpegWASM && window.FFmpegWASM.FFmpeg;
    const legacyAPI = window.FFmpeg && window.FFmpeg.createFFmpeg;
    if (!modernAPI && !legacyAPI) throw new Error('حزمة ffmpeg غير محمّلة.');

    progressLabel.textContent = `جارٍ الضغط العالي والتقسيم لـ (${stepSec}ث)…`;
    progressDetail.textContent = `معالجة ${segs.length} مقطع`;
    progressPercent.textContent = '0%';
    progressBar.style.width = '0%';
    toggleVisible(progressCard, true);
    setBusy(true);

    if (legacyAPI) {
      const { createFFmpeg, fetchFile } = window.FFmpeg;
      const ffmpeg = createFFmpeg({ log: true, corePath: libURL('ffmpeg-core.js') });
      ffmpeg.setProgress(({ ratio }) => {
        progressPercent.textContent = Math.round(ratio * 100) + '%';
        progressBar.style.width = Math.round(ratio * 100) + '%';
      });
      await ffmpeg.load();
      ffmpeg.FS('writeFile', 'input', await fetchFile(selectedFile));

      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const outName = `whatsapp_story_${i + 1}.mp4`;
        const args = [
          '-i', 'input', '-ss', String(seg.start), '-to', String(seg.end),
          '-vf', scaleFilter,
          '-c:v', 'libx264', '-crf', crf, '-preset', 'faster',
          '-maxrate', maxrate, '-bufsize', bufsize,
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '96k',
          '-movflags', '+faststart',
          outName
        ];
        await ffmpeg.run(...args);
        const data = ffmpeg.FS('readFile', outName);
        appendPart(outName, seg.start, seg.end, new Blob([data], { type: 'video/mp4' }));
        try { ffmpeg.FS('unlink', outName); } catch (e) {}
      }
    } else {
      const { FFmpeg } = window.FFmpegWASM;
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        const p = Math.round((progress || 0) * 100);
        progressPercent.textContent = p + '%';
        progressBar.style.width = p + '%';
      });
      await ffmpeg.load({
        coreURL: libURL('ffmpeg-core.js'),
        wasmURL: libURL('ffmpeg-core.wasm'),
        classWorkerURL: libURL('814.ffmpeg.js'),
      });
      await ffmpeg.writeFile('input', new Uint8Array(await selectedFile.arrayBuffer()));

      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const outName = `whatsapp_story_${i + 1}.mp4`;
        const args = [
          '-i', 'input', '-ss', String(seg.start), '-to', String(seg.end),
          '-vf', scaleFilter,
          '-c:v', 'libx264', '-crf', crf, '-preset', 'faster',
          '-maxrate', maxrate, '-bufsize', bufsize,
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '96k',
          '-movflags', '+faststart',
          outName
        ];
        await ffmpeg.exec(args);
        let data = await ffmpeg.readFile(outName);
        if (data && data.buffer) data = new Uint8Array(data.buffer);
        appendPart(outName, seg.start, seg.end, new Blob([data], { type: 'video/mp4' }));
        try { await ffmpeg.deleteFile(outName); } catch (e) {}
      }
    }

    if (multiSuccess) multiSuccess.classList.remove('hidden');
    multiResult.classList.remove('hidden');
    progressLabel.textContent = 'تم إعداد الستوريات بنجاح بأفضل جودة وحجم!';
    progressPercent.textContent = '100%';
  } catch (err) {
    console.error(err);
    showError('فشل التجهيز: ' + (err && err.message ? err.message : err));
  } finally {
    setBusy(false);
    toggleVisible(progressCard, false);
  }
}

runCompress.addEventListener('click', processWhatsAppVideo);

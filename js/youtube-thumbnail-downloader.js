import { trackToolUsage } from './analytics.js';

// Local Toast Utility
function showToast(message, type = 'success') {
  let wrapper = document.getElementById('toast-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'toast-wrapper';
    wrapper.className = 'fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none';
    document.body.appendChild(wrapper);
  }
  const toast = document.createElement('div');
  toast.className = "flex items-center gap-3 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-lg border border-slate-800 animate-slide-in pointer-events-auto transition-all duration-300";
  
  const iconColor = type === 'success' ? 'text-emerald-500' : 'text-rose-500';
  const iconSvg = type === 'success' 
    ? `<svg class="w-4 h-4 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    : `<svg class="w-4 h-4 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
  `;
  wrapper.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Extract Video ID using Regex
function getYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.trim().match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Check if a remote thumbnail image exists (not YouTube's empty 120x90 placeholder)
function checkThumbnailExists(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 120) {
        resolve(true);
      } else {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// Download image file via blob conversion to trigger proper OS save-file prompt
async function downloadThumbnail(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    showToast('Download started successfully!', 'success');
  } catch (err) {
    console.warn('Direct blob fetch download failed, falling back to new tab:', err);
    window.open(url, '_blank');
    showToast('Opening image in a new tab.', 'success');
  }
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
  trackToolUsage('youtube_thumbnail_downloader');

  const btnExtractThumb = document.getElementById('btn-extract-thumbnails');
  const inputUrl = document.getElementById('thumbnail-video-url');
  const resultsDiv = document.getElementById('thumbnail-results');
  const gridDiv = document.getElementById('thumbnail-grid');

  if (btnExtractThumb && inputUrl) {
    btnExtractThumb.addEventListener('click', async () => {
      const url = inputUrl.value.trim();
      const videoId = getYouTubeVideoId(url);

      if (!videoId) {
        showToast('Please enter a valid YouTube video URL.', 'error');
        return;
      }

      // Define standard YouTube resolutions
      const resolutions = [
        { key: 'maxresdefault', name: 'Maximum Resolution (1280x720)', filename: `yt-thumb-${videoId}-max.jpg` },
        { key: 'sddefault', name: 'Standard Definition (640x480)', filename: `yt-thumb-${videoId}-sd.jpg` },
        { key: 'hqdefault', name: 'High Quality (480x360)', filename: `yt-thumb-${videoId}-hq.jpg` },
        { key: 'mqdefault', name: 'Medium Quality (320x180)', filename: `yt-thumb-${videoId}-mq.jpg` },
        { key: 'default', name: 'Default Quality (120x90)', filename: `yt-thumb-${videoId}-default.jpg` }
      ];

      gridDiv.innerHTML = `
        <div class="col-span-full text-center py-6">
          <div class="inline-block w-8 h-8 border-4 border-slate-300 border-t-rose-600 rounded-full animate-spin"></div>
          <p class="text-xs text-slate-500 mt-2.5 font-semibold">Testing thumbnail availability...</p>
        </div>
      `;
      resultsDiv.classList.remove('hidden');

      const validCards = [];

      for (const res of resolutions) {
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/${res.key}.jpg`;
        const exists = await checkThumbnailExists(thumbUrl);

        if (exists || res.key === 'hqdefault' || res.key === 'mqdefault' || res.key === 'default') {
          validCards.push({
            name: res.name,
            url: thumbUrl,
            filename: res.filename
          });
        }
      }

      gridDiv.innerHTML = '';

      if (validCards.length === 0) {
        gridDiv.innerHTML = `
          <div class="col-span-full text-center py-4 text-xs font-semibold text-rose-500">
            No valid thumbnails found for this video.
          </div>
        `;
        return;
      }

      validCards.forEach(card => {
        const cardHtml = `
          <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex flex-col justify-between space-y-4">
            <div>
              <span class="text-[10px] font-bold text-slate-500 block mb-2">${card.name}</span>
              <img src="${card.url}" alt="${card.name}" class="w-full rounded-lg border border-slate-100 object-cover aspect-video bg-slate-50" />
            </div>
            <button class="btn-download-thumb w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5" data-url="${card.url}" data-filename="${card.filename}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              <span>Download Image</span>
            </button>
          </div>
        `;
        const temp = document.createElement('div');
        temp.innerHTML = cardHtml.trim();
        const cardEl = temp.firstChild;

        // Hook download action
        cardEl.querySelector('.btn-download-thumb').addEventListener('click', (e) => {
          const btn = e.currentTarget;
          const downloadUrl = btn.getAttribute('data-url');
          const downloadName = btn.getAttribute('data-filename');
          downloadThumbnail(downloadUrl, downloadName);
        });

        gridDiv.appendChild(cardEl);
      });
    });
  }
});

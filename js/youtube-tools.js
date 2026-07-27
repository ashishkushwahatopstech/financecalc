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
  // Patterns matching watch links, short URLs, embeds, Shorts, and live streams
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.trim().match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Check if a remote thumbnail image exists (not YouTube's empty 120x90 placeholder)
function checkThumbnailExists(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Missing resolutions return a default 120x90 placeholder on YouTube's CDN
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

// DOM Setup & Navigation tab handler
document.addEventListener('DOMContentLoaded', () => {
  trackToolUsage('youtube_tools');

  // Tab switching
  const tabs = [
    { btnId: 'tab-btn-thumbnails', panelId: 'panel-thumbnails' },
    { btnId: 'tab-btn-tags', panelId: 'panel-tags' },
    { btnId: 'tab-btn-keywords', panelId: 'panel-keywords' },
    { btnId: 'tab-btn-hashtags', panelId: 'panel-hashtags' }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(t.btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        // Toggle tabs classes
        tabs.forEach(item => {
          const b = document.getElementById(item.btnId);
          const p = document.getElementById(item.panelId);
          if (b && p) {
            if (item.btnId === t.btnId) {
              b.className = 'tab-btn px-4 py-3 border-b-2 border-rose-600 text-rose-600 flex items-center gap-2 cursor-pointer transition-all';
              p.classList.remove('hidden');
            } else {
              b.className = 'tab-btn px-4 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 cursor-pointer transition-all';
              p.classList.add('hidden');
            }
          }
        });
      });
    }
  });

  // =========================================================================
  // 1. THUMBNAIL DOWNLOADER LOGIC
  // =========================================================================
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

  // =========================================================================
  // SHARED EXPORT DATA COMPONENT
  // =========================================================================
  function renderExportButtons(containerId, dataFetcher, filenameBase) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="flex items-center gap-2">
        <button class="btn-export-csv px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold border border-slate-200 transition-all cursor-pointer flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span>CSV</span>
        </button>
        <button class="btn-export-json px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold border border-slate-200 transition-all cursor-pointer flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span>JSON</span>
        </button>
      </div>
    `;

    container.querySelector('.btn-export-csv').addEventListener('click', () => {
      const items = dataFetcher();
      if (items.length === 0) {
        showToast('No items available to export.', 'error');
        return;
      }
      let csvContent = '';
      if (typeof items[0] === 'object') {
        const headers = Object.keys(items[0]);
        csvContent += headers.join(',') + '\n';
        items.forEach(item => {
          csvContent += headers.map(h => `"${String(item[h]).replace(/"/g, '""')}"`).join(',') + '\n';
        });
      } else {
        csvContent += 'Tags\n';
        items.forEach(val => {
          csvContent += `"${String(val).replace(/"/g, '""')}"\n`;
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('CSV Exported successfully!', 'success');
    });

    container.querySelector('.btn-export-json').addEventListener('click', () => {
      const items = dataFetcher();
      if (items.length === 0) {
        showToast('No items available to export.', 'error');
        return;
      }
      const jsonContent = JSON.stringify(items, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('JSON Exported successfully!', 'success');
    });
  }

  // =========================================================================
  // 2. TAG EXTRACTOR FRONTEND LOGIC
  // =========================================================================
  const btnExtractTags = document.getElementById('btn-extract-tags');
  const inputTagsUrl = document.getElementById('tags-video-url');
  const tagsLoader = document.getElementById('tags-loader');
  const tagsResults = document.getElementById('tags-results');
  const tagsCount = document.getElementById('tags-count');
  const chipsContainer = document.getElementById('tags-chips-container');
  const exportContainer = document.getElementById('tags-export-container');

  if (btnExtractTags && inputTagsUrl) {
    btnExtractTags.addEventListener('click', async () => {
      const url = inputTagsUrl.value.trim();
      const videoId = getYouTubeVideoId(url);

      if (!videoId) {
        showToast('Please enter a valid YouTube URL.', 'error');
        return;
      }

      // Show loader, hide results
      tagsLoader.classList.remove('hidden');
      tagsResults.classList.add('hidden');

      try {
        const response = await fetch(`/api/youtube-tags?id=${videoId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to extract tags.');
        }

        const tags = data.tags || [];
        tagsCount.textContent = tags.length;
        chipsContainer.innerHTML = '';

        if (tags.length === 0) {
          chipsContainer.innerHTML = `
            <div class="text-xs font-semibold text-slate-400 py-2">
              No tags or keywords are embedded in this video page.
            </div>
          `;
          tagsResults.classList.remove('hidden');
          return;
        }

        // Render Tag Chips
        tags.forEach(tag => {
          const chip = document.createElement('div');
          chip.className = 'px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium text-[11px] hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-700 cursor-pointer select-none transition-all';
          chip.textContent = tag;

          // Toggle Selection State on Click
          chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            if (chip.classList.contains('selected')) {
              chip.className = 'px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 font-bold text-[11px] cursor-pointer select-none transition-all';
            } else {
              chip.className = 'px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium text-[11px] hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-700 cursor-pointer select-none transition-all';
            }
          });

          chipsContainer.appendChild(chip);
        });

        // Initialize Shared Export Component for Tags
        renderExportButtons('tags-export-container', () => {
          const selectedChips = chipsContainer.querySelectorAll('.selected');
          // Export selected only, or fallback to export all if none are selected
          const targets = selectedChips.length > 0 ? selectedChips : chipsContainer.querySelectorAll('div');
          return Array.from(targets).map(el => el.textContent);
        }, `yt-tags-${videoId}`);

        tagsResults.classList.remove('hidden');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        tagsLoader.classList.add('hidden');
      }
    });
  }

  // =========================================================================
  // 3. KEYWORD SUGGESTIONS FRONTEND LOGIC
  // =========================================================================
  const btnFetchKeywords = document.getElementById('btn-fetch-keywords');
  const inputSeed = document.getElementById('keywords-seed');
  const keywordsLoader = document.getElementById('keywords-loader');
  const keywordsResults = document.getElementById('keywords-results');
  const keywordsCount = document.getElementById('keywords-count');
  const tableBody = document.getElementById('keywords-table-body');
  const checkAllKeywords = document.getElementById('check-all-keywords');

  if (btnFetchKeywords && inputSeed) {
    btnFetchKeywords.addEventListener('click', async () => {
      const seed = inputSeed.value.trim();
      if (!seed) {
        showToast('Please enter a seed keyword.', 'error');
        return;
      }

      keywordsLoader.classList.remove('hidden');
      keywordsResults.classList.add('hidden');

      try {
        const response = await fetch(`/api/youtube-keywords?q=${encodeURIComponent(seed)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch suggestions.');
        }

        const list = data.suggestions || [];
        keywordsCount.textContent = list.length;
        tableBody.innerHTML = '';

        if (list.length === 0) {
          tableBody.innerHTML = `
            <tr>
              <td colspan="3" class="p-6 text-center text-xs font-semibold text-slate-400">
                No search suggestions found for this phrase on YouTube. Try a simpler keyword.
              </td>
            </tr>
          `;
          keywordsResults.classList.remove('hidden');
          return;
        }

        // Render Table Rows
        list.forEach(kw => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-50 border-b border-slate-100 transition-colors';
          tr.innerHTML = `
            <td class="p-3.5 text-center">
              <input type="checkbox" name="keyword-item" class="keyword-row-checkbox w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer" checked />
            </td>
            <td class="p-3.5 font-bold text-slate-800 text-[11px]">${escapeHTML(kw)}</td>
            <td class="p-3.5 text-right">
              <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wide">YouTube Search</span>
            </td>
          `;

          // Handle single row selection toggle
          tr.querySelector('.keyword-row-checkbox').addEventListener('change', () => {
            const allChecked = Array.from(tableBody.querySelectorAll('.keyword-row-checkbox')).every(cb => cb.checked);
            checkAllKeywords.checked = allChecked;
          });

          tableBody.appendChild(tr);
        });

        // Sync Check-All toggle state
        checkAllKeywords.checked = true;

        // Initialize Shared Export Component for Keywords
        renderExportButtons('keywords-export-container', () => {
          const checkedRows = tableBody.querySelectorAll('.keyword-row-checkbox:checked');
          // If some are selected, export only checked. Otherwise export all rows
          const targets = checkedRows.length > 0 ? checkedRows : tableBody.querySelectorAll('.keyword-row-checkbox');
          return Array.from(targets).map(cb => {
            const tr = cb.closest('tr');
            return tr.querySelector('td:nth-child(2)').textContent.trim();
          });
        }, `yt-keywords-${seed.replace(/\s+/g, '-')}`);

        keywordsResults.classList.remove('hidden');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        keywordsLoader.classList.add('hidden');
      }
    });

    // Check All Checkboxes toggle
    if (checkAllKeywords) {
      checkAllKeywords.addEventListener('change', () => {
        const state = checkAllKeywords.checked;
        tableBody.querySelectorAll('.keyword-row-checkbox').forEach(cb => {
          cb.checked = state;
        });
      });
    }
  }

  // =========================================================================
  // 4. HASHTAG GENERATOR LOGIC
  // =========================================================================
  const btnGenerateHashtags = document.getElementById('btn-generate-hashtags');
  const inputHashtagSeed = document.getElementById('hashtags-seed');
  const hashtagsLoader = document.getElementById('hashtags-loader');
  const hashtagsResults = document.getElementById('hashtags-results');
  const hashtagsCount = document.getElementById('hashtags-count');
  const hashtagsChipsContainer = document.getElementById('hashtags-chips-container');
  const btnCopySelectedHashtags = document.getElementById('btn-copy-selected-hashtags');

  function convertToHashtag(str) {
    if (!str) return '';
    const clean = str.replace(/[^a-zA-Z0-9\s-_]/g, '');
    const words = clean.split(/[\s-_]+/).filter(Boolean);
    const capitalized = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return '#' + capitalized.join('');
  }

  if (btnGenerateHashtags && inputHashtagSeed) {
    btnGenerateHashtags.addEventListener('click', async () => {
      const input = inputHashtagSeed.value.trim();
      if (!input) {
        showToast('Please enter a seed keyword or YouTube URL.', 'error');
        return;
      }

      hashtagsLoader.classList.remove('hidden');
      hashtagsResults.classList.add('hidden');

      const videoId = getYouTubeVideoId(input);
      let items = [];

      try {
        if (videoId) {
          // Input is a YouTube URL, fetch tags from server proxy
          showToast('YouTube Link detected. Fetching tags...', 'success');
          const res = await fetch(`/api/youtube-tags?id=${videoId}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to extract tags.');
          items = data.tags || [];
        } else {
          // Input is a seed keyword, fetch suggestions from autocomplete proxy
          const res = await fetch(`/api/youtube-keywords?q=${encodeURIComponent(input)}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to fetch suggestions.');
          items = data.suggestions || [];
          if (items.length > 0) {
            items.unshift(input);
          }
        }

        hashtagsChipsContainer.innerHTML = '';
        
        // Generate Hashtags List
        const hashtags = items.map(item => convertToHashtag(item)).filter(Boolean);
        const uniqueHashtags = [...new Set(hashtags)];

        hashtagsCount.textContent = uniqueHashtags.length;

        if (uniqueHashtags.length === 0) {
          hashtagsChipsContainer.innerHTML = `
            <div class="text-xs font-semibold text-slate-400 py-2">
              No hashtags could be derived from this keyword. Try a different term.
            </div>
          `;
          hashtagsResults.classList.remove('hidden');
          return;
        }

        uniqueHashtags.forEach(tag => {
          const chip = document.createElement('div');
          chip.className = 'selected px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 font-bold text-[11px] cursor-pointer select-none transition-all';
          chip.textContent = tag;

          chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            if (chip.classList.contains('selected')) {
              chip.className = 'selected px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 font-bold text-[11px] cursor-pointer select-none transition-all';
            } else {
              chip.className = 'px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium text-[11px] hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-700 cursor-pointer select-none transition-all';
            }
          });

          hashtagsChipsContainer.appendChild(chip);
        });

        // Initialize Shared Export Component for Hashtags
        renderExportButtons('hashtags-export-container', () => {
          const selectedChips = hashtagsChipsContainer.querySelectorAll('.selected');
          const targets = selectedChips.length > 0 ? selectedChips : hashtagsChipsContainer.querySelectorAll('div');
          return Array.from(targets).map(el => el.textContent);
        }, `yt-hashtags-${input.replace(/\s+/g, '-')}`);

        hashtagsResults.classList.remove('hidden');

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        hashtagsLoader.classList.add('hidden');
      }
    });

    // Copy Selected Hashtags to Clipboard
    if (btnCopySelectedHashtags) {
      btnCopySelectedHashtags.addEventListener('click', () => {
        const selected = Array.from(hashtagsChipsContainer.querySelectorAll('.selected')).map(el => el.textContent);
        if (selected.length === 0) {
          showToast('No hashtags selected. Click chips to select them.', 'error');
          return;
        }

        const text = selected.join(' ');
        navigator.clipboard.writeText(text).then(() => {
          showToast('Selected hashtags copied to clipboard!', 'success');
        }).catch(err => {
          showToast('Failed to copy text: ' + err, 'error');
        });
      });
    }
  }

  // Simple HTML Escaper
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
});

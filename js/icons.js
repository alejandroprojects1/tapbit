// Ícones lineares (traço arredondado), no lugar dos emojis da interface.
const ICONS = {
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 4M16 6h2.5a2.5 2.5 0 0 1-2.6 4M12 14v3.5M8.5 20.5h7"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>',
  back: '<path d="M15 18 9 12l6-6"/>',
  pause: '<rect x="7" y="5" width="3.2" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="5" width="3.2" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>',
  burst: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5M5.3 5.3l2.4 2.4M16.3 16.3l2.4 2.4M5.3 18.7l2.4-2.4M16.3 7.7l2.4-2.4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  flask: '<path d="M9 3h6M10 3v6.2L4.8 18.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L14 9.2V3"/><path d="M7.3 15h9.4"/>',
  comet: '<circle cx="15.5" cy="8.5" r="4"/><path d="M12.6 11.4 4 20M10.5 8 4.5 14M16 13.5l-6 6"/>',
  bug: '<rect x="8" y="8" width="8" height="12" rx="4"/><path d="M12 8V5.5M9.5 4.5 10.6 6M14.5 4.5 13.4 6M4 13h4M16 13h4M5 19l3-1.6M19 19l-3-1.6M5 7.5l3 1.8M19 7.5l-3 1.8"/>',
  key: '<circle cx="8" cy="15" r="4.2"/><path d="m11 12 8.5-8.5M16.5 6.5l2.6 2.6M14.3 8.7l2 2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
  battery: '<rect x="7" y="4.5" width="10" height="17" rx="2.5"/><path d="M10 2.5h4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  robot: '<rect x="5" y="7" width="14" height="11" rx="3.5"/><path d="M12 7V4M9.5 12.5h.01M14.5 12.5h.01M3 12v2M21 12v2"/>',
  beam: '<path d="M4 20 20 4"/><circle cx="20" cy="4" r="1.5" fill="currentColor"/><path d="M4 14l2 2M10 20l-2-2"/>',
  pad: '<rect x="3" y="7" width="18" height="10" rx="4"/><path d="M8 10v4M6 12h4"/><circle cx="15.5" cy="11" r=".9" fill="currentColor"/><circle cx="17.5" cy="13" r=".9" fill="currentColor"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
};

function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// Troca cada <i data-icon="nome"></i> da página pelo ícone.
document.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.className); });

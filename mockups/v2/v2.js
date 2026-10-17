// Vexilo v2 shared helpers: header/footer, theme, cloth renderer, sample users.
(function () {
  const SHAPED = new Set(['np']);
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  // Cloth flag. opts: h (px height), size ('sm'|'md'|'lg'), live (always fluttering)
  function cloth(code, ratio, name, opts = {}) {
    const shaped = SHAPED.has(code);
    const url = FLAG_IMG(code);
    const cls = ['cloth', shaped && 'cloth--shaped', opts.size && `cloth--${opts.size}`, opts.live && 'is-live'].filter(Boolean).join(' ');
    const style = `--r:${ratio};--h:${opts.h}px;--d:-${(rnd() * 4).toFixed(2)}s;${shaped ? `--mask:url(${url});--strip:0px;` : ''}`;
    const grommets = opts.size === 'sm' ? '' : '<i class="gr gr--top"></i><i class="gr gr--bot"></i>';
    return `<div class="${cls}" style="${style}">
      ${shaped ? '' : `<div class="cloth-strip">${grommets}</div>`}
      <div class="cloth-face">
        <img src="${url}" alt="Flag of ${name}" draggable="false">
        <div class="cw cw--shade"><i></i></div>
        <div class="cw cw--sheen"><i></i></div>
        <div class="cw-weave"></div>
        ${shaped && opts.size !== 'sm' ? '<i class="gr gr--edge gr--top"></i><i class="gr gr--edge gr--bot"></i>' : ''}
      </div>
    </div>`;
  }

  // Equal-area sizing: every flag gets the same amount of cloth, so Nepal hangs tall and Qatar long.
  const equalH = (ratio, area) => Math.round(Math.sqrt(area / ratio));
  const fitH = (ratio, area, maxW, maxH) => Math.min(equalH(ratio, area), Math.floor(maxW / ratio), maxH);

  const pad = (n) => String(n).padStart(4, '0');

  const USERS = [
    { name: 'mira.k', initials: 'MK', color: '#C2410C', flag: 'gb-wls', ratio: 1.667, count: 1204, month: 48, joined: 'Mar 2025' },
    { name: 'tsering_d', initials: 'TD', color: '#0F766E', flag: 'bt', ratio: 1.5, count: 988, month: 35, joined: 'Jan 2025' },
    { name: 'oskarlund', initials: 'OL', color: '#1D4ED8', flag: 'gl', ratio: 1.5, count: 761, month: 29, joined: 'Jul 2025' },
    { name: 'afolabi', initials: 'AF', color: '#15803D', flag: 'ng', ratio: 2, count: 612, month: 22, joined: 'Feb 2025' },
    { name: 'kowalczyk', initials: 'AK', color: '#9F1239', flag: 'pl', ratio: 1.6, count: 540, month: 18, joined: 'May 2025' },
    { name: 'r.alves', initials: 'RA', color: '#A16207', flag: 'br', ratio: 1.43, count: 433, month: 12, joined: 'Apr 2025' },
    { name: 'hana_s', initials: 'HS', color: '#BE123C', flag: 'jp', ratio: 1.5, count: 390, month: 15, joined: 'Aug 2025' },
    { name: 'vexillum', initials: 'VX', color: '#4338CA', flag: 'ch', ratio: 1, count: 352, month: 9, joined: 'Jan 2025' },
    { name: 'tom.b', initials: 'TB', color: '#0E7490', flag: 'ca', ratio: 2, count: 298, month: 11, joined: 'Jun 2025' },
    { name: 'lucia.m', initials: 'LM', color: '#B45309', flag: 'mx', ratio: 1.75, count: 251, month: 7, joined: 'Sep 2025' },
  ];

  function header(active) {
    const link = (id, label, href) => `<a href="${href}" class="${active === id ? 'on' : ''}">${label}</a>`;
    return `<header class="hdr"><div class="wrap">
      <a class="logo" href="home.html"><img src="../shared/logo.svg" alt=""><span>Vexilo</span></a>
      <nav class="nav">
        ${link('home', 'Browse', 'home.html')}
        ${link('quiz', 'Quiz', 'quiz.html')}
        ${link('leaderboard', 'Leaderboard', 'leaderboard.html')}
      </nav>
      <label class="hdr-search">
        <i class="ph-bold ph-magnifying-glass"></i>
        <input placeholder="Search 15,284 flags" />
        <span class="kbd">⌘K</span>
      </label>
      <div class="hdr-right">
        <button class="btn btn--icon" id="theme" title="Toggle theme"><i class="ph-bold ph-moon"></i></button>
        <a class="btn btn--primary" href="#"><i class="ph-bold ph-plus"></i>Post flag</a>
        <a href="profile.html" title="Your profile"><span class="avatar" style="background:#0E7490">TB</span></a>
      </div>
    </div></header>`;
  }

  function footer() {
    return `<footer class="ftr"><div class="wrap">
      <span>© 2026 Vexilo</span><span class="mono">15,284 flags</span>
      <nav><a href="#">Donate</a><a href="#">Guidelines</a><a href="#">Privacy</a><a href="#">Terms</a></nav>
    </div></footer>
    <nav class="mock-switch">
      ${[['home', 'Home'], ['flag', 'Flag page'], ['quiz', 'Quiz'], ['leaderboard', 'Leaderboard'], ['profile', 'Profile']]
        .map(([id, l]) => `<a href="${id}.html" class="${document.body.dataset.page === id ? 'on' : ''}">${l}</a>`).join('')}
    </nav>`;
  }

  function mount(page) {
    document.body.dataset.page = page;
    document.body.insertAdjacentHTML('afterbegin', header(page));
    document.body.insertAdjacentHTML('beforeend', footer());
    const params = new URLSearchParams(location.search);
    if (params.get('theme') === 'dark' || localStorage.getItem('vx-theme') === 'dark') document.documentElement.classList.add('dark');
    if (params.has('shot')) document.documentElement.classList.add('shooting');
    const sync = () => {
      document.querySelector('#theme i').className = document.documentElement.classList.contains('dark') ? 'ph-bold ph-sun' : 'ph-bold ph-moon';
    };
    document.getElementById('theme').addEventListener('click', () => {
      const dark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('vx-theme', dark ? 'dark' : 'light');
      sync();
    });
    sync();
  }

  window.V = { cloth, equalH, fitH, pad, USERS, mount };
})();

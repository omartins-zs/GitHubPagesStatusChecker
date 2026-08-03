const state = {
  repos: [],
  results: [],
  filter: 'all',
  searchQuery: '',
  isLoading: false,
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  cacheElements();
  bindEvents();
  renderWelcomeState();
}

function cacheElements() {
  elements.username = document.getElementById('github-username');
  elements.token = document.getElementById('github-token');
  elements.submitBtn = document.getElementById('submit-btn');
  elements.clearBtn = document.getElementById('clear-btn');
  elements.toggleToken = document.getElementById('toggle-token');
  elements.repoGrid = document.getElementById('repo-grid');
  elements.statsBar = document.getElementById('stats-bar');
  elements.toolbar = document.getElementById('toolbar');
  elements.searchFilter = document.getElementById('search-filter');
  elements.loadingOverlay = document.getElementById('loading-overlay');
  elements.loadingProgress = document.getElementById('loading-progress');
  elements.toastContainer = document.getElementById('toast-container');
  elements.usernameError = document.getElementById('username-error');
  elements.filterChips = document.querySelectorAll('.chip');
}

function bindEvents() {
  elements.submitBtn.addEventListener('click', handleSubmit);
  elements.clearBtn.addEventListener('click', handleClear);
  elements.toggleToken.addEventListener('click', toggleTokenVisibility);
  elements.searchFilter.addEventListener('input', handleSearch);
  elements.username.addEventListener('keydown', handleEnterKey);
  elements.token.addEventListener('keydown', handleEnterKey);
  elements.username.addEventListener('input', clearUsernameError);

  elements.filterChips.forEach((chip) => {
    chip.addEventListener('click', () => setFilter(chip.dataset.filter));
  });
}

function handleEnterKey(e) {
  if (e.key === 'Enter') handleSubmit();
}

function toggleTokenVisibility() {
  const isPassword = elements.token.type === 'password';
  elements.token.type = isPassword ? 'text' : 'password';
  elements.toggleToken.setAttribute('aria-label', isPassword ? 'Ocultar token' : 'Mostrar token');
  elements.toggleToken.innerHTML = isPassword ? ICONS.eyeOff : ICONS.eye;
}

async function handleSubmit() {
  const username = elements.username.value.trim();
  const token = elements.token.value.trim();

  if (!username) {
    showUsernameError('Informe um nome de usuário do GitHub.');
    elements.username.focus();
    return;
  }

  clearUsernameError();
  setLoading(true, 'Buscando repositórios...');

  try {
    const repos = await getRepos(username, token);
    setLoading(true, 'Verificando GitHub Pages...', `0 / ${repos.length}`);

    const results = [];
    for (let i = 0; i < repos.length; i++) {
      const result = await checkGitHubPages(repos[i], username);
      results.push(result);
      setLoading(true, 'Verificando GitHub Pages...', `${i + 1} / ${repos.length}`);
    }

    state.repos = repos;
    state.results = results;
    state.filter = 'all';
    state.searchQuery = '';

    elements.searchFilter.value = '';
    updateFilterChips();
    updateStats();
    renderRepoGrid();
    showToolbar(true);
    showToast(`${repos.length} repositório(s) verificado(s).`, 'success');
  } catch (error) {
    console.error('Error fetching repositories:', error);
    const message = getErrorMessage(error);
    showToast(message, 'error');
    renderWelcomeState();
    showToolbar(false);
  } finally {
    setLoading(false);
  }
}

function handleClear() {
  elements.username.value = '';
  elements.token.value = '';
  elements.searchFilter.value = '';
  clearUsernameError();
  state.repos = [];
  state.results = [];
  state.filter = 'all';
  state.searchQuery = '';
  updateFilterChips();
  showToolbar(false);
  elements.statsBar.classList.remove('visible');
  renderWelcomeState();
}

function handleSearch(e) {
  state.searchQuery = e.target.value.toLowerCase();
  renderRepoGrid();
}

function setFilter(filter) {
  state.filter = filter;
  updateFilterChips();
  renderRepoGrid();
}

function updateFilterChips() {
  elements.filterChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === state.filter);
  });
}

function showToolbar(visible) {
  elements.toolbar.classList.toggle('visible', visible);
}

function setLoading(visible, text = 'Carregando...', progress = '') {
  state.isLoading = visible;
  elements.loadingOverlay.classList.toggle('visible', visible);
  elements.submitBtn.disabled = visible;
  elements.clearBtn.disabled = visible;

  const textEl = elements.loadingOverlay.querySelector('.loading-overlay__text');
  if (textEl) textEl.textContent = text;
  elements.loadingProgress.textContent = progress;
}

function clearUsernameError() {
  elements.username.classList.remove('invalid');
  elements.usernameError.classList.remove('visible');
}

function showUsernameError(message) {
  elements.username.classList.add('invalid');
  elements.usernameError.textContent = message;
  elements.usernameError.classList.add('visible');
}

function getErrorMessage(error) {
  if (error.message.includes('404')) {
    return 'Usuário do GitHub não encontrado. Verifique o nome informado.';
  }
  if (error.message.includes('403')) {
    return 'Limite de requisições excedido. Tente novamente ou use um token de acesso.';
  }
  if (error.message.includes('401')) {
    return 'Token inválido. Verifique suas credenciais.';
  }
  return 'Erro ao buscar repositórios. Tente novamente.';
}

async function fetchWithToken(url, token) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitHubPagesStatusChecker',
  };
  if (token) headers.Authorization = `token ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function getRepos(username, token) {
  let repos = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`;
    const result = await fetchWithToken(url, token);
    if (result.length === 0) break;
    repos = repos.concat(result);
    page++;
  }

  return repos;
}

async function checkGitHubPages(repo, username) {
  const pagesUrl = `https://${username}.github.io/${repo.name}/`;
  try {
    const response = await fetch(pagesUrl, { method: 'HEAD' });
    return classifyResult(pagesUrl, response.status, repo.has_pages);
  } catch {
    return classifyResult(pagesUrl, 404, repo.has_pages);
  }
}

function classifyResult(url, status, hasPages) {
  let type = 'neutral';
  let label = 'Desconhecido';
  let description = '';

  if (status === 200) {
    type = 'online';
    label = 'Online';
    description = 'Projeto hospedado e acessível no GitHub Pages.';
  } else if (status === 404) {
    if (hasPages) {
      type = 'warning';
      label = 'Parcial';
      description =
        'O GitHub Pages está ativado neste repositório, mas a URL retornou 404. ' +
        'Isso costuma ocorrer quando o deploy ainda não terminou, a branch/pasta de publicação está errada ' +
        '(ex.: /docs ou /root), ou falta um index.html na raiz do site.';
    } else {
      type = 'offline';
      label = 'Não hospedado';
      description = 'Este repositório não possui GitHub Pages ativo.';
    }
  } else {
    type = 'offline';
    label = 'Erro';
    description = `Erro ao acessar o GitHub Pages (HTTP ${status}).`;
  }

  return { url, status, hasPages, type, label, description };
}

function getFilteredResults() {
  return state.results
    .map((result, index) => ({ result, repo: state.repos[index] }))
    .filter(({ result, repo }) => {
      const matchesFilter =
        state.filter === 'all' ||
        (state.filter === 'online' && result.type === 'online') ||
        (state.filter === 'warning' && result.type === 'warning') ||
        (state.filter === 'offline' && (result.type === 'offline' || result.type === 'neutral'));

      const matchesSearch = !state.searchQuery || repo.name.toLowerCase().includes(state.searchQuery);
      return matchesFilter && matchesSearch;
    });
}

function updateStats() {
  const stats = { total: state.results.length, online: 0, warning: 0, offline: 0 };

  state.results.forEach((r) => {
    if (r.type === 'online') stats.online++;
    else if (r.type === 'warning') stats.warning++;
    else stats.offline++;
  });

  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-online').textContent = stats.online;
  document.getElementById('stat-warning').textContent = stats.warning;
  document.getElementById('stat-offline').textContent = stats.offline;
  elements.statsBar.classList.add('visible');
}

function renderWelcomeState() {
  elements.repoGrid.innerHTML = `
    <div class="col-span-full text-center py-12 px-6 bg-[#111827] border border-dashed border-slate-800 rounded-2xl">
      <svg class="w-16 h-16 mx-auto mb-5 text-slate-600 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <h2 class="text-lg font-semibold text-white mb-2">Verifique seus GitHub Pages</h2>
      <p class="text-slate-400 text-sm max-w-sm mx-auto">Informe um usuário do GitHub para listar todos os repositórios e verificar o status de cada site publicado.</p>
      <div class="flex flex-col gap-3 mt-6 text-left max-w-xs mx-auto">
        <div class="flex items-center gap-3 text-sm text-slate-400">
          <span class="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-[#1a2234] rounded-full text-xs font-semibold text-[#38bdf8]">1</span>
          <span>Digite o nome de usuário do GitHub</span>
        </div>
        <div class="flex items-center gap-3 text-sm text-slate-400">
          <span class="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-[#1a2234] rounded-full text-xs font-semibold text-[#38bdf8]">2</span>
          <span>Opcionalmente, adicione um token para evitar limites de API</span>
        </div>
        <div class="flex items-center gap-3 text-sm text-slate-400">
          <span class="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-[#1a2234] rounded-full text-xs font-semibold text-[#38bdf8]">3</span>
          <span>Clique em "Verificar Repositórios" e veja os resultados</span>
        </div>
      </div>
    </div>
  `;
}

function renderRepoGrid() {
  const filtered = getFilteredResults();

  if (state.results.length === 0) {
    renderWelcomeState();
    return;
  }

  if (filtered.length === 0) {
    elements.repoGrid.innerHTML = `
      <div class="col-span-full text-center py-12 px-6 bg-[#111827] border border-dashed border-slate-800 rounded-2xl">
        <svg class="w-16 h-16 mx-auto mb-5 text-slate-600 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <h2 class="text-lg font-semibold text-white mb-2">Nenhum resultado encontrado</h2>
        <p class="text-slate-400 text-sm max-w-sm mx-auto">Tente ajustar os filtros ou o termo de busca.</p>
      </div>
    `;
    return;
  }

  elements.repoGrid.innerHTML = filtered
    .map(({ result, repo }, i) => createRepoCardHTML(result, repo, i))
    .join('');

  elements.repoGrid.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copy));
  });
}

function createRepoCardHTML(result, repo, index) {
  let badgeClass = '';
  if (result.type === 'online') {
    badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 before:bg-emerald-400 before:shadow-[0_0_6px_#10b981]';
  } else if (result.type === 'warning') {
    badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20 before:bg-amber-400';
  } else if (result.type === 'offline') {
    badgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20 before:bg-red-400';
  } else {
    badgeClass = 'bg-slate-500/10 text-slate-400 border border-slate-500/20 before:bg-slate-400';
  }

  const urlBlock =
    result.type === 'online'
      ? `<a href="${result.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 px-3 py-2 bg-[#1a2234]/50 border border-slate-800 rounded-lg text-xs text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 transition break-all mb-2">
           ${ICONS.externalLink}
           ${result.url}
         </a>
         <div class="flex gap-2">
           <button class="btn-icon inline-flex items-center justify-center w-8 h-8 bg-[#1a2234] border border-slate-800 rounded-lg text-slate-400 hover:text-[#38bdf8] hover:border-[#38bdf8] transition" data-copy="${result.url}" title="Copiar URL" aria-label="Copiar URL">
             ${ICONS.copy}
           </button>
           <a href="${result.url}" target="_blank" rel="noopener noreferrer" class="btn-icon inline-flex items-center justify-center w-8 h-8 bg-[#1a2234] border border-slate-800 rounded-lg text-slate-400 hover:text-[#38bdf8] hover:border-[#38bdf8] transition" title="Abrir site" aria-label="Abrir site">
             ${ICONS.externalLink}
           </a>
         </div>`
      : '';

  return `
    <article class="repo-card bg-[#111827] border border-slate-800 rounded-2xl p-5 flex flex-col gap-3.5 hover:border-slate-700 hover:-translate-y-0.5 hover:shadow-2xl transition duration-200" style="animation: fadeInUp 0.35s ease backwards; animation-delay: ${Math.min(index * 40, 400)}ms">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-sm font-semibold text-white break-all leading-snug">${escapeHtml(repo.name)}</h3>
        <span class="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full ${badgeClass}">${result.label}</span>
      </div>
      <p class="text-xs text-slate-400 leading-relaxed flex-1">${escapeHtml(result.description)}</p>
      ${urlBlock}
    </article>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('URL copiada para a área de transferência.', 'success');
  } catch {
    showToast('Não foi possível copiar a URL.', 'error');
  }
}

function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  const borderClass = type === 'error' ? 'border-red-500/30' : 'border-emerald-500/30';
  const iconColor = type === 'error' ? 'text-red-400' : 'text-emerald-400';
  
  toast.className = `toast toast--${type} flex items-center gap-3 p-3.5 bg-slate-900 border ${borderClass} rounded-xl shadow-2xl text-xs text-white max-w-sm transition duration-300`;
  toast.style.animation = 'slideIn 0.3s ease';
  
  const icon = type === 'error' ? ICONS.alertCircle : ICONS.checkCircle;
  const styledIcon = icon.replace('<svg', `<svg class="${iconColor} w-5 h-5 flex-shrink-0"`);
  
  toast.innerHTML = `${styledIcon}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

const ICONS = {
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

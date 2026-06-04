// -------------------- ГЛОБАЛЬНОЕ СОСТОЯНИЕ --------------------
const API_BASE = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentUser = null;
let newsState = { page: 1, hasMore: true, filters: { search: '', category: '', authorId: '', sort: 'date' } };
let isLoadingNews = false;

// -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --------------------
async function fetchApi(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
        const response = await fetch(API_BASE + url, { ...options, headers });
        if (response.status === 401) {
            logout();
            throw new Error('Сессия истекла, войдите снова');
        }
        return response;
    } catch (err) {
        if (err.message === 'Failed to fetch') showToast('Нет соединения с сервером', true);
        else showToast(err.message, true);
        throw err;
    }
}

function showToast(message, isError = true) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    toast.style.background = isError ? '#e74c3c' : '#27ae60';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function showPage(pageId) {
    const allowedPages = ['home', 'news', 'team', 'matches', 'favourites', 'profile', 'contacts', 'admin'];
    if (!allowedPages.includes(pageId)) {
        pageId = '404';
        if (!document.getElementById('404Page')) create404Page();
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) targetPage.classList.add('active-page');
    else document.getElementById('404Page').classList.add('active-page');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.page === pageId) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    // Загрузка данных для страниц
    if (pageId === 'news') loadNews(true);
    if (pageId === 'team') loadPlayers();
    if (pageId === 'matches') loadMatches();
    if (pageId === 'favourites' && currentUser) loadFavourites();
    if (pageId === 'profile') { loadMyNews(); loadProfileInfo(); }
    if (pageId === 'home') loadHomeLatest();
    if (pageId === 'admin' && currentUser?.role === 'admin') loadAdminPanel();
}

function create404Page() {
    const contentDiv = document.querySelector('.content');
    const div = document.createElement('div');
    div.id = '404Page';
    div.className = 'page';
    div.innerHTML = `<div style="text-align:center;padding:50px;"><h2>404 - Страница не найдена</h2><p>Запрашиваемая страница не существует.</p><button onclick="showPage('home')">На главную</button></div>`;
    contentDiv.appendChild(div);
}

// -------------------- АУТЕНТИФИКАЦИЯ --------------------
async function login(email, password) {
    const res = await fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    token = data.token;
    localStorage.setItem('token', token);
    await loadCurrentUser();
}

async function register(name, email, password) {
    const res = await fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    token = data.token;
    localStorage.setItem('token', token);
    await loadCurrentUser();
}

async function loadCurrentUser() {
    if (!token) return null;
    try {
        const res = await fetchApi('/auth/me');
        if (!res.ok) throw new Error();
        const user = await res.json();
        currentUser = user;
        document.getElementById('userInfo').innerHTML = `👋 ${escapeHtml(user.name)} ${user.role === 'admin' ? '<span class="admin-badge">admin</span>' : ''}`;
        document.getElementById('navTabs').style.display = 'flex';
        document.getElementById('authPage').classList.remove('active-page');
        const adminBtn = document.getElementById('adminNavBtn');
        if (user.role === 'admin') adminBtn.style.display = 'block';
        else adminBtn.style.display = 'none';
        showPage('home');
        return user;
    } catch(e) {
        logout();
        return null;
    }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    document.getElementById('navTabs').style.display = 'none';
    document.getElementById('userInfo').innerHTML = '';
    document.getElementById('authPage').classList.add('active-page');
    document.querySelectorAll('.page').forEach(p => { if (p.id !== 'authPage') p.classList.remove('active-page'); });
    showAuthForms(true);
    showToast('Вы вышли из системы', false);
}

function showAuthForms(showLogin = true) {
    document.getElementById('loginFormBlock').style.display = showLogin ? 'block' : 'none';
    document.getElementById('registerFormBlock').style.display = showLogin ? 'none' : 'block';
    document.getElementById('authError').innerText = '';
    document.getElementById('regError').innerText = '';
}

// -------------------- НОВОСТИ (CRUD + фильтры, пагинация, лайки) --------------------
async function loadNews(reset = true) {
    if (isLoadingNews) return;
    if (reset) { newsState.page = 1; newsState.hasMore = true; document.getElementById('newsListContainer').innerHTML = ''; }
    if (!newsState.hasMore) return;
    isLoadingNews = true;
    document.getElementById('newsLoading').style.display = 'block';
    try {
        const params = new URLSearchParams({
            page: newsState.page,
            limit: 5,
            search: newsState.filters.search,
            category: newsState.filters.category,
            authorId: newsState.filters.authorId,
            sort: newsState.filters.sort
        });
        const res = await fetchApi(`/news?${params}`);
        const data = await res.json();
        const newsItems = data.items || [];
        const total = data.total || 0;
        const container = document.getElementById('newsListContainer');
        for (let item of newsItems) {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="news-header">
                    <h4>${escapeHtml(item.title)}</h4>
                    <button class="like-btn ${item.userLiked ? 'liked' : ''}" data-id="${item.id}">❤️ ${item.likesCount || 0}</button>
                </div>
                <p>${escapeHtml(item.content.substring(0, 200))}${item.content.length > 200 ? '...' : ''}</p>
                <small>Категория: ${item.category} | Автор: ${escapeHtml(item.authorName)} | ${new Date(item.createdAt).toLocaleDateString()}</small>
            `;
            container.appendChild(div);
        }
        attachLikeEvents();
        newsState.hasMore = newsItems.length === 5 && (newsState.page * 5) < total;
        document.getElementById('loadMoreNews').style.display = newsState.hasMore ? 'block' : 'none';
    } catch(err) { showToast('Ошибка загрузки новостей'); }
    finally { isLoadingNews = false; document.getElementById('newsLoading').style.display = 'none'; }
}

function attachLikeEvents() {
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.removeEventListener('click', likeHandler);
        btn.addEventListener('click', likeHandler);
    });
}

async function likeHandler(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const newsId = btn.dataset.id;
    if (!currentUser) { showToast('Войдите, чтобы ставить лайки'); return; }
    const res = await fetchApi(`/news/${newsId}/like`, { method: 'POST' });
    if (res.ok) {
        const data = await res.json();
        if (data.liked) btn.classList.add('liked');
        else btn.classList.remove('liked');
        loadNews(true);
    }
}

function applyNewsFilters() {
    newsState.filters.search = document.getElementById('newsSearch').value;
    newsState.filters.category = document.getElementById('newsCategoryFilter').value;
    newsState.filters.authorId = document.getElementById('newsAuthorFilter').value;
    newsState.filters.sort = document.getElementById('newsSort').value;
    loadNews(true);
}

async function loadAuthorFilter() {
    const res = await fetchApi('/users');
    if (res.ok) {
        const users = await res.json();
        const select = document.getElementById('newsAuthorFilter');
        select.innerHTML = '<option value="">Все авторы</option>' + users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    }
}

// -------------------- ПРОФИЛЬ (свои новости) --------------------
async function loadMyNews() {
    if (!currentUser) return;
    const res = await fetchApi('/news');
    if (res.ok) {
        const data = await res.json();
        const myNews = data.items.filter(n => n.userId === currentUser.id);
        const container = document.getElementById('myNewsList');
        container.innerHTML = myNews.map(item => `
            <div class="card">
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.content)}</p>
                <button class="edit-mynews" data-id="${item.id}">✏️ Редактировать</button>
                <button class="delete-mynews" data-id="${item.id}">🗑️ Удалить</button>
            </div>
        `).join('');
        document.querySelectorAll('.edit-mynews').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            const newTitle = prompt('Новый заголовок');
            const newContent = prompt('Новый текст');
            if (newTitle && newContent) {
                await fetchApi(`/news/${id}`, { method: 'PUT', body: JSON.stringify({ title: newTitle, content: newContent, category: 'club' }) });
                loadMyNews(); loadNews(true);
            }
        }));
        document.querySelectorAll('.delete-mynews').forEach(btn => btn.addEventListener('click', async (e) => {
            if (confirm('Удалить новость?')) {
                await fetchApi(`/news/${btn.dataset.id}`, { method: 'DELETE' });
                loadMyNews(); loadNews(true);
            }
        }));
    }
}

document.getElementById('newsCreateForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('newsTitle').value;
    const content = document.getElementById('newsContent').value;
    const category = document.getElementById('newsCategory').value;
    if (!title || !content) { showToast('Заголовок и текст обязательны'); return; }
    await fetchApi('/news', { method: 'POST', body: JSON.stringify({ title, content, category }) });
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    loadMyNews(); loadNews(true);
    showToast('Новость создана', false);
});

async function loadProfileInfo() {
    if (currentUser) document.getElementById('profileUserInfo').innerHTML = `<p><strong>${escapeHtml(currentUser.name)}</strong> (${currentUser.email})</p>`;
}

// -------------------- КОМАНДА --------------------
async function loadPlayers() {
    const res = await fetchApi('/players');
    if (res.ok) {
        const players = await res.json();
        document.getElementById('playersList').innerHTML = players.map(p => `
            <div class="player-card">
                <img src="${p.photoUrl || 'https://via.placeholder.com/100'}" alt="${escapeHtml(p.name)}">
                <h4>${escapeHtml(p.name)}</h4>
                <p>№${p.number} | ${p.position || '—'}</p>
            </div>
        `).join('');
    }
}

// -------------------- МАТЧИ И ИЗБРАННОЕ --------------------
async function loadMatches() {
    const res = await fetchApi('/matches');
    if (res.ok) {
        const matches = await res.json();
        document.getElementById('matchesList').innerHTML = matches.map(m => `
            <div class="match-card">
                <strong>${escapeHtml(m.opponent)}</strong><br>
                📅 ${new Date(m.dateTime).toLocaleString()}<br>
                🏟️ ${m.venue === 'home' ? 'Дома' : 'В гостях'}<br>
                <button class="fav-match-btn" data-id="${m.id}">❤️ В избранное</button>
            </div>
        `).join('');
        document.querySelectorAll('.fav-match-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const matchId = btn.dataset.id;
            const res = await fetchApi(`/favourites/matches/${matchId}`, { method: 'POST' });
            if (res.ok) showToast('Добавлено в избранное', false);
            else showToast('Уже в избранном или ошибка');
        }));
    }
}

async function loadFavourites() {
    const res = await fetchApi('/favourites');
    if (res.ok) {
        const favs = await res.json();
        const container = document.getElementById('favouritesList');
        if (favs.length === 0) { container.innerHTML = '<p>Нет избранных матчей</p>'; return; }
        container.innerHTML = favs.map(f => `
            <div class="card">
                ⚽ Матч: ${escapeHtml(f.opponent)} (${new Date(f.dateTime).toLocaleString()})
                <button class="remove-fav" data-type="matches" data-id="${f.entityId}">🗑️ Удалить</button>
            </div>
        `).join('');
        document.querySelectorAll('.remove-fav').forEach(btn => btn.addEventListener('click', async (e) => {
            await fetchApi(`/favourites/matches/${btn.dataset.id}`, { method: 'DELETE' });
            loadFavourites();
        }));
    }
}

// -------------------- АДМИН-ПАНЕЛЬ --------------------
async function loadAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin') return;
    const container = document.getElementById('adminPanel');
    container.innerHTML = `
        <h3>Управление игроками</h3>
        <form id="adminPlayerForm">
            <input type="text" id="playerName" placeholder="Имя" required>
            <input type="number" id="playerNumber" placeholder="Номер">
            <input type="text" id="playerPosition" placeholder="Позиция">
            <button type="submit">Добавить игрока</button>
        </form>
        <div id="adminPlayersList"></div>
        <hr>
        <h3>Управление матчами</h3>
        <form id="adminMatchForm">
            <input type="text" id="opponentName" placeholder="Соперник" required>
            <input type="datetime-local" id="matchDateTime">
            <select id="matchVenue"><option value="home">Дома</option><option value="away">В гостях</option></select>
            <button type="submit">Добавить матч</button>
        </form>
        <div id="adminMatchesList"></div>
    `;
    async function loadAdminPlayers() {
        const res = await fetchApi('/players');
        const players = await res.json();
        document.getElementById('adminPlayersList').innerHTML = players.map(p => `<div>${escapeHtml(p.name)} (№${p.number}) <button class="del-player" data-id="${p.id}">Удалить</button></div>`).join('');
        document.querySelectorAll('.del-player').forEach(btn => btn.addEventListener('click', async (e) => {
            await fetchApi(`/players/${btn.dataset.id}`, { method: 'DELETE' });
            loadAdminPlayers();
        }));
    }
    async function loadAdminMatches() {
        const res = await fetchApi('/matches');
        const matches = await res.json();
        document.getElementById('adminMatchesList').innerHTML = matches.map(m => `<div>${escapeHtml(m.opponent)} (${new Date(m.dateTime).toLocaleString()}) <button class="del-match" data-id="${m.id}">Удалить</button></div>`).join('');
        document.querySelectorAll('.del-match').forEach(btn => btn.addEventListener('click', async (e) => {
            await fetchApi(`/matches/${btn.dataset.id}`, { method: 'DELETE' });
            loadAdminMatches();
        }));
    }
    document.getElementById('adminPlayerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetchApi('/players', { method: 'POST', body: JSON.stringify({ 
            name: document.getElementById('playerName').value, 
            number: document.getElementById('playerNumber').value, 
            position: document.getElementById('playerPosition').value 
        }) });
        loadAdminPlayers();
    });
    document.getElementById('adminMatchForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetchApi('/matches', { method: 'POST', body: JSON.stringify({ 
            opponent: document.getElementById('opponentName').value, 
            dateTime: document.getElementById('matchDateTime').value, 
            venue: document.getElementById('matchVenue').value 
        }) });
        loadAdminMatches();
    });
    loadAdminPlayers(); loadAdminMatches();
}

// -------------------- ГЛАВНАЯ --------------------
async function loadHomeLatest() {
    const res = await fetchApi('/news?limit=3');
    if (res.ok) {
        const data = await res.json();
        const latest = data.items || [];
        document.getElementById('homeLatestNews').innerHTML = '<h3>Последние новости</h3>' + latest.map(n => `<div class="card"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.content.substring(0,100))}...</p></div>`).join('');
    }
}

// -------------------- ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ --------------------
document.getElementById('doLoginBtn').onclick = async () => {
    try { await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); }
    catch(e) { document.getElementById('authError').innerText = e.message; }
};
document.getElementById('doRegisterBtn').onclick = async () => {
    try { await register(document.getElementById('regName').value, document.getElementById('regEmail').value, document.getElementById('regPassword').value); }
    catch(e) { document.getElementById('regError').innerText = e.message; }
};
document.getElementById('showRegisterLink').onclick = () => showAuthForms(false);
document.getElementById('showLoginLink').onclick = () => showAuthForms(true);
document.getElementById('applyNewsFilters').onclick = () => applyNewsFilters();
document.getElementById('loadMoreNews').onclick = () => { newsState.page++; loadNews(false); };
document.getElementById('logoutNavBtn').onclick = () => logout();
document.getElementById('navToggle').onclick = () => document.getElementById('navTabs').classList.toggle('show');
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => btn.addEventListener('click', () => { 
    showPage(btn.dataset.page); 
    if (window.innerWidth <= 768) document.getElementById('navTabs').classList.remove('show'); 
}));

// Старт приложения
if (token) {
    loadCurrentUser().then(() => loadAuthorFilter());
} else {
    showAuthForms(true);
}

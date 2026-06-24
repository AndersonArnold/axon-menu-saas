// ============================================================================
// Axon Menu Base - Admin Panel
// Complete administration interface for managing the digital menu system
// ============================================================================

import './css/global.css';
import './css/admin.css';
import './css/table-map.css';
import './css/print.css';
import { store } from './modules/store.js';
import { configManager } from './modules/config-manager.js';
import { orderManager } from './modules/order-manager.js';
import { tableMap } from './modules/table-map.js';
import { cashier } from './modules/cashier.js';
import { printer } from './modules/printer.js';
import { formatCurrency, formatDate, formatTime, formatDateTime, showToast, generateId, playNotificationSound } from './modules/utils.js';
import * as imageUploader from './modules/image-uploader.js';

// ============================================================================
// STATE
// ============================================================================

window.onerror = function(message, source, lineno, colno, error) {
  showToast(`ERRO CRÍTICO: ${message}`, 'error', 10000);
  console.error(error);
};
window.addEventListener('unhandledrejection', function(event) {
  showToast(`ERRO PROMISE: ${event.reason}`, 'error', 10000);
  console.error(event.reason);
});

const state = {
  currentPage: 'dashboard',
  config: null,
  categories: [],
  menuItems: [],
  orders: [],
  dashboardInterval: null,
  ordersInterval: null,
  lastOrderCount: 0
};

// ============================================================================
// DOM REFS
// ============================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================================
// INITIALIZATION
// ============================================================================
async function init() {
  await configManager.loadConfig();
  state.config = configManager.getConfig();
  configManager.applyTheme();

  // Store já foi inicializado pelo configManager.loadConfig()

  if (sessionStorage.getItem('axon_admin_auth') === 'true') {
    showApp();
  } else {
    showLogin();
  }
}

// ============================================================================
// LOGIN
// ============================================================================
function showLogin() {
  $('#admin-login').style.display = 'flex';
  $('#admin-app').style.display = 'none';

  const passwordInput = $('#admin-password');
  const loginBtn = $('#login-btn');
  const loginError = $('#login-error');

  const doLogin = () => {
    const password = passwordInput.value.trim();
    const adminPassword = state.config?.admin?.password || 'admin123';

    if (password === adminPassword) {
      sessionStorage.setItem('axon_admin_auth', 'true');
      loginError.style.display = 'none';
      passwordInput.value = '';
      showApp();
    } else {
      loginError.style.display = 'block';
      passwordInput.classList.add('shake');
      setTimeout(() => passwordInput.classList.remove('shake'), 500);
    }
  };

  loginBtn.onclick = doLogin;
  passwordInput.onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
}

function showApp() {
  $('#admin-login').style.display = 'none';
  $('#admin-app').style.display = 'flex';

  // Set store name in header
  const storeInfo = configManager.getStoreInfo ? configManager.getStoreInfo() : state.config?.store;
  if (storeInfo) {
    $('#header-store-name').textContent = storeInfo.name || 'Axon Menu';
  }

  setupSidebar();
  setupMobileNav();
  navigateTo('dashboard');
}

// ============================================================================
// SIDEBAR & NAVIGATION
// ============================================================================
function setupSidebar() {
  const toggleBtn = $('#menu-toggle');
  const sidebar = $('#admin-sidebar');
  const overlay = $('#sidebar-overlay');

  toggleBtn.onclick = () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  };

  overlay.onclick = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  };

  // Sidebar nav items
  $$('.sidebar-nav .nav-item').forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    };
  });

  // Logout
  $('#logout-btn').onclick = () => {
    sessionStorage.removeItem('axon_admin_auth');
    clearAllIntervals();
    showLogin();
  };
}

function setupMobileNav() {
  $$('.mobile-nav-item').forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    };
  });
}

function navigateTo(page) {
  clearAllIntervals();
  state.currentPage = page;

  // Update active states
  $$('.sidebar-nav .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  $$('.mobile-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Page titles
  const titles = {
    dashboard: 'Dashboard',
    menu: 'Cardápio',
    orders: 'Pedidos',
    deliveries: 'Acerto de Entregas',
    tables: 'Mesas',
    cashier: 'Caixa',
    settings: 'Configurações'
  };
  $('#page-title').textContent = titles[page] || 'Admin';

  // Render page with transition
  const content = $('#page-content');
  content.classList.add('page-exit');

  setTimeout(() => {
    content.innerHTML = '';
    const renderers = {
      dashboard: renderDashboard,
      menu: renderMenuPage,
      orders: renderOrdersPage,
      deliveries: renderDeliveriesPage,
      tables: renderTablesPage,
      cashier: renderCashierPage,
      settings: renderSettingsPage
    };
    if (renderers[page]) renderers[page](content);
    content.classList.remove('page-exit');
    content.classList.add('page-enter');
    setTimeout(() => content.classList.remove('page-enter'), 400);
  }, 200);
}

function clearAllIntervals() {
  if (state.dashboardInterval) { clearInterval(state.dashboardInterval); state.dashboardInterval = null; }
  if (state.ordersInterval) {
    if (typeof state.ordersInterval === 'function') state.ordersInterval();
    else clearInterval(state.ordersInterval);
    state.ordersInterval = null;
  }
}

// ============================================================================
// MODAL SYSTEM
// ============================================================================
function openModal(contentHTML, options = {}) {
  const overlay = $('#modal-overlay');
  const container = $('#modal-container');
  container.className = `modal-container glass-card ${options.className || ''}`;
  container.innerHTML = contentHTML;
  // Use 'active' class to match CSS (.modal-overlay.active)
  requestAnimationFrame(() => overlay.classList.add('active'));

  if (!options.persistent) {
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };
  }

  return container;
}

function closeModal() {
  const overlay = $('#modal-overlay');
  overlay.classList.remove('active');
  setTimeout(() => {
    $('#modal-container').innerHTML = '';
  }, 300);
}

// ============================================================================
// DASHBOARD PAGE
// ============================================================================
async function renderDashboard(container) {
  container.innerHTML = '<div class="loading-state"><span class="material-icons-round spin">sync</span><p>Carregando dados...</p></div>';

  const summary = await getDashboardData();

  container.innerHTML = `
    <div class="dashboard-grid">
      <!-- Stat Cards -->
      <div class="stats-row">
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(6,214,160,0.15);color:var(--success)">
            <span class="material-icons-round">attach_money</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(summary.totalSales)}</span>
            <span class="stat-label">Total Vendas Hoje</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(255,107,53,0.15);color:var(--primary)">
            <span class="material-icons-round">receipt_long</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${summary.totalOrders}</span>
            <span class="stat-label">Pedidos Hoje</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(255,209,102,0.15);color:var(--accent)">
            <span class="material-icons-round">trending_up</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(summary.avgTicket)}</span>
            <span class="stat-label">Ticket Médio</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(239,71,111,0.15);color:var(--danger)">
            <span class="material-icons-round">pending_actions</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${summary.pendingOrders}</span>
            <span class="stat-label">Pedidos Pendentes</span>
          </div>
        </div>
      </div>

      <!-- Charts & Lists -->
      <div class="dashboard-panels">
        <div class="panel glass-card">
          <div class="panel-header">
            <h3><span class="material-icons-round">bar_chart</span> Vendas por Forma de Pagamento</h3>
          </div>
          <div class="panel-body">
            <div class="bar-chart" id="payment-chart">
              ${renderPaymentChart(summary.byPayment)}
            </div>
          </div>
        </div>

        <div class="panel glass-card">
          <div class="panel-header">
            <h3><span class="material-icons-round">history</span> Pedidos Recentes</h3>
          </div>
          <div class="panel-body">
            <div id="recent-orders-list">
              ${renderRecentOrders(summary.recentOrders)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Auto-refresh
  state.dashboardInterval = setInterval(async () => {
    if (state.currentPage !== 'dashboard') return;
    const newSummary = await getDashboardData();
    const statsEls = container.querySelectorAll('.stat-value');
    if (statsEls[0]) statsEls[0].textContent = formatCurrency(newSummary.totalSales);
    if (statsEls[1]) statsEls[1].textContent = newSummary.totalOrders;
    if (statsEls[2]) statsEls[2].textContent = formatCurrency(newSummary.avgTicket);
    if (statsEls[3]) statsEls[3].textContent = newSummary.pendingOrders;

    const chartEl = container.querySelector('#payment-chart');
    if (chartEl) chartEl.innerHTML = renderPaymentChart(newSummary.byPayment);

    const recentEl = container.querySelector('#recent-orders-list');
    if (recentEl) recentEl.innerHTML = renderRecentOrders(newSummary.recentOrders);
  }, 30000);
}

async function getDashboardData() {
  try {
    const orders = await orderManager.getTodaysOrders();
    const completed = orders.filter(o => o.status === 'delivered' || o.status === 'ready' || o.status === 'preparing');
    const totalSales = completed.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    // Payment breakdown
    const byPayment = { pix: 0, credit: 0, debit: 0, cash: 0 };
    completed.forEach(o => {
      const method = o.paymentMethod || 'cash';
      if (Object.hasOwn(byPayment, method)) byPayment[method] += (o.total || 0);
      else byPayment.cash += (o.total || 0);
    });

    const recentOrders = orders.slice(-5).reverse();
    return { totalSales, totalOrders, avgTicket, pendingOrders, byPayment, recentOrders };
  } catch (err) {
    console.error('Dashboard data error:', err);
    return { totalSales: 0, totalOrders: 0, avgTicket: 0, pendingOrders: 0, byPayment: { pix: 0, credit: 0, debit: 0, cash: 0 }, recentOrders: [] };
  }
}

function renderPaymentChart(byPayment) {
  const methods = [
    { key: 'pix', label: 'PIX', color: '#06D6A0' },
    { key: 'credit', label: 'Crédito', color: '#118AB2' },
    { key: 'debit', label: 'Débito', color: '#FFD166' },
    { key: 'cash', label: 'Dinheiro', color: '#FF6B35' }
  ];
  const maxVal = Math.max(...Object.values(byPayment), 1);

  return methods.map(m => {
    const val = byPayment[m.key] || 0;
    const pct = (val / maxVal) * 100;
    return `
      <div class="bar-row">
        <span class="bar-label">${m.label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${m.color}"></div>
        </div>
        <span class="bar-value">${formatCurrency(val)}</span>
      </div>
    `;
  }).join('');
}

function renderRecentOrders(orders) {
  if (!orders || orders.length === 0) {
    return '<div class="empty-state"><span class="material-icons-round">inbox</span><p>Nenhum pedido hoje</p></div>';
  }

  return orders.map(order => {
    const statusLabels = { pending: 'Pendente', preparing: 'Preparando', ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado' };
    const statusColors = { pending: 'var(--warning)', preparing: 'var(--info)', ready: 'var(--success)', delivered: 'var(--text-muted)', cancelled: 'var(--danger)' };
    const typeLabels = { dineIn: 'Mesa', takeaway: 'Retirada', delivery: 'Delivery' };
    const statusLabel = statusLabels[order.status] || order.status;
    const statusColor = statusColors[order.status] || 'var(--text-muted)';
    const typeLabel = typeLabels[order.type] || order.type || '';
    const tableLabel = order.tableId ? ` ${order.tableId}` : '';

    return `
      <div class="recent-order-item">
        <div class="recent-order-num">#${order.orderNumber || String(order.id).slice(-4) || '----'}</div>
        <div class="recent-order-info">
          <span class="recent-order-name">${order.customerInfo?.name || 'Cliente'}</span>
          <span class="recent-order-type">${typeLabel}${tableLabel}</span>
        </div>
        <span class="recent-order-total">${formatCurrency(order.total || 0)}</span>
        <span class="status-badge" style="background:${statusColor}20;color:${statusColor}">${statusLabel}</span>
      </div>
    `;
  }).join('');
}

// ============================================================================
// MENU MANAGEMENT PAGE
// ============================================================================
async function renderMenuPage(container) {
  // Always try loading from the IndexedDB store first
  try {
    const allCats = await store.getAllCategories();
    const allItems = await store.getAllMenuItems();
    // Only use DB data if we actually got results (DB was seeded)
    if (allCats.length > 0 || allItems.length > 0) {
      state.categories = allCats;
      state.menuItems = allItems;
    } else {
      // Fallback to static config if DB is empty
      state.categories = state.config?.categories || [];
      state.menuItems = state.config?.menuItems || [];
    }
  } catch (e) {
    console.error('Error loading from store:', e);
    // Fallback to static config on error
    state.categories = state.config?.categories || [];
    state.menuItems = state.config?.menuItems || [];
    showToast('Erro ao carregar dados do banco: ' + e.message, 'error');
  }

  container.innerHTML = `
    <div class="menu-management">
      <!-- Tab Bar -->
      <div class="tab-bar">
        <button class="tab-btn active" data-tab="categories">
          <span class="material-icons-round">category</span> Categorias
        </button>
        <button class="tab-btn" data-tab="items">
          <span class="material-icons-round">fastfood</span> Itens
        </button>
      </div>

      <!-- Categories Tab -->
      <div id="tab-categories" class="tab-content active">
        <div class="tab-actions">
          <button class="btn btn-primary" id="add-category-btn">
            <span class="material-icons-round">add</span> Nova Categoria
          </button>
        </div>
        <div id="categories-list" class="categories-list">
          ${renderCategoriesList()}
        </div>
      </div>

      <!-- Items Tab -->
      <div id="tab-items" class="tab-content" style="display:none">
        <div class="tab-actions">
          <div class="filter-group">
            <select id="filter-category" class="form-select">
              <option value="">Todas as categorias</option>
              ${state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="add-item-btn">
            <span class="material-icons-round">add</span> Novo Item
          </button>
        </div>
        <div id="items-grid" class="items-grid">
          ${renderItemsGrid()}
        </div>
      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      container.querySelector('#tab-categories').style.display = tab === 'categories' ? 'block' : 'none';
      container.querySelector('#tab-items').style.display = tab === 'items' ? 'block' : 'none';
    };
  });

  // Add category
  container.querySelector('#add-category-btn').onclick = () => openCategoryModal();

  // Add item
  container.querySelector('#add-item-btn')?.addEventListener('click', () => openItemModal());

  // Category filter
  container.querySelector('#filter-category')?.addEventListener('change', (e) => {
    const catId = e.target.value;
    container.querySelector('#items-grid').innerHTML = renderItemsGrid(catId);
    bindItemActions(container);
  });

  bindCategoryActions(container);
  bindItemActions(container);
}

function renderCategoriesList() {
  if (state.categories.length === 0) {
    return '<div class="empty-state"><span class="material-icons-round">category</span><p>Nenhuma categoria cadastrada</p></div>';
  }

  return state.categories
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((cat, i) => `
      <div class="category-row glass-card" data-id="${cat.id}">
        <div class="category-row-info">
          <span class="material-icons-round category-icon">${cat.icon || 'category'}</span>
          <span class="category-name">${cat.name}</span>
          <span class="category-order-badge">Ordem: ${cat.order || i + 1}</span>
        </div>
        <div class="category-row-actions">
          <button class="btn-icon btn-sm" data-action="move-up" data-id="${cat.id}" title="Mover para cima">
            <span class="material-icons-round">arrow_upward</span>
          </button>
          <button class="btn-icon btn-sm" data-action="move-down" data-id="${cat.id}" title="Mover para baixo">
            <span class="material-icons-round">arrow_downward</span>
          </button>
          <button class="btn-icon btn-sm" data-action="edit-cat" data-id="${cat.id}" title="Editar">
            <span class="material-icons-round">edit</span>
          </button>
          <button class="btn-icon btn-sm btn-danger-icon" data-action="delete-cat" data-id="${cat.id}" title="Excluir">
            <span class="material-icons-round">delete</span>
          </button>
        </div>
      </div>
    `).join('');
}

function bindCategoryActions(container) {
  container.querySelectorAll('[data-action="edit-cat"]').forEach(btn => {
    btn.onclick = () => {
      const cat = state.categories.find(c => c.id === btn.dataset.id);
      if (cat) openCategoryModal(cat);
    };
  });

  container.querySelectorAll('[data-action="delete-cat"]').forEach(btn => {
    btn.onclick = () => confirmDelete('categoria', btn.dataset.id, 'category');
  });

  container.querySelectorAll('[data-action="move-up"]').forEach(btn => {
    btn.onclick = () => reorderCategory(btn.dataset.id, -1, container);
  });

  container.querySelectorAll('[data-action="move-down"]').forEach(btn => {
    btn.onclick = () => reorderCategory(btn.dataset.id, 1, container);
  });
}

async function reorderCategory(catId, direction, container) {
  const sorted = [...state.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  const idx = sorted.findIndex(c => c.id === catId);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= sorted.length) return;

  [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
  sorted.forEach((c, i) => c.order = i + 1);
  state.categories = sorted;

  try {
    for (const c of state.categories) {
      await store.updateCategory(c.id, { order: c.order });
    }
  } catch (e) { /* silent */ }

  const list = container.querySelector('#categories-list');
  if (list) {
    list.innerHTML = renderCategoriesList();
    bindCategoryActions(container);
  }
}

function openCategoryModal(category = null) {
  const isEdit = !!category;
  const title = isEdit ? 'Editar Categoria' : 'Nova Categoria';

  const modal = openModal(`
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="btn-icon modal-close-btn" id="close-modal">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <div class="modal-body">
      <div class="input-group">
        <label>Nome da Categoria</label>
        <input type="text" id="cat-name" class="form-input" placeholder="Ex: 🍔 Lanches" value="${category?.name || ''}" />
      </div>
      <div class="input-group">
        <label>Ícone (Material Icon)</label>
        <input type="text" id="cat-icon" class="form-input" placeholder="Ex: lunch_dining" value="${category?.icon || ''}" />
        <small class="input-hint">Veja ícones em fonts.google.com/icons</small>
      </div>
      <div class="input-group">
        <label>Ordem de Exibição</label>
        <input type="number" id="cat-order" class="form-input" placeholder="1" value="${category?.order || state.categories.length + 1}" min="1" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancel-cat">Cancelar</button>
      <button class="btn btn-primary" id="save-cat">
        <span class="material-icons-round">save</span> Salvar
      </button>
    </div>
  `);

  modal.querySelector('#close-modal').onclick = closeModal;
  modal.querySelector('#cancel-cat').onclick = closeModal;
  modal.querySelector('#save-cat').onclick = async () => {
    const name = modal.querySelector('#cat-name').value.trim();
    const icon = modal.querySelector('#cat-icon').value.trim();
    const order = parseInt(modal.querySelector('#cat-order').value) || 1;

    if (!name) {
      showToast('Preencha o nome da categoria', 'error');
      return;
    }

    if (isEdit) {
      const idx = state.categories.findIndex(c => c.id === category.id);
      if (idx >= 0) {
        state.categories[idx] = { ...state.categories[idx], name, icon, order };
      }
    } else {
      state.categories.push({ id: generateId(), name, icon, order, active: true });
    }

    try {
      if (isEdit) {
        await store.updateCategory(category.id, { name, icon, order });
      } else {
        await store.addCategory(state.categories[state.categories.length - 1]);
      }
    } catch (e) {
      console.error('Error saving category:', e);
      showToast('Erro ao salvar no banco de dados: ' + e.message, 'error');
    }

    closeModal();
    showToast(isEdit ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
    renderMenuPage($('#page-content'));
  };
}

function renderItemsGrid(filterCat = '') {
  let items = state.menuItems;
  if (filterCat) items = items.filter(i => i.categoryId === filterCat);

  if (items.length === 0) {
    return '<div class="empty-state"><span class="material-icons-round">fastfood</span><p>Nenhum item cadastrado</p></div>';
  }

  return items.map(item => {
    const cat = state.categories.find(c => c.id === item.categoryId);
    const catName = cat ? cat.name : 'Sem categoria';
    const imgSrc = item.image || '';
    const imgDisplay = imgSrc
      ? `<img src="${imgSrc}" alt="${item.name}" class="item-card-img" />`
      : `<div class="item-card-img-placeholder"><span class="material-icons-round">image</span></div>`;

    return `
      <div class="item-card glass-card ${!item.active ? 'item-inactive' : ''}" data-id="${item.id}">
        <div class="item-card-image">
          ${imgDisplay}
          <span class="item-card-cat-badge">${catName}</span>
        </div>
        <div class="item-card-body">
          <h4 class="item-card-name">${item.name}</h4>
          <p class="item-card-desc">${item.description || ''}</p>
          <div class="item-card-footer">
            <span class="item-card-price">${formatCurrency(item.price)}</span>
            <div class="item-card-actions">
              <label class="toggle-switch" title="${item.active ? 'Ativo' : 'Inativo'}">
                <input type="checkbox" ${item.active ? 'checked' : ''} data-action="toggle-item" data-id="${item.id}" />
                <span class="toggle-slider"></span>
              </label>
              <button class="btn-icon btn-sm" data-action="edit-item" data-id="${item.id}" title="Editar">
                <span class="material-icons-round">edit</span>
              </button>
              <button class="btn-icon btn-sm btn-danger-icon" data-action="delete-item" data-id="${item.id}" title="Excluir">
                <span class="material-icons-round">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function bindItemActions(container) {
  container.querySelectorAll('[data-action="edit-item"]').forEach(btn => {
    btn.onclick = () => {
      const item = state.menuItems.find(i => i.id === btn.dataset.id);
      if (item) openItemModal(item);
    };
  });

  container.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
    btn.onclick = () => confirmDelete('item', btn.dataset.id, 'item');
  });

  container.querySelectorAll('[data-action="toggle-item"]').forEach(input => {
    input.onchange = async () => {
      const item = state.menuItems.find(i => i.id === input.dataset.id);
      if (item) {
        item.active = input.checked;
        try {
          await store.updateMenuItem(item.id, { active: item.active });
        } catch (e) { /* silent */ }
        showToast(item.active ? 'Item ativado' : 'Item desativado', 'info');
      }
    };
  });
}

function openItemModal(item = null) {
  const isEdit = !!item;
  const title = isEdit ? 'Editar Item' : 'Novo Item';
  const extras = item?.extras || [];

  const modal = openModal(`
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="btn-icon modal-close-btn" id="close-modal">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <div class="modal-body modal-body-scroll">
      <!-- Image Upload -->
      <div class="input-group">
        <label>Imagem do Item</label>
        <div id="item-image-zone" class="upload-zone">
          ${item?.image
            ? `<img src="${item.image}" class="upload-preview" id="image-preview" /><button class="btn-icon upload-remove" id="remove-image"><span class="material-icons-round">close</span></button>`
            : `<span class="material-icons-round upload-icon">cloud_upload</span><p>Arraste uma imagem ou clique para selecionar</p><small>JPG, PNG — Máx 2MB</small>`
          }
        </div>
        <input type="hidden" id="item-image-data" value="${item?.image || ''}" />
      </div>

      <div class="form-row">
        <div class="input-group flex-1">
          <label>Nome do Item</label>
          <input type="text" id="item-name" class="form-input" placeholder="Ex: X-Burger Clássico" value="${item?.name || ''}" />
        </div>
        <div class="input-group" style="width:140px">
          <label>Preço (R$)</label>
          <input type="number" id="item-price" class="form-input" placeholder="0.00" step="0.01" min="0" value="${item?.price || ''}" />
        </div>
      </div>

      <div class="input-group">
        <label>Descrição</label>
        <textarea id="item-desc" class="form-input form-textarea" placeholder="Descreva o item..." rows="3">${item?.description || ''}</textarea>
      </div>

      <div class="input-group">
        <label>Categoria</label>
        <select id="item-category" class="form-select">
          <option value="">Selecione uma categoria</option>
          ${state.categories.map(c => `<option value="${c.id}" ${item?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>

      <!-- Extras -->
      <div class="input-group">
        <label>Extras / Adicionais</label>
        <div id="extras-list" class="extras-list">
          ${extras.map((ext, i) => `
            <div class="extra-row" data-index="${i}">
              <input type="text" class="form-input extra-name" placeholder="Nome do extra" value="${ext.name}" />
              <input type="number" class="form-input extra-price" placeholder="Preço" step="0.01" min="0" value="${ext.price}" style="width:100px" />
              <button class="btn-icon btn-sm btn-danger-icon remove-extra" data-index="${i}">
                <span class="material-icons-round">remove_circle</span>
              </button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" id="add-extra-btn">
          <span class="material-icons-round">add</span> Adicionar Extra
        </button>
      </div>

      <!-- Active Toggle -->
      <div class="input-group">
        <label class="toggle-label">
          <span>Item Ativo</span>
          <label class="toggle-switch">
            <input type="checkbox" id="item-active" ${item?.active !== false ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancel-item">Cancelar</button>
      <button class="btn btn-primary" id="save-item">
        <span class="material-icons-round">save</span> Salvar
      </button>
    </div>
  `, { className: 'modal-lg' });

  // Close
  modal.querySelector('#close-modal').onclick = closeModal;
  modal.querySelector('#cancel-item').onclick = closeModal;

  // Image upload zone
  setupImageUpload(modal);

  // Add extra
  modal.querySelector('#add-extra-btn').onclick = () => {
    const list = modal.querySelector('#extras-list');
    const idx = list.querySelectorAll('.extra-row').length;
    const row = document.createElement('div');
    row.className = 'extra-row';
    row.dataset.index = idx;
    row.innerHTML = `
      <input type="text" class="form-input extra-name" placeholder="Nome do extra" />
      <input type="number" class="form-input extra-price" placeholder="Preço" step="0.01" min="0" style="width:100px" />
      <button class="btn-icon btn-sm btn-danger-icon remove-extra" data-index="${idx}">
        <span class="material-icons-round">remove_circle</span>
      </button>
    `;
    row.querySelector('.remove-extra').onclick = () => row.remove();
    list.appendChild(row);
  };

  // Remove extra handlers
  modal.querySelectorAll('.remove-extra').forEach(btn => {
    btn.onclick = () => btn.closest('.extra-row').remove();
  });

  // Save
  modal.querySelector('#save-item').onclick = async () => {
    const name = modal.querySelector('#item-name').value.trim();
    const price = parseFloat(modal.querySelector('#item-price').value) || 0;
    const description = modal.querySelector('#item-desc').value.trim();
    const categoryId = modal.querySelector('#item-category').value;
    const image = modal.querySelector('#item-image-data').value;
    const active = modal.querySelector('#item-active').checked;

    if (!name) { showToast('Preencha o nome do item', 'error'); return; }
    if (price <= 0) { showToast('Informe um preço válido', 'error'); return; }
    if (!categoryId) { showToast('Selecione uma categoria', 'error'); return; }

    // Collect extras
    const extrasRows = modal.querySelectorAll('.extra-row');
    const newExtras = [];
    extrasRows.forEach(row => {
      const eName = row.querySelector('.extra-name').value.trim();
      const ePrice = parseFloat(row.querySelector('.extra-price').value) || 0;
      if (eName && ePrice > 0) {
        newExtras.push({ id: generateId(), name: eName, price: ePrice });
      }
    });

    if (isEdit) {
      const idx = state.menuItems.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        state.menuItems[idx] = { ...state.menuItems[idx], name, price, description, categoryId, image, active, extras: newExtras };
      }
    } else {
      state.menuItems.push({
        id: generateId(), name, price, description, categoryId, image, active,
        order: state.menuItems.length + 1, extras: newExtras
      });
    }

    try {
      if (isEdit) {
        await store.updateMenuItem(item.id, { name, price, description, categoryId, image, active, extras: newExtras });
      } else {
        await store.addMenuItem(state.menuItems[state.menuItems.length - 1]);
      }
    } catch (e) {
      console.error('Error saving item:', e);
      showToast('Erro ao salvar no banco de dados: ' + e.message, 'error');
    }

    closeModal();
    showToast(isEdit ? 'Item atualizado!' : 'Item criado!', 'success');
    renderMenuPage($('#page-content'));
  };
}

function setupImageUpload(modal) {
  const zone = modal.querySelector('#item-image-zone');
  const hiddenInput = modal.querySelector('#item-image-data');

  // Remove existing image handler
  const removeBtn = modal.querySelector('#remove-image');
  if (removeBtn) {
    removeBtn.onclick = () => {
      hiddenInput.value = '';
      zone.innerHTML = `<span class="material-icons-round upload-icon">cloud_upload</span><p>Arraste uma imagem ou clique para selecionar</p><small>JPG, PNG — Máx 2MB</small>`;
      setupImageUpload(modal);
    };
  }

  // Click to upload
  zone.onclick = (e) => {
    if (e.target.closest('.upload-remove')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showToast('Imagem muito grande. Máximo 2MB.', 'error');
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        hiddenInput.value = dataUrl;
        zone.innerHTML = `<img src="${dataUrl}" class="upload-preview" id="image-preview" /><button class="btn-icon upload-remove" id="remove-image"><span class="material-icons-round">close</span></button>`;
        setupImageUpload(modal);
      } catch (err) {
        showToast('Erro ao carregar imagem', 'error');
      }
    };
    input.click();
  };

  // Drag and drop
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Imagem muito grande. Máximo 2MB.', 'error');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      hiddenInput.value = dataUrl;
      zone.innerHTML = `<img src="${dataUrl}" class="upload-preview" id="image-preview" /><button class="btn-icon upload-remove" id="remove-image"><span class="material-icons-round">close</span></button>`;
      setupImageUpload(modal);
    } catch (err) {
      showToast('Erro ao carregar imagem', 'error');
    }
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function confirmDelete(typeLabel, id, type) {
  openModal(`
    <div class="modal-header">
      <h3>Confirmar Exclusão</h3>
      <button class="btn-icon modal-close-btn" id="close-modal">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <div class="modal-body">
      <div class="confirm-delete-icon">
        <span class="material-icons-round" style="font-size:48px;color:var(--danger)">warning</span>
      </div>
      <p style="text-align:center;margin-top:12px">Tem certeza que deseja excluir esta <strong>${typeLabel}</strong>?</p>
      <p style="text-align:center;color:var(--text-muted);font-size:0.85rem">Esta ação não pode ser desfeita.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancel-delete">Cancelar</button>
      <button class="btn btn-danger" id="confirm-delete">
        <span class="material-icons-round">delete</span> Excluir
      </button>
    </div>
  `, { className: 'modal-sm' });

  const overlay = $('#modal-overlay');
  overlay.querySelector('#close-modal').onclick = closeModal;
  overlay.querySelector('#cancel-delete').onclick = closeModal;
  overlay.querySelector('#confirm-delete').onclick = async () => {
    if (type === 'category') {
      state.categories = state.categories.filter(c => c.id !== id);
      try { await store.deleteCategory(id); } catch (e) {}
    } else if (type === 'item') {
      state.menuItems = state.menuItems.filter(i => i.id !== id);
      try { await store.deleteMenuItem(id); } catch (e) {}
    }
    closeModal();
    showToast(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} excluída com sucesso`, 'success');
    renderMenuPage($('#page-content'));
  };
}

// ============================================================================
// DELIVERIES PAGE (ACERTO MOTOBOY)
// ============================================================================
async function renderDeliveriesPage(container) {
  container.innerHTML = '<div class="loading-state"><span class="material-icons-round spin">sync</span><p>Carregando entregas...</p></div>';

  const allOrders = await loadOrders();
  
  // Filter only delivery orders that are not cancelled
  const deliveryOrders = allOrders.filter(o => o.type === 'delivery' && o.status !== 'cancelled');
  
  // Calculate total delivery fees
  const totalFees = deliveryOrders.reduce((sum, order) => sum + (parseFloat(order.deliveryFee) || 0), 0);
  const totalTrips = deliveryOrders.length;

  container.innerHTML = `
    <div class="deliveries-page">
      <!-- Dashboard Cards -->
      <div class="stats-grid" style="margin-bottom: 2rem;">
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background: var(--primary-dark); color: var(--primary);">
            <span class="material-icons-round">two_wheeler</span>
          </div>
          <div class="stat-info">
            <h3>Viagens (Hoje)</h3>
            <p class="stat-value">${totalTrips}</p>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background: rgba(6, 214, 160, 0.2); color: var(--success);">
            <span class="material-icons-round">payments</span>
          </div>
          <div class="stat-info">
            <h3>Total Taxas (R$)</h3>
            <p class="stat-value">${formatCurrency(totalFees)}</p>
          </div>
        </div>
      </div>

      <!-- Deliveries List -->
      <div class="section-header">
        <h2>Histórico de Entregas</h2>
      </div>
      
      <div class="orders-list">
        ${deliveryOrders.length === 0 ? 
          '<div class="empty-state"><span class="material-icons-round">two_wheeler</span><p>Nenhuma entrega registrada hoje</p></div>' : 
          deliveryOrders.map(order => renderDeliveryCard(order)).join('')
        }
      </div>
    </div>
  `;

  // Bind order clicks to open the order details
  container.querySelectorAll('[data-action="view-order"]').forEach(el => {
    el.onclick = async () => {
      const orderId = typeof btn !== 'undefined' ? btn.dataset.id : (typeof el !== 'undefined' ? el.dataset.id : null);
      const order = allOrders.find(o => o.id === orderId);
      if (order) openOrderDetailModal(order);
    };
  });
}

function renderDeliveryCard(order) {
  const statusLabels = { pending: 'Pendente', preparing: 'Em Preparo', ready: 'Pronto', delivered: 'Entregue' };
  const statusColors = { pending: '#FFD166', preparing: '#118AB2', ready: '#06D6A0', delivered: '#8888AA' };
  
  const statusLabel = statusLabels[order.status] || order.status;
  const statusColor = statusColors[order.status] || '#8888AA';
  const time = order.createdAt ? formatTime(new Date(order.createdAt)) : '--:--';
  
  return `
    <div class="order-card glass-card status-border-${order.status}" data-action="view-order" data-id="${order.id}" style="cursor: pointer;">
      <div class="order-card-header">
        <div class="order-card-num">
          <span class="order-number">#${order.orderNumber || order.id?.toString().slice(-4) || '----'}</span>
          <span class="order-time">${time}</span>
        </div>
        <div class="order-badges">
          <span class="status-badge" style="background:${statusColor}20;color:${statusColor}">${statusLabel}</span>
        </div>
      </div>
      <div class="order-card-body" style="padding-top: 10px;">
        <p class="order-customer" style="margin-bottom: 5px;">
          <span class="material-icons-round" style="font-size:16px">person</span> ${order.customerInfo?.name || 'Cliente'}
        </p>
        <p class="order-items-summary" style="color: var(--text-color);">
          <span class="material-icons-round" style="font-size:16px">location_on</span> ${order.address || 'Endereço não informado'}
        </p>
      </div>
      <div class="order-card-footer" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 10px;">
        <span style="color: var(--text-muted); font-size: 0.9rem;">Taxa de Entrega:</span>
        <span class="order-total" style="color: var(--success);">${formatCurrency(order.deliveryFee || 0)}</span>
      </div>
    </div>
  `;
}

// ============================================================================
// ORDERS PAGE
// ============================================================================
async function renderOrdersPage(container) {
  container.innerHTML = '<div class="loading-state"><span class="material-icons-round spin">sync</span><p>Carregando pedidos...</p></div>';

  const orders = await loadOrders();

  container.innerHTML = `
    <div class="orders-page">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <button class="filter-btn active" data-filter="all">Todos</button>
        <button class="filter-btn" data-filter="pending">
          <span class="material-icons-round" style="font-size:16px">schedule</span> Pendentes
        </button>
        <button class="filter-btn" data-filter="preparing">
          <span class="material-icons-round" style="font-size:16px">local_fire_department</span> Em Preparo
        </button>
        <button class="filter-btn" data-filter="ready">
          <span class="material-icons-round" style="font-size:16px">check_circle</span> Prontos
        </button>
        <button class="filter-btn" data-filter="delivered">
          <span class="material-icons-round" style="font-size:16px">done_all</span> Entregues
        </button>
      </div>

      <!-- Orders List -->
      <div id="orders-list" class="orders-list">
        ${renderOrdersList(orders, 'all')}
      </div>
    </div>
  `;

  // Filter buttons
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      container.querySelector('#orders-list').innerHTML = renderOrdersList(orders, filter);
      bindOrderActions(container);
    };
  });

  bindOrderActions(container);

  // Auto-refresh for new orders using Real-time Listener (Firebase)
  state.lastOrderCount = orders.length;
  state.ordersInterval = store.subscribeToTodaysOrders((rawOrders) => {
    if (state.currentPage !== 'orders') return;
    const newOrders = rawOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    if (newOrders.length > state.lastOrderCount) {
      if (typeof playNotificationSound === 'function') playNotificationSound();
      showToast('Novo pedido recebido!', 'info');
    }
    state.lastOrderCount = newOrders.length;
    
    const activeFilter = container.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const list = container.querySelector('#orders-list');
    if (list) {
      list.innerHTML = renderOrdersList(newOrders, activeFilter);
      bindOrderActions(container);
    }
    updatePendingBadge(newOrders);
  });

  updatePendingBadge(orders);
}

async function loadOrders() {
  try {
    const orders = await orderManager.getTodaysOrders();
    return orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (e) {
    return [];
  }
}

function updatePendingBadge(orders) {
  const pending = orders.filter(o => o.status === 'pending').length;
  const badge = $('#pending-orders-badge');
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending > 0 ? 'flex' : 'none';
  }
}

function renderOrdersList(orders, filter) {
  let filtered = orders;
  if (filter && filter !== 'all') {
    filtered = orders.filter(o => o.status === filter);
  }

  if (filtered.length === 0) {
    return '<div class="empty-state"><span class="material-icons-round">receipt_long</span><p>Nenhum pedido encontrado</p></div>';
  }

  const statusLabels = { pending: 'Pendente', preparing: 'Em Preparo', ready: 'Pronto', delivered: 'Entregue', completed: 'Encerrado', cancelled: 'Cancelado' };
  const statusColors = { pending: '#FFD166', preparing: '#118AB2', ready: '#06D6A0', delivered: '#8888AA', completed: '#8888AA', cancelled: '#EF476F' };
  const typeLabels = { dineIn: 'Mesa', takeaway: 'Retirada', delivery: 'Delivery' };
  const typeIcons = { dineIn: 'table_restaurant', takeaway: 'shopping_bag', delivery: 'delivery_dining' };
  const paymentLabels = { pix: 'PIX', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro' };

  return filtered.map(order => {
    const statusLabel = statusLabels[order.status] || order.status;
    const statusColor = statusColors[order.status] || '#8888AA';
    const typeLabel = typeLabels[order.type] || order.type || 'Retirada';
    const typeIcon = typeIcons[order.type] || 'shopping_bag';
    const tableLabel = order.tableId ? ` #${order.tableId}` : '';
    const paymentLabel = paymentLabels[order.paymentMethod] || order.paymentMethod || '';
    const time = order.createdAt ? formatTime(new Date(order.createdAt)) : '--:--';
    const itemsSummary = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
    const shortSummary = itemsSummary.length > 60 ? itemsSummary.substring(0, 60) + '...' : itemsSummary;

    // Action buttons based on status
    let actionButtons = '';
    if (order.status === 'pending') {
      actionButtons = `<button class="btn btn-sm btn-primary" data-action="accept" data-id="${order.id}"><span class="material-icons-round">check</span> Aceitar</button>`;
    } else if (order.status === 'preparing') {
      actionButtons = `<button class="btn btn-sm btn-success" data-action="ready" data-id="${order.id}"><span class="material-icons-round">done</span> Pronto</button>`;
    } else if (order.status === 'ready') {
      actionButtons = `<button class="btn btn-sm btn-info" data-action="deliver" data-id="${order.id}"><span class="material-icons-round">done_all</span> Entregue</button>`;
    } else if (order.status === 'delivered' && order.type === 'dineIn') {
      actionButtons = `<button class="btn btn-sm btn-warning" data-action="complete" data-id="${order.id}"><span class="material-icons-round">storefront</span> Encerrar Mesa</button>`;
    }

    return `
      <div class="order-card glass-card status-border-${order.status}" data-id="${order.id}">
        <div class="order-card-header">
          <div class="order-card-num">
            <span class="order-number">#${order.orderNumber || order.id?.toString().slice(-4) || '----'}</span>
            <span class="order-time">${time}</span>
          </div>
          <div class="order-badges">
            <span class="type-badge"><span class="material-icons-round" style="font-size:14px">${typeIcon}</span> ${typeLabel}${tableLabel}</span>
            ${paymentLabel ? `<span class="payment-badge">${paymentLabel}</span>` : ''}
            <span class="status-badge" style="background:${statusColor}20;color:${statusColor}">${statusLabel}</span>
          </div>
        </div>
        <div class="order-card-body" data-action="view-order" data-id="${order.id}">
          <p class="order-customer"><span class="material-icons-round" style="font-size:16px">person</span> ${order.customerInfo?.name || 'Cliente'}</p>
          <p class="order-items-summary">${shortSummary || 'Sem itens'}</p>
        </div>
        <div class="order-card-footer">
          <span class="order-total">${formatCurrency(order.total || 0)}</span>
          <div class="order-actions">
            <button class="btn-icon btn-sm" data-action="print-order" data-id="${order.id}" title="Imprimir">
              <span class="material-icons-round">print</span>
            </button>
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function bindOrderActions(container) {
  container.querySelectorAll('[data-action="accept"]').forEach(btn => {
    btn.onclick = async () => {
      const orderId = typeof btn !== 'undefined' ? btn.dataset.id : (typeof el !== 'undefined' ? el.dataset.id : null);
      await orderManager.updateStatus(orderId, 'preparing');
      showToast('Pedido aceito — Em preparo!', 'success');
      renderOrdersPage($('#page-content'));
    };
  });

  container.querySelectorAll('[data-action="ready"]').forEach(btn => {
    btn.onclick = async () => {
      const orderId = typeof btn !== 'undefined' ? btn.dataset.id : (typeof el !== 'undefined' ? el.dataset.id : null);
      await orderManager.updateStatus(orderId, 'ready');
      showToast('Pedido pronto!', 'success');
      renderOrdersPage($('#page-content'));
    };
  });

  container.querySelectorAll('[data-action="deliver"]').forEach(btn => {
    btn.onclick = async () => {
      const orderId = typeof btn !== 'undefined' ? btn.dataset.id : (typeof el !== 'undefined' ? el.dataset.id : null);
      await orderManager.updateStatus(orderId, 'delivered');
      showToast('Pedido entregue!', 'success');
      renderOrdersPage($('#page-content'));
    };
  });

  container.querySelectorAll('[data-action="complete"]').forEach(btn => {
    btn.onclick = async () => {
      const orderId = typeof btn !== 'undefined' ? btn.dataset.id : (typeof el !== 'undefined' ? el.dataset.id : null);
      await orderManager.updateStatus(orderId, 'completed');
      showToast('Mesa encerrada com sucesso!', 'success');
      renderOrdersPage($('#page-content'));
    };
  });

  container.querySelectorAll('[data-action="print-order"]').forEach(btn => {
    btn.onclick = async () => {
      try {
        const orderId = typeof btn !== 'undefined' ? btn.dataset.id : (typeof el !== 'undefined' ? el.dataset.id : null);
        const order = await orderManager.getOrderById(orderId);
        if (!order) throw new Error('Pedido não encontrado');
        
        const ticketData = orderManager.generateTicketData(order);
        if (printer.isConnected?.()) {
          await printer.printTicket(ticketData);
        } else {
          const html = printer.formatTicketHTML(ticketData);
          printer.printViaBrowser(html);
        }
        showToast('Impressão enviada!', 'info');
      } catch (err) {
        showToast('Erro ao imprimir', 'error');
      }
    };
  });

  container.querySelectorAll('[data-action="view-order"]').forEach(el => {
    el.onclick = async () => {
      const orders = await loadOrders();
      const orderId = typeof btn !== 'undefined' ? btn.dataset.id : (typeof el !== 'undefined' ? el.dataset.id : null);
      const order = orders.find(o => o.id === orderId);
      if (order) openOrderDetailModal(order);
    };
  });
}

function openOrderDetailModal(order) {
  const statusLabels = { pending: 'Pendente', preparing: 'Em Preparo', ready: 'Pronto', delivered: 'Entregue', completed: 'Encerrado', cancelled: 'Cancelado' };
  const typeLabels = { dineIn: 'No Local', takeaway: 'Retirada', delivery: 'Delivery' };
  const paymentLabels = { pix: 'PIX', credit: 'Cartão de Crédito', debit: 'Cartão de Débito', cash: 'Dinheiro' };
  const time = order.createdAt ? formatDateTime(new Date(order.createdAt)) : '--';

  const itemsHTML = (order.items || []).map(item => {
    const extrasHTML = (item.extras || []).map(e => `<span class="order-detail-extra">+ ${e.name} (${formatCurrency(e.price)})</span>`).join('');
    return `
      <div class="order-detail-item">
        <div class="order-detail-item-info">
          <span class="order-detail-qty">${item.quantity}x</span>
          <div>
            <span class="order-detail-item-name">${item.name}</span>
            ${extrasHTML}
          </div>
        </div>
        <span class="order-detail-item-price">${formatCurrency((item.price + (item.extras || []).reduce((s, e) => s + e.price, 0)) * item.quantity)}</span>
      </div>
    `;
  }).join('');

  openModal(`
    <div class="modal-header">
      <h3>Pedido #${order.orderNumber || order.id?.toString().slice(-4) || '----'}</h3>
      <button class="btn-icon modal-close-btn" id="close-modal">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <div class="modal-body modal-body-scroll">
      <div class="order-detail-meta">
        <div class="order-detail-row">
          <span class="material-icons-round">person</span>
          <span>${order.customerInfo?.name || 'Cliente'}</span>
        </div>
        <div class="order-detail-row">
          <span class="material-icons-round">schedule</span>
          <span>${time}</span>
        </div>
        <div class="order-detail-row">
          <span class="material-icons-round">local_shipping</span>
          <span>${typeLabels[order.type] || order.type || 'Retirada'}${order.tableId ? ' — Mesa ' + order.tableId : ''}</span>
        </div>
        <div class="order-detail-row">
          <span class="material-icons-round">payment</span>
          <span>${paymentLabels[order.paymentMethod] || order.paymentMethod || 'Não informado'}</span>
        </div>
        <div class="order-detail-row">
          <span class="material-icons-round">info</span>
          <span>Status: <strong>${statusLabels[order.status] || order.status}</strong></span>
        </div>
      </div>

      ${order.address ? `<div class="order-detail-address"><span class="material-icons-round">location_on</span> ${order.address}</div>` : ''}
      ${order.notes ? `<div class="order-detail-notes"><span class="material-icons-round">notes</span> ${order.notes}</div>` : ''}

      <div class="order-detail-items">
        <h4>Itens do Pedido</h4>
        ${itemsHTML}
      </div>

      <div class="order-detail-totals">
        ${order.deliveryFee ? `<div class="order-detail-total-row"><span>Taxa de entrega</span><span>${formatCurrency(order.deliveryFee)}</span></div>` : ''}
        <div class="order-detail-total-row total-final">
          <span>Total</span>
          <span>${formatCurrency(order.total || 0)}</span>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="close-detail">Fechar</button>
      ${(order.type === 'dineIn' && order.status !== 'completed' && order.status !== 'cancelled') ? `<button class="btn btn-warning" id="complete-detail"><span class="material-icons-round">storefront</span> Encerrar Mesa</button>` : ''}
      <button class="btn btn-primary" id="print-detail">
        <span class="material-icons-round">print</span> Imprimir
      </button>
    </div>
  `, { className: 'modal-md' });

  const overlay = $('#modal-overlay');
  overlay.querySelector('#close-modal').onclick = closeModal;
  overlay.querySelector('#close-detail').onclick = closeModal;
  
  const completeBtn = overlay.querySelector('#complete-detail');
  if (completeBtn) {
    completeBtn.onclick = async () => {
      await orderManager.updateStatus(order.id, 'completed');
      showToast('Mesa encerrada!', 'success');
      closeModal();
      // Optional: Refresh the underlying page if it's visible
      if (state.currentPage === 'tables') renderTablesPage($('#page-content'));
      else if (state.currentPage === 'orders') renderOrdersPage($('#page-content'));
    };
  }

  overlay.querySelector('#print-detail').onclick = async () => {
    try {
      const ticketData = await orderManager.generateTicketData(order.id);
      if (printer.isConnected?.()) {
        await printer.printTicket(ticketData);
      } else {
        const html = printer.formatTicketHTML(ticketData);
        printer.printViaBrowser(html);
      }
      showToast('Impressão enviada!', 'info');
    } catch (err) {
      showToast('Erro ao imprimir', 'error');
    }
  };
}

// ============================================================================
// TABLES PAGE
// ============================================================================
async function renderTablesPage(container) {
  const config = state.config;
  const tables = config?.tables?.layout || [];
  let isEditing = false;

  // Load current table statuses from orders
  const orders = await loadOrders();
  const tablesWithStatus = tables.map(t => {
    const activeOrder = orders.find(o => o.tableId === t.id && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready' || o.status === 'delivered'));
    if (activeOrder) {
      let status = 'occupied';
      if (activeOrder.status === 'ready') status = 'ready';
      return { ...t, status, orderId: activeOrder.id, occupiedSince: activeOrder.createdAt };
    }
    return { ...t, status: 'available' };
  });

  container.innerHTML = `
    <div class="tables-page">
      <div class="tables-toolbar">
        <button class="btn btn-ghost" id="toggle-edit-mode">
          <span class="material-icons-round">edit</span> Editar Layout
        </button>
        <button class="btn btn-primary" id="add-table-btn" style="display:none">
          <span class="material-icons-round">add</span> Adicionar Mesa
        </button>
        <button class="btn btn-success" id="save-layout-btn" style="display:none">
          <span class="material-icons-round">save</span> Salvar Layout
        </button>
      </div>
      <div id="table-map-wrapper" class="table-map-wrapper"></div>
    </div>
  `;

  // Init table map
  tableMap.init(container.querySelector('#table-map-wrapper'), tablesWithStatus, {
    editable: false,
    showLegend: true,
    onTableClick: (table) => {
      if (isEditing) return;
      openTableActionModal(table, orders);
    }
  });

  // Edit mode toggle
  const toggleBtn = container.querySelector('#toggle-edit-mode');
  const addBtn = container.querySelector('#add-table-btn');
  const saveBtn = container.querySelector('#save-layout-btn');

  toggleBtn.onclick = () => {
    isEditing = !isEditing;
    if (isEditing) {
      tableMap.enableEditMode();
      toggleBtn.innerHTML = '<span class="material-icons-round">close</span> Cancelar Edição';
      toggleBtn.classList.add('btn-warning');
      addBtn.style.display = 'inline-flex';
      saveBtn.style.display = 'inline-flex';
    } else {
      tableMap.disableEditMode();
      toggleBtn.innerHTML = '<span class="material-icons-round">edit</span> Editar Layout';
      toggleBtn.classList.remove('btn-warning');
      addBtn.style.display = 'none';
      saveBtn.style.display = 'none';
      // Re-render to restore original layout
      renderTablesPage($('#page-content'));
    }
  };

  // Add table
  addBtn.onclick = () => {
    const nextId = tablesWithStatus.length > 0 ? Math.max(...tablesWithStatus.map(t => typeof t.id === 'number' ? t.id : 0)) + 1 : 1;
    tableMap.addTable({
      id: nextId,
      label: String(nextId).padStart(2, '0'),
      x: 50,
      y: 50,
      shape: 'square',
      seats: 4
    });
    showToast('Mesa adicionada! Arraste para posicionar.', 'info');
  };

  // Save layout
  saveBtn.onclick = async () => {
    const layout = tableMap.getLayout();
    try {
      await configManager.updateConfig?.('tables', { layout });
      state.config.tables = { layout };
      showToast('Layout salvo com sucesso!', 'success');
      isEditing = false;
      tableMap.disableEditMode();
      renderTablesPage($('#page-content'));
    } catch (e) {
      showToast('Erro ao salvar layout', 'error');
    }
  };
}

function openTableActionModal(table, orders) {
  const activeOrder = orders.find(o => String(o.tableId) === String(table.id) && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready' || o.status === 'delivered'));

  if (activeOrder) {
    // Show order details for this table
    openOrderDetailModal(activeOrder);
  } else {
    // Table is available — show info
    openModal(`
      <div class="modal-header">
        <h3>Mesa ${table.label}</h3>
        <button class="btn-icon modal-close-btn" id="close-modal">
          <span class="material-icons-round">close</span>
        </button>
      </div>
      <div class="modal-body" style="text-align:center">
        <span class="material-icons-round" style="font-size:64px;color:var(--success);opacity:0.6">check_circle</span>
        <p style="margin-top:12px;font-size:1.1rem">Mesa disponível</p>
        <p style="color:var(--text-muted)">${table.seats || 4} lugares</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="generate-qr-modal"><span class="material-icons-round">qr_code</span> QR Code</button>
        <button class="btn btn-ghost" id="close-table-modal">Fechar</button>
      </div>
    `, { className: 'modal-sm' });

    const overlay = $('#modal-overlay');
    overlay.querySelector('#close-modal').onclick = closeModal;
    overlay.querySelector('#close-table-modal').onclick = closeModal;
    overlay.querySelector('#generate-qr-modal').onclick = () => {
      closeModal();
      openQRCodeModal(table);
    };
  }
}

function openQRCodeModal(table) {
  const url = `${window.location.origin}/?mesa=${table.label}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  openModal(`
    <div class="modal-header">
      <h3>QR Code - Mesa ${table.label}</h3>
      <button class="btn-icon modal-close-btn" id="close-modal"><span class="material-icons-round">close</span></button>
    </div>
    <div class="modal-body" style="text-align:center">
      <img src="${qrUrl}" alt="QR Code Mesa ${table.label}" style="width:200px; height:200px; margin: 20px auto; display:block; border-radius: 8px;" />
      <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 10px;">Escaneie para abrir o cardápio direto nesta mesa.</p>
      <input type="text" class="form-input" value="${url}" readonly style="text-align:center; user-select:all;" onclick="this.select()" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="print-qr-btn"><span class="material-icons-round">print</span> Imprimir</button>
      <button class="btn btn-ghost" id="close-qr-modal">Fechar</button>
    </div>
  `, { className: 'modal-sm' });

  const overlay = $('#modal-overlay');
  overlay.querySelector('#close-modal').onclick = closeModal;
  overlay.querySelector('#close-qr-modal').onclick = closeModal;
  
  overlay.querySelector('#print-qr-btn').onclick = () => {
    const html = `
      <div style="text-align:center; padding: 20px; font-family: sans-serif;">
        <h2 style="margin:0 0 10px 0;">Mesa ${table.label}</h2>
        <img src="${qrUrl}" style="width:250px;height:250px;margin-bottom:10px" />
        <p style="margin:0;">Escaneie para fazer seu pedido</p>
      </div>
    `;
    printer.printViaBrowser(html);
  };
}

// ============================================================================
// CASHIER PAGE
// ============================================================================
async function renderCashierPage(container) {
  container.innerHTML = '<div class="loading-state"><span class="material-icons-round spin">sync</span><p>Carregando caixa...</p></div>';

  let currentRegister = null;
  try {
    currentRegister = await cashier.getCurrentRegister();
  } catch (e) { /* no register open */ }

  if (!currentRegister || currentRegister.status === 'closed') {
    renderCashierClosed(container);
  } else {
    await renderCashierOpen(container, currentRegister);
  }

  // History
  await renderCashierHistory(container);
}

function renderCashierClosed(container) {
  container.innerHTML = `
    <div class="cashier-page">
      <div class="cashier-closed glass-card">
        <span class="material-icons-round" style="font-size:80px;color:var(--primary);opacity:0.5">point_of_sale</span>
        <h3>Caixa Fechado</h3>
        <p>Abra o caixa para começar a registrar vendas</p>
        <div class="input-group" style="max-width:300px;margin:20px auto 0">
          <label>Saldo Inicial (R$)</label>
          <input type="number" id="initial-balance" class="form-input" placeholder="0.00" step="0.01" min="0" value="0" />
        </div>
        <button class="btn btn-primary btn-lg" id="open-register-btn">
          <span class="material-icons-round">lock_open</span> Abrir Caixa
        </button>
      </div>
      <div id="cashier-history-section"></div>
    </div>
  `;

  container.querySelector('#open-register-btn').onclick = async () => {
    const balance = parseFloat(container.querySelector('#initial-balance').value) || 0;
    try {
      await cashier.openRegister(balance);
      showToast('Caixa aberto com sucesso!', 'success');
      renderCashierPage($('#page-content'));
    } catch (err) {
      showToast('Erro ao abrir caixa: ' + err.message, 'error');
    }
  };
}

async function renderCashierOpen(container, register) {
  let summary;
  try {
    summary = await cashier.getDailySummary();
  } catch (e) {
    summary = { totalSales: 0, pix: 0, credit: 0, debit: 0, cash: 0, orderCount: 0, orders: [] };
  }

  const totalCard = summary.totalSales || (summary.salesByMethod?.pix + summary.salesByMethod?.credit + summary.salesByMethod?.debit + summary.salesByMethod?.cash) || 0;

  container.innerHTML = `
    <div class="cashier-page">
      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(6,214,160,0.15);color:var(--success)">
            <span class="material-icons-round">attach_money</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(totalCard)}</span>
            <span class="stat-label">Total Vendas</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(6,214,160,0.15);color:#06D6A0">
            <span class="material-icons-round">qr_code</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(summary.salesByMethod?.pix || 0)}</span>
            <span class="stat-label">Vendas PIX</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(17,138,178,0.15);color:#118AB2">
            <span class="material-icons-round">credit_card</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency((summary.salesByMethod?.credit || 0) + (summary.salesByMethod?.debit || 0))}</span>
            <span class="stat-label">Vendas Cartão</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(255,107,53,0.15);color:var(--primary)">
            <span class="material-icons-round">payments</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(summary.salesByMethod?.cash || 0)}</span>
            <span class="stat-label">Vendas Dinheiro</span>
          </div>
        </div>
      </div>

      <!-- Transactions Stats -->
      <div class="stats-row" style="margin-top: 1rem;">
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(255,107,53,0.15);color:var(--danger)">
            <span class="material-icons-round">remove_circle_outline</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(summary.totalOut || 0)}</span>
            <span class="stat-label">Retiradas (Sangria)</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(6,214,160,0.15);color:var(--success)">
            <span class="material-icons-round">add_circle_outline</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(summary.totalIn || 0)}</span>
            <span class="stat-label">Entradas (Troco)</span>
          </div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-icon" style="background:rgba(17,138,178,0.15);color:var(--info)">
            <span class="material-icons-round">account_balance_wallet</span>
          </div>
          <div class="stat-info">
            <span class="stat-value">${formatCurrency(summary.expectedBalance || 0)}</span>
            <span class="stat-label">Saldo Físico (Dinheiro)</span>
          </div>
        </div>
      </div>

      <div class="cashier-actions" style="margin-top:1rem; display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary" id="new-transaction-btn">
          <span class="material-icons-round">swap_vert</span> Nova Movimentação
        </button>
      </div>

      <!-- Chart -->
      <div class="panel glass-card" style="margin-top:1.5rem;">
        <div class="panel-header">
          <h3><span class="material-icons-round">bar_chart</span> Vendas por Forma de Pagamento</h3>
        </div>
        <div class="panel-body">
          <div class="bar-chart">
            ${renderPaymentChart({ pix: summary.salesByMethod?.pix || 0, credit: summary.salesByMethod?.credit || 0, debit: summary.salesByMethod?.debit || 0, cash: summary.salesByMethod?.cash || 0 })}
          </div>
        </div>
      </div>

      <!-- Orders Table -->
      <div class="panel glass-card">
        <div class="panel-header">
          <h3><span class="material-icons-round">list</span> Pedidos do Dia</h3>
        </div>
        <div class="panel-body">
          <div class="orders-table-wrapper">
            ${renderCashierOrdersTable(summary.orders || [])}
          </div>
        </div>
      </div>

      <!-- Close Register -->
      <div class="cashier-close-section">
        <button class="btn btn-danger btn-lg" id="close-register-btn">
          <span class="material-icons-round">lock</span> Fechar Caixa
        </button>
      </div>

      <div id="cashier-history-section"></div>
    </div>
  `;

  container.querySelector('#close-register-btn').onclick = () => openCloseRegisterModal(summary, register);
  container.querySelector('#new-transaction-btn').onclick = () => openTransactionModal(register);
}

function openTransactionModal(register) {
  const modal = openModal(`
    <div class="modal-header">
      <h3>Nova Movimentação</h3>
      <button class="btn-icon modal-close-btn" id="close-modal">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <div class="modal-body form-grid">
      <div class="input-group">
        <label>Tipo de Movimentação</label>
        <select id="trans-type" class="form-input">
          <option value="out">Retirada (Sangria)</option>
          <option value="in">Entrada (Suprimento / Troco)</option>
        </select>
      </div>
      <div class="input-group">
        <label>Valor (R$)</label>
        <input type="number" id="trans-amount" class="form-input" step="0.01" min="0.01" placeholder="0.00" required>
      </div>
      <div class="input-group">
        <label>Motivo</label>
        <input type="text" id="trans-reason" class="form-input" placeholder="Ex: Pagamento fornecedor, Troco..." required>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancel-trans">Cancelar</button>
      <button class="btn btn-primary" id="save-trans">Confirmar</button>
    </div>
  `);

  modal.querySelector('#close-modal').onclick = closeModal;
  modal.querySelector('#cancel-trans').onclick = closeModal;
  modal.querySelector('#save-trans').onclick = async () => {
    const type = modal.querySelector('#trans-type').value;
    const amount = parseFloat(modal.querySelector('#trans-amount').value);
    const reason = modal.querySelector('#trans-reason').value.trim();

    if (!amount || amount <= 0) {
      showToast('Insira um valor válido', 'error');
      return;
    }
    if (!reason) {
      showToast('O motivo é obrigatório', 'error');
      return;
    }

    try {
      await cashier.addTransaction(type, amount, reason);
      showToast('Movimentação registrada com sucesso!', 'success');
      closeModal();
      renderCashierPage($('#page-content'));
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  };
}

function renderCashierOrdersTable(orders) {
  if (!orders || orders.length === 0) {
    return '<div class="empty-state"><span class="material-icons-round">inbox</span><p>Nenhum pedido registrado</p></div>';
  }

  const paymentLabels = { pix: 'PIX', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro' };

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Hora</th>
          <th>Cliente</th>
          <th>Pagamento</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td>#${o.number || o.id?.toString().slice(-4) || '----'}</td>
            <td>${o.createdAt ? formatTime(new Date(o.createdAt)) : '--:--'}</td>
            <td>${o.customerName || 'Cliente'}</td>
            <td>${paymentLabels[o.paymentMethod] || o.paymentMethod || '-'}</td>
            <td>${formatCurrency(o.total || 0)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openCloseRegisterModal(summary, register) {
  const initialBalance = summary.openingBalance || 0;
  const totalCard = summary.totalSales || 0;
  const expectedCash = summary.expectedBalance || 0;
  const totalIn = summary.totalIn || 0;
  const totalOut = summary.totalOut || 0;

  openModal(`
    <div class="modal-header">
      <h3>Fechar Caixa</h3>
      <button class="btn-icon modal-close-btn" id="close-modal">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <div class="modal-body">
      <div class="confirm-delete-icon">
        <span class="material-icons-round" style="font-size:48px;color:var(--warning)">point_of_sale</span>
      </div>
      <h4 style="text-align:center;margin:12px 0">Resumo do Caixa</h4>

      <div class="cashier-summary">
        <div class="summary-row"><span>Saldo Inicial</span><span>${formatCurrency(initialBalance)}</span></div>
        <div class="summary-row"><span>Total em Vendas</span><span>${formatCurrency(totalCard)}</span></div>
        <div class="summary-divider"></div>
        <div class="summary-row"><span>PIX</span><span>${formatCurrency(summary.salesByMethod?.pix || 0)}</span></div>
        <div class="summary-row"><span>Cartão de Crédito</span><span>${formatCurrency(summary.salesByMethod?.credit || 0)}</span></div>
        <div class="summary-row"><span>Cartão de Débito</span><span>${formatCurrency(summary.salesByMethod?.debit || 0)}</span></div>
        <div class="summary-row"><span>Dinheiro</span><span>${formatCurrency(summary.salesByMethod?.cash || 0)}</span></div>
        <div class="summary-divider"></div>
        <div class="summary-row"><span>Entradas (Troco)</span><span style="color:var(--success)">+ ${formatCurrency(totalIn)}</span></div>
        <div class="summary-row"><span>Retiradas (Sangria)</span><span style="color:var(--danger)">- ${formatCurrency(totalOut)}</span></div>
        <div class="summary-divider"></div>
        <div class="summary-row"><span>Qtd. Pedidos</span><span>${summary.orderCount || (summary.orders || []).length}</span></div>
        <div class="summary-row total"><span>Dinheiro Esperado em Caixa</span><span>${formatCurrency(expectedCash)}</span></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancel-close">Cancelar</button>
      <button class="btn btn-ghost" id="print-summary">
        <span class="material-icons-round">print</span> Imprimir
      </button>
      <button class="btn btn-danger" id="confirm-close">
        <span class="material-icons-round">lock</span> Fechar Caixa
      </button>
    </div>
  `, { className: 'modal-md' });

  const overlay = $('#modal-overlay');
  overlay.querySelector('#close-modal').onclick = closeModal;
  overlay.querySelector('#cancel-close').onclick = closeModal;

  overlay.querySelector('#print-summary').onclick = () => {
    const html = `
      <div style="font-family:monospace;padding:10px;max-width:300px">
        <h3 style="text-align:center">Fechamento de Caixa</h3>
        <p style="text-align:center">${formatDateTime(new Date())}</p>
        <hr/>
        <p>Saldo Inicial: ${formatCurrency(initialBalance)}</p>
        <p>Total Vendas: ${formatCurrency(totalCard)}</p>
        <hr/>
        <p>PIX: ${formatCurrency(summary.salesByMethod?.pix || 0)}</p>
        <p>Crédito: ${formatCurrency(summary.salesByMethod?.credit || 0)}</p>
        <p>Débito: ${formatCurrency(summary.salesByMethod?.debit || 0)}</p>
        <p>Dinheiro: ${formatCurrency(summary.salesByMethod?.cash || 0)}</p>
        <hr/>
        <p>Entradas: + ${formatCurrency(totalIn)}</p>
        <p>Retiradas: - ${formatCurrency(totalOut)}</p>
        <hr/>
        <p>Pedidos: ${summary.orderCount || (summary.orders || []).length}</p>
        <p><strong>Dinheiro em Caixa: ${formatCurrency(expectedCash)}</strong></p>
      </div>
    `;
    printer.printViaBrowser(html);
  };

  overlay.querySelector('#confirm-close').onclick = async () => {
    try {
      await cashier.closeRegister(summary);
      closeModal();
      showToast('Caixa fechado com sucesso!', 'success');
      renderCashierPage($('#page-content'));
    } catch (err) {
      showToast('Erro ao fechar caixa: ' + err.message, 'error');
    }
  };
}

async function renderCashierHistory(container) {
  const section = container.querySelector('#cashier-history-section');
  if (!section) return;

  let history = [];
  try {
    history = await cashier.getHistory();
  } catch (e) { /* no history */ }

  if (history.length === 0) {
    section.innerHTML = '';
    return;
  }

  section.innerHTML = `
    <div class="panel glass-card" style="margin-top:24px">
      <div class="panel-header">
        <h3><span class="material-icons-round">history</span> Histórico de Fechamentos</h3>
      </div>
      <div class="panel-body">
        <div class="orders-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Abertura</th>
                <th>Fechamento</th>
                <th>Vendas</th>
                <th>Pedidos</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(h => `
                <tr>
                  <td>${h.closedAt ? formatDate(new Date(h.closedAt)) : '-'}</td>
                  <td>${h.openedAt ? formatTime(new Date(h.openedAt)) : '-'}</td>
                  <td>${h.closedAt ? formatTime(new Date(h.closedAt)) : '-'}</td>
                  <td>${formatCurrency(h.totalSales || 0)}</td>
                  <td>${h.orderCount || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// SETTINGS PAGE
// ============================================================================
async function renderSettingsPage(container) {
  const config = state.config || {};
  const storeData = config.store || {};
  const schedule = config.schedule || {};
  const delivery = config.delivery || {};
  const payment = config.payment || {};
  const theme = config.theme || {};
  const tables = config.tables || {};
  const admin = config.admin || {};
  const printerConfig = config.printer || {};

  const dayLabels = {
    monday: 'Segunda-feira', tuesday: 'Terça-feira', wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira', friday: 'Sexta-feira', saturday: 'Sábado', sunday: 'Domingo'
  };

  container.innerHTML = `
    <div class="settings-page">

      <!-- Dados da Loja -->
      <div class="settings-section glass-card" id="section-store">
        <div class="settings-section-header" data-toggle="store-content">
          <h3><span class="material-icons-round">store</span> Dados da Loja</h3>
          <span class="material-icons-round section-toggle-icon">expand_more</span>
        </div>
        <div class="settings-section-body" id="store-content">
          <div class="form-row">
            <div class="input-group flex-1">
              <label>Nome da Loja</label>
              <input type="text" id="store-name" class="form-input" value="${storeData.name || ''}" />
            </div>
          </div>
          <div class="input-group">
            <label>Descrição</label>
            <textarea id="store-description" class="form-input form-textarea" rows="2">${storeData.description || ''}</textarea>
          </div>
          <div class="form-row">
            <div class="input-group flex-1">
              <label>Endereço</label>
              <input type="text" id="store-address" class="form-input" value="${storeData.address || ''}" />
            </div>
          </div>
          <div class="input-group">
            <label>Link do Google Maps</label>
            <input type="url" id="store-maps" class="form-input" value="${storeData.googleMapsLink || ''}" />
          </div>
          <div class="form-row">
            <div class="input-group flex-1">
              <label>Telefone</label>
              <input type="tel" id="store-phone" class="form-input" value="${storeData.phone || ''}" />
            </div>
            <div class="input-group flex-1">
              <label>WhatsApp</label>
              <input type="tel" id="store-whatsapp" class="form-input" value="${storeData.whatsapp || ''}" />
            </div>
          </div>
          <div class="form-row">
            <div class="input-group flex-1">
              <label>Logo da Loja</label>
              <div class="mini-upload-zone" id="logo-upload">
                ${storeData.logo ? `<img src="${storeData.logo}" class="mini-upload-preview" />` : `<span class="material-icons-round">add_photo_alternate</span><span>Logo</span>`}
              </div>
              <input type="hidden" id="store-logo-data" value="${storeData.logo || ''}" />
            </div>
            <div class="input-group flex-1">
              <label>Banner da Loja</label>
              <div class="mini-upload-zone" id="banner-upload">
                ${storeData.banner ? `<img src="${storeData.banner}" class="mini-upload-preview" />` : `<span class="material-icons-round">add_photo_alternate</span><span>Banner</span>`}
              </div>
              <input type="hidden" id="store-banner-data" value="${storeData.banner || ''}" />
            </div>
          </div>
          <button class="btn btn-primary" id="save-store">
            <span class="material-icons-round">save</span> Salvar Dados da Loja
          </button>
        </div>
      </div>

      <!-- Horário de Funcionamento -->
      <div class="settings-section glass-card" id="section-schedule">
        <div class="settings-section-header" data-toggle="schedule-content">
          <h3><span class="material-icons-round">schedule</span> Horário de Funcionamento</h3>
          <span class="material-icons-round section-toggle-icon">expand_more</span>
        </div>
        <div class="settings-section-body collapsed" id="schedule-content">
          <div class="schedule-grid">
            ${Object.entries(dayLabels).map(([key, label]) => {
              const day = schedule[key] || { open: '08:00', close: '22:00', enabled: false };
              return `
                <div class="schedule-row">
                  <label class="toggle-switch">
                    <input type="checkbox" class="schedule-enabled" data-day="${key}" ${day.enabled ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="schedule-day-label">${label}</span>
                  <input type="time" class="form-input form-input-sm schedule-open" data-day="${key}" value="${day.open || '08:00'}" />
                  <span class="schedule-separator">às</span>
                  <input type="time" class="form-input form-input-sm schedule-close" data-day="${key}" value="${day.close || '22:00'}" />
                </div>
              `;
            }).join('')}
          </div>
          <button class="btn btn-primary" id="save-schedule">
            <span class="material-icons-round">save</span> Salvar Horários
          </button>
        </div>
      </div>

      <!-- Delivery -->
      <div class="settings-section glass-card" id="section-delivery">
        <div class="settings-section-header" data-toggle="delivery-content">
          <h3><span class="material-icons-round">delivery_dining</span> Delivery</h3>
          <span class="material-icons-round section-toggle-icon">expand_more</span>
        </div>
        <div class="settings-section-body collapsed" id="delivery-content">
          <div class="input-group">
            <label>Pedido Mínimo (R$)</label>
            <input type="number" id="delivery-min" class="form-input" step="0.01" min="0" value="${delivery.minimumOrder || 0}" style="max-width:200px" />
          </div>
          <div class="input-group">
            <label>Zonas de Entrega</label>
            <div id="delivery-zones-list">
              ${(delivery.zones || []).map((zone, i) => `
                <div class="delivery-zone-row" data-index="${i}">
                  <input type="text" class="form-input zone-name" placeholder="Nome da zona" value="${zone.name}" />
                  <input type="number" class="form-input zone-fee" placeholder="Taxa" step="0.01" min="0" value="${zone.fee}" style="width:100px" />
                  <button class="btn-icon btn-sm btn-danger-icon remove-zone">
                    <span class="material-icons-round">remove_circle</span>
                  </button>
                </div>
              `).join('')}
            </div>
            <button class="btn btn-ghost btn-sm" id="add-zone-btn">
              <span class="material-icons-round">add</span> Adicionar Zona
            </button>
          </div>
          <button class="btn btn-primary" id="save-delivery">
            <span class="material-icons-round">save</span> Salvar Delivery
          </button>
        </div>
      </div>

      <!-- Formas de Pagamento -->
      <div class="settings-section glass-card" id="section-payment">
        <div class="settings-section-header" data-toggle="payment-content">
          <h3><span class="material-icons-round">payment</span> Formas de Pagamento</h3>
          <span class="material-icons-round section-toggle-icon">expand_more</span>
        </div>
        <div class="settings-section-body collapsed" id="payment-content">
          <div class="payment-methods-list" id="payment-methods-list">
            ${(payment.methods || []).map(method => `
              <div class="payment-method-row" data-id="${method.id}" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <input type="text" class="form-input payment-label" value="${method.label}" placeholder="Nome (ex: Pix)" />
                <input type="text" class="form-input payment-icon" value="${method.icon || 'payment'}" placeholder="Ícone" style="width:100px;" />
                <label class="toggle-switch" style="margin-left:auto;">
                  <input type="checkbox" class="payment-toggle" data-id="${method.id}" ${method.enabled ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
                <button class="btn-icon btn-sm btn-danger-icon remove-payment" style="margin-left:8px;" onclick="this.parentElement.remove()">
                  <span class="material-icons-round">close</span>
                </button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" id="add-payment-btn" style="margin-bottom:16px;">
            <span class="material-icons-round">add</span> Adicionar Pagamento
          </button>
          <button class="btn btn-primary" id="save-payment" style="display:flex;">
            <span class="material-icons-round">save</span> Salvar Pagamento
          </button>
        </div>
      </div>

      <!-- Tema -->
      <div class="settings-section glass-card" id="section-theme">
        <div class="settings-section-header" data-toggle="theme-content">
          <h3><span class="material-icons-round">palette</span> Tema</h3>
          <span class="material-icons-round section-toggle-icon">expand_more</span>
        </div>
        <div class="settings-section-body collapsed" id="theme-content">
          <div class="form-row">
            <div class="input-group flex-1">
              <label>Cor Primária</label>
              <div class="color-picker-group">
                <input type="color" id="theme-primary" class="form-color" value="${theme.primaryColor || '#FF6B35'}" />
                <input type="text" class="form-input form-input-sm" value="${theme.primaryColor || '#FF6B35'}" id="theme-primary-text" />
              </div>
            </div>
            <div class="input-group flex-1">
              <label>Cor de Destaque</label>
              <div class="color-picker-group">
                <input type="color" id="theme-accent" class="form-color" value="${theme.accentColor || '#FFD166'}" />
                <input type="text" class="form-input form-input-sm" value="${theme.accentColor || '#FFD166'}" id="theme-accent-text" />
              </div>
            </div>
          </div>
          <div class="theme-preview glass-card" id="theme-preview">
            <div class="theme-preview-bar" style="background:${theme.primaryColor || '#FF6B35'}"></div>
            <p style="padding:12px">Pré-visualização do tema</p>
            <button class="btn" style="background:${theme.primaryColor || '#FF6B35'};color:#fff;margin:0 12px 12px">Botão Primário</button>
            <button class="btn" style="background:${theme.accentColor || '#FFD166'};color:#000;margin:0 12px 12px">Botão Destaque</button>
          </div>
          <button class="btn btn-primary" id="save-theme">
            <span class="material-icons-round">save</span> Salvar Tema
          </button>
        </div>
      </div>

      <!-- Senha Admin -->
      <div class="settings-section glass-card" id="section-password">
        <div class="settings-section-header" data-toggle="password-content">
          <h3><span class="material-icons-round">lock</span> Senha Admin</h3>
          <span class="material-icons-round section-toggle-icon">expand_more</span>
        </div>
        <div class="settings-section-body collapsed" id="password-content">
          <div class="input-group" style="max-width:400px">
            <label>Senha Atual</label>
            <input type="password" id="current-password" class="form-input" placeholder="Senha atual" />
          </div>
          <div class="input-group" style="max-width:400px">
            <label>Nova Senha</label>
            <input type="password" id="new-password" class="form-input" placeholder="Nova senha" />
          </div>
          <div class="input-group" style="max-width:400px">
            <label>Confirmar Nova Senha</label>
            <input type="password" id="confirm-password" class="form-input" placeholder="Confirmar nova senha" />
          </div>
          <button class="btn btn-primary" id="save-password">
            <span class="material-icons-round">save</span> Alterar Senha
          </button>
        </div>
      </div>

      <!-- Impressora -->
      <div class="settings-section glass-card" id="section-printer">
        <div class="settings-section-header" data-toggle="printer-content">
          <h3><span class="material-icons-round">print</span> Impressora</h3>
          <span class="material-icons-round section-toggle-icon">expand_more</span>
        </div>
        <div class="settings-section-body collapsed" id="printer-content">
          <div class="printer-status">
            <span class="material-icons-round" style="font-size:32px;color:var(--text-muted)">print</span>
            <span id="printer-status-text">${printer.isConnected?.() ? 'Conectada' : 'Desconectada'}</span>
          </div>
          <div class="form-row" style="margin-top:16px">
            <button class="btn btn-primary" id="connect-printer-btn">
              <span class="material-icons-round">bluetooth</span> Conectar Bluetooth
            </button>
            <button class="btn btn-ghost" id="disconnect-printer-btn" ${!printer.isConnected?.() ? 'disabled' : ''}>
              <span class="material-icons-round">bluetooth_disabled</span> Desconectar
            </button>
          </div>
          <div class="input-group" style="max-width:200px;margin-top:16px">
            <label>Largura do Papel (mm)</label>
            <select id="printer-paper-width" class="form-select">
              <option value="58" ${printerConfig.paperWidth === 58 ? 'selected' : ''}>58mm</option>
              <option value="80" ${printerConfig.paperWidth === 80 || !printerConfig.paperWidth ? 'selected' : ''}>80mm</option>
            </select>
          </div>
          <button class="btn btn-primary" id="save-printer" style="margin-top:16px">
            <span class="material-icons-round">save</span> Salvar Configurações
          </button>
        </div>
      </div>

    </div>
  `;

  // === Accordion toggles ===
  container.querySelectorAll('.settings-section-header').forEach(header => {
    header.onclick = () => {
      const targetId = header.dataset.toggle;
      const body = container.querySelector(`#${targetId}`);
      if (body) {
        body.classList.toggle('collapsed');
        const icon = header.querySelector('.section-toggle-icon');
        if (icon) icon.textContent = body.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
      }
    };
  });

  // === Store image uploads ===
  setupMiniUpload(container.querySelector('#logo-upload'), container.querySelector('#store-logo-data'));
  setupMiniUpload(container.querySelector('#banner-upload'), container.querySelector('#store-banner-data'));

  // === Save Store ===
  container.querySelector('#save-store').onclick = async () => {
    const updatedStore = {
      name: container.querySelector('#store-name').value.trim(),
      description: container.querySelector('#store-description').value.trim(),
      address: container.querySelector('#store-address').value.trim(),
      googleMapsLink: container.querySelector('#store-maps').value.trim(),
      phone: container.querySelector('#store-phone').value.trim(),
      whatsapp: container.querySelector('#store-whatsapp').value.trim(),
      logo: container.querySelector('#store-logo-data').value,
      banner: container.querySelector('#store-banner-data').value,
      socialMedia: storeData.socialMedia || {}
    };
    try {
      await configManager.updateConfig?.('store', updatedStore);
      state.config.store = updatedStore;
      $('#header-store-name').textContent = updatedStore.name;
      showToast('Dados da loja salvos!', 'success');
    } catch (e) { showToast('Erro ao salvar', 'error'); }
  };

  // === Save Schedule ===
  container.querySelector('#save-schedule').onclick = async () => {
    const updatedSchedule = {};
    Object.keys(dayLabels).forEach(day => {
      const enabled = container.querySelector(`.schedule-enabled[data-day="${day}"]`)?.checked || false;
      const open = container.querySelector(`.schedule-open[data-day="${day}"]`)?.value || '08:00';
      const close = container.querySelector(`.schedule-close[data-day="${day}"]`)?.value || '22:00';
      updatedSchedule[day] = { open, close, enabled };
    });
    try {
      await configManager.updateConfig?.('schedule', updatedSchedule);
      state.config.schedule = updatedSchedule;
      showToast('Horários salvos!', 'success');
    } catch (e) { showToast('Erro ao salvar', 'error'); }
  };

  // === Delivery Zones ===
  const addZoneBtn = container.querySelector('#add-zone-btn');
  addZoneBtn.onclick = () => {
    const list = container.querySelector('#delivery-zones-list');
    const row = document.createElement('div');
    row.className = 'delivery-zone-row';
    row.innerHTML = `
      <input type="text" class="form-input zone-name" placeholder="Nome da zona" />
      <input type="number" class="form-input zone-fee" placeholder="Taxa" step="0.01" min="0" style="width:100px" />
      <button class="btn-icon btn-sm btn-danger-icon remove-zone">
        <span class="material-icons-round">remove_circle</span>
      </button>
    `;
    row.querySelector('.remove-zone').onclick = () => row.remove();
    list.appendChild(row);
  };

  container.querySelectorAll('.remove-zone').forEach(btn => {
    btn.onclick = () => btn.closest('.delivery-zone-row').remove();
  });

  container.querySelector('#save-delivery').onclick = async () => {
    const zones = [];
    container.querySelectorAll('.delivery-zone-row').forEach(row => {
      const name = row.querySelector('.zone-name').value.trim();
      const fee = parseFloat(row.querySelector('.zone-fee').value) || 0;
      if (name) zones.push({ id: generateId(), name, fee });
    });
    const minimumOrder = parseFloat(container.querySelector('#delivery-min').value) || 0;
    const updatedDelivery = { zones, minimumOrder };
    try {
      await configManager.updateConfig?.('delivery', updatedDelivery);
      state.config.delivery = updatedDelivery;
      showToast('Configurações de delivery salvas!', 'success');
    } catch (e) { showToast('Erro ao salvar', 'error'); }
  };

  // === Save Payment ===
  const addPaymentBtn = container.querySelector('#add-payment-btn');
  if (addPaymentBtn) {
    addPaymentBtn.onclick = () => {
      const list = container.querySelector('#payment-methods-list');
      const id = 'pay_' + Date.now().toString();
      const row = document.createElement('div');
      row.className = 'payment-method-row';
      row.dataset.id = id;
      row.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
      row.innerHTML = `
        <input type="text" class="form-input payment-label" placeholder="Nome (ex: Pix)" value="" />
        <input type="text" class="form-input payment-icon" placeholder="Ícone" value="payment" style="width:100px;" />
        <label class="toggle-switch" style="margin-left:auto;">
          <input type="checkbox" class="payment-toggle" data-id="${id}" checked />
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon btn-sm btn-danger-icon remove-payment" style="margin-left:8px;" onclick="this.parentElement.remove()">
          <span class="material-icons-round">close</span>
        </button>
      `;
      list.appendChild(row);
    };
  }

  container.querySelector('#save-payment').onclick = async () => {
    const methods = [];
    container.querySelectorAll('.payment-method-row').forEach(row => {
      const id = row.dataset.id;
      const label = row.querySelector('.payment-label').value.trim();
      const icon = row.querySelector('.payment-icon').value.trim() || 'payment';
      const enabled = row.querySelector('.payment-toggle').checked;
      if (label) {
        methods.push({ id, label, icon, enabled });
      }
    });

    try {
      await configManager.updateConfig?.('payment', { methods });
      state.config.payment = { methods };
      showToast('Formas de pagamento salvas!', 'success');
    } catch (e) { showToast('Erro ao salvar', 'error'); }
  };

  // === Theme ===
  const primaryColor = container.querySelector('#theme-primary');
  const primaryText = container.querySelector('#theme-primary-text');
  const accentColor = container.querySelector('#theme-accent');
  const accentText = container.querySelector('#theme-accent-text');
  const preview = container.querySelector('#theme-preview');

  const updatePreview = () => {
    const pBar = preview.querySelector('.theme-preview-bar');
    const pBtn = preview.querySelectorAll('.btn');
    if (pBar) pBar.style.background = primaryColor.value;
    if (pBtn[0]) pBtn[0].style.background = primaryColor.value;
    if (pBtn[1]) pBtn[1].style.background = accentColor.value;
  };

  primaryColor.oninput = () => { primaryText.value = primaryColor.value; updatePreview(); };
  primaryText.oninput = () => { primaryColor.value = primaryText.value; updatePreview(); };
  accentColor.oninput = () => { accentText.value = accentColor.value; updatePreview(); };
  accentText.oninput = () => { accentColor.value = accentText.value; updatePreview(); };

  container.querySelector('#save-theme').onclick = async () => {
    const updatedTheme = { ...theme, primaryColor: primaryColor.value, accentColor: accentColor.value };
    try {
      await configManager.updateConfig?.('theme', updatedTheme);
      state.config.theme = updatedTheme;
      configManager.applyTheme?.();
      showToast('Tema salvo!', 'success');
    } catch (e) { showToast('Erro ao salvar', 'error'); }
  };

  // === Password ===
  container.querySelector('#save-password').onclick = async () => {
    const current = container.querySelector('#current-password').value;
    const newPass = container.querySelector('#new-password').value;
    const confirm = container.querySelector('#confirm-password').value;

    if (current !== (admin.password || 'admin123')) {
      showToast('Senha atual incorreta', 'error');
      return;
    }
    if (!newPass || newPass.length < 4) {
      showToast('A nova senha deve ter pelo menos 4 caracteres', 'error');
      return;
    }
    if (newPass !== confirm) {
      showToast('As senhas não conferem', 'error');
      return;
    }
    try {
      await configManager.updateConfig?.('admin', { password: newPass });
      state.config.admin = { password: newPass };
      container.querySelector('#current-password').value = '';
      container.querySelector('#new-password').value = '';
      container.querySelector('#confirm-password').value = '';
      showToast('Senha alterada com sucesso!', 'success');
    } catch (e) { showToast('Erro ao salvar', 'error'); }
  };

  // === Printer ===
  container.querySelector('#connect-printer-btn').onclick = async () => {
    try {
      await printer.connectBluetooth();
      container.querySelector('#printer-status-text').textContent = 'Conectada';
      container.querySelector('#disconnect-printer-btn').disabled = false;
      showToast('Impressora conectada!', 'success');
    } catch (err) {
      showToast('Erro ao conectar: ' + (err.message || 'Bluetooth não disponível'), 'error');
    }
  };

  container.querySelector('#disconnect-printer-btn').onclick = async () => {
    try {
      await printer.disconnect?.();
      container.querySelector('#printer-status-text').textContent = 'Desconectada';
      container.querySelector('#disconnect-printer-btn').disabled = true;
      showToast('Impressora desconectada', 'info');
    } catch (err) {
      showToast('Erro ao desconectar', 'error');
    }
  };

  container.querySelector('#save-printer').onclick = async () => {
    const paperWidth = parseInt(container.querySelector('#printer-paper-width').value) || 80;
    try {
      await configManager.updateConfig?.('printer', { ...printerConfig, paperWidth });
      state.config.printer = { ...printerConfig, paperWidth };
      showToast('Configurações de impressora salvas!', 'success');
    } catch (e) { showToast('Erro ao salvar', 'error'); }
  };
}

function setupMiniUpload(zone, hiddenInput) {
  if (!zone || !hiddenInput) return;

  zone.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showToast('Imagem muito grande. Máximo 2MB.', 'error');
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        hiddenInput.value = dataUrl;
        zone.innerHTML = `<img src="${dataUrl}" class="mini-upload-preview" />`;
      } catch (err) {
        showToast('Erro ao carregar imagem', 'error');
      }
    };
    input.click();
  };
}

// ============================================================================
// BOOTSTRAP
// ============================================================================
document.addEventListener('DOMContentLoaded', init);

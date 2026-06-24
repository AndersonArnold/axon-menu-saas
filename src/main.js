/* ============================================================================
   Axon Menu Base — Main Entry Point (Client Menu)
   ============================================================================
   Orchestrates all modules: config loading, store init, theme, rendering,
   cart management, checkout flow, and schedule monitoring.
   ============================================================================ */

import './css/global.css';
import './css/menu.css';
import './css/print.css';
import { store } from './modules/store.js';
import { configManager } from './modules/config-manager.js';
import { scheduleManager } from './modules/schedule-manager.js';
import { menuRenderer } from './modules/menu-renderer.js';
import { cart } from './modules/cart.js';
import { deliveryCalculator } from './modules/delivery-calculator.js';
import { orderManager } from './modules/order-manager.js';
import { printer } from './modules/printer.js';
import { formatCurrency, showToast, generateId, sanitizeHTML, truncateText } from './modules/utils.js';

/* --------------------------------------------------------------------------
   Global Error Handlers
   -------------------------------------------------------------------------- */
window.addEventListener('error', (event) => {
  showToast(`🚨 ERRO: ${event.error?.message || event.message}`, 'error', 10000);
});

window.addEventListener('unhandledrejection', (event) => {
  showToast(`🚨 ERRO ASYNC: ${event.reason?.message || event.reason}`, 'error', 10000);
});

/* --------------------------------------------------------------------------
   DOM References
   -------------------------------------------------------------------------- */
const dom = {
  loadingScreen:        document.getElementById('loading-screen'),
  closedOverlay:        document.getElementById('closed-overlay'),
  closedMessage:        document.getElementById('closed-message'),
  closedSchedule:       document.getElementById('closed-schedule'),
  storeBanner:          document.getElementById('store-banner'),
  storeLogo:            document.getElementById('store-logo'),
  storeName:            document.getElementById('store-name'),
  storeDescription:     document.getElementById('store-description'),
  storeStatus:          document.getElementById('store-status'),
  storeAddress:         document.getElementById('store-address'),
  storePhone:           document.getElementById('store-phone'),
  storeHours:           document.getElementById('store-hours'),
  searchInput:          document.getElementById('search-input'),
  searchClear:          document.getElementById('search-clear'),
  categoryScroll:       document.getElementById('category-scroll'),
  menuGrid:             document.getElementById('menu-grid'),
  emptyMenu:            document.getElementById('empty-menu'),
  cartFab:              document.getElementById('cart-fab'),
  cartCount:            document.getElementById('cart-count'),
  cartDrawerOverlay:    document.getElementById('cart-drawer-overlay'),
  cartDrawer:           document.getElementById('cart-drawer'),
  cartItems:            document.getElementById('cart-items'),
  cartEmpty:            document.getElementById('cart-empty'),
  cartFooter:           document.getElementById('cart-footer'),
  cartSubtotal:         document.getElementById('cart-subtotal'),
  cartClose:            document.getElementById('cart-close'),
  checkoutBtn:          document.getElementById('checkout-btn'),
  clearCartBtn:         document.getElementById('clear-cart-btn'),
  itemModalOverlay:     document.getElementById('item-modal-overlay'),
  itemModal:            document.getElementById('item-modal'),
  checkoutOverlay:      document.getElementById('checkout-overlay'),
  checkoutModal:        document.getElementById('checkout-modal'),
  orderConfirmedOverlay: document.getElementById('order-confirmed-overlay'),
  orderConfirmedModal:  document.getElementById('order-confirmed-modal'),
  toastContainer:       document.getElementById('toast-container'),
};


/* --------------------------------------------------------------------------
   App State
   -------------------------------------------------------------------------- */
let appConfig = null;
let categories = [];
let menuItems = [];
let activeCategory = null;
let searchTerm = '';
let checkoutState = {
  step: 1,
  orderType: null,       // 'delivery' | 'takeaway' | 'dineIn'
  customerName: '',
  customerPhone: '',
  address: '',
  addressNumber: '',
  reference: '',
  deliveryZone: null,
  tableId: null,
  paymentMethod: null,
  deliveryFee: 0,
  change: null,
  observation: '',
};
let scannedTableLabel = null;


/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */
async function init() {
  try {
    // 1. Load config
    appConfig = await configManager.loadConfig();

    // CHECK QR CODE MESA
    const urlParams = new URLSearchParams(window.location.search);
    const mesa = urlParams.get('mesa');
    if (mesa) {
      scannedTableLabel = mesa;
      setTimeout(() => {
        showToast(`Mesa ${mesa} identificada via QR Code!`, 'info', 5000);
      }, 1000);
    }

    // 2. Store já foi inicializado pelo configManager.loadConfig()

    // 3. Apply theme
    configManager.applyTheme();

    // 4. Update page title
    const storeInfo = configManager.getStoreInfo() || {};
    document.title = `${storeInfo.name || 'Loja'} — Cardápio Digital`;

    // 5. Populate header
    populateHeader(storeInfo);

    // 6. Populate info bar
    populateInfoBar(storeInfo);

    // 7. Load data
    try {
      const allCats = await store.getAllCategories();
      const allItems = await store.getAllMenuItems();

      if (allCats.length > 0 || allItems.length > 0) {
        categories = allCats;
        menuItems = allItems;
      } else {
        categories = (appConfig.categories || []).filter(c => c.active).sort((a, b) => (a.order || 0) - (b.order || 0));
        menuItems  = (appConfig.menuItems || []).filter(i => i.active).sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    } catch (e) {
      console.warn('[Axon] Error loading from DB, using fallback', e);
      categories = (appConfig.categories || []).filter(c => c.active).sort((a, b) => (a.order || 0) - (b.order || 0));
      menuItems  = (appConfig.menuItems || []).filter(i => i.active).sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // 8. Init delivery calculator
    deliveryCalculator.init(appConfig.delivery);

    // 9. Render categories navigation
    menuRenderer.renderCategories(categories, dom.categoryScroll);

    // 10. Render menu items
    menuRenderer.init(dom.menuGrid, categories, menuItems);

    // 11. Setup event listeners
    setupSearchListeners();
    setupCartListeners();
    setupCartCallbacks();
    setupCategoryListeners();

    // 12. Setup intersection observer for scroll animations
    setupScrollAnimations();

    // 13. Start schedule monitoring
    setupScheduleMonitoring();

    // 14. Hide loading screen
    hideLoadingScreen();

  } catch (error) {
    console.error('[Axon] Initialization failed:', error);
    showToast(`Erro ao carregar: ${error.message}`, 'error', 10000);
    hideLoadingScreen();
  }
}


/* --------------------------------------------------------------------------
   Header Population
   -------------------------------------------------------------------------- */
function populateHeader(info) {
  // Store name
  dom.storeName.textContent = info.name || 'Cardápio Digital';

  // Store description
  if (dom.storeDescription) {
    dom.storeDescription.textContent = info.description || '';
  }

  // Banner
  if (info.banner) {
    dom.storeBanner.style.backgroundImage = `url('${info.banner}')`;
    dom.storeBanner.classList.add('has-image');
  } else {
    dom.storeBanner.classList.add('no-image');
  }

  // Logo
  if (info.logo) {
    const logoImg = document.createElement('img');
    logoImg.src = info.logo;
    logoImg.alt = `Logo ${info.name}`;
    logoImg.loading = 'eager';
    dom.storeLogo.appendChild(logoImg);
    dom.storeLogo.classList.add('has-image');
  } else {
    // Fallback: first letter
    const initial = (info.name || 'A').charAt(0).toUpperCase();
    dom.storeLogo.innerHTML = `<span class="logo-initial">${initial}</span>`;
    dom.storeLogo.classList.add('no-image');
  }

  // Status
  updateStoreStatus();
}


/* --------------------------------------------------------------------------
   Info Bar Population
   -------------------------------------------------------------------------- */
function populateInfoBar(info) {
  // Address
  const addressText = dom.storeAddress.querySelector('.info-text');
  if (info.address) {
    addressText.textContent = info.address;
    dom.storeAddress.href = info.googleMapsLink || `https://maps.google.com/?q=${encodeURIComponent(info.address)}`;
  } else {
    dom.storeAddress.style.display = 'none';
  }

  // Phone
  const phoneText = dom.storePhone.querySelector('.info-text');
  if (info.phone) {
    phoneText.textContent = info.phone;
    const cleanPhone = info.phone.replace(/\D/g, '');
    dom.storePhone.href = `tel:+55${cleanPhone}`;
  } else {
    dom.storePhone.style.display = 'none';
  }

  // Hours (today)
  const hoursText = dom.storeHours.querySelector('.info-text');
  const schedule = configManager.getSchedule();
  const todaySchedule = getTodaySchedule(schedule);
  if (todaySchedule && todaySchedule.enabled) {
    hoursText.textContent = `Hoje: ${todaySchedule.open} – ${todaySchedule.close}`;
  } else {
    hoursText.textContent = 'Fechado hoje';
  }
}


/* --------------------------------------------------------------------------
   Schedule Helpers
   -------------------------------------------------------------------------- */
const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getTodaySchedule(schedule) {
  if (!schedule) return null;
  const today = dayMap[new Date().getDay()];
  return schedule[today] || null;
}

function updateStoreStatus() {
  const statusDot  = dom.storeStatus?.querySelector('.status-dot');
  const statusText = dom.storeStatus?.querySelector('.status-text');
  if (!statusDot || !statusText) return;
  
  const status = scheduleManager.isOpen();
  const isOpen = status?.open ?? true;

  if (isOpen) {
    statusDot.classList.add('open');
    statusDot.classList.remove('closed');
    statusText.textContent = 'Aberto agora';
    dom.storeStatus.classList.add('is-open');
    dom.storeStatus.classList.remove('is-closed');
  } else {
    statusDot.classList.add('closed');
    statusDot.classList.remove('open');
    statusText.textContent = 'Fechado';
    dom.storeStatus.classList.add('is-closed');
    dom.storeStatus.classList.remove('is-open');
  }
}

function setupScheduleMonitoring() {
  scheduleManager.init(configManager.getSchedule());
  scheduleManager.startMonitoring((status) => {
    updateStoreStatus();
    const isOpen = status?.open ?? true;
    if (!isOpen) {
      menuRenderer.showClosedOverlay(scheduleManager.getScheduleDisplay());
    } else {
      menuRenderer.hideClosedOverlay();
    }
  });

  // Initial check
  const initialStatus = scheduleManager.isOpen();
  if (!(initialStatus?.open ?? true)) {
    menuRenderer.showClosedOverlay(scheduleManager.getScheduleDisplay());
  }
}


/* --------------------------------------------------------------------------
   Search
   -------------------------------------------------------------------------- */
function setupSearchListeners() {
  let debounceTimer = null;

  dom.searchInput.addEventListener('input', () => {
    const value = dom.searchInput.value.trim();
    searchTerm = value;

    // Show/hide clear button
    dom.searchClear.style.display = value.length > 0 ? 'flex' : 'none';

    // Debounce search
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(value);
    }, 200);
  });

  dom.searchClear.addEventListener('click', () => {
    dom.searchInput.value = '';
    searchTerm = '';
    dom.searchClear.style.display = 'none';
    performSearch('');
    dom.searchInput.focus();
  });
}

function performSearch(term) {
  if (!term) {
    // Show all items (optionally filtered by category)
    if (activeCategory) {
      menuRenderer.filterByCategory(activeCategory);
    } else {
      menuRenderer.filterItems('');
    }
    dom.emptyMenu.style.display = 'none';
    dom.menuGrid.style.display = '';
    return;
  }

  const filtered = menuRenderer.filterItems(term);
  if (filtered === 0) {
    dom.emptyMenu.style.display = 'flex';
    dom.menuGrid.style.display = 'none';
  } else {
    dom.emptyMenu.style.display = 'none';
    dom.menuGrid.style.display = '';
  }

  // Deactivate category pills during search
  activeCategory = null;
  const pills = dom.categoryScroll.querySelectorAll('.category-chip');
  pills.forEach(p => p.classList.remove('active'));
}


/* --------------------------------------------------------------------------
   Category Navigation
   -------------------------------------------------------------------------- */
function setupCategoryListeners() {
  dom.categoryScroll.addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;

    const catId = chip.dataset.categoryId;

    // Clear search if active
    if (searchTerm) {
      dom.searchInput.value = '';
      searchTerm = '';
      dom.searchClear.style.display = 'none';
    }

    // Toggle active category
    if (activeCategory === catId) {
      // Deselect - show all
      activeCategory = null;
      chip.classList.remove('active');
      menuRenderer.filterItems('');
      dom.emptyMenu.style.display = 'none';
      dom.menuGrid.style.display = '';
    } else {
      activeCategory = catId;
      // Update active chip
      dom.categoryScroll.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      menuRenderer.filterByCategory(catId);
      dom.emptyMenu.style.display = 'none';
      dom.menuGrid.style.display = '';

      // Scroll to category section
      const section = dom.menuGrid.querySelector(`[data-category-section="${catId}"]`);
      if (section) {
        const navHeight = document.querySelector('.category-nav')?.offsetHeight || 0;
        const searchHeight = document.querySelector('.search-container')?.offsetHeight || 0;
        const offset = navHeight + searchHeight + 16;
        const top = section.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
  });
}


/* --------------------------------------------------------------------------
   Cart UI
   -------------------------------------------------------------------------- */
function setupCartListeners() {
  // FAB click → open drawer
  dom.cartFab.addEventListener('click', () => openCartDrawer());

  // Close drawer
  dom.cartClose.addEventListener('click', () => closeCartDrawer());
  dom.cartDrawerOverlay.addEventListener('click', () => closeCartDrawer());

  // Checkout
  dom.checkoutBtn.addEventListener('click', () => {
    const obsInput = document.getElementById('cart-observation');
    if (obsInput) checkoutState.observation = obsInput.value.trim();
    closeCartDrawer();
    openCheckout();
  });

  // Clear cart
  dom.clearCartBtn.addEventListener('click', () => {
    if (cart.getItemCount() === 0) return;
    cart.clear();
    showToast('Carrinho limpo', 'info');
    closeCartDrawer();
  });

  // Modal overlays (close only if clicking outside the modal)
  dom.itemModalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.itemModalOverlay) closeItemDetail();
  });
  dom.checkoutOverlay.addEventListener('click', (e) => {
    if (e.target === dom.checkoutOverlay) closeCheckout();
  });
  dom.orderConfirmedOverlay.addEventListener('click', (e) => {
    if (e.target === dom.orderConfirmedOverlay) closeOrderConfirmed();
  });
}

function setupCartCallbacks() {
  cart.onChange((cartData) => {
    const { items, count, subtotal } = cartData;

    // Update FAB
    dom.cartCount.textContent = count;
    dom.cartFab.style.display = count > 0 ? 'flex' : 'none';
    if (count > 0) {
      dom.cartFab.classList.add('bounce');
      setTimeout(() => dom.cartFab.classList.remove('bounce'), 400);
    }

    // Update drawer
    renderCartItems(items, subtotal);
  });
}

function openCartDrawer() {
  const items = cart.getItems();
  const subtotal = cart.getSubtotal();
  renderCartItems(items, subtotal);

  dom.cartDrawerOverlay.style.display = 'block';
  dom.cartDrawer.style.display = 'flex';

  // Trigger animation
  requestAnimationFrame(() => {
    dom.cartDrawerOverlay.classList.add('active');
    dom.cartDrawer.classList.add('active');
  });

  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  dom.cartDrawerOverlay.classList.remove('active');
  dom.cartDrawer.classList.remove('active');

  setTimeout(() => {
    dom.cartDrawerOverlay.style.display = 'none';
    dom.cartDrawer.style.display = 'none';
    document.body.style.overflow = '';
  }, 350);
}

function renderCartItems(items, subtotal) {
  if (!items || items.length === 0) {
    dom.cartItems.innerHTML = '';
    dom.cartEmpty.style.display = 'flex';
    dom.cartFooter.style.display = 'none';
    return;
  }

  dom.cartEmpty.style.display = 'none';
  dom.cartFooter.style.display = 'block';
  dom.cartSubtotal.textContent = formatCurrency(subtotal);

  dom.cartItems.innerHTML = items.map(item => {
    const extrasText = item.extras && item.extras.length > 0
      ? `<p class="cart-item-extras">${item.extras.map(e => e.name).join(', ')}</p>`
      : '';
    const obsText = item.observation
      ? `<p class="cart-item-obs"><span class="material-icons-round">chat_bubble_outline</span>${sanitizeHTML(item.observation)}</p>`
      : '';

    return `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-info">
          <h4 class="cart-item-name">${sanitizeHTML(item.name)}</h4>
          ${extrasText}
          ${obsText}
          <p class="cart-item-price">${formatCurrency(item.totalPrice)}</p>
        </div>
        <div class="cart-item-actions">
          <div class="quantity-control">
            <button class="qty-btn qty-minus" data-id="${item.id}" aria-label="Diminuir quantidade" type="button">
              <span class="material-icons-round">remove</span>
            </button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn qty-plus" data-id="${item.id}" aria-label="Aumentar quantidade" type="button">
              <span class="material-icons-round">add</span>
            </button>
          </div>
          <button class="cart-item-remove" data-id="${item.id}" aria-label="Remover item" type="button">
            <span class="material-icons-round">delete_outline</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach cart item event listeners
  dom.cartItems.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = items.find(i => i.id === id);
      if (item && item.quantity > 1) {
        cart.updateQuantity(id, item.quantity - 1);
      } else {
        cart.removeItem(id);
      }
    });
  });

  dom.cartItems.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = items.find(i => i.id === id);
      if (item) {
        cart.updateQuantity(id, item.quantity + 1);
      }
    });
  });

  dom.cartItems.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      cart.removeItem(btn.dataset.id);
      showToast('Item removido', 'info');
    });
  });
}


/* --------------------------------------------------------------------------
   Item Detail Modal
   -------------------------------------------------------------------------- */
function openItemDetail(item) {
  const selectedExtras = new Set();
  let quantity = 1;

  function calcTotal() {
    let extrasTotal = 0;
    item.extras?.forEach(ext => {
      if (selectedExtras.has(ext.id)) extrasTotal += ext.price;
    });
    return (item.price + extrasTotal) * quantity;
  }

  function render() {
    const total = calcTotal();
    const hasImage = item.image && item.image.trim() !== '';

    dom.itemModal.innerHTML = `
      <div class="item-modal-content">
        <button class="item-modal-close btn-icon" aria-label="Fechar" type="button">
          <span class="material-icons-round">close</span>
        </button>

        ${hasImage
          ? `<div class="item-modal-image">
               <img src="${item.image}" alt="${sanitizeHTML(item.name)}" loading="lazy">
             </div>`
          : `<div class="item-modal-image item-modal-image-placeholder">
               <span class="material-icons-round">restaurant</span>
             </div>`
        }

        <div class="item-modal-body">
          <h2 class="item-modal-name">${sanitizeHTML(item.name)}</h2>
          <p class="item-modal-description">${sanitizeHTML(item.description || '')}</p>
          <p class="item-modal-base-price">${formatCurrency(item.price)}</p>

          ${item.extras && item.extras.length > 0 ? `
            <div class="item-modal-extras">
              <h3 class="extras-title">
                <span class="material-icons-round" aria-hidden="true">add_circle_outline</span>
                Adicionais
              </h3>
              <div class="extras-list">
                ${item.extras.map(ext => `
                  <label class="extra-item ${selectedExtras.has(ext.id) ? 'selected' : ''}" data-extra-id="${ext.id}">
                    <div class="extra-checkbox">
                      <input type="checkbox" ${selectedExtras.has(ext.id) ? 'checked' : ''} aria-label="${ext.name}">
                      <span class="checkmark">
                        <span class="material-icons-round">check</span>
                      </span>
                    </div>
                    <span class="extra-name">${sanitizeHTML(ext.name)}</span>
                    <span class="extra-price">+ ${formatCurrency(ext.price)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="item-modal-observation">
            <label for="item-observation" class="obs-label">
              <span class="material-icons-round" aria-hidden="true">chat_bubble_outline</span>
              Alguma observação?
            </label>
            <textarea
              id="item-observation"
              class="obs-textarea"
              placeholder="Ex: Sem cebola, sem tomate..."
              maxlength="200"
              rows="2"
            ></textarea>
          </div>

          <div class="item-modal-footer">
            <div class="quantity-control quantity-lg">
              <button class="qty-btn qty-modal-minus" aria-label="Diminuir quantidade" type="button">
                <span class="material-icons-round">remove</span>
              </button>
              <span class="qty-value qty-modal-value">${quantity}</span>
              <button class="qty-btn qty-modal-plus" aria-label="Aumentar quantidade" type="button">
                <span class="material-icons-round">add</span>
              </button>
            </div>
            <button class="btn btn-primary btn-add-to-cart" type="button">
              <span class="material-icons-round" aria-hidden="true">add_shopping_cart</span>
              Adicionar ${formatCurrency(total)}
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    dom.itemModal.querySelector('.item-modal-close').addEventListener('click', closeItemDetail);

    // Extras
    dom.itemModal.querySelectorAll('.extra-item').forEach(label => {
      label.addEventListener('click', (e) => {
        e.preventDefault();
        const extId = label.dataset.extraId;
        if (selectedExtras.has(extId)) {
          selectedExtras.delete(extId);
        } else {
          selectedExtras.add(extId);
        }
        render();
      });
    });

    // Quantity
    dom.itemModal.querySelector('.qty-modal-minus')?.addEventListener('click', () => {
      if (quantity > 1) { quantity--; render(); }
    });
    dom.itemModal.querySelector('.qty-modal-plus')?.addEventListener('click', () => {
      if (quantity < 99) { quantity++; render(); }
    });

    // Add to cart
    dom.itemModal.querySelector('.btn-add-to-cart').addEventListener('click', () => {
      const observation = dom.itemModal.querySelector('#item-observation')?.value?.trim() || '';
      const extras = item.extras?.filter(ext => selectedExtras.has(ext.id)) || [];

      cart.addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        extras,
        quantity,
        observation,
      });

      showToast(`${item.name} adicionado ao pedido!`, 'success');
      closeItemDetail();

      // Fly-to-cart animation on FAB
      dom.cartFab.classList.add('pulse');
      setTimeout(() => dom.cartFab.classList.remove('pulse'), 600);
    });
  }

  render();

  // Show modal
  dom.itemModalOverlay.style.display = 'flex';
  dom.itemModal.style.display = 'flex';

  requestAnimationFrame(() => {
    dom.itemModalOverlay.classList.add('active');
    dom.itemModal.classList.add('active');
  });

  document.body.style.overflow = 'hidden';
}

function closeItemDetail() {
  dom.itemModalOverlay.classList.remove('active');
  dom.itemModal.classList.remove('active');

  setTimeout(() => {
    dom.itemModalOverlay.style.display = 'none';
    dom.itemModal.style.display = 'none';
    dom.itemModal.innerHTML = '';
    document.body.style.overflow = '';
  }, 350);
}


/* --------------------------------------------------------------------------
   Checkout Flow (Multi-step)
   -------------------------------------------------------------------------- */
function openCheckout() {
  checkoutState = {
    step: 1,
    orderType: null,
    customerName: '',
    customerPhone: '',
    address: '',
    addressNumber: '',
    reference: '',
    deliveryZone: null,
    tableId: null,
    paymentMethod: null,
    deliveryFee: 0,
    change: null,
    observation: '',
  };

  if (scannedTableLabel) {
    const tables = appConfig?.tables?.layout || [];
    const t = tables.find(t => String(t.label) === String(scannedTableLabel));
    checkoutState.orderType = 'dineIn';
    checkoutState.tableId = t ? t.id : scannedTableLabel;
    checkoutState.step = 3; // Jump directly to Order Summary
  }

  dom.checkoutOverlay.style.display = 'flex';
  dom.checkoutModal.style.display = 'block';

  requestAnimationFrame(() => {
    dom.checkoutOverlay.classList.add('active');
    dom.checkoutModal.classList.add('active');
  });

  document.body.style.overflow = 'hidden';

  renderCheckoutStep();
}

function closeCheckout() {
  dom.checkoutOverlay.classList.remove('active');
  dom.checkoutModal.classList.remove('active');

  setTimeout(() => {
    dom.checkoutOverlay.style.display = 'none';
    dom.checkoutModal.style.display = 'none';
    dom.checkoutModal.innerHTML = '';
    document.body.style.overflow = '';
  }, 350);
}

async function renderCheckoutStep() {
  const step = checkoutState.step;
  let orderTypes = appConfig.orderTypes;
  
  if (!orderTypes || Object.keys(orderTypes).length === 0) {
    orderTypes = {
      delivery: { enabled: true, label: 'Delivery' },
      takeaway: { enabled: true, label: 'Retirada na Loja' },
      dineIn: { enabled: true, label: 'Consumir no Local' }
    };
  }

  /* ── Progress Indicator ─────────────────────────────────── */
  const totalSteps = 5;
  let progressHTML = `
    <div class="checkout-steps">
      ${Array.from({ length: totalSteps }).map((_, i) => {
        const num = i + 1;
        const active = num === step ? 'active' : '';
        const completed = num < step ? 'completed' : '';
        return `
          <div class="checkout-step ${active} ${completed}"></div>
        `;
      }).join('')}
    </div>
  `;

  const stepLabels = ['Tipo', 'Dados', 'Resumo', 'Pagamento', 'Confirmação'];

  let stepContent = '';

  /* ── Step 1: Order Type ─────────────────────────────────── */
  if (step === 1) {
    const types = [];
    if (orderTypes.delivery?.enabled) {
      types.push(`
        <div class="delivery-type-card ${checkoutState.orderType === 'delivery' ? 'selected' : ''}" data-type="delivery">
          <span class="material-icons-round">two_wheeler</span>
          <div class="type-info">
            <h4>${orderTypes.delivery.label}</h4>
            <p>Receba no conforto da sua casa</p>
          </div>
        </div>
      `);
    }
    if (orderTypes.takeaway?.enabled) {
      types.push(`
        <div class="delivery-type-card ${checkoutState.orderType === 'takeaway' ? 'selected' : ''}" data-type="takeaway">
          <span class="material-icons-round">storefront</span>
          <div class="type-info">
            <h4>${orderTypes.takeaway.label}</h4>
            <p>Retire seu pedido na loja</p>
          </div>
        </div>
      `);
    }
    if (orderTypes.dineIn?.enabled) {
      types.push(`
        <div class="delivery-type-card ${checkoutState.orderType === 'dineIn' ? 'selected' : ''}" data-type="dineIn">
          <span class="material-icons-round">restaurant</span>
          <div class="type-info">
            <h4>${orderTypes.dineIn.label}</h4>
            <p>Coma aqui com conforto</p>
          </div>
        </div>
      `);
    }

    stepContent = `
      <h3 class="checkout-step-title">Como deseja receber?</h3>
      <div class="order-type-grid">
        ${types.join('')}
      </div>
    `;
  }

  /* ── Step 2: Customer Info ─────────────────────────────── */
  else if (step === 2) {
    let formFields = '';

    if (checkoutState.orderType === 'delivery') {
      const zones = configManager.getDeliveryZones();
      formFields = `
        <h3 class="checkout-step-title">Dados para Entrega</h3>
        <div class="checkout-form">
          <div class="input-group">
            <label for="ck-name">Nome</label>
            <input type="text" id="ck-name" class="form-input" placeholder="Seu nome completo" value="${sanitizeHTML(checkoutState.customerName)}" required>
          </div>
          <div class="input-group">
            <label for="ck-phone">Telefone</label>
            <input type="tel" id="ck-phone" class="form-input" placeholder="(00) 00000-0000" value="${sanitizeHTML(checkoutState.customerPhone)}" required>
          </div>
          <div class="input-group">
            <label for="ck-address">Endereço</label>
            <input type="text" id="ck-address" class="form-input" placeholder="Rua, Avenida..." value="${sanitizeHTML(checkoutState.address)}" required>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label for="ck-number">Número</label>
              <input type="text" id="ck-number" class="form-input" placeholder="Nº" value="${sanitizeHTML(checkoutState.addressNumber)}" required>
            </div>
            <div class="input-group">
              <label for="ck-reference">Ponto de Referência</label>
              <input type="text" id="ck-reference" class="form-input" placeholder="Opcional" value="${sanitizeHTML(checkoutState.reference)}">
            </div>
          </div>
          <div class="input-group">
            <label for="ck-zone">Zona de Entrega</label>
            <div class="zone-options">
              ${zones.map(z => `
                <label class="zone-option ${checkoutState.deliveryZone?.id === z.id ? 'selected' : ''}" data-zone-id="${z.id}">
                  <input type="radio" name="delivery-zone" ${checkoutState.deliveryZone?.id === z.id ? 'checked' : ''}>
                  <span class="zone-name">${z.name}</span>
                  <span class="zone-fee">${formatCurrency(z.fee)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (checkoutState.orderType === 'takeaway') {
      formFields = `
        <h3 class="checkout-step-title">Dados para Retirada</h3>
        <div class="checkout-form">
          <div class="input-group">
            <label for="ck-name">Nome</label>
            <input type="text" id="ck-name" class="form-input" placeholder="Seu nome para chamar no balcão" value="${sanitizeHTML(checkoutState.customerName)}" required>
          </div>
          <div class="input-group">
            <label for="ck-phone">Telefone</label>
            <input type="tel" id="ck-phone" class="form-input" placeholder="(00) 00000-0000" value="${sanitizeHTML(checkoutState.customerPhone)}" required>
          </div>
        </div>
      `;
    } else if (checkoutState.orderType === 'dineIn') {
      const tables = appConfig.tables?.layout || [];
      const orders = await store.getTodaysOrders();
      const tablesWithStatus = tables.map(t => {
        const activeOrder = orders.find(o => String(o.tableId) === String(t.id) && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready' || o.status === 'delivered'));
        return { ...t, status: activeOrder ? 'occupied' : 'available' };
      });

      formFields = `
        <h3 class="checkout-step-title">Selecione sua Mesa (Opcional)</h3>
        <div class="table-map">
          ${tablesWithStatus.map(t => `
            <button
              class="table-spot ${t.status !== 'available' ? 'occupied' : ''} ${checkoutState.tableId === t.id ? 'selected' : ''} table-${t.shape}"
              data-table-id="${t.id}"
              ${t.status !== 'available' ? 'disabled' : ''}
              style="left: ${t.x}%; top: ${t.y}%"
              type="button"
              aria-label="Mesa ${t.label}, ${t.seats} lugares${t.status !== 'available' ? ', ocupada' : ''}"
            >
              <span class="table-label">${t.label}</span>
              <span class="table-seats">${t.seats}p</span>
            </button>
          `).join('')}
        </div>
        <div class="table-legend">
          <span class="legend-item"><span class="legend-dot available"></span> Disponível</span>
          <span class="legend-item"><span class="legend-dot selected-dot"></span> Selecionada</span>
          <span class="legend-item"><span class="legend-dot occupied"></span> Ocupada</span>
        </div>
      `;
    }

    stepContent = formFields;
  }

  /* ── Step 3: Order Summary ──────────────────────────────── */
  else if (step === 3) {
    const items = cart.getItems();
    const subtotal = cart.getSubtotal();
    const deliveryFee = checkoutState.deliveryFee;
    const total = subtotal + deliveryFee;

    const orderTypeLabel = checkoutState.orderType === 'delivery'
      ? 'Delivery'
      : checkoutState.orderType === 'takeaway'
        ? 'Retirada'
        : 'No Local';

    stepContent = `
      <h3 class="checkout-step-title">Resumo do Pedido</h3>
      <div class="order-summary">
        <div class="summary-type">
          <span class="material-icons-round" aria-hidden="true">${
            checkoutState.orderType === 'delivery' ? 'delivery_dining' :
            checkoutState.orderType === 'takeaway' ? 'store' : 'restaurant'
          }</span>
          <span>${orderTypeLabel}</span>
          ${checkoutState.orderType === 'dineIn' && checkoutState.tableId
            ? `<span class="summary-table">Mesa ${appConfig.tables.layout.find(t => t.id === checkoutState.tableId)?.label || checkoutState.tableId}</span>`
            : ''
          }
        </div>

        ${checkoutState.orderType === 'delivery' ? `
          <div class="summary-address">
            <span class="material-icons-round" aria-hidden="true">location_on</span>
            <span>${sanitizeHTML(checkoutState.address)}, ${sanitizeHTML(checkoutState.addressNumber)}${checkoutState.reference ? ` (${sanitizeHTML(checkoutState.reference)})` : ''}</span>
          </div>
        ` : ''}

        <div class="summary-items">
          ${items.map(item => `
            <div class="summary-item">
              <div class="summary-item-info">
                <span class="summary-item-qty">${item.quantity}x</span>
                <span class="summary-item-name">${sanitizeHTML(item.name)}</span>
              </div>
              <span class="summary-item-price">${formatCurrency(item.totalPrice)}</span>
            </div>
            ${item.extras?.length > 0 ? `
              <div class="summary-item-extras">${item.extras.map(e => `+ ${e.name}`).join(', ')}</div>
            ` : ''}
          `).join('')}
        </div>

        <div class="summary-totals">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          ${checkoutState.orderType === 'delivery' ? `
            <div class="summary-row">
              <span>Taxa de entrega</span>
              <span>${formatCurrency(deliveryFee)}</span>
            </div>
          ` : ''}
          <div class="summary-row summary-total">
            <span>Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Step 4: Payment Method ─────────────────────────────── */
  else if (step === 4) {
    const methods = configManager.getPaymentMethods().filter(m => m.enabled);

    stepContent = `
      <h3 class="checkout-step-title">Forma de Pagamento</h3>
      <div class="payment-methods">
        ${methods.map(m => `
          <button class="payment-card ${checkoutState.paymentMethod === m.id ? 'selected' : ''}" data-method="${m.id}" type="button">
            <span class="material-icons-round payment-card-icon">${m.icon}</span>
            <span class="payment-card-label">${m.label}</span>
          </button>
        `).join('')}
      </div>
      ${checkoutState.paymentMethod === 'cash' ? `
        <div class="change-section">
          <label for="ck-change">Precisa de troco para quanto?</label>
          <div class="change-input-wrap">
            <span class="change-prefix">R$</span>
            <input type="number" id="ck-change" placeholder="0,00" min="0" step="0.01" value="${checkoutState.change || ''}">
          </div>
        </div>
      ` : ''}
    `;
  }

  /* ── Step 5: Confirmation (not yet confirmed) ───────────── */
  else if (step === 5) {
    stepContent = `
      <div class="checkout-confirming">
        <div class="confirming-icon">
          <span class="material-icons-round">check_circle</span>
        </div>
        <h3 class="checkout-step-title">Tudo certo?</h3>
        <p class="confirming-text">Ao confirmar, seu pedido será enviado para a cozinha.</p>
      </div>
    `;
  }

  /* ── Assemble the modal ─────────────────────────────────── */
  dom.checkoutModal.innerHTML = `
    <div class="checkout-content">
      <div class="checkout-header">
        <button class="checkout-close btn-icon" aria-label="Fechar" type="button">
          <span class="material-icons-round">close</span>
        </button>
        ${progressHTML}
        <div class="checkout-step-labels">
          ${stepLabels.map((l, i) => `<span class="${i + 1 === step ? 'active' : ''}">${l}</span>`).join('')}
        </div>
      </div>
      <div class="checkout-body">
        ${stepContent}
      </div>
      <div class="checkout-nav">
        ${step > 1 ? `
          <button class="btn btn-ghost checkout-back" type="button">
            <span class="material-icons-round" aria-hidden="true">arrow_back</span>
            Voltar
          </button>
        ` : '<div></div>'}
        ${step < 5 ? `
          <button class="btn btn-primary checkout-next" type="button">
            Continuar
            <span class="material-icons-round" aria-hidden="true">arrow_forward</span>
          </button>
        ` : `
          <button class="btn btn-primary btn-lg checkout-confirm" type="button">
            <span class="material-icons-round" aria-hidden="true">check</span>
            Confirmar Pedido
          </button>
        `}
      </div>
    </div>
  `;

  // Event bindings
  attachCheckoutEvents();
}


/* --------------------------------------------------------------------------
   Checkout Event Bindings
   -------------------------------------------------------------------------- */
function attachCheckoutEvents() {
  const step = checkoutState.step;

  // Close
  dom.checkoutModal.querySelector('.checkout-close')?.addEventListener('click', closeCheckout);

  // Back
  dom.checkoutModal.querySelector('.checkout-back')?.addEventListener('click', () => {
    if (scannedTableLabel && checkoutState.step === 3) {
      showToast('A mesa já foi selecionada automaticamente.', 'info');
      closeCheckout();
      return;
    }
    checkoutState.step--;
    renderCheckoutStep();
  });

  // Next
  dom.checkoutModal.querySelector('.checkout-next')?.addEventListener('click', () => {
    if (validateCheckoutStep()) {
      checkoutState.step++;
      renderCheckoutStep();
    }
  });

  // Confirm
  dom.checkoutModal.querySelector('.checkout-confirm')?.addEventListener('click', confirmOrder);

  if (step === 1) {
    dom.checkoutModal.querySelectorAll('.delivery-type-card').forEach(card => {
      card.addEventListener('click', () => {
        checkoutState.orderType = card.dataset.type;
        dom.checkoutModal.querySelectorAll('.delivery-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        // Auto-advance to next step
        setTimeout(() => {
          if (validateCheckoutStep()) {
            checkoutState.step++;
            renderCheckoutStep();
          }
        }, 150);
      });
    });
  }

  if (step === 2) {
    // Delivery zone selection
    dom.checkoutModal.querySelectorAll('.zone-option').forEach(option => {
      option.addEventListener('click', () => {
        const zoneId = option.dataset.zoneId;
        const zones = configManager.getDeliveryZones();
        const zone = zones.find(z => z.id === zoneId);
        checkoutState.deliveryZone = zone;
        checkoutState.deliveryFee = zone?.fee || 0;
        dom.checkoutModal.querySelectorAll('.zone-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
      });
    });

    // Table selection
    dom.checkoutModal.querySelectorAll('.table-spot:not([disabled])').forEach(spot => {
      spot.addEventListener('click', () => {
        checkoutState.tableId = parseInt(spot.dataset.tableId);
        dom.checkoutModal.querySelectorAll('.table-spot').forEach(s => s.classList.remove('selected'));
        spot.classList.add('selected');
      });
    });
  }

  if (step === 4) {
    dom.checkoutModal.querySelectorAll('.payment-card').forEach(card => {
      card.addEventListener('click', () => {
        checkoutState.paymentMethod = card.dataset.method;
        dom.checkoutModal.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        // Re-render to show change input for cash
        renderCheckoutStep();
      });
    });
  }
}


/* --------------------------------------------------------------------------
   Checkout Validation
   -------------------------------------------------------------------------- */
function validateCheckoutStep() {
  const step = checkoutState.step;

  if (step === 1) {
    if (!checkoutState.orderType) {
      showToast('Selecione como deseja receber seu pedido', 'warning');
      return false;
    }
    return true;
  }

  if (step === 2) {
    if (checkoutState.orderType === 'delivery') {
      // Read form values
      checkoutState.customerName  = dom.checkoutModal.querySelector('#ck-name')?.value?.trim() || '';
      checkoutState.customerPhone = dom.checkoutModal.querySelector('#ck-phone')?.value?.trim() || '';
      checkoutState.address       = dom.checkoutModal.querySelector('#ck-address')?.value?.trim() || '';
      checkoutState.addressNumber = dom.checkoutModal.querySelector('#ck-number')?.value?.trim() || '';
      checkoutState.reference     = dom.checkoutModal.querySelector('#ck-reference')?.value?.trim() || '';

      if (!checkoutState.customerName) { showToast('Informe seu nome', 'warning'); return false; }
      if (!checkoutState.customerPhone) { showToast('Informe seu telefone', 'warning'); return false; }
      if (!checkoutState.address) { showToast('Informe seu endereço', 'warning'); return false; }
      if (!checkoutState.addressNumber) { showToast('Informe o número', 'warning'); return false; }
      if (!checkoutState.deliveryZone) { showToast('Selecione a zona de entrega', 'warning'); return false; }

      // Check minimum order
      const minOrder = deliveryCalculator.getMinimumOrder();
      if (minOrder && cart.getSubtotal() < minOrder) {
        showToast(`Pedido mínimo para delivery: ${formatCurrency(minOrder)}`, 'warning');
        return false;
      }
      return true;

    } else if (checkoutState.orderType === 'takeaway') {
      checkoutState.customerName  = dom.checkoutModal.querySelector('#ck-name')?.value?.trim() || '';
      checkoutState.customerPhone = dom.checkoutModal.querySelector('#ck-phone')?.value?.trim() || '';

      if (!checkoutState.customerName) { showToast('Informe seu nome', 'warning'); return false; }
      if (!checkoutState.customerPhone) { showToast('Informe seu telefone', 'warning'); return false; }
      return true;

    } else if (checkoutState.orderType === 'dineIn') {
      // Mesa é opcional, então não barramos o usuário
      return true;
    }
  }

  if (step === 3) {
    return true; // Summary step — just review
  }

  if (step === 4) {
    if (!checkoutState.paymentMethod) {
      showToast('Selecione a forma de pagamento', 'warning');
      return false;
    }
    // Read change if cash
    if (checkoutState.paymentMethod === 'cash') {
      const changeInput = dom.checkoutModal.querySelector('#ck-change');
      checkoutState.change = changeInput ? parseFloat(changeInput.value) || null : null;
    }
    return true;
  }

  return true;
}


/* --------------------------------------------------------------------------
   Confirm Order
   -------------------------------------------------------------------------- */
async function confirmOrder() {
  const confirmBtn = dom.checkoutModal.querySelector('.checkout-confirm');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
      <span class="material-icons-round spin" aria-hidden="true">sync</span>
      Enviando...
    `;
  }

  try {
    const items = cart.getItems();
    const subtotal = cart.getSubtotal();
    const deliveryFee = checkoutState.deliveryFee;
    const total = subtotal + deliveryFee;

    const orderData = {
      type: checkoutState.orderType,
      customerInfo: {
        name: checkoutState.customerName,
        phone: checkoutState.customerPhone,
        address: checkoutState.orderType === 'delivery'
          ? `${checkoutState.address}, ${checkoutState.addressNumber}${checkoutState.reference ? ` (${checkoutState.reference})` : ''}`
          : null,
      },
      delivery: checkoutState.orderType === 'delivery' ? {
        address: checkoutState.address,
        number: checkoutState.addressNumber,
        reference: checkoutState.reference,
        zone: checkoutState.deliveryZone,
        fee: deliveryFee,
      } : null,
      table: checkoutState.orderType === 'dineIn' ? {
        id: checkoutState.tableId,
        label: appConfig.tables?.layout?.find(t => t.id === checkoutState.tableId)?.label || '',
      } : null,
      items,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: checkoutState.paymentMethod,
      tableId: checkoutState.orderType === 'dineIn' ? checkoutState.tableId : null,
      change: checkoutState.change,
      observation: checkoutState.observation,
    };

    const order = await orderManager.createOrder(orderData);

    // Close checkout and show success
    closeCheckout();
    cart.clear();
    showOrderConfirmed(order);

  } catch (error) {
    console.error('[Axon] Order creation failed:', error);
    showToast('Erro ao criar pedido. Tente novamente.', 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `
        <span class="material-icons-round" aria-hidden="true">check</span>
        Confirmar Pedido
      `;
    }
  }
}


/* --------------------------------------------------------------------------
   Order Confirmed Modal
   -------------------------------------------------------------------------- */
function showOrderConfirmed(order) {
  const orderNum = order.orderNumber || order.id?.slice(-6)?.toUpperCase() || '---';
  
  // Format WhatsApp message
  const storeInfo = configManager.getStoreInfo() || {};
  let waNumber = (storeInfo.whatsapp || storeInfo.phone || '').replace(/\D/g, '');
  if (waNumber && !waNumber.startsWith('55')) waNumber = '55' + waNumber;

  let waText = `*NOVO PEDIDO #${orderNum}* 🍔\n\n`;
  waText += `*Cliente:* ${order.customerInfo?.name || 'Cliente'}\n`;
  if (order.customerInfo?.phone) waText += `*Telefone:* ${order.customerInfo.phone}\n`;
  
  if (order.type === 'delivery') {
    waText += `\n*🛵 DELIVERY*\n`;
    waText += `Endereço: ${order.delivery?.address}, ${order.delivery?.number}\n`;
    if (order.delivery?.reference) waText += `Ref: ${order.delivery.reference}\n`;
  } else if (order.type === 'takeaway') {
    waText += `\n*🛍️ RETIRADA NO BALCÃO*\n`;
  } else if (order.type === 'dineIn') {
    waText += `\n*🍽️ CONSUMIR NO LOCAL*\n`;
    if (order.tableId) waText += `Mesa: ${order.table?.label || order.tableId}\n`;
  }

  if (order.observation) waText += `\n*📝 Observação:* ${order.observation}\n`;

  waText += `\n*📝 ITENS DO PEDIDO:*\n`;
  (order.items || []).forEach(item => {
    waText += `🔹 ${item.quantity}x ${item.name} - ${formatCurrency(item.totalPrice)}\n`;
    if (item.extras && item.extras.length > 0) {
      waText += `   ➕ Extras: ${item.extras.map(e => e.name).join(', ')}\n`;
    }
    if (item.observation) {
      waText += `   💬 Obs: ${item.observation}\n`;
    }
  });

  waText += `\n*💰 RESUMO:*\n`;
  waText += `Subtotal: ${formatCurrency(order.subtotal)}\n`;
  if (order.deliveryFee > 0) waText += `Taxa de Entrega: ${formatCurrency(order.deliveryFee)}\n`;
  waText += `*Total: ${formatCurrency(order.total)}*\n`;
  
  if (order.paymentMethod) {
    waText += `\n*💳 PAGAMENTO:*\n`;
    waText += `Método: ${order.paymentMethod.toUpperCase()}\n`;
    if (order.change) waText += `Troco para: ${formatCurrency(order.change)}\n`;
  }

  const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

  dom.orderConfirmedModal.innerHTML = `
    <div class="confirmed-content">
      <div class="confirmed-animation">
        <div class="confirmed-circle">
          <span class="material-icons-round confirmed-check">check</span>
        </div>
        <div class="confirmed-particles" aria-hidden="true">
          ${Array.from({ length: 12 }, (_, i) => `<div class="particle particle-${i}"></div>`).join('')}
        </div>
      </div>
      <h2 class="confirmed-title">Pedido Confirmado!</h2>
      <p class="confirmed-number">
        <span>Nº do Pedido</span>
        <strong>#${orderNum}</strong>
      </p>
      <p class="confirmed-message">
        ${order.type === 'delivery'
          ? 'Seu pedido está sendo preparado e será entregue em breve!'
          : order.type === 'takeaway'
            ? 'Seu pedido está sendo preparado. Aguarde a notificação para retirar!'
            : 'Seu pedido está sendo preparado. Fique confortável!'
        }
      </p>
      <div class="confirmed-actions" style="display:flex; flex-direction:column; gap:8px; margin-top:24px; width:100%">
        ${waNumber ? `
        <a href="${waLink}" target="_blank" class="btn btn-primary confirmed-whatsapp" style="background:#25D366; color:#fff; border:none; width:100%;">
          <span class="material-icons-round" aria-hidden="true">chat</span>
          Enviar para o WhatsApp
        </a>
        ` : ''}
        ${order.type === 'dineIn' ? `
        <button class="btn btn-ghost confirmed-print" type="button" style="width:100%;">
          <span class="material-icons-round" aria-hidden="true">receipt_long</span>
          Imprimir Comprovante
        </button>
        ` : ''}
        <button class="btn btn-ghost confirmed-close" type="button" style="width:100%;">
          <span class="material-icons-round" aria-hidden="true">home</span>
          Voltar ao Cardápio
        </button>
      </div>
    </div>
  `;

  dom.orderConfirmedOverlay.style.display = 'flex';
  dom.orderConfirmedModal.style.display = 'flex';

  requestAnimationFrame(() => {
    dom.orderConfirmedOverlay.classList.add('active');
    dom.orderConfirmedModal.classList.add('active');
  });

  document.body.style.overflow = 'hidden';

  if (order.type === 'dineIn') {
    dom.orderConfirmedModal.querySelector('.confirmed-print')?.addEventListener('click', () => {
      try {
        const ticketData = orderManager.generateTicketData(order);
        const ticketHTML = printer.formatTicketHTML(ticketData);
        printer.printViaBrowser(ticketHTML);
      } catch (err) {
        console.error('[Axon] Print failed:', err);
        showToast('Erro ao imprimir comprovante', 'error');
      }
    });
  }

  // Close
  dom.orderConfirmedModal.querySelector('.confirmed-close')?.addEventListener('click', closeOrderConfirmed);
}

function closeOrderConfirmed() {
  dom.orderConfirmedOverlay.classList.remove('active');
  dom.orderConfirmedModal.classList.remove('active');

  setTimeout(() => {
    dom.orderConfirmedOverlay.style.display = 'none';
    dom.orderConfirmedModal.style.display = 'none';
    dom.orderConfirmedModal.innerHTML = '';
    document.body.style.overflow = '';
  }, 350);
}


/* --------------------------------------------------------------------------
   Scroll Animations (IntersectionObserver)
   -------------------------------------------------------------------------- */
function setupScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  // Observe after initial render
  requestAnimationFrame(() => {
    dom.menuGrid.querySelectorAll('.menu-item-card, .menu-section-header').forEach(el => {
      observer.observe(el);
    });
  });

  // Expose for menu-renderer to call after re-renders
  window.__axonScrollObserver = observer;
}


/* --------------------------------------------------------------------------
   Loading Screen
   -------------------------------------------------------------------------- */
function hideLoadingScreen() {
  setTimeout(() => {
    dom.loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      dom.loadingScreen.style.display = 'none';
    }, 700);
  }, 600);
}


/* --------------------------------------------------------------------------
   Expose openItemDetail globally for menu-renderer
   -------------------------------------------------------------------------- */
window.__axonOpenItemDetail = openItemDetail;


/* --------------------------------------------------------------------------
   Phone Mask Utility
   -------------------------------------------------------------------------- */
document.addEventListener('input', (e) => {
  if (e.target.id === 'ck-phone') {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 6) {
      e.target.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      e.target.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      e.target.value = `(${value}`;
    }
  }
});


/* --------------------------------------------------------------------------
   Keyboard Accessibility
   -------------------------------------------------------------------------- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close modals in order of priority
    if (dom.orderConfirmedModal.style.display !== 'none' && dom.orderConfirmedModal.style.display !== '') {
      closeOrderConfirmed();
    } else if (dom.checkoutModal.style.display !== 'none' && dom.checkoutModal.style.display !== '') {
      closeCheckout();
    } else if (dom.itemModal.style.display !== 'none' && dom.itemModal.style.display !== '') {
      closeItemDetail();
    } else if (dom.cartDrawer.style.display !== 'none' && dom.cartDrawer.style.display !== '') {
      closeCartDrawer();
    }
  }
});


/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

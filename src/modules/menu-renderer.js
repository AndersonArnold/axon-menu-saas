/* ============================================================================
   Axon Menu Base — Menu Renderer Module
   ============================================================================
   Handles all menu UI rendering: category chips, menu item cards,
   item detail modal content, cart drawer, checkout steps,
   order confirmation, and closed overlay.
   ============================================================================ */

import { formatCurrency, sanitizeHTML, truncateText } from './utils.js';
import { cart } from './cart.js';

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */
let _container = null;
let _categories = [];
let _items = [];
let _filteredItems = null;  // null = show all
let _navContainer = null;

/* --------------------------------------------------------------------------
   Constants
   -------------------------------------------------------------------------- */
const DESCRIPTION_MAX_LENGTH = 80;
const PLACEHOLDER_ICON = 'restaurant';


/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */
function init(container, categories, items) {
  _container  = container;
  _categories = categories;
  _items      = items;
  _filteredItems = null;

  renderMenuGrid(_items);
}


/* --------------------------------------------------------------------------
   Categories Navigation
   -------------------------------------------------------------------------- */
function renderCategories(categories, navContainer) {
  _navContainer = navContainer;

  // "All" chip
  const allChip = `
    <button class="category-chip active" data-category-id="all" role="tab" aria-selected="true" type="button">
      <span class="material-icons-round chip-icon" aria-hidden="true">apps</span>
      <span class="chip-label">Todos</span>
    </button>
  `;

  const chips = categories.map(cat => `
    <button class="category-chip" data-category-id="${cat.id}" role="tab" aria-selected="false" type="button">
      <span class="material-icons-round chip-icon" aria-hidden="true">${cat.icon || 'category'}</span>
      <span class="chip-label">${sanitizeHTML(cat.name)}</span>
    </button>
  `).join('');

  navContainer.innerHTML = allChip + chips;

  // "All" chip click handler
  navContainer.querySelector('[data-category-id="all"]')?.addEventListener('click', () => {
    _filteredItems = null;
    navContainer.querySelectorAll('.category-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-selected', 'false');
    });
    navContainer.querySelector('[data-category-id="all"]').classList.add('active');
    navContainer.querySelector('[data-category-id="all"]').setAttribute('aria-selected', 'true');
    renderMenuGrid(_items);
    reobserveAnimations();
  });
}


/* --------------------------------------------------------------------------
   Menu Grid Rendering
   -------------------------------------------------------------------------- */
function renderMenuGrid(items) {
  if (!_container) return;

  // Group items by category
  const grouped = new Map();
  _categories.forEach(cat => grouped.set(cat.id, []));

  items.forEach(item => {
    if (grouped.has(item.categoryId)) {
      grouped.get(item.categoryId).push(item);
    }
  });

  let html = '';
  let itemIndex = 0;

  grouped.forEach((catItems, catId) => {
    if (catItems.length === 0) return;

    const category = _categories.find(c => c.id === catId);
    if (!category) return;

    // Section header
    html += `
      <div class="menu-section-header" data-category-section="${catId}">
        <div class="section-header-line" aria-hidden="true"></div>
        <h2 class="section-title">
          <span class="material-icons-round section-icon" aria-hidden="true">${category.icon || 'category'}</span>
          ${sanitizeHTML(category.name)}
        </h2>
        <span class="section-count">${catItems.length} ${catItems.length === 1 ? 'item' : 'itens'}</span>
      </div>
    `;

    // Item cards
    html += '<div class="menu-section-items">';
    catItems.forEach((item) => {
      html += renderItemCard(item, itemIndex);
      itemIndex++;
    });
    html += '</div>';
  });

  _container.innerHTML = html;

  // Attach click handlers
  _container.querySelectorAll('.menu-item-card').forEach(card => {
    card.addEventListener('click', () => {
      const itemId = card.dataset.itemId;
      const item = _items.find(i => i.id === itemId);
      if (item && window.__axonOpenItemDetail) {
        window.__axonOpenItemDetail(item);
      }
    });
  });

  // Quick add buttons (prevent propagation)
  _container.querySelectorAll('.menu-item-quick-add').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      const item = _items.find(i => i.id === itemId);
      if (item) {
        // If item has extras, open detail modal instead
        if (item.extras && item.extras.length > 0) {
          if (window.__axonOpenItemDetail) {
            window.__axonOpenItemDetail(item);
          }
        } else {
          // Quick add with no extras
          cart.addItem({
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            extras: [],
            quantity: 1,
            observation: '',
          });

          // Button animation
          btn.classList.add('added');
          btn.innerHTML = '<span class="material-icons-round">check</span>';
          setTimeout(() => {
            btn.classList.remove('added');
            btn.innerHTML = '<span class="material-icons-round">add</span>';
          }, 1200);

          if (window.__axonShowToast) {
            window.__axonShowToast(`${item.name} adicionado!`, 'success');
          }
        }
      }
    });
  });
}


/* --------------------------------------------------------------------------
   Item Card Template
   -------------------------------------------------------------------------- */
function renderItemCard(item, index) {
  const hasImage = item.image && item.image.trim() !== '';
  const description = item.description
    ? truncateText(item.description, DESCRIPTION_MAX_LENGTH)
    : '';
  const hasExtras = item.extras && item.extras.length > 0;
  const delay = Math.min(index * 50, 500);

  return `
    <article
      class="menu-item-card"
      data-item-id="${item.id}"
      data-category="${item.categoryId}"
      style="--anim-delay: ${delay}ms"
      role="button"
      tabindex="0"
      aria-label="${sanitizeHTML(item.name)}, ${formatCurrency(item.price)}"
    >
      <div class="menu-item-image-wrapper">
        ${hasImage
          ? `<img class="menu-item-image" src="${item.image}" alt="${sanitizeHTML(item.name)}" loading="lazy">`
          : `<div class="menu-item-image-placeholder">
               <span class="material-icons-round">${PLACEHOLDER_ICON}</span>
             </div>`
        }
        ${hasExtras
          ? `<span class="menu-item-extras-badge" aria-label="Possui adicionais">
               <span class="material-icons-round">add_circle</span>
             </span>`
          : ''
        }
      </div>
      <div class="menu-item-body">
        <h3 class="menu-item-name">${sanitizeHTML(item.name)}</h3>
        ${description ? `<p class="menu-item-description">${sanitizeHTML(description)}</p>` : ''}
        <div class="menu-item-footer">
          <span class="menu-item-price">${formatCurrency(item.price)}</span>
          <button
            class="menu-item-quick-add"
            data-item-id="${item.id}"
            aria-label="Adicionar ${sanitizeHTML(item.name)} ao pedido"
            type="button"
          >
            <span class="material-icons-round">add</span>
          </button>
        </div>
      </div>
    </article>
  `;
}


/* --------------------------------------------------------------------------
   Filter by Search Term
   -------------------------------------------------------------------------- */
function filterItems(searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    _filteredItems = null;
    renderMenuGrid(_items);
    reobserveAnimations();
    return _items.length;
  }

  const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  _filteredItems = _items.filter(item => {
    const name = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const desc = (item.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return name.includes(term) || desc.includes(term);
  });

  renderMenuGrid(_filteredItems);
  reobserveAnimations();
  return _filteredItems.length;
}


/* --------------------------------------------------------------------------
   Filter by Category
   -------------------------------------------------------------------------- */
function filterByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') {
    _filteredItems = null;
    renderMenuGrid(_items);
  } else {
    _filteredItems = _items.filter(item => item.categoryId === categoryId);
    renderMenuGrid(_filteredItems);
  }
  reobserveAnimations();

  // Update nav chips
  if (_navContainer) {
    _navContainer.querySelectorAll('.category-chip').forEach(c => {
      const isActive = c.dataset.categoryId === categoryId || (!categoryId && c.dataset.categoryId === 'all');
      c.classList.toggle('active', isActive);
      c.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }
}


/* --------------------------------------------------------------------------
   Cart UI Updates
   -------------------------------------------------------------------------- */
function updateCartUI(cartModule) {
  const cartFab   = document.getElementById('cart-fab');
  const cartCount = document.getElementById('cart-count');

  if (!cartFab || !cartCount) return;

  const count = cartModule.getItemCount();
  cartCount.textContent = count;
  cartFab.style.display = count > 0 ? 'flex' : 'none';
}


/* --------------------------------------------------------------------------
   Render Cart Drawer
   -------------------------------------------------------------------------- */
function renderCartDrawer(cartItems, subtotal) {
  const cartItemsEl  = document.getElementById('cart-items');
  const cartEmpty    = document.getElementById('cart-empty');
  const cartFooter   = document.getElementById('cart-footer');
  const cartSubtotal = document.getElementById('cart-subtotal');

  if (!cartItemsEl) return;

  if (!cartItems || cartItems.length === 0) {
    cartItemsEl.innerHTML = '';
    if (cartEmpty) cartEmpty.style.display = 'flex';
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }

  if (cartEmpty) cartEmpty.style.display = 'none';
  if (cartFooter) cartFooter.style.display = 'block';
  if (cartSubtotal) cartSubtotal.textContent = formatCurrency(subtotal);

  cartItemsEl.innerHTML = cartItems.map(item => `
    <div class="cart-item" data-cart-id="${item.cartId}">
      <div class="cart-item-info">
        <h4 class="cart-item-name">${sanitizeHTML(item.name)}</h4>
        ${item.extras?.length > 0 ? `<p class="cart-item-extras">${item.extras.map(e => e.name).join(', ')}</p>` : ''}
        ${item.observation ? `<p class="cart-item-obs"><span class="material-icons-round">chat_bubble_outline</span>${sanitizeHTML(item.observation)}</p>` : ''}
        <p class="cart-item-price">${formatCurrency(item.totalPrice)}</p>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-control">
          <button class="qty-btn qty-minus" data-cart-id="${item.cartId}" aria-label="Diminuir" type="button">
            <span class="material-icons-round">remove</span>
          </button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn qty-plus" data-cart-id="${item.cartId}" aria-label="Aumentar" type="button">
            <span class="material-icons-round">add</span>
          </button>
        </div>
        <button class="cart-item-remove" data-cart-id="${item.cartId}" aria-label="Remover" type="button">
          <span class="material-icons-round">delete_outline</span>
        </button>
      </div>
    </div>
  `).join('');
}


/* --------------------------------------------------------------------------
   Checkout Rendering
   -------------------------------------------------------------------------- */
function renderCheckout(cartModule, config) {
  // Delegated to main.js for tight state integration
  // This method is kept for API completeness
  return null;
}


/* --------------------------------------------------------------------------
   Order Confirmed Rendering
   -------------------------------------------------------------------------- */
function renderOrderConfirmed(order) {
  // Delegated to main.js for tight state integration
  return null;
}


/* --------------------------------------------------------------------------
   Closed Overlay
   -------------------------------------------------------------------------- */
function showClosedOverlay(scheduleInfo) {
  const overlay  = document.getElementById('closed-overlay');
  const message  = document.getElementById('closed-message');
  const schedule = document.getElementById('closed-schedule');

  if (!overlay) return;

  // Build schedule display
  const dayNames = {
    monday: 'Segunda',
    tuesday: 'Terça',
    wednesday: 'Quarta',
    thursday: 'Quinta',
    friday: 'Sexta',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  let scheduleHTML = '';
  if (scheduleInfo && typeof scheduleInfo === 'object') {
    // If scheduleInfo is a schedule display object with next opening
    if (scheduleInfo.nextOpen) {
      message.textContent = `Voltamos ${scheduleInfo.nextOpen}`;
    } else {
      message.textContent = 'No momento não estamos recebendo pedidos.';
    }

    if (scheduleInfo.schedule) {
      scheduleHTML = '<div class="schedule-table">';
      for (const [day, info] of Object.entries(scheduleInfo.schedule)) {
        const dayLabel = dayNames[day] || day;
        const isToday = new Date().getDay() === ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(day);
        scheduleHTML += `
          <div class="schedule-row ${isToday ? 'today' : ''} ${!info.enabled ? 'disabled' : ''}">
            <span class="schedule-day">${dayLabel}</span>
            <span class="schedule-time">${info.enabled ? `${info.open} – ${info.close}` : 'Fechado'}</span>
          </div>
        `;
      }
      scheduleHTML += '</div>';
    }
  } else if (typeof scheduleInfo === 'string') {
    message.textContent = scheduleInfo;
  }

  if (schedule) schedule.innerHTML = scheduleHTML;

  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

function hideClosedOverlay() {
  const overlay = document.getElementById('closed-overlay');
  if (!overlay) return;

  overlay.classList.remove('visible');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 500);
}


function reobserveAnimations() {
  if (window.__axonScrollObserver && _container) {
    requestAnimationFrame(() => {
      _container.querySelectorAll('.menu-item-card:not(.animate-in), .menu-section-header:not(.animate-in)').forEach(el => {
        window.__axonScrollObserver.observe(el);
      });
    });
  }
}


/* --------------------------------------------------------------------------
   Export Singleton
   -------------------------------------------------------------------------- */
export const menuRenderer = {
  init,
  renderCategories,
  renderMenuItems: renderMenuGrid,
  renderItemDetail: () => {},  // handled by main.js openItemDetail
  filterItems,
  filterByCategory,
  updateCartUI,
  renderCartDrawer,
  renderCheckout,
  renderOrderConfirmed,
  showClosedOverlay,
  hideClosedOverlay,
};

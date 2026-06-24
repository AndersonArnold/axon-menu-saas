// ============================================================================
// Axon Menu Base - Table Map Module
// Interactive visual table layout with drag-and-drop editing
// ============================================================================

class TableMap {
  constructor() {
    this.container = null;
    this.tables = [];
    this.options = { editable: false, onTableClick: null, showLegend: true };
    this.editMode = false;
    this.dragState = null;
    this.occupationTimers = new Map();
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  init(container, tables, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.tables = JSON.parse(JSON.stringify(tables || []));
    this.options = { ...this.options, ...options };
    this.editMode = false;
    this.dragState = null;
    this.occupationTimers.forEach(id => clearInterval(id));
    this.occupationTimers.clear();
    this.renderMap(this.tables);
  }

  // ---------------------------------------------------------------------------
  // Status Config
  // ---------------------------------------------------------------------------
  static STATUS = {
    available: { label: 'Disponível', icon: 'check_circle', cssClass: 'status-available', color: 'var(--success, #06D6A0)' },
    occupied:  { label: 'Ocupada',    icon: 'person',       cssClass: 'status-occupied',  color: 'var(--danger, #EF476F)' },
    ready:     { label: 'Pronto',     icon: 'notifications_active', cssClass: 'status-ready', color: 'var(--warning, #FFD166)' },
    payment:   { label: 'Pagamento',  icon: 'credit_card',  cssClass: 'status-payment',   color: 'var(--info, #118AB2)' }
  };

  // ---------------------------------------------------------------------------
  // Render full map
  // ---------------------------------------------------------------------------
  renderMap(tables) {
    if (!this.container) return;
    this.tables = tables || this.tables;
    this.container.innerHTML = '';
    this.container.classList.add('table-map-container');

    // Map area
    const mapArea = document.createElement('div');
    mapArea.className = 'table-map-area';
    mapArea.id = 'table-map-area';

    // Grid overlay for edit mode
    const gridOverlay = document.createElement('div');
    gridOverlay.className = 'table-map-grid';
    mapArea.appendChild(gridOverlay);

    // Render each table node
    this.tables.forEach(table => {
      const node = this._createTableNode(table);
      mapArea.appendChild(node);
    });

    this.container.appendChild(mapArea);

    // Legend
    if (this.options.showLegend) {
      const legend = this._createLegend();
      this.container.appendChild(legend);
    }

    // Start timers for occupied tables
    this._startOccupationTimers();
  }

  // ---------------------------------------------------------------------------
  // Create a single table node
  // ---------------------------------------------------------------------------
  _createTableNode(table) {
    const statusInfo = TableMap.STATUS[table.status] || TableMap.STATUS.available;
    const node = document.createElement('div');
    node.className = `table-node ${statusInfo.cssClass} shape-${table.shape || 'square'}`;
    node.dataset.tableId = table.id;
    node.style.left = `${table.x}%`;
    node.style.top = `${table.y}%`;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `Mesa ${table.label} - ${statusInfo.label}`);

    // Glow ring
    const glow = document.createElement('div');
    glow.className = 'table-glow';
    node.appendChild(glow);

    // Status icon
    const statusIcon = document.createElement('span');
    statusIcon.className = 'material-icons-round table-status-icon';
    statusIcon.textContent = statusInfo.icon;
    node.appendChild(statusIcon);

    // Table number (large)
    const numberEl = document.createElement('span');
    numberEl.className = 'table-number';
    numberEl.textContent = table.label;
    node.appendChild(numberEl);

    // Seats count
    const seatsEl = document.createElement('span');
    seatsEl.className = 'table-seats';
    seatsEl.innerHTML = `<span class="material-icons-round" style="font-size:12px">person</span> ${table.seats || 4}`;
    node.appendChild(seatsEl);

    // Occupation timer (hidden by default, shown if occupied)
    const timerEl = document.createElement('span');
    timerEl.className = 'table-timer';
    timerEl.id = `table-timer-${table.id}`;
    timerEl.style.display = table.status === 'occupied' ? 'flex' : 'none';
    timerEl.innerHTML = `<span class="material-icons-round" style="font-size:10px">schedule</span> <span class="timer-value">00:00</span>`;
    node.appendChild(timerEl);

    // Edit mode remove button (hidden by default)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'table-remove-btn';
    removeBtn.innerHTML = '<span class="material-icons-round">close</span>';
    removeBtn.style.display = 'none';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeTable(table.id);
    });
    node.appendChild(removeBtn);

    // Click handler
    node.addEventListener('click', (e) => {
      if (this.dragState && this.dragState.moved) return;
      if (this.options.onTableClick) {
        this.options.onTableClick(table);
      }
    });

    // Pulse animation for occupied
    if (table.status === 'occupied') {
      node.classList.add('pulse');
    }

    return node;
  }

  // ---------------------------------------------------------------------------
  // Legend component
  // ---------------------------------------------------------------------------
  _createLegend() {
    const legend = document.createElement('div');
    legend.className = 'table-map-legend';
    Object.entries(TableMap.STATUS).forEach(([key, info]) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      const dot = document.createElement('span');
      dot.className = `legend-dot ${info.cssClass}`;
      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = info.label;
      item.appendChild(dot);
      item.appendChild(label);
      legend.appendChild(item);
    });
    return legend;
  }

  // ---------------------------------------------------------------------------
  // Occupation timers
  // ---------------------------------------------------------------------------
  _startOccupationTimers() {
    this.occupationTimers.forEach(id => clearInterval(id));
    this.occupationTimers.clear();

    this.tables.forEach(table => {
      if (table.status === 'occupied' && table.occupiedSince) {
        const timerEl = document.getElementById(`table-timer-${table.id}`);
        if (!timerEl) return;
        const valueEl = timerEl.querySelector('.timer-value');
        const updateTimer = () => {
          const elapsed = Date.now() - new Date(table.occupiedSince).getTime();
          const mins = Math.floor(elapsed / 60000);
          const secs = Math.floor((elapsed % 60000) / 1000);
          valueEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };
        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        this.occupationTimers.set(table.id, intervalId);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Update single table status
  // ---------------------------------------------------------------------------
  updateTableStatus(tableId, status, extraData = {}) {
    const tableIndex = this.tables.findIndex(t => t.id === tableId);
    if (tableIndex === -1) return;

    this.tables[tableIndex].status = status;
    if (extraData.occupiedSince) this.tables[tableIndex].occupiedSince = extraData.occupiedSince;
    if (extraData.orderId) this.tables[tableIndex].orderId = extraData.orderId;

    const node = this.getTableElement(tableId);
    if (!node) return;

    // Remove old status classes
    Object.values(TableMap.STATUS).forEach(s => node.classList.remove(s.cssClass));
    node.classList.remove('pulse');

    const statusInfo = TableMap.STATUS[status] || TableMap.STATUS.available;
    node.classList.add(statusInfo.cssClass);
    node.setAttribute('aria-label', `Mesa ${this.tables[tableIndex].label} - ${statusInfo.label}`);

    // Update icon
    const icon = node.querySelector('.table-status-icon');
    if (icon) icon.textContent = statusInfo.icon;

    // Timer visibility
    const timer = node.querySelector('.table-timer');
    if (timer) {
      timer.style.display = status === 'occupied' ? 'flex' : 'none';
    }

    // Pulse for occupied
    if (status === 'occupied') {
      node.classList.add('pulse');
    }

    this._startOccupationTimers();
  }

  // ---------------------------------------------------------------------------
  // Get DOM element for a table
  // ---------------------------------------------------------------------------
  getTableElement(tableId) {
    if (!this.container) return null;
    return this.container.querySelector(`[data-table-id="${tableId}"]`);
  }

  // ---------------------------------------------------------------------------
  // Edit Mode: Enable
  // ---------------------------------------------------------------------------
  enableEditMode() {
    this.editMode = true;
    const mapArea = this.container.querySelector('.table-map-area');
    if (mapArea) mapArea.classList.add('edit-mode');

    // Show remove buttons
    this.container.querySelectorAll('.table-remove-btn').forEach(btn => {
      btn.style.display = 'flex';
    });

    // Make tables draggable
    this.container.querySelectorAll('.table-node').forEach(node => {
      node.classList.add('draggable');
      this._enableDrag(node);
    });
  }

  // ---------------------------------------------------------------------------
  // Edit Mode: Disable
  // ---------------------------------------------------------------------------
  disableEditMode() {
    this.editMode = false;
    const mapArea = this.container.querySelector('.table-map-area');
    if (mapArea) mapArea.classList.remove('edit-mode');

    // Hide remove buttons
    this.container.querySelectorAll('.table-remove-btn').forEach(btn => {
      btn.style.display = 'none';
    });

    // Remove draggable classes
    this.container.querySelectorAll('.table-node').forEach(node => {
      node.classList.remove('draggable');
    });
  }

  // ---------------------------------------------------------------------------
  // Drag helpers
  // ---------------------------------------------------------------------------
  _enableDrag(node) {
    const startDrag = (e) => {
      if (!this.editMode) return;
      e.preventDefault();
      const mapArea = this.container.querySelector('.table-map-area');
      const rect = mapArea.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      this.dragState = {
        node,
        startX: clientX,
        startY: clientY,
        origLeft: parseFloat(node.style.left),
        origTop: parseFloat(node.style.top),
        containerRect: rect,
        moved: false
      };

      node.classList.add('dragging');
      document.addEventListener('mousemove', moveDrag);
      document.addEventListener('touchmove', moveDrag, { passive: false });
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);
    };

    const moveDrag = (e) => {
      if (!this.dragState) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - this.dragState.startX;
      const dy = clientY - this.dragState.startY;
      const dxPercent = (dx / this.dragState.containerRect.width) * 100;
      const dyPercent = (dy / this.dragState.containerRect.height) * 100;

      let newX = this.dragState.origLeft + dxPercent;
      let newY = this.dragState.origTop + dyPercent;

      // Snap to 5% grid
      newX = Math.round(newX / 5) * 5;
      newY = Math.round(newY / 5) * 5;

      // Clamp within bounds
      newX = Math.max(0, Math.min(90, newX));
      newY = Math.max(0, Math.min(85, newY));

      this.dragState.node.style.left = `${newX}%`;
      this.dragState.node.style.top = `${newY}%`;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.dragState.moved = true;
      }
    };

    const endDrag = () => {
      if (!this.dragState) return;
      this.dragState.node.classList.remove('dragging');

      // Update table data
      const tableId = parseInt(this.dragState.node.dataset.tableId) || this.dragState.node.dataset.tableId;
      const t = this.tables.find(t => String(t.id) === String(tableId));
      if (t) {
        t.x = parseFloat(this.dragState.node.style.left);
        t.y = parseFloat(this.dragState.node.style.top);
      }

      document.removeEventListener('mousemove', moveDrag);
      document.removeEventListener('touchmove', moveDrag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchend', endDrag);

      setTimeout(() => { this.dragState = null; }, 50);
    };

    node.addEventListener('mousedown', startDrag);
    node.addEventListener('touchstart', startDrag, { passive: false });
  }

  // ---------------------------------------------------------------------------
  // Add / Remove table
  // ---------------------------------------------------------------------------
  addTable(tableData) {
    const newTable = {
      id: tableData.id || (this.tables.length > 0 ? Math.max(...this.tables.map(t => typeof t.id === 'number' ? t.id : 0)) + 1 : 1),
      label: tableData.label || String(this.tables.length + 1).padStart(2, '0'),
      x: tableData.x || 50,
      y: tableData.y || 50,
      shape: tableData.shape || 'square',
      seats: tableData.seats || 4,
      status: 'available'
    };
    this.tables.push(newTable);

    const mapArea = this.container.querySelector('.table-map-area');
    if (mapArea) {
      const node = this._createTableNode(newTable);
      if (this.editMode) {
        node.classList.add('draggable');
        node.querySelector('.table-remove-btn').style.display = 'flex';
        mapArea.appendChild(node);
        this._enableDrag(node);
      } else {
        mapArea.appendChild(node);
      }
    }

    return newTable;
  }

  removeTable(tableId) {
    this.tables = this.tables.filter(t => String(t.id) !== String(tableId));
    const node = this.getTableElement(tableId);
    if (node) {
      node.classList.add('removing');
      setTimeout(() => node.remove(), 300);
    }
    if (this.occupationTimers.has(tableId)) {
      clearInterval(this.occupationTimers.get(tableId));
      this.occupationTimers.delete(tableId);
    }
  }

  // ---------------------------------------------------------------------------
  // Get current layout (for saving)
  // ---------------------------------------------------------------------------
  getLayout() {
    return this.tables.map(t => ({
      id: t.id,
      label: t.label,
      x: t.x,
      y: t.y,
      shape: t.shape,
      seats: t.seats,
      status: t.status
    }));
  }

  // ---------------------------------------------------------------------------
  // Render Mini Map (for checkout / quick selection)
  // ---------------------------------------------------------------------------
  renderMiniMap(container, tables, onSelect) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    el.innerHTML = '';
    el.classList.add('table-minimap');

    const grid = document.createElement('div');
    grid.className = 'minimap-grid';

    (tables || []).forEach(table => {
      const statusInfo = TableMap.STATUS[table.status] || TableMap.STATUS.available;
      const btn = document.createElement('button');
      btn.className = `minimap-table ${statusInfo.cssClass}`;
      btn.disabled = table.status !== 'available';
      btn.innerHTML = `
        <span class="material-icons-round minimap-icon">${statusInfo.icon}</span>
        <span class="minimap-number">${table.label}</span>
        <span class="minimap-seats">${table.seats} lug.</span>
      `;
      btn.addEventListener('click', () => {
        if (onSelect) onSelect(table);
        el.querySelectorAll('.minimap-table').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      grid.appendChild(btn);
    });

    el.appendChild(grid);

    // Mini legend
    const legend = document.createElement('div');
    legend.className = 'minimap-legend';
    [
      { status: 'available', label: 'Livre' },
      { status: 'occupied', label: 'Ocupada' }
    ].forEach(({ status, label }) => {
      const item = document.createElement('span');
      item.className = 'minimap-legend-item';
      item.innerHTML = `<span class="legend-dot ${TableMap.STATUS[status].cssClass}"></span> ${label}`;
      legend.appendChild(item);
    });
    el.appendChild(legend);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  destroy() {
    this.occupationTimers.forEach(id => clearInterval(id));
    this.occupationTimers.clear();
    if (this.container) this.container.innerHTML = '';
    this.tables = [];
    this.dragState = null;
    this.editMode = false;
  }
}

export const tableMap = new TableMap();

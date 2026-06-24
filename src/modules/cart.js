// ============================================================
// Axon Menu Base — Shopping Cart
// ============================================================

import { generateId } from './utils.js';

class Cart {
  constructor() {
    /** @type {Array<CartItem>} */
    this._items = [];
    /** @type {Set<Function>} */
    this._listeners = new Set();
  }

  /**
   * @typedef {Object} CartItem
   * @property {string} id - ID único no carrinho
   * @property {string} menuItemId - ID do item no cardápio
   * @property {string} name - Nome do item
   * @property {number} price - Preço unitário base
   * @property {number} quantity - Quantidade
   * @property {Array<{name: string, price: number}>} extras - Adicionais selecionados
   * @property {string} observation - Observação do cliente
   * @property {number} totalPrice - Preço total (base + extras) * quantidade
   */

  /**
   * Calcula o preço total de um item (base + extras) * quantidade
   * @param {number} basePrice
   * @param {Array<{price: number}>} extras
   * @param {number} quantity
   * @returns {number}
   */
  _calculateItemTotal(basePrice, extras, quantity) {
    const extrasTotal = (extras || []).reduce((sum, ext) => sum + (ext.price || 0), 0);
    return (basePrice + extrasTotal) * quantity;
  }

  /**
   * Gera uma "assinatura" de item para detectar duplicatas (mesmo item, mesmos extras, mesma obs)
   * @param {string} menuItemId
   * @param {Array} extras
   * @param {string} observation
   * @returns {string}
   */
  _getItemSignature(menuItemId, extras, observation) {
    const extrasKey = (extras || [])
      .map((e) => `${e.name}:${e.price}`)
      .sort()
      .join('|');
    return `${menuItemId}__${extrasKey}__${observation || ''}`;
  }

  /**
   * Adiciona um item ao carrinho
   * Se já existe um item idêntico (mesmo produto, extras e observação), incrementa a quantidade
   * @param {Object} menuItem - Item do cardápio { id, name, price, ... }
   * @param {number} quantity
   * @param {Array<{name: string, price: number}>} selectedExtras
   * @param {string} observation
   * @returns {CartItem}
   */
  addItem(menuItemOrObj, quantity = 1, selectedExtras = [], observation = '') {
    // Suporta duas formas de chamada:
    // 1. addItem({ id, name, price, extras, quantity, observation }) — objeto único
    // 2. addItem(menuItem, quantity, selectedExtras, observation) — params separados
    let menuItem, qty, extras, obs;

    if (menuItemOrObj && (menuItemOrObj.extras !== undefined || menuItemOrObj.quantity !== undefined || menuItemOrObj.observation !== undefined) && arguments.length === 1) {
      // Chamada com objeto único
      menuItem = { id: menuItemOrObj.id, name: menuItemOrObj.name, price: menuItemOrObj.price };
      qty = menuItemOrObj.quantity || 1;
      extras = menuItemOrObj.extras || [];
      obs = menuItemOrObj.observation || '';
    } else {
      // Chamada com params separados
      menuItem = menuItemOrObj;
      qty = quantity;
      extras = selectedExtras;
      obs = observation;
    }

    const signature = this._getItemSignature(menuItem.id, extras, obs);

    // Verifica se já existe item idêntico
    const existing = this._items.find(
      (item) =>
        this._getItemSignature(item.menuItemId, item.extras, item.observation) === signature
    );

    if (existing) {
      existing.quantity += qty;
      existing.totalPrice = this._calculateItemTotal(
        existing.price,
        existing.extras,
        existing.quantity
      );
      this._notifyListeners();
      return existing;
    }

    // Novo item
    const cartItem = {
      id: generateId(),
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: qty,
      extras: extras.map((e) => ({ name: e.name, price: e.price })),
      observation: obs || '',
      totalPrice: this._calculateItemTotal(menuItem.price, extras, qty),
    };

    this._items.push(cartItem);
    this._notifyListeners();
    return cartItem;
  }

  /**
   * Remove um item do carrinho pelo ID
   * @param {string} cartItemId
   */
  removeItem(cartItemId) {
    const index = this._items.findIndex((item) => item.id === cartItemId);
    if (index !== -1) {
      this._items.splice(index, 1);
      this._notifyListeners();
    }
  }

  /**
   * Atualiza a quantidade de um item. Remove se quantidade <= 0
   * @param {string} cartItemId
   * @param {number} quantity
   */
  updateQuantity(cartItemId, quantity) {
    if (quantity <= 0) {
      this.removeItem(cartItemId);
      return;
    }

    const item = this._items.find((i) => i.id === cartItemId);
    if (item) {
      item.quantity = quantity;
      item.totalPrice = this._calculateItemTotal(item.price, item.extras, item.quantity);
      this._notifyListeners();
    }
  }

  /**
   * Retorna todos os itens do carrinho
   * @returns {CartItem[]}
   */
  getItems() {
    return [...this._items];
  }

  /**
   * Retorna a contagem total de itens (soma das quantidades)
   * @returns {number}
   */
  getItemCount() {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Retorna o subtotal (soma de todos os totalPrice)
   * @returns {number}
   */
  getSubtotal() {
    return this._items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  /**
   * Limpa todo o carrinho
   */
  clear() {
    this._items = [];
    this._notifyListeners();
  }

  /**
   * Registra um callback que é chamado quando o carrinho muda
   * @param {Function} callback - Recebe { items, count, subtotal }
   * @returns {Function} Função para cancelar o registro
   */
  onChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /** Notifica todos os listeners registrados */
  _notifyListeners() {
    const data = {
      items: this.getItems(),
      count: this.getItemCount(),
      subtotal: this.getSubtotal(),
    };
    this._listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('[Cart] Erro no listener:', err);
      }
    });
  }
}

/** Singleton */
export const cart = new Cart();
export default cart;

// ============================================================
// Axon Menu Base — Central Data Store (Firebase Firestore)
// ============================================================

import { db, getTenantId } from './firebase.js';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, 
  query, where, deleteDoc, onSnapshot
} from "firebase/firestore";
import { isToday } from './utils.js';

class AppStore {
  constructor() {
    this.tenant = getTenantId();
    this._initialized = false;
  }

  // Helper to get collection ref scoped by tenant
  _col(name) {
    return collection(db, 'stores', this.tenant, name);
  }

  // Helper to get doc ref scoped by tenant
  _doc(name, id) {
    return doc(db, 'stores', this.tenant, name, String(id));
  }

  // ─── Inicialização ─────────────────────────────────────────

  async init(configData) {
    if (this._initialized) return;
    try {
      const seededDoc = await getDoc(this._doc('config', '_seeded'));
      if (!seededDoc.exists() && configData) {
        await this._seedFromConfig(configData);
      }
      this._initialized = true;
    } catch (error) {
      console.error('[AppStore] Erro ao inicializar banco na nuvem:', error);
      throw error;
    }
  }

  async _seedFromConfig(config) {
    const sections = ['store', 'schedule', 'orderTypes', 'delivery', 'payment', 'theme', 'admin', 'printer'];
    for (const section of sections) {
      if (config[section]) {
        await setDoc(this._doc('config', section), { value: config[section] });
      }
    }

    if (config.categories?.length) {
      for (const cat of config.categories) {
        const id = cat.id || Date.now().toString() + Math.random();
        await setDoc(this._doc('categories', id), { ...cat, id });
      }
    }

    if (config.menuItems?.length) {
      for (const item of config.menuItems) {
        const id = item.id || Date.now().toString() + Math.random();
        await setDoc(this._doc('menuItems', id), { ...item, id });
      }
    }

    if (config.tables?.layout?.length) {
      for (const t of config.tables.layout) {
        await setDoc(this._doc('restaurantTables', t.id), t);
      }
    }

    await setDoc(this._doc('config', '_seeded'), { value: true });
  }

  // ─── Config ────────────────────────────────────────────────

  async getConfig(key) {
    const docSnap = await getDoc(this._doc('config', key));
    return docSnap.exists() ? docSnap.data().value : null;
  }

  async setConfig(key, value) {
    await setDoc(this._doc('config', key), { value }, { merge: true });
  }

  // ─── Categorias ────────────────────────────────────────────

  async getAllCategories() {
    const snap = await getDocs(this._col('categories'));
    const cats = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    return cats
      .filter(c => c.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async addCategory(cat) {
    const docRef = await addDoc(this._col('categories'), cat);
    return docRef.id;
  }

  async updateCategory(id, data) {
    await updateDoc(this._doc('categories', id), data);
  }

  async deleteCategory(id) {
    await updateDoc(this._doc('categories', id), { active: false });
  }

  // ─── Itens do Cardápio ─────────────────────────────────────

  async getAllMenuItems() {
    const snap = await getDocs(this._col('menuItems'));
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    return items
      .filter(item => item.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getItemsByCategory(categoryId) {
    const q = query(this._col('menuItems'), where('categoryId', '==', categoryId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    return items
      .filter(item => item.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async addMenuItem(item) {
    const docRef = await addDoc(this._col('menuItems'), item);
    return docRef.id;
  }

  async updateMenuItem(id, data) {
    await updateDoc(this._doc('menuItems', id), data);
  }

  async deleteMenuItem(id) {
    await updateDoc(this._doc('menuItems', id), { active: false });
  }

  // ─── Pedidos ───────────────────────────────────────────────

  async createOrder(orderData) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const q = query(this._col('orders'), where('date', '==', todayStr));
    const todaysOrdersSnap = await getDocs(q);
    
    const nextNumber = todaysOrdersSnap.size + 1;
    const orderNumber = `#${String(nextNumber).padStart(3, '0')}`;

    const order = {
      ...orderData,
      orderNumber,
      date: todayStr,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      status: orderData.status || 'pending',
      createdAt: now.toISOString(),
    };

    const docRef = await addDoc(this._col('orders'), order);
    return { ...order, id: docRef.id };
  }

  async getOrdersByDate(date) {
    const q = query(this._col('orders'), where('date', '==', date));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  }

  async updateOrderStatus(id, status) {
    await updateDoc(this._doc('orders', id), { status });
  }

  async getTodaysOrders() {
    const todayStr = new Date().toISOString().split('T')[0];
    const q = query(this._col('orders'), where('date', '==', todayStr));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  }

  subscribeToTodaysOrders(callback) {
    const todayStr = new Date().toISOString().split('T')[0];
    const q = query(this._col('orders'), where('date', '==', todayStr));
    return onSnapshot(q, (snap) => {
      const orders = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      callback(orders);
    });
  }

  async getOrderById(id) {
    const snap = await getDoc(this._doc('orders', id));
    return snap.exists() ? { ...snap.data(), id: snap.id } : undefined;
  }

  // ─── Mesas ─────────────────────────────────────────────────

  async getTableStatus() {
    const snap = await getDocs(this._col('restaurantTables'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  }

  async updateTableStatus(id, status, orderId = null) {
    await updateDoc(this._doc('restaurantTables', id), {
      status,
      currentOrderId: orderId,
    });
  }

  // ─── Caixa ─────────────────────────────────────────────────

  async openCashRegister(balance) {
    const now = new Date();
    const register = {
      date: now.toISOString().split('T')[0],
      openingBalance: balance,
      closingBalance: null,
      sales: { pix: 0, credit: 0, debit: 0, cash: 0 },
      transactions: [],
      totalOrders: 0,
      averageTicket: 0,
      openedAt: now.toISOString(),
      closedAt: null,
      status: 'open',
    };

    const docRef = await addDoc(this._col('cashRegister'), register);
    return { ...register, id: docRef.id };
  }

  async closeCashRegister(id) {
    const registerSnap = await getDoc(this._doc('cashRegister', id));
    if (!registerSnap.exists()) throw new Error('Caixa não encontrado');
    const register = registerSnap.data();

    const { sales, totalOrders, openingBalance } = register;
    const totalSales = sales.pix + sales.credit + sales.debit + sales.cash;
    const closingBalance = openingBalance + sales.cash; 

    const updates = {
      closingBalance,
      averageTicket: totalOrders > 0 ? totalSales / totalOrders : 0,
      closedAt: new Date().toISOString(),
      status: 'closed',
    };

    await updateDoc(this._doc('cashRegister', id), updates);
    return { ...register, ...updates, id };
  }

  async getCurrentCashRegister() {
    const q = query(this._col('cashRegister'), where('status', '==', 'open'));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    
    // Pega o último aberto
    const registers = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    return registers[registers.length - 1];
  }

  async updateCashRegister(id, updates) {
    await updateDoc(this._doc('cashRegister', id), updates);
  }

  async addSaleToCashRegister(paymentMethod, amount) {
    const register = await this.getCurrentCashRegister();
    if (!register) throw new Error('Nenhum caixa aberto');

    const sales = { ...register.sales };
    if (sales[paymentMethod] !== undefined) {
      sales[paymentMethod] += amount;
    }

    await updateDoc(this._doc('cashRegister', register.id), {
      sales,
      totalOrders: register.totalOrders + 1,
    });
  }

  async addTransactionToCashRegister(transaction) {
    const register = await this.getCurrentCashRegister();
    if (!register) throw new Error('Nenhum caixa aberto');

    const transactions = register.transactions || [];
    transactions.push({
      ...transaction,
      id: Date.now().toString(),
      time: new Date().toISOString()
    });

    await updateDoc(this._doc('cashRegister', register.id), { transactions });
    return transactions;
  }
}

export const store = new AppStore();
export default store;

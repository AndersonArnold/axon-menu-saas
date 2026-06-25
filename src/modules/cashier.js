// ============================================================
// Axon Menu Base — Cash Register (Caixa)
// ============================================================

import { store } from './store.js';
import { formatCurrency } from './utils.js';
import configManager from './config-manager.js';

class Cashier {
  constructor() {}

  /**
   * Abre o caixa com saldo inicial
   * @param {number} initialBalance - Saldo de abertura em R$
   * @returns {Promise<Object>} Registro do caixa criado
   */
  async openRegister(initialBalance = 0) {
    // Verifica se já há um caixa aberto
    const current = await store.getCurrentCashRegister();
    if (current) {
      throw new Error('Já existe um caixa aberto. Feche o caixa atual antes de abrir um novo.');
    }

    const register = await store.openCashRegister(initialBalance);
    return register;
  }

  /**
   * Fecha o caixa atual, calculando todos os totais
   * @returns {Promise<Object>} Registro do caixa com totais finais
   */
  async closeRegister() {
    const current = await store.getCurrentCashRegister();
    if (!current) {
      throw new Error('Nenhum caixa aberto para fechar.');
    }

    // Busca pedidos do dia para recalcular totais
    const todaysOrders = await store.getTodaysOrders();
    const validOrders = todaysOrders.filter((o) => o.status !== 'cancelled');

    // Recalcula vendas por método
    const sales = { pix: 0, credit: 0, debit: 0, cash: 0 };
    const methods = configManager.getPaymentMethods();

    for (const order of validOrders) {
      const methodId = order.paymentMethod;
      const amount = order.total || 0;
      if (!methodId) continue;
      
      const methodObj = methods.find((m) => m.id === methodId);
      const label = methodObj ? methodObj.label.toLowerCase() : String(methodId).toLowerCase();

      if (label.includes('pix')) sales.pix += amount;
      else if (label.includes('cartão') || label.includes('cartao') || label.includes('credit') || label.includes('debit')) {
        if (label.includes('débito') || label.includes('debito') || label.includes('debit')) sales.debit += amount;
        else sales.credit += amount;
      }
      else if (label.includes('dinheiro') || label.includes('cash')) sales.cash += amount;
      else sales.pix += amount; // fallback para outros
    }

    // Atualiza vendas no registro antes de fechar
    await store.db.cashRegister.update(current.id, {
      sales,
      totalOrders: validOrders.length,
    });

    // Fecha
    const closed = await store.closeCashRegister(current.id);
    return closed;
  }

  /**
   * Retorna o caixa aberto atualmente, ou null
   * @returns {Promise<Object|null>}
   */
  async getCurrentRegister() {
    return store.getCurrentCashRegister();
  }

  /**
   * Verifica se há um caixa aberto
   * @returns {Promise<boolean>}
   */
  async isRegisterOpen() {
    const current = await store.getCurrentCashRegister();
    return current !== null;
  }

  /**
   * Registra uma venda no caixa aberto
   * @param {string} paymentMethod - 'pix' | 'credit' | 'debit' | 'cash'
   * @param {number} amount
   */
  async addSale(paymentMethod, amount) {
    await store.addSaleToCashRegister(paymentMethod, amount);
  }

  /**
   * Adiciona movimentação manual
   * @param {string} type - 'in' | 'out'
   * @param {number} amount
   * @param {string} reason
   */
  async addTransaction(type, amount, reason = '') {
    await store.addTransactionToCashRegister({ type, amount, reason });
  }

  /**
   * Retorna resumo do dia atual baseado no caixa aberto e pedidos
   * @returns {Promise<Object>}
   */
  async getDailySummary() {
    const register = await store.getCurrentCashRegister();
    const todaysOrders = await store.getTodaysOrders();
    const validOrders = todaysOrders.filter((o) => o.status !== 'cancelled');

    // Calcula vendas por método a partir dos pedidos
    const salesByMethod = { pix: 0, credit: 0, debit: 0, cash: 0 };
    let totalSales = 0;
    const methods = configManager.getPaymentMethods();

    for (const order of validOrders) {
      const amount = order.total || 0;
      totalSales += amount;
      
      const methodId = order.paymentMethod;
      if (!methodId) continue;

      const methodObj = methods.find((m) => m.id === methodId);
      const label = methodObj ? methodObj.label.toLowerCase() : String(methodId).toLowerCase();

      if (label.includes('pix')) salesByMethod.pix += amount;
      else if (label.includes('cartão') || label.includes('cartao') || label.includes('credit') || label.includes('debit')) {
        if (label.includes('débito') || label.includes('debito') || label.includes('debit')) salesByMethod.debit += amount;
        else salesByMethod.credit += amount;
      }
      else if (label.includes('dinheiro') || label.includes('cash')) salesByMethod.cash += amount;
      else salesByMethod.pix += amount; // fallback para outros
    }

    const orderCount = validOrders.length;
    const averageTicket = orderCount > 0 ? totalSales / orderCount : 0;
    const openingBalance = register?.openingBalance || 0;
    
    const transactions = register?.transactions || [];
    let totalIn = 0;
    let totalOut = 0;
    for (const t of transactions) {
      if (t.type === 'in') totalIn += t.amount;
      if (t.type === 'out') totalOut += t.amount;
    }

    const expectedBalance = openingBalance + salesByMethod.cash + totalIn - totalOut; // Saldo físico

    return {
      totalSales,
      totalSalesFormatted: formatCurrency(totalSales),
      salesByMethod,
      salesByMethodFormatted: {
        pix: formatCurrency(salesByMethod.pix),
        credit: formatCurrency(salesByMethod.credit),
        debit: formatCurrency(salesByMethod.debit),
        cash: formatCurrency(salesByMethod.cash),
      },
      orderCount,
      averageTicket,
      averageTicketFormatted: formatCurrency(averageTicket),
      openingBalance,
      openingBalanceFormatted: formatCurrency(openingBalance),
      expectedBalance,
      expectedBalanceFormatted: formatCurrency(expectedBalance),
      totalIn,
      totalInFormatted: formatCurrency(totalIn),
      totalOut,
      totalOutFormatted: formatCurrency(totalOut),
      transactions,
      registerStatus: register ? 'open' : 'closed',
      openedAt: register?.openedAt || null,
    };
  }

  /**
   * Retorna histórico de fechamentos dos últimos N dias
   * @param {number} days - Número de dias (padrão 30)
   * @returns {Promise<Array>}
   */
  async getHistory(days = 30) {
    const allRegisters = await store.db.cashRegister
      .where('status')
      .equals('closed')
      .toArray();

    // Filtra por data
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const filtered = allRegisters
      .filter((r) => r.closedAt && r.closedAt >= cutoffStr)
      .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));

    return filtered.map((r) => {
      const totalSales = r.sales
        ? r.sales.pix + r.sales.credit + r.sales.debit + r.sales.cash
        : 0;

      return {
        ...r,
        totalSales,
        totalSalesFormatted: formatCurrency(totalSales),
        openingBalanceFormatted: formatCurrency(r.openingBalance || 0),
        closingBalanceFormatted: formatCurrency(r.closingBalance || 0),
        averageTicketFormatted: formatCurrency(r.averageTicket || 0),
      };
    });
  }
}

/** Singleton */
export const cashier = new Cashier();
export default cashier;

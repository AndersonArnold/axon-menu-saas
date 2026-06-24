// ============================================================
// Axon Menu Base — Order Manager
// ============================================================

import { store } from './store.js';
import { formatCurrency, formatDate, formatTime, formatDateTime } from './utils.js';

const ORDER_STATUS_FLOW = ['pending', 'preparing', 'ready', 'delivered', 'completed'];

const STATUS_LABELS = {
  pending: 'Pendente',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivered: 'Entregue',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
};

const TYPE_LABELS = {
  dineIn: 'Mesa',
  takeaway: 'Retirada',
  delivery: 'Delivery',
};

class OrderManager {
  constructor() {}

  /**
   * Cria um novo pedido
   * @param {Object} params
   * @param {string} params.type - 'dineIn' | 'takeaway' | 'delivery'
   * @param {Object} [params.customerInfo] - { name, phone, address }
   * @param {Array} params.items - Itens do carrinho
   * @param {number} params.subtotal
   * @param {number} [params.deliveryFee]
   * @param {number} params.total
   * @param {string} params.paymentMethod
   * @param {number|null} [params.tableId]
   * @returns {Promise<Object>} Pedido criado
   */
  async createOrder({ type, customerInfo, items, subtotal, deliveryFee = 0, total, paymentMethod, tableId = null, change, observation }) {
    const orderData = {
      type,
      customerInfo: customerInfo || null,
      items,
      subtotal,
      deliveryFee,
      total,
      paymentMethod,
      tableId,
      change,
      observation,
    };

    const order = await store.createOrder(orderData);

    // Se for mesa, marca como ocupada
    if (type === 'dineIn' && tableId) {
      await store.updateTableStatus(tableId, 'occupied', order.id);
    }

    // Registra venda no caixa
    try {
      await store.addSaleToCashRegister(paymentMethod, total);
    } catch {
      // Caixa pode não estar aberto — falha silenciosa
    }

    return order;
  }

  /**
   * Atualiza o status de um pedido seguindo o fluxo
   * @param {number} orderId
   * @param {string} newStatus
   * @returns {Promise<Object>} Pedido atualizado
   */
  async updateStatus(orderId, newStatus) {
    const order = await store.getOrderById(orderId);
    if (!order) throw new Error('Pedido não encontrado');

    // Valida se o status é permitido
    if (newStatus !== 'cancelled' && !ORDER_STATUS_FLOW.includes(newStatus)) {
      throw new Error(`Status inválido: ${newStatus}`);
    }

    await store.updateOrderStatus(orderId, newStatus);

    // Se finalizado e era mesa, libera a mesa
    if ((newStatus === 'completed' || newStatus === 'cancelled') && order.type === 'dineIn' && order.tableId) {
      await store.updateTableStatus(order.tableId, 'available', null);
    }

    return { ...order, status: newStatus };
  }

  /**
   * Retorna o próximo status possível para um pedido
   * @param {string} currentStatus
   * @returns {string|null}
   */
  getNextStatus(currentStatus) {
    const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === ORDER_STATUS_FLOW.length - 1) return null;
    return ORDER_STATUS_FLOW[currentIndex + 1];
  }

  /**
   * Retorna o label traduzido de um status
   * @param {string} status
   * @returns {string}
   */
  getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  /**
   * Retorna o label traduzido de um tipo de pedido
   * @param {string} type
   * @returns {string}
   */
  getTypeLabel(type) {
    return TYPE_LABELS[type] || type;
  }

  /**
   * Retorna pedidos de hoje, opcionalmente filtrados por status
   * @param {string} [filterStatus]
   * @returns {Promise<Array>}
   */
  async getTodaysOrders(filterStatus) {
    let orders = await store.getTodaysOrders();
    if (filterStatus) {
      orders = orders.filter((o) => o.status === filterStatus);
    }
    // Ordena por mais recente primeiro
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Busca um pedido pelo ID
   * @param {number} id
   * @returns {Promise<Object|undefined>}
   */
  async getOrderById(id) {
    return store.getOrderById(id);
  }

  /**
   * Cancela um pedido
   * @param {number} orderId
   * @returns {Promise<Object>}
   */
  async cancelOrder(orderId) {
    return this.updateStatus(orderId, 'cancelled');
  }

  /**
   * Gera dados formatados para impressão do ticket
   * @param {Object} order
   * @returns {Object}
   */
  generateTicketData(order) {
    const createdAt = new Date(order.createdAt);

    const itemLines = (order.items || []).map((item) => {
      const extras =
        item.extras && item.extras.length
          ? item.extras.map((e) => `  + ${e.name} (${formatCurrency(e.price)})`).join('\n')
          : '';
      const obs = item.observation ? `  Obs: ${item.observation}` : '';
      return {
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.totalPrice,
        extras,
        observation: obs,
        formattedLine: `${item.quantity}x ${item.name} ${formatCurrency(item.totalPrice)}`,
      };
    });

    return {
      orderNumber: order.orderNumber,
      date: formatDate(createdAt),
      time: formatTime(createdAt),
      dateTime: formatDateTime(createdAt),
      type: TYPE_LABELS[order.type] || order.type,
      observation: order.observation || null,
      tableId: order.tableId,
      tableLabel: order.tableId ? `Mesa ${String(order.tableId).padStart(2, '0')}` : null,
      customerName: order.customerInfo?.name || null,
      customerPhone: order.customerInfo?.phone || null,
      customerAddress: order.customerInfo?.address || null,
      items: itemLines,
      subtotal: order.subtotal,
      subtotalFormatted: formatCurrency(order.subtotal),
      deliveryFee: order.deliveryFee || 0,
      deliveryFeeFormatted: formatCurrency(order.deliveryFee || 0),
      total: order.total,
      totalFormatted: formatCurrency(order.total),
      paymentMethod: order.paymentMethod,
      paymentMethodLabel: this._getPaymentLabel(order.paymentMethod),
      status: STATUS_LABELS[order.status] || order.status,
    };
  }

  /**
   * Label do método de pagamento
   * @param {string} method
   * @returns {string}
   */
  _getPaymentLabel(method) {
    const labels = {
      pix: 'PIX',
      credit: 'Cartão de Crédito',
      debit: 'Cartão de Débito',
      cash: 'Dinheiro',
    };
    return labels[method] || method;
  }

  /**
   * Retorna resumo diário de vendas
   * @returns {Promise<Object>}
   */
  async getDailySummary() {
    const orders = await store.getTodaysOrders();
    const validOrders = orders.filter((o) => o.status !== 'cancelled');

    const byPaymentMethod = { pix: 0, credit: 0, debit: 0, cash: 0 };

    let totalRevenue = 0;
    for (const order of validOrders) {
      totalRevenue += order.total || 0;
      const method = order.paymentMethod;
      if (byPaymentMethod[method] !== undefined) {
        byPaymentMethod[method] += order.total || 0;
      }
    }

    return {
      totalOrders: validOrders.length,
      totalRevenue,
      totalRevenueFormatted: formatCurrency(totalRevenue),
      byPaymentMethod,
      byPaymentMethodFormatted: {
        pix: formatCurrency(byPaymentMethod.pix),
        credit: formatCurrency(byPaymentMethod.credit),
        debit: formatCurrency(byPaymentMethod.debit),
        cash: formatCurrency(byPaymentMethod.cash),
      },
      averageTicket: validOrders.length > 0 ? totalRevenue / validOrders.length : 0,
      averageTicketFormatted: formatCurrency(
        validOrders.length > 0 ? totalRevenue / validOrders.length : 0
      ),
    };
  }
}

/** Singleton */
export const orderManager = new OrderManager();
export default orderManager;

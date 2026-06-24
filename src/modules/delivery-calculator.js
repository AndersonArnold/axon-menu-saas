// ============================================================
// Axon Menu Base — Delivery Calculator
// ============================================================

import { formatCurrency } from './utils.js';

class DeliveryCalculator {
  constructor() {
    /** @type {Array} */
    this._zones = [];
    /** @type {number} */
    this._minimumOrder = 0;
  }

  /**
   * Inicializa com dados de delivery do config
   * @param {Object} deliveryConfig - { zones: Array, minimumOrder: number }
   */
  init(deliveryConfig) {
    if (!deliveryConfig) return;
    this._zones = deliveryConfig.zones || [];
    this._minimumOrder = deliveryConfig.minimumOrder || 0;
  }

  /**
   * Retorna as zonas de entrega disponíveis
   * @returns {Array<{ id: string, name: string, fee: number }>}
   */
  getZones() {
    return [...this._zones];
  }

  /**
   * Calcula a taxa de entrega para uma zona
   * @param {string} zoneId
   * @returns {number} Taxa de entrega em reais, ou 0 se zona não encontrada
   */
  calculateFee(zoneId) {
    const zone = this._zones.find((z) => z.id === zoneId);
    return zone ? zone.fee : 0;
  }

  /**
   * Retorna o valor mínimo do pedido para delivery
   * @returns {number}
   */
  getMinimumOrder() {
    return this._minimumOrder;
  }

  /**
   * Valida se o pedido atende os requisitos de delivery
   * @param {number} subtotal - Subtotal do pedido
   * @param {string} zoneId - ID da zona de entrega
   * @returns {{ valid: boolean, message: string, fee: number }}
   */
  validateDeliveryOrder(subtotal, zoneId) {
    const zone = this._zones.find((z) => z.id === zoneId);

    if (!zone) {
      return {
        valid: false,
        message: 'Selecione uma região de entrega.',
        fee: 0,
      };
    }

    if (subtotal < this._minimumOrder) {
      const diff = this._minimumOrder - subtotal;
      return {
        valid: false,
        message: `Pedido mínimo para delivery: ${formatCurrency(this._minimumOrder)}. Faltam ${formatCurrency(diff)}.`,
        fee: zone.fee,
      };
    }

    return {
      valid: true,
      message: `Taxa de entrega (${zone.name}): ${formatCurrency(zone.fee)}`,
      fee: zone.fee,
    };
  }
}

/** Singleton */
export const deliveryCalculator = new DeliveryCalculator();
export default deliveryCalculator;

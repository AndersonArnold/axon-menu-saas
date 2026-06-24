// ============================================================
// Axon Menu Base — Bluetooth & Browser Printer
// ============================================================

import { formatCurrency, sanitizeHTML } from './utils.js';

// ESC/POS Command Constants
const ESC = 0x1B;
const GS = 0x1D;

const ESCPOS = {
  INIT: [ESC, 0x40],                             // Inicializa impressora
  BOLD_ON: [ESC, 0x45, 0x01],                    // Negrito ligado
  BOLD_OFF: [ESC, 0x45, 0x00],                   // Negrito desligado
  ALIGN_LEFT: [ESC, 0x61, 0x00],                 // Alinhamento esquerda
  ALIGN_CENTER: [ESC, 0x61, 0x01],               // Alinhamento centro
  ALIGN_RIGHT: [ESC, 0x61, 0x02],                // Alinhamento direita
  FONT_NORMAL: [ESC, 0x21, 0x00],                // Fonte normal
  FONT_DOUBLE_HEIGHT: [ESC, 0x21, 0x10],         // Fonte dobro altura
  FONT_DOUBLE_WIDTH: [ESC, 0x21, 0x20],          // Fonte dobro largura
  FONT_DOUBLE: [ESC, 0x21, 0x30],                // Fonte dobro ambos
  CUT: [GS, 0x56, 0x00],                         // Corte total
  PARTIAL_CUT: [GS, 0x56, 0x01],                 // Corte parcial
  FEED_LINE: [0x0A],                              // Linha em branco
  FEED_3_LINES: [ESC, 0x64, 0x03],               // 3 linhas em branco
};

// Bluetooth Printer Service UUIDs (padrão para impressoras térmicas)
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

class Printer {
  constructor() {
    /** @type {BluetoothDevice|null} */
    this._device = null;
    /** @type {BluetoothRemoteGATTCharacteristic|null} */
    this._characteristic = null;
    this._connected = false;
    this._deviceName = '';
  }

  // ─── Bluetooth ───────────────────────────────────────────

  /**
   * Conecta a uma impressora Bluetooth via Web Bluetooth API
   * @returns {Promise<{ connected: boolean, deviceName: string }>}
   */
  async connectBluetooth() {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth não suportado neste navegador.');
      }

      // Solicita dispositivo ao usuário
      this._device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [PRINTER_SERVICE_UUID] }],
        optionalServices: [PRINTER_SERVICE_UUID],
      }).catch(() => {
        // Tenta busca mais ampla se o UUID específico não funcionar
        return navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [PRINTER_SERVICE_UUID],
        });
      });

      if (!this._device) {
        return { connected: false, deviceName: '' };
      }

      this._deviceName = this._device.name || 'Impressora';

      // Listener de desconexão
      this._device.addEventListener('gattserverdisconnected', () => {
        this._connected = false;
        this._characteristic = null;
        console.log('[Printer] Impressora desconectada');
      });

      // Conecta ao GATT server
      const server = await this._device.gatt.connect();
      const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
      this._characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID);
      this._connected = true;

      console.log(`[Printer] Conectada: ${this._deviceName}`);
      return { connected: true, deviceName: this._deviceName };
    } catch (error) {
      console.error('[Printer] Erro ao conectar Bluetooth:', error);
      this._connected = false;
      return { connected: false, deviceName: '', error: error.message };
    }
  }

  /**
   * Desconecta a impressora Bluetooth
   */
  async disconnectBluetooth() {
    if (this._device && this._device.gatt.connected) {
      this._device.gatt.disconnect();
    }
    this._connected = false;
    this._characteristic = null;
    this._device = null;
    this._deviceName = '';
  }

  /**
   * Verifica se a impressora está conectada
   * @returns {boolean}
   */
  isConnected() {
    return this._connected && this._characteristic !== null;
  }

  /**
   * Envia bytes para a impressora Bluetooth em chunks
   * @param {Uint8Array} data
   */
  async _sendData(data) {
    if (!this._characteristic) {
      throw new Error('Impressora não conectada');
    }

    // Envia em chunks de 512 bytes (limite BLE)
    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this._characteristic.writeValue(chunk);
      // Pequeno delay entre chunks para estabilidade
      if (i + chunkSize < data.length) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  /**
   * Converte texto para bytes com encoding latin1
   * @param {string} text
   * @returns {number[]}
   */
  _textToBytes(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);
      // Mapeia caracteres acentuados comuns para Code Page 860 (Português)
      if (code > 127) {
        const map = {
          0xE7: 0x87, // ç
          0xC7: 0x80, // Ç
          0xE3: 0x84, // ã
          0xC3: 0xB6, // Ã
          0xE1: 0xA0, // á
          0xC1: 0xB5, // Á
          0xE9: 0x82, // é
          0xC9: 0x90, // É
          0xED: 0xA1, // í
          0xCD: 0xD6, // Í
          0xF3: 0xA2, // ó
          0xD3: 0xE0, // Ó
          0xFA: 0xA3, // ú
          0xDA: 0xE9, // Ú
          0xF4: 0x93, // ô
          0xD4: 0xE3, // Ô
          0xEA: 0x88, // ê
          0xCA: 0xD2, // Ê
          0xE2: 0x83, // â
          0xC2: 0xB6, // Â
          0xF5: 0x94, // õ
          0xD5: 0xE4, // Õ
        };
        code = map[code] || 0x3F; // ? para caracteres desconhecidos
      }
      bytes.push(code);
    }
    return bytes;
  }

  /**
   * Cria uma linha divisória
   * @param {number} width - Largura em caracteres (padrão 48 para 80mm)
   * @returns {number[]}
   */
  _divider(width = 48) {
    return this._textToBytes('-'.repeat(width) + '\n');
  }

  /**
   * Formata uma linha com texto à esquerda e à direita
   * @param {string} left
   * @param {string} right
   * @param {number} width
   * @returns {string}
   */
  _formatLine(left, right, width = 48) {
    const spaces = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  }

  /**
   * Imprime o ticket do pedido
   * Se conectada via Bluetooth, usa ESC/POS. Senão, fallback para window.print()
   * @param {Object} orderData - Dados do ticket (de generateTicketData)
   */
  async printTicket(orderData) {
    if (this.isConnected()) {
      await this._printViaBluetooth(orderData);
    } else {
      const html = this.formatTicketHTML(orderData);
      this.printViaBrowser(html);
    }
  }

  /**
   * Imprime via Bluetooth usando ESC/POS
   * @param {Object} data - Dados do ticket
   */
  async _printViaBluetooth(data) {
    const bytes = [];
    const push = (...arrs) => arrs.forEach((a) => bytes.push(...a));

    // Inicializa
    push(ESCPOS.INIT);

    // Cabeçalho - Nome da loja
    push(ESCPOS.ALIGN_CENTER, ESCPOS.BOLD_ON, ESCPOS.FONT_DOUBLE);
    push(this._textToBytes(data.storeName || 'AXON MENU'));
    push(ESCPOS.FEED_LINE);
    push(ESCPOS.FONT_NORMAL, ESCPOS.BOLD_OFF);

    if (data.storeAddress) {
      push(this._textToBytes(data.storeAddress));
      push(ESCPOS.FEED_LINE);
    }

    push(this._divider());

    // Número do pedido
    push(ESCPOS.BOLD_ON, ESCPOS.FONT_DOUBLE_HEIGHT);
    push(this._textToBytes(`PEDIDO ${data.orderNumber}`));
    push(ESCPOS.FEED_LINE);
    push(ESCPOS.FONT_NORMAL, ESCPOS.BOLD_OFF);

    // Tipo e data
    push(this._textToBytes(`${data.type}  ${data.dateTime}`));
    push(ESCPOS.FEED_LINE);

    // Mesa ou cliente
    if (data.tableLabel) {
      push(ESCPOS.BOLD_ON);
      push(this._textToBytes(data.tableLabel));
      push(ESCPOS.FEED_LINE);
      push(ESCPOS.BOLD_OFF);
    }

    if (data.customerName) {
      push(this._textToBytes(`Cliente: ${data.customerName}`));
      push(ESCPOS.FEED_LINE);
    }
    if (data.customerPhone) {
      push(this._textToBytes(`Tel: ${data.customerPhone}`));
      push(ESCPOS.FEED_LINE);
    }
    if (data.customerAddress) {
      push(this._textToBytes(`End: ${data.customerAddress}`));
      push(ESCPOS.FEED_LINE);
    }

    push(this._divider());

    // Itens
    push(ESCPOS.ALIGN_LEFT);
    for (const item of data.items) {
      push(ESCPOS.BOLD_ON);
      push(this._textToBytes(this._formatLine(
        `${item.quantity}x ${item.name}`,
        formatCurrency(item.totalPrice)
      )));
      push(ESCPOS.FEED_LINE);
      push(ESCPOS.BOLD_OFF);

      if (item.extras) {
        push(this._textToBytes(item.extras));
        push(ESCPOS.FEED_LINE);
      }
      if (item.observation) {
        push(this._textToBytes(item.observation));
        push(ESCPOS.FEED_LINE);
      }
    }

    push(this._divider());

    // Totais
    push(ESCPOS.ALIGN_LEFT);
    push(this._textToBytes(this._formatLine('Subtotal:', data.subtotalFormatted)));
    push(ESCPOS.FEED_LINE);

    if (data.deliveryFee > 0) {
      push(this._textToBytes(this._formatLine('Taxa de entrega:', data.deliveryFeeFormatted)));
      push(ESCPOS.FEED_LINE);
    }

    push(ESCPOS.BOLD_ON, ESCPOS.FONT_DOUBLE_HEIGHT);
    push(this._textToBytes(this._formatLine('TOTAL:', data.totalFormatted)));
    push(ESCPOS.FEED_LINE);
    push(ESCPOS.FONT_NORMAL, ESCPOS.BOLD_OFF);

    // Pagamento
    push(this._divider());
    push(ESCPOS.ALIGN_CENTER);
    push(this._textToBytes(`Pagamento: ${data.paymentMethodLabel}`));
    push(ESCPOS.FEED_LINE, ESCPOS.FEED_LINE);

    push(this._textToBytes('Obrigado pela preferencia!'));
    push(ESCPOS.FEED_3_LINES);

    // Corte
    push(ESCPOS.PARTIAL_CUT);

    await this._sendData(new Uint8Array(bytes));
  }

  /**
   * Gera HTML formatado do ticket para impressão via navegador
   * @param {Object} data - Dados do ticket
   * @returns {string}
   */
  formatTicketHTML(data) {
    const itemsHTML = (data.items || []).map((item) => {
      let extrasHTML = '';
      if (item.extras) {
        extrasHTML = `<div class="ticket-item-extras">${sanitizeHTML(item.extras)}</div>`;
      }
      let obsHTML = '';
      if (item.observation) {
        obsHTML = `<div class="ticket-item-obs">${sanitizeHTML(item.observation)}</div>`;
      }
      return `
        <div class="ticket-item">
          <div class="ticket-item-main">
            <span class="ticket-item-name">${item.quantity}x ${sanitizeHTML(item.name)}</span>
            <span class="ticket-item-price">${formatCurrency(item.totalPrice)}</span>
          </div>
          ${extrasHTML}
          ${obsHTML}
        </div>
      `;
    }).join('');

    const deliveryHTML = data.deliveryFee > 0
      ? `<div class="ticket-line">
          <span>Taxa de entrega</span>
          <span>${data.deliveryFeeFormatted}</span>
        </div>`
      : '';

    const customerHTML = data.customerName
      ? `<div class="ticket-customer">
          <p>${sanitizeHTML(data.customerName)}</p>
          ${data.customerPhone ? `<p>${sanitizeHTML(data.customerPhone)}</p>` : ''}
          ${data.customerAddress ? `<p>${sanitizeHTML(data.customerAddress)}</p>` : ''}
        </div>`
      : '';

    const tableHTML = data.tableLabel
      ? `<div class="ticket-table">${sanitizeHTML(data.tableLabel)}</div>`
      : '';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Pedido ${sanitizeHTML(data.orderNumber)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            margin: 0 auto;
            padding: 8px;
            color: #000;
            background: #fff;
          }
          .ticket-header {
            text-align: center;
            padding-bottom: 8px;
            border-bottom: 2px dashed #000;
            margin-bottom: 8px;
          }
          .ticket-store-name {
            font-size: 18px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .ticket-store-address {
            font-size: 10px;
            margin-top: 2px;
            color: #555;
          }
          .ticket-order-number {
            text-align: center;
            font-size: 22px;
            font-weight: 700;
            padding: 8px 0;
            border-bottom: 1px dashed #000;
            margin-bottom: 8px;
          }
          .ticket-meta {
            text-align: center;
            font-size: 11px;
            margin-bottom: 4px;
          }
          .ticket-table {
            text-align: center;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .ticket-customer {
            text-align: center;
            font-size: 11px;
            margin-bottom: 8px;
          }
          .ticket-divider {
            border: none;
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .ticket-item {
            margin-bottom: 6px;
          }
          .ticket-item-main {
            display: flex;
            justify-content: space-between;
            font-weight: 600;
          }
          .ticket-item-extras,
          .ticket-item-obs {
            font-size: 10px;
            color: #555;
            padding-left: 16px;
            white-space: pre-line;
          }
          .ticket-totals {
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 8px;
          }
          .ticket-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .ticket-total {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            font-weight: 700;
            border-top: 2px solid #000;
            padding-top: 6px;
            margin-top: 4px;
          }
          .ticket-payment {
            text-align: center;
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 8px;
            font-size: 11px;
          }
          .ticket-footer {
            text-align: center;
            margin-top: 12px;
            font-size: 11px;
            color: #555;
          }
          @media print {
            body { width: 80mm; margin: 0; padding: 4px; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="ticket-header">
          <div class="ticket-store-name">${sanitizeHTML(data.storeName || 'Axon Menu')}</div>
          ${data.storeAddress ? `<div class="ticket-store-address">${sanitizeHTML(data.storeAddress)}</div>` : ''}
        </div>

        <div class="ticket-order-number">PEDIDO ${sanitizeHTML(data.orderNumber)}</div>
        <div class="ticket-meta">${sanitizeHTML(data.type)} • ${sanitizeHTML(data.dateTime)}</div>
        ${tableHTML}
        ${customerHTML}

        <hr class="ticket-divider">

        <div class="ticket-items">
          ${itemsHTML}
        </div>

        <div class="ticket-totals">
          <div class="ticket-line">
            <span>Subtotal</span>
            <span>${data.subtotalFormatted}</span>
          </div>
          ${deliveryHTML}
          <div class="ticket-total">
            <span>TOTAL</span>
            <span>${data.totalFormatted}</span>
          </div>
        </div>

        <div class="ticket-payment">
          Pagamento: <strong>${sanitizeHTML(data.paymentMethodLabel)}</strong>
        </div>

        <div class="ticket-footer">
          Obrigado pela preferência! 🧡
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Abre a janela de impressão do navegador com o ticket HTML
   * @param {string} html
   */
  printViaBrowser(html) {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
      // Popup bloqueado — fallback com iframe oculto
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '80mm';
      iframe.style.height = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Aguarda carregar fontes e então imprime
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 500);
  }
}

/** Singleton */
export const printer = new Printer();
export default printer;

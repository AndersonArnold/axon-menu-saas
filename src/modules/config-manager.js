// ============================================================
// Axon Menu Base — Config Manager
// ============================================================

import { store } from './store.js';

class ConfigManager {
  constructor() {
    /** @type {Object|null} Configuração em memória */
    this._config = null;
    this._loaded = false;
  }

  /**
   * Carrega o config.json do servidor, armazena em memória e no IndexedDB
   * @returns {Promise<Object>}
   */
  async loadConfig() {
    try {
      let defaultConfig = null;
      try {
        const response = await fetch('/config.json');
        if (response.ok) {
          defaultConfig = await response.json();
        }
      } catch (e) {
        console.warn('[ConfigManager] config.json não encontrado ou erro de rede, seguindo em frente...');
      }

      // Inicializa o store com os dados do config (só semeia se o banco estiver vazio)
      await store.init(defaultConfig);

      // Lê sempre do IndexedDB como fonte da verdade
      const theme = await store.getConfig('theme');
      const storeInfo = await store.getConfig('store');
      const schedule = await store.getConfig('schedule');
      const delivery = await store.getConfig('delivery');
      const payment = await store.getConfig('payment');
      const orderTypes = await store.getConfig('orderTypes');
      const admin = await store.getConfig('admin');
      const printer = await store.getConfig('printer');
      const tables = await store.getConfig('tables');

      this._config = {
        store: storeInfo || defaultConfig?.store,
        schedule: schedule || defaultConfig?.schedule,
        delivery: delivery || defaultConfig?.delivery,
        payment: payment || defaultConfig?.payment,
        orderTypes: orderTypes || defaultConfig?.orderTypes,
        theme: theme || defaultConfig?.theme,
        admin: admin || defaultConfig?.admin,
        printer: printer || defaultConfig?.printer,
        tables: tables || defaultConfig?.tables,
      };

      this._loaded = true;

      // Aplica o tema automaticamente
      if (this._config.theme) {
        this.applyTheme(this._config.theme);
      }

      return this._config;
    } catch (error) {
      console.error('[ConfigManager] Erro fatal ao inicializar configs:', error);
      throw error;
    }
  }

  /**
   * Retorna o objeto de configuração atual
   * @returns {Object|null}
   */
  getConfig() {
    return this._config;
  }

  /**
   * Atualiza uma seção da configuração
   * @param {string} section - Nome da seção (ex: 'store', 'schedule')
   * @param {Object} data - Novos dados para a seção
   */
  async updateConfig(section, data) {
    if (this._config) {
      this._config[section] = { ...this._config[section], ...data };
    }
    await store.setConfig(section, this._config?.[section] || data);
  }

  /**
   * Aplica as variáveis CSS do tema no :root do documento
   * @param {Object} theme - Objeto do tema com cores e fontes
   */
  applyTheme(theme) {
    if (!theme) return;

    const root = document.documentElement;
    const cssVarMap = {
      primaryColor: '--primary',
      secondaryColor: '--secondary',
      accentColor: '--accent',
      surfaceColor: '--surface',
      surfaceLightColor: '--surface-light',
      textColor: '--text',
      textMutedColor: '--text-muted',
      successColor: '--success',
      warningColor: '--warning',
      dangerColor: '--danger',
      infoColor: '--info',
      fontFamily: '--font-family',
      borderRadius: '--radius',
    };

    for (const [key, cssVar] of Object.entries(cssVarMap)) {
      if (theme[key] !== undefined && theme[key] !== null) {
        const value =
          key === 'fontFamily'
            ? `'${theme[key]}', sans-serif`
            : theme[key];
        root.style.setProperty(cssVar, value);
      }
    }

    // Variáveis derivadas para glassmorphism
    if (theme.surfaceColor) {
      root.style.setProperty(
        '--glass-bg',
        `${theme.surfaceColor}CC`
      );
      root.style.setProperty(
        '--glass-bg-light',
        `${theme.surfaceLightColor || theme.surfaceColor}BB`
      );
    }
    if (theme.primaryColor) {
      root.style.setProperty(
        '--primary-glow',
        `${theme.primaryColor}33`
      );
    }
  }

  /**
   * Retorna informações da loja (nome, endereço, etc.)
   * @returns {Object|null}
   */
  getStoreInfo() {
    return this._config?.store || null;
  }

  /**
   * Retorna configuração de horários
   * @returns {Object|null}
   */
  getSchedule() {
    return this._config?.schedule || null;
  }

  /**
   * Retorna zonas de entrega
   * @returns {Array}
   */
  getDeliveryZones() {
    return this._config?.delivery?.zones || [];
  }

  /**
   * Retorna métodos de pagamento habilitados
   * @returns {Array}
   */
  getPaymentMethods() {
    const methods = this._config?.payment?.methods || [];
    return methods.filter((m) => m.enabled !== false);
  }

  /**
   * Retorna configuração do layout de mesas
   * @returns {Array}
   */
  getTableLayout() {
    return this._config?.tables?.layout || [];
  }

  /**
   * Retorna configuração de tipos de pedido
   * @returns {Object}
   */
  getOrderTypes() {
    return this._config?.orderTypes || {};
  }

  /**
   * Retorna configuração da impressora
   * @returns {Object|null}
   */
  getPrinterConfig() {
    return this._config?.printer || null;
  }
}

/** Singleton */
export const configManager = new ConfigManager();
export default configManager;

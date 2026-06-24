// ============================================================
// Axon Menu Base — Schedule Manager
// ============================================================

import { parseTime } from './utils.js';

const DAY_MAP = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

const DAY_LABELS = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const DAY_SHORT_LABELS = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

class ScheduleManager {
  constructor() {
    /** @type {Object|null} */
    this._schedule = null;
    /** @type {number|null} */
    this._monitorInterval = null;
    /** @type {boolean|null} */
    this._lastOpenState = null;
  }

  /**
   * Inicializa com dados de horário do config
   * @param {Object} schedule
   */
  init(schedule) {
    this._schedule = schedule;
  }

  /**
   * Retorna o nome do dia da semana em inglês (key do config)
   * @param {number} dayIndex - 0=domingo, 1=segunda...
   * @returns {string}
   */
  getDayName(dayIndex) {
    return DAY_MAP[dayIndex] || 'monday';
  }

  /**
   * Converte hora string 'HH:MM' para minutos desde meia-noite
   * @param {string} timeStr
   * @returns {number}
   */
  _timeToMinutes(timeStr) {
    const { hours, minutes } = parseTime(timeStr);
    return hours * 60 + minutes;
  }

  /**
   * Retorna minutos atuais desde meia-noite
   * @returns {number}
   */
  _currentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /**
   * Verifica se a loja está aberta agora
   * @returns {{ open: boolean, nextChange: string, message: string }}
   */
  isOpen() {
    if (!this._schedule) {
      return { open: true, nextChange: '', message: 'Horário não configurado' };
    }

    const now = new Date();
    const dayKey = this.getDayName(now.getDay());
    const dayConfig = this._schedule[dayKey];

    // Dia desabilitado
    if (!dayConfig || !dayConfig.enabled) {
      const nextOpen = this._getNextOpenInfo();
      return {
        open: false,
        nextChange: nextOpen.time,
        message: `Fechado hoje. ${nextOpen.message}`,
      };
    }

    const currentMin = this._currentMinutes();
    const openMin = this._timeToMinutes(dayConfig.open);
    const closeMin = this._timeToMinutes(dayConfig.close);

    // Horário cruzando meia-noite (ex: 18:00 - 02:00)
    if (closeMin < openMin) {
      const isOpen = currentMin >= openMin || currentMin < closeMin;
      if (isOpen) {
        const closeTime = dayConfig.close;
        return {
          open: true,
          nextChange: closeTime,
          message: `Aberto até ${closeTime}`,
        };
      }
      return {
        open: false,
        nextChange: dayConfig.open,
        message: `Fechado. Abrimos às ${dayConfig.open}`,
      };
    }

    // Horário normal
    if (currentMin >= openMin && currentMin < closeMin) {
      return {
        open: true,
        nextChange: dayConfig.close,
        message: `Aberto até ${dayConfig.close}`,
      };
    }

    // Ainda não abriu hoje
    if (currentMin < openMin) {
      return {
        open: false,
        nextChange: dayConfig.open,
        message: `Fechado. Abrimos às ${dayConfig.open}`,
      };
    }

    // Já fechou hoje
    const nextOpen = this._getNextOpenInfo();
    return {
      open: false,
      nextChange: nextOpen.time,
      message: `Fechado. ${nextOpen.message}`,
    };
  }

  /**
   * Informação interna sobre quando abre próxima vez
   * @returns {{ time: string, message: string }}
   */
  _getNextOpenInfo() {
    if (!this._schedule) {
      return { time: '', message: '' };
    }

    const now = new Date();
    const currentDayIndex = now.getDay();

    // Busca nos próximos 7 dias
    for (let offset = 1; offset <= 7; offset++) {
      const dayIndex = (currentDayIndex + offset) % 7;
      const dayKey = this.getDayName(dayIndex);
      const dayConfig = this._schedule[dayKey];

      if (dayConfig && dayConfig.enabled) {
        const dayLabel = DAY_LABELS[dayKey];
        if (offset === 1) {
          return {
            time: dayConfig.open,
            message: `Abrimos amanhã (${dayLabel}) às ${dayConfig.open}`,
          };
        }
        return {
          time: dayConfig.open,
          message: `Abrimos ${dayLabel} às ${dayConfig.open}`,
        };
      }
    }

    return { time: '', message: 'Sem horário de abertura definido' };
  }

  /**
   * Se está fechado, retorna quando abre próxima vez
   * @returns {string|null}
   */
  getNextOpenTime() {
    const status = this.isOpen();
    if (status.open) return null;
    return status.nextChange;
  }

  /**
   * Retorna o horário formatado para exibição no cardápio
   * @returns {string[]} Array de strings com o horário de cada dia/grupo
   */
  getScheduleDisplay() {
    if (!this._schedule) return { nextOpen: null, schedule: null };

    const status = this.isOpen();
    const nextOpenInfo = !status.open ? this._getNextOpenInfo() : null;

    return {
      nextOpen: nextOpenInfo?.message || null,
      schedule: this._schedule,
    };
  }

  /**
   * Formata um grupo de dias com mesmo horário
   * @param {string} startDay
   * @param {string} endDay
   * @param {string} timeKey - "HH:MM-HH:MM"
   * @returns {string}
   */
  _formatScheduleGroup(startDay, endDay, timeKey) {
    const [open, close] = timeKey.split('-');
    const label =
      startDay === endDay
        ? DAY_SHORT_LABELS[startDay]
        : `${DAY_SHORT_LABELS[startDay]}-${DAY_SHORT_LABELS[endDay]}`;
    return `${label}: ${open} - ${close}`;
  }

  /**
   * Inicia monitoramento periódico do status (aberto/fechado)
   * @param {Function} callback - Recebe { open, message } quando status muda
   */
  startMonitoring(callback) {
    this.stopMonitoring();

    // Verifica estado inicial
    const initial = this.isOpen();
    this._lastOpenState = initial.open;
    callback(initial);

    this._monitorInterval = setInterval(() => {
      const status = this.isOpen();
      if (status.open !== this._lastOpenState) {
        this._lastOpenState = status.open;
        callback(status);
      }
    }, 30000); // 30 segundos
  }

  /**
   * Para o monitoramento
   */
  stopMonitoring() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
  }
}

/** Singleton */
export const scheduleManager = new ScheduleManager();
export default scheduleManager;

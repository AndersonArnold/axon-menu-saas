// ============================================================
// Axon Menu Base — Utility Functions
// ============================================================

/**
 * Formata um valor numérico para moeda BRL (R$ 25,90)
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formata uma data para DD/MM/YYYY
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--/--/----';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata uma data para HH:MM
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--:--';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formata uma data para DD/MM/YYYY HH:MM
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Gera um ID único usando crypto.randomUUID com fallback
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: gera um UUID v4 simples
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Debounce — atrasa a execução até que a chamada pare por `ms` milissegundos
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── Toast Notification ────────────────────────────────────

let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;

  toastContainer = document.createElement('div');
  toastContainer.id = 'axon-toast-container';
  Object.assign(toastContainer.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '10000',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    pointerEvents: 'none',
    maxWidth: '380px',
    width: '100%',
  });
  document.body.appendChild(toastContainer);
  return toastContainer;
}

const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const TOAST_COLORS = {
  success: '#06D6A0',
  error: '#EF476F',
  warning: '#FFD166',
  info: '#118AB2',
};

/**
 * Mostra uma notificação toast
 * @param {string} message - Texto da notificação
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - Duração em ms (padrão 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = ensureToastContainer();
  const color = TOAST_COLORS[type] || TOAST_COLORS.info;
  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

  const toast = document.createElement('div');
  toast.className = 'axon-toast';
  Object.assign(toast.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    borderRadius: '12px',
    background: 'rgba(26, 26, 46, 0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: `1px solid ${color}33`,
    borderLeft: `4px solid ${color}`,
    color: '#EAEAEA',
    fontFamily: "'Inter', sans-serif",
    fontSize: '14px',
    lineHeight: '1.4',
    boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)`,
    pointerEvents: 'auto',
    transform: 'translateX(120%)',
    opacity: '0',
    transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
    cursor: 'pointer',
    maxWidth: '100%',
    wordBreak: 'break-word',
  });

  const iconSpan = document.createElement('span');
  Object.assign(iconSpan.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: `${color}22`,
    color: color,
    fontSize: '14px',
    fontWeight: '700',
    flexShrink: '0',
  });
  iconSpan.textContent = icon;

  const textSpan = document.createElement('span');
  textSpan.style.flex = '1';
  textSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });
  });

  const dismiss = () => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  };

  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

// ─── Audio ─────────────────────────────────────────────────

let audioCtx = null;

/**
 * Toca um som de bip curto para alertas de novos pedidos
 */
export function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Primeiro bip
    const play = (freq, startTime, dur) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + dur);
      osc.start(startTime);
      osc.stop(startTime + dur);
    };

    const now = audioCtx.currentTime;
    play(880, now, 0.12);        // A5
    play(1108.73, now + 0.14, 0.12); // C#6
    play(1318.51, now + 0.28, 0.18); // E6
  } catch {
    // Audio indisponível — falha silenciosa
  }
}

// ─── HTML / Text ───────────────────────────────────────────

/**
 * Escapa caracteres especiais de HTML para prevenção de XSS
 * @param {string} str
 * @returns {string}
 */
export function sanitizeHTML(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Trunca texto com reticências
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateText(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

// ─── Time / Date ───────────────────────────────────────────

/**
 * Converte string 'HH:MM' em objeto { hours, minutes }
 * @param {string} timeStr
 * @returns {{ hours: number, minutes: number }}
 */
export function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return { hours: 0, minutes: 0 };
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0], 10) || 0,
    minutes: parseInt(parts[1], 10) || 0,
  };
}

/**
 * Verifica se uma data corresponde ao dia de hoje
 * @param {Date|string|number} date
 * @returns {boolean}
 */
export function isToday(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// ─── DOM Helpers ───────────────────────────────────────────

/**
 * Cria um elemento DOM com classes, atributos e filhos
 * @param {string} tag - Nome da tag HTML
 * @param {string|string[]} [classes] - Classe(s) CSS
 * @param {Object} [attributes] - Atributos do elemento (key-value)
 * @param {(string|Node)[]} [children] - Filhos (texto ou elementos)
 * @returns {HTMLElement}
 */
export function createElement(tag, classes = [], attributes = {}, children = []) {
  const el = document.createElement(tag);

  // Classes
  if (classes) {
    const classList = Array.isArray(classes) ? classes : classes.split(' ');
    classList.filter(Boolean).forEach((c) => el.classList.add(c));
  }

  // Atributos
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.assign(el.dataset, value);
      } else if (key === 'innerHTML') {
        el.innerHTML = value;
      } else if (key === 'textContent') {
        el.textContent = value;
      } else {
        el.setAttribute(key, value);
      }
    }
  }

  // Filhos
  if (children) {
    const childArray = Array.isArray(children) ? children : [children];
    childArray.forEach((child) => {
      if (child == null) return;
      if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(String(child)));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    });
  }

  return el;
}

/**
 * Adiciona uma classe de animação a um elemento e a remove após a conclusão
 * @param {HTMLElement} element
 * @param {string} animation - Nome da classe de animação CSS
 * @param {number} duration - Duração em ms (padrão 400)
 * @returns {Promise<void>}
 */
export function animateElement(element, animation, duration = 400) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.classList.add(animation);
    const handler = () => {
      element.classList.remove(animation);
      element.removeEventListener('animationend', handler);
      resolve();
    };
    element.addEventListener('animationend', handler);
    // Fallback: se animationend não disparar, limpa após duration
    setTimeout(() => {
      if (element.classList.contains(animation)) {
        element.classList.remove(animation);
        element.removeEventListener('animationend', handler);
        resolve();
      }
    }, duration + 50);
  });
}

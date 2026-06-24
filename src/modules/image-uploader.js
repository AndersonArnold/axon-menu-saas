// ============================================================
// Axon Menu Base — Image Uploader & Processor
// ============================================================

import { showToast } from './utils.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Abre o seletor de arquivos do navegador para imagens
 * @param {Object} [options]
 * @param {number} [options.maxWidth=800]
 * @param {number} [options.maxHeight=600]
 * @param {number} [options.quality=0.8]
 * @param {string} [options.aspectRatio] - Ex: '16:9', '1:1', '4:3'
 * @returns {Promise<string|null>} Base64 da imagem processada, ou null se cancelado
 */
export function openFilePicker(options = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_TYPES.join(',');
    input.style.display = 'none';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const base64 = await processImage(file, options);
        resolve(base64);
      } catch (error) {
        showToast(error.message, 'error');
        resolve(null);
      } finally {
        document.body.removeChild(input);
      }
    });

    input.addEventListener('cancel', () => {
      resolve(null);
      if (input.parentNode) document.body.removeChild(input);
    });

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Processa uma imagem: valida, redimensiona e comprime
 * @param {File} file
 * @param {Object} [options]
 * @param {number} [options.maxWidth=800]
 * @param {number} [options.maxHeight=600]
 * @param {number} [options.quality=0.8]
 * @param {string} [options.aspectRatio] - Ex: '16:9', '1:1'
 * @returns {Promise<string>} Base64 da imagem processada
 */
export async function processImage(file, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 0.8,
    aspectRatio = null,
  } = options;

  // Validação de tipo
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Formato não suportado. Use JPG, PNG ou WebP.');
  }

  // Validação de tamanho
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Imagem muito grande (${sizeMB}MB). Máximo: 5MB.`);
  }

  // Lê o arquivo como DataURL
  const dataUrl = await _readFileAsDataURL(file);

  // Redimensiona
  return resizeImage(dataUrl, maxWidth, maxHeight, quality, aspectRatio);
}

/**
 * Redimensiona e comprime uma imagem a partir de base64
 * @param {string} base64 - Data URL ou base64 da imagem
 * @param {number} [maxWidth=800]
 * @param {number} [maxHeight=600]
 * @param {number} [quality=0.8]
 * @param {string} [aspectRatio] - Ex: '16:9'
 * @returns {Promise<string>} Base64 redimensionada
 */
export function resizeImage(base64, maxWidth = 800, maxHeight = 600, quality = 0.8, aspectRatio = null) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let srcX = 0;
        let srcY = 0;
        let srcW = img.width;
        let srcH = img.height;

        // Crop para aspect ratio se necessário
        if (aspectRatio) {
          const [arW, arH] = aspectRatio.split(':').map(Number);
          if (arW && arH) {
            const targetRatio = arW / arH;
            const currentRatio = srcW / srcH;

            if (currentRatio > targetRatio) {
              // Imagem mais larga: corta nas laterais
              srcW = Math.round(srcH * targetRatio);
              srcX = Math.round((img.width - srcW) / 2);
            } else {
              // Imagem mais alta: corta em cima e embaixo
              srcH = Math.round(srcW / targetRatio);
              srcY = Math.round((img.height - srcH) / 2);
            }
          }
        }

        // Calcula dimensões finais mantendo proporção
        let finalW = srcW;
        let finalH = srcH;

        if (finalW > maxWidth) {
          finalH = Math.round(finalH * (maxWidth / finalW));
          finalW = maxWidth;
        }
        if (finalH > maxHeight) {
          finalW = Math.round(finalW * (maxHeight / finalH));
          finalH = maxHeight;
        }

        // Canvas para redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, finalW, finalH);

        const result = canvas.toDataURL('image/jpeg', quality);
        resolve(result);
      } catch (error) {
        reject(new Error('Erro ao processar a imagem.'));
      }
    };

    img.onerror = () => reject(new Error('Erro ao carregar a imagem.'));
    img.src = base64;
  });
}

/**
 * Cria uma zona de drag-and-drop para upload de imagens
 * @param {HTMLElement} container - Elemento onde a zona será criada
 * @param {Function} callback - Recebe base64 da imagem processada
 * @param {Object} [options] - Opções de processamento
 * @returns {HTMLElement} O elemento da zona de upload
 */
export function createUploadZone(container, callback, options = {}) {
  const zone = document.createElement('div');
  zone.className = 'upload-zone';
  Object.assign(zone.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '32px 24px',
    borderRadius: 'var(--border-radius, 12px)',
    border: '2px dashed var(--color-text-muted, #8888AA)',
    background: 'var(--color-surface-glass, rgba(26,26,46,0.8))',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minHeight: '160px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  });

  // Ícone e texto
  const iconEl = document.createElement('span');
  iconEl.className = 'material-symbols-rounded';
  iconEl.textContent = 'cloud_upload';
  Object.assign(iconEl.style, {
    fontSize: '40px',
    color: 'var(--color-primary, #FF6B35)',
    transition: 'transform 0.3s ease',
  });

  const textEl = document.createElement('p');
  textEl.textContent = 'Arraste uma imagem ou clique para selecionar';
  Object.assign(textEl.style, {
    color: 'var(--color-text-muted, #8888AA)',
    fontSize: '14px',
    margin: '0',
    lineHeight: '1.4',
  });

  const hintEl = document.createElement('p');
  hintEl.textContent = 'JPG, PNG ou WebP • Máx. 5MB';
  Object.assign(hintEl.style, {
    color: 'var(--color-text-muted, #8888AA)',
    fontSize: '12px',
    opacity: '0.7',
    margin: '0',
  });

  // Preview container (oculto inicialmente)
  const previewContainer = document.createElement('div');
  previewContainer.className = 'upload-zone-preview';
  Object.assign(previewContainer.style, {
    display: 'none',
    position: 'relative',
    width: '100%',
    maxHeight: '200px',
    overflow: 'hidden',
    borderRadius: '8px',
  });

  zone.appendChild(iconEl);
  zone.appendChild(textEl);
  zone.appendChild(hintEl);
  zone.appendChild(previewContainer);

  // Input de arquivo oculto
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = ACCEPTED_TYPES.join(',');
  fileInput.style.display = 'none';

  zone.appendChild(fileInput);

  // Função auxiliar para processar arquivo
  const handleFile = async (file) => {
    try {
      const base64 = await processImage(file, options);

      // Mostra preview
      previewContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = base64;
      Object.assign(img.style, {
        width: '100%',
        height: 'auto',
        maxHeight: '200px',
        objectFit: 'cover',
        borderRadius: '8px',
        display: 'block',
      });
      previewContainer.appendChild(img);
      previewContainer.style.display = 'block';

      // Esconde textos
      iconEl.style.display = 'none';
      textEl.style.display = 'none';
      hintEl.textContent = 'Clique para trocar a imagem';

      callback(base64);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Click para selecionar
  zone.addEventListener('click', (e) => {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
  });

  // Drag & Drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.style.borderColor = 'var(--color-primary, #FF6B35)';
    zone.style.background = 'var(--color-primary-glow, rgba(255,107,53,0.1))';
    iconEl.style.transform = 'scale(1.15)';
  });

  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.style.borderColor = 'var(--color-text-muted, #8888AA)';
    zone.style.background = 'var(--color-surface-glass, rgba(26,26,46,0.8))';
    iconEl.style.transform = 'scale(1)';
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.style.borderColor = 'var(--color-text-muted, #8888AA)';
    zone.style.background = 'var(--color-surface-glass, rgba(26,26,46,0.8))';
    iconEl.style.transform = 'scale(1)';

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  // Paste from clipboard
  zone.setAttribute('tabindex', '0');
  zone.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  });

  // Hover state
  zone.addEventListener('mouseenter', () => {
    zone.style.borderColor = 'var(--color-primary, #FF6B35)';
  });
  zone.addEventListener('mouseleave', () => {
    zone.style.borderColor = 'var(--color-text-muted, #8888AA)';
  });

  container.appendChild(zone);
  return zone;
}

/**
 * Retorna um elemento <img> com a imagem base64
 * @param {string} base64
 * @returns {HTMLImageElement}
 */
export function getImagePreview(base64) {
  const img = document.createElement('img');
  img.src = base64;
  Object.assign(img.style, {
    width: '100%',
    height: 'auto',
    maxHeight: '300px',
    objectFit: 'cover',
    borderRadius: 'var(--border-radius, 12px)',
    display: 'block',
  });
  img.alt = 'Preview da imagem';
  return img;
}

// ─── Auxiliar ───────────────────────────────────────────────

/**
 * Lê um arquivo como Data URL
 * @param {File} file
 * @returns {Promise<string>}
 */
function _readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

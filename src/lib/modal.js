// @ts-nocheck
// Reusable modal utility functions
// Provides showAlert(), showConfirm(), and showPrompt() to replace browser alert(), confirm(), and prompt()

/**
 * Show an alert modal
 * @param {string} message - The message to display
 * @param {string} [title] - Optional title for the modal
 * @returns {Promise<void>}
 */
export function showAlert(message, title = 'Alert') {
  return new Promise((resolve) => {
    const modalId = `alert-modal-${Date.now()}`;
    
    const modalHTML = `
      <div id="${modalId}" class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      ">
        <div class="modal-content" style="
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        ">
          <h3 style="margin: 0 0 1rem; font-size: 1.25rem; color: #111;">${escapeHtml(title)}</h3>
          <p style="margin: 0 0 1.5rem; color: #333; line-height: 1.5;">${escapeHtml(message)}</p>
          <div style="text-align: right;">
            <button class="modal-btn-ok" style="
              padding: 0.5rem 1.5rem;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 4px;
              font-weight: 600;
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s ease;
            ">OK</button>
          </div>
        </div>
      </div>
    `;
    
    // Add animation styles
    if (!document.getElementById('modal-animations')) {
      const style = document.createElement('style');
      style.id = 'modal-animations';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-btn-ok:hover,
        .modal-btn-confirm:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .modal-btn-ok:active,
        .modal-btn-confirm:active {
          transform: translateY(0);
          box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
        }
        .modal-btn-cancel:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
          transform: translateY(-1px);
        }
        .modal-btn-cancel:active {
          transform: translateY(0);
          background: #e5e7eb;
        }
        .modal-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById(modalId);
    const okBtn = modal.querySelector('.modal-btn-ok');
    
    const close = () => {
      modal.remove();
      resolve();
    };
    
    okBtn.addEventListener('click', close);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    
    // Close on Escape
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escapeHandler);
        close();
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Focus OK button
    okBtn.focus();
  });
}

/**
 * Show a confirm modal
 * @param {string} message - The message to display
 * @param {string} [title] - Optional title for the modal
 * @returns {Promise<boolean>} - true if confirmed, false if cancelled
 */
export function showConfirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const modalId = `confirm-modal-${Date.now()}`;
    
    const modalHTML = `
      <div id="${modalId}" class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      ">
        <div class="modal-content" style="
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        ">
          <h3 style="margin: 0 0 1rem; font-size: 1.25rem; color: #111;">${escapeHtml(title)}</h3>
          <p style="margin: 0 0 1.5rem; color: #333; line-height: 1.5;">${escapeHtml(message)}</p>
          <div style="text-align: right; display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button class="modal-btn-cancel" style="
              padding: 0.5rem 1.5rem;
              background: white;
              color: #666;
              border: 2px solid #ddd;
              border-radius: 4px;
              font-weight: 600;
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s ease;
            ">Cancel</button>
            <button class="modal-btn-confirm" style="
              padding: 0.5rem 1.5rem;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 4px;
              font-weight: 600;
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s ease;
            ">Confirm</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById(modalId);
    const confirmBtn = modal.querySelector('.modal-btn-confirm');
    const cancelBtn = modal.querySelector('.modal-btn-cancel');
    
    const close = (result) => {
      modal.remove();
      resolve(result);
    };
    
    confirmBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    
    // Close on backdrop click (counts as cancel)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close(false);
    });
    
    // Close on Escape (counts as cancel)
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escapeHandler);
        close(false);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Focus confirm button
    confirmBtn.focus();
  });
}

/**
 * Show a prompt modal for text input
 * @param {string} message - The message to display
 * @param {string} [title] - Optional title for the modal
 * @param {string} [defaultValue] - Optional default value for the input
 * @returns {Promise<string|null>} - The entered text, or null if cancelled
 */
export function showPrompt(message, title = 'Input Required', defaultValue = '') {
  return new Promise((resolve) => {
    const modalId = `prompt-modal-${Date.now()}`;
    
    const modalHTML = `
      <div id="${modalId}" class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      ">
        <div class="modal-content" style="
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        ">
          <h3 style="margin: 0 0 1rem; font-size: 1.25rem; color: #111;">${escapeHtml(title)}</h3>
          <p style="margin: 0 0 1rem; color: #333; line-height: 1.5;">${escapeHtml(message)}</p>
          <input type="text" class="modal-input" value="${escapeHtml(defaultValue)}" style="
            width: 100%;
            padding: 0.625rem;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
            margin-bottom: 1.5rem;
            box-sizing: border-box;
            font-family: inherit;
            transition: all 0.2s ease;
          " />
          <div style="text-align: right; display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button class="modal-btn-cancel" style="
              padding: 0.5rem 1.5rem;
              background: white;
              color: #666;
              border: 2px solid #ddd;
              border-radius: 4px;
              font-weight: 600;
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s ease;
            ">Cancel</button>
            <button class="modal-btn-ok" style="
              padding: 0.5rem 1.5rem;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 4px;
              font-weight: 600;
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s ease;
            ">OK</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById(modalId);
    const okBtn = modal.querySelector('.modal-btn-ok');
    const cancelBtn = modal.querySelector('.modal-btn-cancel');
    const input = modal.querySelector('.modal-input');
    
    const close = (result) => {
      modal.remove();
      resolve(result);
    };
    
    okBtn.addEventListener('click', () => close(input.value));
    cancelBtn.addEventListener('click', () => close(null));
    
    // Submit on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        close(input.value);
      }
    });
    
    // Close on backdrop click (counts as cancel)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close(null);
    });
    
    // Close on Escape (counts as cancel)
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escapeHandler);
        close(null);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Focus input
    input.focus();
    input.select();
  });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

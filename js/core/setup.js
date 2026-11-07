import { esc } from './util.js';
import * as dialogs from './dialogs.js';

const STORAGE_OPTIONS = [
  { id: 1, label: '1 GB', desc: 'Minimal' },
  { id: 5, label: '5 GB', desc: 'Standard' },
  { id: 10, label: '10 GB', desc: 'Extended' },
  { id: 25, label: '25 GB', desc: 'Maximum' }
];

export function runSetup() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';
    
    let step = 1;
    let config = {
      diskLimit: 25,
      name: '',
      password: ''
    };

    const render = () => {
      overlay.innerHTML = `
        <div class="setup-window">
          <div class="setup-header">Monochrome OS — Setup</div>
          <div class="setup-body">
            <div class="setup-sidebar">
              <div class="setup-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}">1. Storage</div>
              <div class="setup-step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}">2. Account</div>
              <div class="setup-step ${step === 3 ? 'active' : ''}">3. Finish</div>
            </div>
            <div class="setup-content">
              ${step === 1 ? `
                <h2>Storage Allocation</h2>
                <p>Select the maximum virtual disk size for your workspace. This simulates a physical hard drive limit.</p>
                <div class="setup-storage-options">
                  ${STORAGE_OPTIONS.map(opt => `
                    <button type="button" class="setup-storage-btn ${config.diskLimit === opt.id ? 'active' : ''}" data-limit="${opt.id}">
                      <b>${opt.label}</b>
                      <span>${opt.desc}</span>
                    </button>
                  `).join('')}
                </div>
              ` : step === 2 ? `
                <h2>Create Account</h2>
                <p>Set up your local user account. You will use these credentials to log in and unlock your session.</p>
                <div class="setup-form-group">
                  <label>Full Name</label>
                  <input type="text" id="setup-name" value="${esc(config.name)}" placeholder="e.g. Jane Doe">
                </div>
                <div class="setup-form-group">
                  <label>Password</label>
                  <input type="password" id="setup-pass" value="${esc(config.password)}" placeholder="••••••••">
                </div>
              ` : `
                <h2>Ready to Install</h2>
                <p>Monochrome OS is ready to be installed. The virtual disk will be formatted to <b>${config.diskLimit} GB</b>.</p>
                <p>A user account for <b>${config.name}</b> will be created.</p>
              `}
            </div>
          </div>
          <div class="setup-footer">
            ${step > 1 ? '<button class="app-btn" id="setup-back">Back</button>' : ''}
            <button class="app-btn primary" id="setup-next" ${(step === 2 && (!config.name || !config.password)) ? 'disabled' : ''}>
              ${step === 3 ? 'Install & Boot' : 'Continue'}
            </button>
          </div>
        </div>
      `;

      // Attach events
      if (step === 1) {
        overlay.querySelectorAll('.setup-storage-btn').forEach(btn => {
          btn.onclick = () => {
            config.diskLimit = parseInt(btn.dataset.limit);
            render();
          };
        });
      } else if (step === 2) {
        const nameInp = overlay.querySelector('#setup-name');
        const passInp = overlay.querySelector('#setup-pass');
        const nextBtn = overlay.querySelector('#setup-next');
        
        const check = () => {
          config.name = nameInp.value.trim();
          config.password = passInp.value;
          nextBtn.disabled = !config.name || !config.password;
        };
        nameInp.oninput = check;
        passInp.oninput = check;
        if (!config.name) setTimeout(() => nameInp.focus(), 50);
        else setTimeout(() => passInp.focus(), 50);
      }

      if (step > 1) {
        overlay.querySelector('#setup-back').onclick = () => { step--; render(); };
      }
      overlay.querySelector('#setup-next').onclick = () => {
        if (step < 3) { step++; render(); }
        else {
          // Save config
          localStorage.setItem('os16.setup_complete', '1');
          localStorage.setItem('os16.config', JSON.stringify(config));
          overlay.remove();
          resolve(config);
        }
      };
    };

    render();
    document.body.appendChild(overlay);
  });
}

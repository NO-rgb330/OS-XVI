export function showLogin(isLockScreen = false) {
  return new Promise((resolve) => {
    let config = { name: 'User', password: '' };
    try { config = JSON.parse(localStorage.getItem('os16.config')) || config; } catch {}
    
    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';
    overlay.id = 'lock-screen';
    
    const wallpaper = localStorage.getItem('os16.wallpaper'); // If you add wallpaper support later
    if (wallpaper) overlay.style.backgroundImage = `url(${wallpaper})`;

    const initial = config.name.charAt(0).toUpperCase();

    overlay.innerHTML = `
      <div class="lock-box">
        <div class="lock-avatar">${initial}</div>
        <div class="lock-name">${config.name}</div>
        <div class="lock-error" id="lock-err">Incorrect password</div>
        <div class="lock-input-wrap">
          <input type="password" class="lock-input" id="lock-pass" placeholder="Password" autocomplete="off">
          <button class="lock-btn" id="lock-btn">${isLockScreen ? 'Unlock' : 'Log In'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    const inp = overlay.querySelector('#lock-pass');
    const btn = overlay.querySelector('#lock-btn');
    const err = overlay.querySelector('#lock-err');
    
    setTimeout(() => inp.focus(), 100);

    const submit = () => {
      if (inp.value === config.password) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 300);
      } else {
        err.style.display = 'block';
        inp.value = '';
        inp.focus();
        setTimeout(() => { err.style.display = 'none'; }, 2000);
      }
    };

    btn.onclick = submit;
    inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  });
}

// theme.js — Light/dark toggle

(function() {
  var toggle = document.getElementById('theme-toggle');
  var html = document.documentElement;
  
  // Load saved preference or default to dark
  var saved = localStorage.getItem('logshare-theme');
  if (saved === 'light') {
    html.setAttribute('data-theme', 'light');
    if (toggle) toggle.textContent = 'dark_mode';
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      var current = html.getAttribute('data-theme');
      var next = current === 'light' ? 'dark' : 'light';
      
      if (next === 'light') {
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('logshare-theme', 'light');
        toggle.textContent = 'dark_mode';
      } else {
        html.removeAttribute('data-theme');
        localStorage.setItem('logshare-theme', 'dark');
        toggle.textContent = 'light_mode';
      }
    });
  }
})();

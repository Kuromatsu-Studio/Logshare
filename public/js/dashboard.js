var logsDiv = document.getElementById('logs');

async function loadDashboard() {
  try {
    var headers = await authHeaders();
    var res = await fetch('/api/my-logs', { headers: headers });
    
    if (res.status === 401) {
      window.location.href = '/sign-in.html';
      return;
    }

    var logs = await res.json();

    if (logs.length === 0) {
      logsDiv.innerHTML = '<p>No logs yet. <a href="/">Paste your first log</a></p>';
      return;
    }

    var html = '<ul class="log-list">';
    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];
      var date = new Date(log.created_at).toLocaleString();
      var size = (log.size_bytes / 1024).toFixed(1);
      var title = log.title || 'Untitled Log';
      html += '<li><a href="/view.html?id=' + log.id + '">' + title + '</a> <span>— ' + date + ' — ' + size + ' KB</span></li>';
    }
    html += '</ul>';
    logsDiv.innerHTML = html;

  } catch (err) {
    logsDiv.innerHTML = '<p>Error loading logs. <a href="/">Go home</a></p>';
  }
}

loadDashboard();

var content = document.getElementById('content');
var title = document.getElementById('title');
var btn = document.getElementById('submit-btn');
var count = document.getElementById('char-count');
var error = document.getElementById('error');

content.addEventListener('input', function() {
  count.textContent = content.value.length + ' characters';
});

btn.addEventListener('click', async function() {
  if (!content.value.trim()) {
    error.textContent = 'Paste some logs first';
    error.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating...';
  error.style.display = 'none';

  try {
    var headers = await authHeaders();
    headers['Content-Type'] = 'application/json';

    var res = await fetch('/api/log', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ content: content.value, title: title.value })
    });
    var data = await res.json();

    if (data.id) {
      window.location.href = '/view.html?id=' + data.id;
    } else {
      error.textContent = data.error || 'Failed';
      error.style.display = 'block';
    }
  } catch (e) {
    error.textContent = 'Something went wrong';
    error.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Shareable Link';
  }
});

var params = new URLSearchParams(window.location.search);
var logId = params.get('id');

var titleEl = document.getElementById('title');
var metaEl = document.getElementById('meta');
var expiresEl = document.getElementById('expires');
var linesEl = document.getElementById('lines');
var emptyEl = document.getElementById('empty');
var searchInput = document.getElementById('search');
var rawLink = document.getElementById('raw-link');
var formatBadge = document.getElementById('format-badge');

var allLines = [];
var currentFilter = 'ALL';
var detectedFormat = 'Plain text';

// ============================================
// MULTI-FORMAT PARSERS
// ============================================

function parseLogs(text) {
  var lines = text.split('\n');
  if (lines.length === 0) return [];

  // Try JSON format
  var jsonParsed = tryJsonFormat(lines);
  if (jsonParsed) {
    detectedFormat = 'JSON';
    return jsonParsed;
  }

  // Try syslog format
  var syslogParsed = trySyslogFormat(lines);
  if (syslogParsed) {
    detectedFormat = 'Syslog';
    return syslogParsed;
  }

  // Try nginx access log
  var nginxParsed = tryNginxFormat(lines);
  if (nginxParsed) {
    detectedFormat = 'Nginx';
    return nginxParsed;
  }

  // Try Docker/container format
  var dockerParsed = tryDockerFormat(lines);
  if (dockerParsed) {
    detectedFormat = 'Docker';
    return dockerParsed;
  }

  // Fallback: simple text parser
  detectedFormat = 'Plain text';
  return simpleParse(lines);
}

function tryJsonFormat(lines) {
  var results = [];
  var matchCount = 0;

  // Sample first 5 lines
  for (var i = 0; i < Math.min(lines.length, 5); i++) {
    var trimmed = lines[i].trim();
    if (!trimmed) continue;
    try {
      var obj = JSON.parse(trimmed);
      if (obj && (obj.level || obj.severity || obj.msg || obj.message || obj.time || obj.timestamp)) {
        matchCount++;
      }
    } catch (e) {}
  }

  if (matchCount < 2) return null;

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var trimmed = raw.trim();
    var level = null;
    var timestamp = null;
    var message = raw;

    if (!trimmed) {
      results.push({ raw: '', lineNum: i + 1, timestamp: null, level: null });
      continue;
    }

    try {
      var obj = JSON.parse(trimmed);

      // Extract level
      var lvl = obj.level || obj.severity || obj.log_level || '';
      if (lvl) {
        var upper = String(lvl).toUpperCase();
        if (['ERROR','WARN','INFO','DEBUG','FATAL'].indexOf(upper) !== -1) {
          level = upper;
        }
      }

      // Extract timestamp
      var ts = obj.time || obj.timestamp || obj.ts || obj['@timestamp'] || '';
      if (ts) timestamp = String(ts);

      // Extract message
      var msg = obj.msg || obj.message || obj.text || obj.log || obj.body || '';
      if (msg) {
        message = String(msg);
      } else {
        // If no message field, pretty-print the JSON
        message = JSON.stringify(obj, null, 2).replace(/\n/g, ' ');
      }

    } catch (e) {
      // Not JSON, keep raw
    }

    results.push({
      raw: message,
      lineNum: i + 1,
      timestamp: timestamp,
      level: level
    });
  }

  return results;
}

function trySyslogFormat(lines) {
  // <PRI>Mmm dd HH:MM:SS host process[pid]: message
  var syslogRe = /^<(\d+)>([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^[]+)(?:\[(\d+)\])?:\s*(.*)$/;
  var matchCount = 0;

  for (var i = 0; i < Math.min(lines.length, 5); i++) {
    if (syslogRe.test(lines[i])) matchCount++;
  }

  if (matchCount < 2) return null;

  var results = [];
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var match = raw.match(syslogRe);

    if (match) {
      var pri = parseInt(match[1], 10);
      var level = null;
      // Syslog severity: 0=emerg, 1=alert, 2=crit, 3=err, 4=warn, 5=notice, 6=info, 7=debug
      if (pri % 8 === 0 || pri % 8 === 1 || pri % 8 === 2) level = 'FATAL';
      else if (pri % 8 === 3) level = 'ERROR';
      else if (pri % 8 === 4) level = 'WARN';
      else if (pri % 8 === 5 || pri % 8 === 6) level = 'INFO';
      else if (pri % 8 === 7) level = 'DEBUG';

      results.push({
        raw: match[4].trim() + (match[5] ? '[' + match[5] + ']' : '') + ': ' + match[6],
        lineNum: i + 1,
        timestamp: match[2],
        level: level
      });
    } else {
      results.push({ raw: raw, lineNum: i + 1, timestamp: null, level: null });
    }
  }
  return results;
}

function tryNginxFormat(lines) {
  // IP - - [DD/Mon/YYYY:HH:MM:SS +ZZZZ] "METHOD URL PROTOCOL" STATUS SIZE "REFERRER" "USER_AGENT"
  var nginxRe = /^(\S+)\s+-\s+-\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d{3})\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"$/;
  var matchCount = 0;

  for (var i = 0; i < Math.min(lines.length, 5); i++) {
    if (nginxRe.test(lines[i])) matchCount++;
  }

  if (matchCount < 2) return null;

  var results = [];
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var match = raw.match(nginxRe);

    if (match) {
      var status = parseInt(match[4], 10);
      var level = 'INFO';
      if (status >= 500) level = 'ERROR';
      else if (status >= 400) level = 'WARN';

      results.push({
        raw: match[1] + ' ' + match[3] + ' ' + match[4] + ' ' + match[5],
        lineNum: i + 1,
        timestamp: match[2],
        level: level
      });
    } else {
      results.push({ raw: raw, lineNum: i + 1, timestamp: null, level: null });
    }
  }
  return results;
}

function tryDockerFormat(lines) {
  // timestamp level message  OR  level=timestamp msg=...
  var dockerRe = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.?\d*Z?)\s+(ERROR|WARN|INFO|DEBUG|FATAL)\s+(.*)$/;
  var matchCount = 0;

  for (var i = 0; i < Math.min(lines.length, 5); i++) {
    if (dockerRe.test(lines[i])) matchCount++;
  }

  if (matchCount < 2) return null;

  var results = [];
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var match = raw.match(dockerRe);

    if (match) {
      results.push({
        raw: match[3],
        lineNum: i + 1,
        timestamp: match[1],
        level: match[2].toUpperCase()
      });
    } else {
      results.push({ raw: raw, lineNum: i + 1, timestamp: null, level: null });
    }
  }
  return results;
}

function simpleParse(lines) {
  return lines.map(function(raw, i) {
    var tsMatch = raw.match(/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/);
    var levelMatch = raw.match(/\b(ERROR|WARN|INFO|DEBUG|FATAL)\b/i);
    return {
      raw: raw,
      lineNum: i + 1,
      timestamp: tsMatch ? tsMatch[0] : null,
      level: levelMatch ? levelMatch[1].toUpperCase() : null
    };
  });
}

// ============================================
// VIEWER LOGIC
// ============================================

function timeLeft(expiresAt) {
  var diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  var h = Math.floor(diff / (1000 * 60 * 60));
  var m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

async function loadLog() {
  if (!logId) {
    titleEl.textContent = 'No log ID';
    return;
  }
  try {
    var headers = await authHeaders();
    var res = await fetch('/api/log/' + logId, { headers: headers });
    if (!res.ok) throw new Error('Not found');
    var log = await res.json();
    allLines = parseLogs(log.content);

    titleEl.textContent = log.title || 'Untitled Log';
    metaEl.textContent = allLines.length + ' lines · ' + new Date(log.created_at).toLocaleString();
    if (formatBadge) formatBadge.textContent = detectedFormat;
    expiresEl.innerHTML = '<i data-lucide="clock"></i> Expires in ' + timeLeft(log.expires_at);
    rawLink.href = '/api/log/' + logId + '/raw';

    lucide.createIcons();
    render();
  } catch (err) {
    titleEl.textContent = 'Log not found';
  }
}

function render() {
  var search = searchInput.value.toLowerCase();
  var filtered = allLines.filter(function(line) {
    var matchLevel = currentFilter === 'ALL' || line.level === currentFilter;
    var matchSearch = !search || line.raw.toLowerCase().indexOf(search) !== -1;
    return matchLevel && matchSearch;
  });

  ['ALL','ERROR','WARN','INFO','DEBUG','FATAL'].forEach(function(l) {
    var btn = document.getElementById('f-' + l);
    if (btn) btn.className = (l === currentFilter) ? 'active' : '';
  });

  if (filtered.length === 0) {
    linesEl.style.display = 'none';
    emptyEl.classList.remove('hidden');
    return;
  }

  linesEl.style.display = 'block';
  emptyEl.classList.add('hidden');

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var line = filtered[i];
    var levelClass = '';
    if (line.level === 'ERROR' || line.level === 'FATAL') levelClass = 'level-error';
    else if (line.level === 'WARN') levelClass = 'level-warn';
    else if (line.level === 'INFO') levelClass = 'level-info';

    html += '<div class="log-line ' + levelClass + '">';
    html += '<span class="line-num">' + line.lineNum + '</span>';
    html += '<span class="line-content">' + escapeHtml(line.raw) + '</span>';
    html += '</div>';
  }
  linesEl.innerHTML = html;
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setFilter(level) {
  currentFilter = level;
  render();
}

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href);
  alert('Link copied!');
}

async function copyText() {
  var res = await fetch('/api/log/' + logId + '/raw');
  var text = await res.text();
  await navigator.clipboard.writeText(text);
  alert('Text copied!');
}

loadLog();

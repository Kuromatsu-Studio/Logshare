// config.js — Fetches Supabase credentials, initializes client

var supabaseClient = null;

async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  
  var res = await fetch('/api/config');
  var config = await res.json();
  
  supabaseClient = supabase.createClient(config.url, config.key);
  window.supabaseClient = supabaseClient;
  return supabaseClient;
}

async function waitForSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  if (supabaseClient) return supabaseClient;
  
  return new Promise(function(resolve) {
    var check = setInterval(function() {
      if (window.supabaseClient) {
        clearInterval(check);
        resolve(window.supabaseClient);
      }
    }, 50);
  });
}

// Auto-init
initSupabase();

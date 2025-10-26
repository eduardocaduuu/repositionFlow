// ==========================================
// CONFIGURAÇÃO DO BACKEND
// ==========================================

const CONFIG = {
  // URL do backend - detecta automaticamente
  API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'  // Desenvolvimento local
    : 'https://seu-app.koyeb.app',  // Produção no Koyeb

  // WebSocket URL - detecta automaticamente
  WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://localhost:3000'  // Desenvolvimento local
    : 'wss://seu-app.koyeb.app'  // Produção no Koyeb (WebSocket seguro)
};

// Log da configuração no console para debug
console.log('🔧 Configuração do backend:', CONFIG);

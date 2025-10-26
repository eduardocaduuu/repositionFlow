# 🚀 Guia de Deploy - RepositionFlow

Este guia explica como fazer o deploy do RepositionFlow com **frontend no Render** e **backend no Koyeb** (sempre ativo 24/7).

## 📋 Arquitetura

- **Frontend**: Render (HTML/CSS/JS estáticos) - pode dormir após 15min de inatividade
- **Backend**: Koyeb (Node.js + API + WebSocket) - **sempre ativo no plano gratuito**

## 🔧 Parte 1: Deploy do Backend no Koyeb

### Passo 1: Criar conta no Koyeb
1. Acesse https://www.koyeb.com/
2. Crie uma conta gratuita
3. O plano gratuito oferece 1 serviço sempre ativo!

### Passo 2: Criar novo serviço
1. No dashboard do Koyeb, clique em **"Create Service"**
2. Selecione **"GitHub"** como fonte
3. Conecte seu repositório: `https://github.com/eduardocaduuu/repositionFlow.git`
4. Configure:
   - **Branch**: `master`
   - **Build type**: `Dockerfile` ou `Buildpack`
   - **Run command**: `node server.js`
   - **Port**: `3000`

### Passo 3: Configurar variáveis de ambiente
Adicione as seguintes variáveis de ambiente no Koyeb:

```
FIREBASE_PROJECT_ID=repositionflow
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@repositionflow.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://seu-app.onrender.com
```

**IMPORTANTE**:
- Cole a `FIREBASE_PRIVATE_KEY` completa (com `\n` literal)
- Em `FRONTEND_URL`, substitua pela URL real do seu frontend no Render

### Passo 4: Deploy
1. Clique em **"Deploy"**
2. Aguarde o build e deploy (3-5 minutos)
3. Anote a URL do seu backend, exemplo: `https://seu-app-koyeb.koyeb.app`

---

## 🎨 Parte 2: Deploy do Frontend no Render

### Passo 1: Atualizar config.js
Antes de fazer deploy no Render, atualize o arquivo `public/config.js` com a URL do backend do Koyeb:

```javascript
const CONFIG = {
  API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://seu-app-koyeb.koyeb.app',  // ⬅️ COLE SUA URL DO KOYEB AQUI

  WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://localhost:3000'
    : 'wss://seu-app-koyeb.koyeb.app'  // ⬅️ COLE SUA URL DO KOYEB AQUI (wss://)
};
```

**Commit e push as alterações:**
```bash
git add public/config.js
git commit -m "config: Atualizar URL do backend para Koyeb"
git push origin master
```

### Passo 2: Criar serviço no Render
1. Acesse https://render.com/
2. Crie uma conta (se ainda não tiver)
3. Clique em **"New"** → **"Static Site"**
4. Conecte seu repositório GitHub
5. Configure:
   - **Name**: `repositionflow-frontend`
   - **Branch**: `master`
   - **Build Command**: *deixe vazio*
   - **Publish Directory**: `public`

### Passo 3: Deploy
1. Clique em **"Create Static Site"**
2. Aguarde o deploy (1-2 minutos)
3. Anote a URL do frontend, exemplo: `https://repositionflow-frontend.onrender.com`

### Passo 4: Atualizar CORS no Backend
Volte ao Koyeb e atualize a variável de ambiente `FRONTEND_URL`:

```
FRONTEND_URL=https://repositionflow-frontend.onrender.com
```

Isso garantirá que o backend aceite apenas requests do seu frontend.

---

## ✅ Verificação

Após o deploy completo:

1. **Acesse o frontend** no Render: `https://seu-app.onrender.com`
2. **Faça login** (atendente, separador ou admin)
3. **Verifique o console** do navegador (F12):
   - Deve mostrar: `🔧 Configuração do backend: { API_URL: "https://...", WS_URL: "wss://..." }`
   - Deve mostrar: `WebSocket conectado`

Se tudo estiver funcionando:
- ✅ Frontend carrega normalmente
- ✅ WebSocket conecta
- ✅ Métricas aparecem
- ✅ Backend não dorme (Koyeb sempre ativo!)

---

## 🐛 Troubleshooting

### Erro de CORS
**Problema**: Frontend não consegue se conectar ao backend
**Solução**: Verifique se `FRONTEND_URL` no Koyeb está correta

### WebSocket não conecta
**Problema**: `WebSocket connection failed`
**Solução**:
- Verifique se a URL no `config.js` usa `wss://` (não `ws://`)
- Verifique se o Koyeb está rodando na porta 3000

### Firebase não conecta no backend
**Problema**: `Firebase não configurado`
**Solução**:
- Verifique se as variáveis de ambiente estão corretas no Koyeb
- A `FIREBASE_PRIVATE_KEY` deve ter `\n` literal, não quebras de linha reais

### Backend continua dormindo
**Problema**: Serviço dorme após inatividade
**Solução**:
- Certifique-se de que está usando o **plano gratuito do Koyeb**, não do Render
- O Koyeb oferece 1 serviço sempre ativo gratuitamente

---

## 📊 Monitoramento

### Logs do Backend (Koyeb)
1. Acesse o dashboard do Koyeb
2. Clique no seu serviço
3. Vá em **"Logs"**

### Logs do Frontend (Render)
1. Acesse o dashboard do Render
2. Clique no seu site
3. Vá em **"Logs"**

---

## 🔄 Atualizações

Quando fizer mudanças no código:

### Frontend (Render)
```bash
git add .
git commit -m "feat: Nova funcionalidade"
git push origin master
```
O Render detecta automaticamente e faz redeploy.

### Backend (Koyeb)
```bash
git add .
git commit -m "feat: Nova API"
git push origin master
```
O Koyeb detecta automaticamente e faz redeploy.

---

## 💰 Custos

- **Render (Frontend)**: Gratuito com limitações (dorme após 15min)
- **Koyeb (Backend)**: Gratuito - 1 serviço sempre ativo!

**Total**: R$ 0,00/mês! 🎉

---

## 🆘 Suporte

Se tiver problemas:
1. Verifique os logs no Koyeb e Render
2. Abra uma issue no GitHub: https://github.com/eduardocaduuu/repositionFlow/issues
3. Consulte a documentação oficial:
   - Koyeb: https://www.koyeb.com/docs
   - Render: https://render.com/docs

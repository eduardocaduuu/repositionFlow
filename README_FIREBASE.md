# 🔥 Firebase Integration - RepositionFlow

## ✅ STATUS ATUAL

O RepositionFlow está **pronto** para usar Firebase Firestore, mas funciona perfeitamente **sem configuração**!

### 🎯 Como Funciona

- ❌ **SEM** Firebase configurado → Sistema usa **armazenamento em memória** (funciona normalmente)
- ✅ **COM** Firebase configurado → Sistema usa **Firestore** (dados persistem permanentemente)

---

## 🚀 Início Rápido

### Opção 1: Usar SEM Firebase (Padrão)

Não faça nada! O sistema já funciona em memória.

```bash
npm start
```

✅ Sistema funcionando!
⚠️ Dados serão perdidos ao reiniciar servidor


### Opção 2: Configurar Firebase (Recomendado para Produção)

Siga o guia completo: **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**

**Resumo rápido:**
1. Crie projeto no Firebase Console
2. Ative Firestore Database
3. Baixe credenciais (Service Account JSON)
4. Configure `.env` com as credenciais
5. Reinicie o servidor

```bash
npm start
```

✅ Procure no console: `Firebase Firestore conectado com sucesso!`
✅ Dados agora persistem permanentemente!

---

## 📂 Estrutura dos Arquivos

```
RepositionFlow/
├── database.js              # Módulo de banco de dados (Firestore ou memória)
├── server.js                # Servidor principal
├── .env.example             # Template de configuração
├── .env                     # Suas credenciais (NÃO commitar!)
├── FIREBASE_SETUP.md        # Guia completo de configuração
└── README_FIREBASE.md       # Este arquivo
```

---

## 🔧 Arquivos de Configuração

### `.env.example` (Template)
Copie para `.env` e preencha com suas credenciais:

```env
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
PORT=3000
NODE_ENV=production
```

### `.env` (Suas Credenciais Reais)
⚠️ **NUNCA commite este arquivo!** Está no `.gitignore`

---

## 📊 Módulo Database.js

O arquivo `database.js` gerencia automaticamente:

### Modo Firestore (quando configurado)
```javascript
✅ createTask()     → Salva no Firestore
✅ getAllTasks()    → Busca do Firestore
✅ getTaskById()    → Busca do Firestore
✅ updateTask()     → Atualiza no Firestore
✅ deleteTask()     → Remove do Firestore
```

### Modo Memória (sem configuração)
```javascript
✅ createTask()     → Salva em array (memória)
✅ getAllTasks()    → Busca do array
✅ getTaskById()    → Busca do array
✅ updateTask()     → Atualiza array
✅ deleteTask()     → Remove do array
```

---

## 🔄 Migração de Dados (Futuro)

**ATENÇÃO**: Atualmente, ao ativar Firebase, você começa com banco VAZIO.

Dados que estavam em memória NÃO são migrados automaticamente.

### Plano de Migração (A ser implementado)

1. **Opção A**: Export manual
   - Exporte tarefas antes de ativar Firebase
   - Importe manualmente após configurar

2. **Opção B**: Script de migração automática (futuro)
   - Sistema detecta dados em memória
   - Migra automaticamente para Firestore no primeiro start

---

## 🧪 Testando a Integração

### 1. Verificar Modo Atual

Ao iniciar o servidor, procure no console:

**Com Firebase:**
```
✅ Firebase Firestore conectado com sucesso!
```

**Sem Firebase:**
```
⚠️  Firebase não configurado. Usando armazenamento em memória.
```

### 2. Criar uma Tarefa

1. Entre como atendente
2. Envie uma requisição com planilha
3. Verifique no Firebase Console se apareceu em **Firestore Database** → **tasks**

### 3. Health Check

Endpoint de verificação (futuro):
```bash
GET /api/health
```

Resposta:
```json
{
  "status": "ok",
  "database": "firestore"  // ou "memory"
}
```

---

## 💾 Estrutura de Dados no Firestore

### Collection: `tasks`

```javascript
{
  id: "uuid",
  nomeAtendente: "João",
  nomeSeparador: "Maria",
  prioridade: "Alta",
  observacoes: "Cliente aguardando",
  status: "CONCLUIDO",
  items: [...],
  totalItems: 100,
  uniqueSkus: 25,
  arquivoOriginal: "planilha-123.xlsx",
  planilhaConclusao: {
    arquivo: "conclusao-123.xlsx",
    movimentacoes: [...],
    totalLinhas: 25,
    totalQuantidade: 100
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  startTime: "2025-01-15T10:00:00Z",
  endTime: "2025-01-15T11:30:00Z",
  activeTime: 5400,
  durationFormatted: "01:30:00",
  timeline: [...]
}
```

---

## 🔐 Segurança

### Regras do Firestore

Configure regras para permitir apenas acesso via servidor:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // Bloqueia acesso direto do navegador
    }
  }
}
```

### Variáveis de Ambiente

- ✅ `.env` está no `.gitignore`
- ✅ NUNCA commite credenciais no GitHub
- ✅ Use variáveis de ambiente no servidor de produção (Render, Heroku, etc.)

---

## 🚀 Deploy em Produção

### Render.com, Heroku, ou similar

1. Configure as variáveis de ambiente no painel:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `PORT`
   - `NODE_ENV=production`

2. Deploy normalmente

3. Verifique logs para: `✅ Firebase Firestore conectado com sucesso!`

---

## 📈 Monitoramento

### Firebase Console

1. **Firestore Database** → Veja dados em tempo real
2. **Uso e faturamento** → Monitore uso do plano gratuito
3. **Regras** → Configure segurança

### Plano Gratuito

- ✅ 1 GB armazenamento
- ✅ 50.000 leituras/dia
- ✅ 20.000 escritas/dia
- ✅ 20.000 exclusões/dia

---

## 🆘 Troubleshooting

### Erro: "Firebase não configurado"
✅ Normal! Sistema usa memória como fallback
✅ Configure `.env` se quiser usar Firestore

### Erro: "Error parsing private key"
- Verifique se `PRIVATE_KEY` está entre aspas duplas no `.env`
- Mantenha os `\n` na chave

### Dados não aparecem no Firestore
- Verifique se o console mostra: `✅ Firebase Firestore conectado`
- Verifique credenciais no `.env`
- Verifique regras do Firestore

### Sistema lento após ativar Firebase
- Firebase adiciona latência de rede (normal)
- Considere caching para operações frequentes (futuro)

---

## 🎯 Próximos Passos

Melhorias futuras:

- [ ] Migração automática de dados memória → Firestore
- [ ] Endpoint `/api/health` com status do banco
- [ ] Caching de queries frequentes
- [ ] Backup/export automático
- [ ] Índices otimizados no Firestore
- [ ] Migração completa de todos os endpoints para async/await

---

## 📚 Documentação

- [Firebase Setup Completo](./FIREBASE_SETUP.md)
- [Firestore Docs Oficiais](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

## ✅ Checklist de Configuração

- [ ] Criar projeto no Firebase Console
- [ ] Ativar Firestore Database
- [ ] Baixar Service Account JSON
- [ ] Copiar `.env.example` para `.env`
- [ ] Preencher credenciais no `.env`
- [ ] Reiniciar servidor
- [ ] Verificar log: `✅ Firebase Firestore conectado`
- [ ] Testar criando uma tarefa
- [ ] Verificar tarefa no Firebase Console
- [ ] Configurar regras de segurança
- [ ] Deploy em produção com variáveis de ambiente

---

**Pronto!** Seu RepositionFlow agora suporta Firebase Firestore! 🎉

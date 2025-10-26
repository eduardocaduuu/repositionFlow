# 🔥 Configuração do Firebase para RepositionFlow

Este guia te ajudará a configurar o Firebase Firestore como banco de dados para o RepositionFlow.

## ⏱️ Tempo estimado: 10 minutos

---

## 📋 Passo 1: Criar Projeto no Firebase Console

1. Acesse: **https://console.firebase.google.com/**
2. Faça login com sua conta Google
3. Clique em **"Adicionar projeto"** ou **"Create a project"**
4. **Nome do projeto**: `RepositionFlow` (ou escolha outro nome)
5. Aceite os termos e clique em **"Continuar"**
6. **Google Analytics**:
   - Pode **desabilitar** (não é necessário para este projeto)
   - Ou deixar habilitado se quiser analytics
7. Clique em **"Criar projeto"**
8. Aguarde a criação (leva ~30 segundos)
9. Clique em **"Continuar"**

---

## 🗄️ Passo 2: Criar Firestore Database

1. No menu lateral esquerdo, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"** ou **"Create database"**
3. Escolha o modo de início:
   - ✅ **Modo de produção** (recomendado)
   - Ou **Modo de teste** (permite acesso total por 30 dias - útil para desenvolvimento)
4. Clique em **"Avançar"** ou **"Next"**
5. Escolha a localização do servidor:
   - ✅ **southamerica-east1 (São Paulo)** - melhor para Brasil
   - Ou outra região próxima
6. Clique em **"Ativar"** ou **"Enable"**
7. Aguarde a criação do banco (leva ~1 minuto)

---

## 🔑 Passo 3: Obter Credenciais (Service Account)

### 3.1 - Acessar Configurações do Projeto

1. No menu lateral, clique no ícone de **⚙️ engrenagem** (Settings)
2. Clique em **"Configurações do projeto"** ou **"Project settings"**

### 3.2 - Criar Service Account Key

1. Clique na aba **"Contas de serviço"** ou **"Service accounts"**
2. Você verá algo como: `firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com`
3. Clique no link **"Gerenciar permissões de conta de serviço"**

   OU vá direto para:

4. Clique em **"Gerar nova chave privada"** ou **"Generate new private key"**
5. Escolha formato: **JSON**
6. Clique em **"Gerar chave"** ou **"Generate key"**
7. Um arquivo JSON será baixado automaticamente

⚠️ **IMPORTANTE**: Guarde este arquivo em local seguro! Não compartilhe nem commite no GitHub!

---

## 📝 Passo 4: Configurar Credenciais no Projeto

### 4.1 - Abrir o arquivo JSON baixado

Abra o arquivo JSON baixado no Passo 3. Ele terá esta estrutura:

```json
{
  "type": "service_account",
  "project_id": "repositionflow-xxxxx",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@repositionflow-xxxxx.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

### 4.2 - Criar arquivo .env

1. Na raiz do projeto RepositionFlow, copie o arquivo `.env.example` para `.env`:

   ```bash
   cp .env.example .env
   ```

2. Abra o arquivo `.env` e preencha com os dados do JSON:

   ```env
   # Firebase Project Configuration
   FIREBASE_PROJECT_ID=repositionflow-xxxxx
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@repositionflow-xxxxx.iam.gserviceaccount.com

   # Server Configuration
   PORT=3000
   NODE_ENV=production
   ```

3. **Onde pegar cada valor**:
   - `FIREBASE_PROJECT_ID`: copie o valor de `"project_id"` do JSON
   - `FIREBASE_PRIVATE_KEY`: copie o valor COMPLETO de `"private_key"` do JSON (incluindo `-----BEGIN` e `-----END`)
   - `FIREBASE_CLIENT_EMAIL`: copie o valor de `"client_email"` do JSON

⚠️ **ATENÇÃO**: A `PRIVATE_KEY` deve estar entre aspas duplas e manter os `\n`!

---

## 🔒 Passo 5: Configurar Regras de Segurança (Opcional mas Recomendado)

Se escolheu **Modo de produção** no Passo 2:

1. No Firebase Console, vá em **"Firestore Database"**
2. Clique na aba **"Regras"** ou **"Rules"**
3. Cole estas regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir acesso apenas via Admin SDK (servidor)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Clique em **"Publicar"** ou **"Publish"**

Estas regras bloqueiam acesso direto ao Firestore pelo navegador, permitindo apenas via servidor (mais seguro).

---

## ✅ Passo 6: Testar a Conexão

1. Certifique-se que o arquivo `.env` está configurado
2. Reinicie o servidor:

   ```bash
   npm start
   ```

3. Procure no console por:
   - ✅ `Firebase Firestore conectado com sucesso!`
   - ❌ Se aparecer erro, verifique se copiou as credenciais corretamente

4. Teste criando uma tarefa no sistema
5. Verifique no Firebase Console se a tarefa aparece em **Firestore Database**

---

## 🔧 Resolução de Problemas

### Erro: "FIREBASE_PROJECT_ID is not defined"
- ✅ Verifique se o arquivo `.env` está na raiz do projeto
- ✅ Verifique se as variáveis estão escritas corretamente

### Erro: "Error parsing private key"
- ✅ Certifique-se que a PRIVATE_KEY está entre aspas duplas
- ✅ Mantenha os `\n` na chave (não remova)
- ✅ Copie a chave completa incluindo BEGIN e END

### Erro: "Permission denied"
- ✅ Verifique se as regras do Firestore permitem acesso via Admin SDK
- ✅ Certifique-se que a Service Account tem permissões corretas

### Sistema funciona mas usa memória
- ℹ️ Se o Firebase não conectar, o sistema automaticamente usa armazenamento em memória
- ℹ️ Procure no console por: `⚠️ Usando armazenamento em memória`
- ✅ Verifique as credenciais no `.env`

---

## 📊 Monitorar Uso (Plano Gratuito)

O plano gratuito do Firebase Firestore oferece:
- ✅ 1 GB de armazenamento
- ✅ 50.000 leituras/dia
- ✅ 20.000 escritas/dia
- ✅ 20.000 exclusões/dia

Para monitorar uso:
1. Firebase Console → **Uso e faturamento**
2. Acompanhe as métricas diárias

---

## 🚀 Pronto!

Seu RepositionFlow agora está usando Firebase Firestore como banco de dados permanente!

**Benefícios**:
- ✅ Dados persistem mesmo após reiniciar servidor
- ✅ Backup automático pelo Google
- ✅ Escalável (suporta milhares de tarefas)
- ✅ Grátis até os limites acima
- ✅ Acesso de qualquer lugar

**Próximos passos**:
- Configure regras de segurança avançadas
- Configure backup/export de dados
- Monitore uso do Firestore

---

## 🆘 Suporte

Problemas?
- Documentação oficial: https://firebase.google.com/docs/firestore
- Verifique os logs do servidor
- Revise as credenciais no `.env`

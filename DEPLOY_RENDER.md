# Guia Completo: Deploy no Render

Este guia fornece um passo a passo detalhado para fazer o deploy da aplicação RepositionFlow no Render (plano gratuito).

## Pré-requisitos

- ✅ Código já está no GitHub: https://github.com/eduardocaduuu/repositionFlow.git
- ✅ Conta no GitHub (já possui)
- ⚠️ Conta no Render (vamos criar se não tiver)

---

## Passo 1: Criar Conta no Render

### 1.1. Acesse o Site do Render
- Abra seu navegador
- Acesse: https://render.com/

### 1.2. Criar Conta
- Clique em **"Get Started"** ou **"Sign Up"** (no canto superior direito)
- Escolha uma das opções:
  - **GitHub** (RECOMENDADO - mais rápido)
  - GitLab
  - Email

### 1.3. Conectar com GitHub (Recomendado)
- Clique em **"Sign up with GitHub"**
- Faça login na sua conta GitHub
- Autorize o Render a acessar sua conta
- Aguarde ser redirecionado para o dashboard do Render

---

## Passo 2: Criar um Web Service no Render

### 2.1. Acessar o Dashboard
Após fazer login, você verá o dashboard do Render.

### 2.2. Criar Novo Serviço
1. Clique no botão **"New +"** (canto superior direito)
2. No menu que abrir, selecione **"Web Service"**

### 2.3. Conectar Repositório

**Opção A: Se você vê o repositório na lista**
- Procure por `repositionFlow` na lista de repositórios
- Clique em **"Connect"** ao lado do repositório

**Opção B: Se não vê o repositório**
- Clique em **"Configure account"** (no canto superior direito da lista)
- Selecione sua conta GitHub
- Escolha:
  - **"All repositories"** (dar acesso a todos) OU
  - **"Only select repositories"** → Marque `repositionFlow`
- Clique em **"Install"** ou **"Save"**
- Volte para a página anterior
- Agora você verá o repositório `repositionFlow`
- Clique em **"Connect"**

---

## Passo 3: Configurar o Web Service

Após conectar o repositório, você verá uma página de configuração.

### 3.1. Configurações Básicas

**Name (Nome do Serviço)**
```
repositionflow
```
(Ou qualquer nome que preferir - este será parte da URL)

**Region (Região)**
```
Oregon (US West)
```
(Escolha a região mais próxima de você. Opções: Oregon, Frankfurt, Singapore)

**Branch**
```
master
```
(O Render já deve detectar automaticamente)

**Root Directory**
```
(deixe em branco)
```

---

### 3.2. Configurações de Build e Start

O Render deve detectar automaticamente o arquivo `render.yaml` e preencher os campos. Verifique se estão assim:

**Environment**
```
Node
```

**Build Command**
```
npm install
```

**Start Command**
```
npm start
```

---

### 3.3. Plano (Muito Importante!)

**Instance Type**
- Selecione: **"Free"** (Plano gratuito - $0/mês)

**Importante sobre o Plano Free:**
- ✅ Totalmente gratuito
- ⚠️ O serviço hiberna após 15 minutos de inatividade
- ⚠️ Primeira requisição após hibernação demora ~30-50 segundos
- ⚠️ 750 horas/mês de uso (suficiente para testes e projetos pessoais)

---

### 3.4. Variáveis de Ambiente (Environment Variables)

Role a página até encontrar **"Environment Variables"**

**Clique em "Add Environment Variable"** e adicione:

```
Key (Nome):    NODE_ENV
Value (Valor): production
```

Esta é a única variável necessária.

---

### 3.5. Health Check (Verificação de Saúde)

Role até encontrar **"Health Check Path"** (pode estar em "Advanced" ou já visível)

```
Health Check Path: /health
```

Isso permite que o Render verifique se sua aplicação está funcionando.

---

## Passo 4: Criar o Serviço

### 4.1. Revisão Final
Antes de criar, verifique:
- ✅ Nome: repositionflow
- ✅ Branch: master
- ✅ Build Command: npm install
- ✅ Start Command: npm start
- ✅ Instance Type: Free
- ✅ Environment Variable: NODE_ENV=production
- ✅ Health Check Path: /health

### 4.2. Criar
- Role até o final da página
- Clique no botão azul **"Create Web Service"**

---

## Passo 5: Aguardar o Deploy

### 5.1. Processo de Deploy
Após clicar em "Create Web Service", você será redirecionado para a página de logs.

Você verá mensagens como:
```
==> Cloning from https://github.com/eduardocaduuu/repositionFlow...
==> Downloading cache...
==> Running 'npm install'
==> Installing dependencies...
==> Build successful
==> Starting service with 'npm start'
==> Your service is live 🎉
```

**Tempo estimado:** 2-5 minutos

### 5.2. Acompanhar o Deploy
- Aguarde até ver a mensagem **"Your service is live"** ou **"Live"** (com bolinha verde)
- Se houver erros, eles aparecerão em vermelho nos logs

---

## Passo 6: Acessar sua Aplicação

### 6.1. Obter a URL
Após o deploy ser concluído:
- No topo da página, você verá a URL do seu serviço
- Formato: `https://repositionflow.onrender.com` (ou outro nome que você escolheu)

### 6.2. Copiar a URL
- Clique no ícone de copiar ao lado da URL
- OU anote a URL manualmente

### 6.3. Testar
- Abra uma nova aba no navegador
- Cole a URL
- Aguarde a aplicação carregar (primeira vez pode demorar ~30 segundos)
- Você deve ver a tela de login do RepositionFlow!

---

## Passo 7: Testar a Aplicação

### 7.1. Fazer Login
1. Na tela de login, preencha:
   - **Nome:** Seu nome (ex: João)
   - **Função:** Selecione "Atendente"
2. Clique em **"Entrar"**

### 7.2. Testar Upload (Opcional)
Para testar o upload de planilha, você precisa criar um arquivo Excel:

**Criar Planilha de Teste:**
1. Abra Excel, Google Sheets ou LibreOffice Calc
2. Crie uma tabela com estas colunas:

| SKU   | Descrição    | Quantidade_requerida |
|-------|--------------|---------------------|
| 123   | Produto A    | 10                  |
| 456   | Produto B    | 5                   |

3. Salve como `.xlsx`
4. Faça upload na aplicação em "Nova Requisição"

### 7.3. Testar em Múltiplas Abas
- Abra a URL em outra aba
- Faça login como "Separador"
- Teste as notificações em tempo real!

---

## Passo 8: Configurações Adicionais (Opcional)

### 8.1. Configurar Domínio Personalizado (Opcional)
Se você tem um domínio próprio:
1. No dashboard do Render, clique no seu serviço
2. Vá em **"Settings"**
3. Role até **"Custom Domain"**
4. Adicione seu domínio

### 8.2. Auto-Deploy (Já Configurado)
O Render automaticamente faz redeploy quando você fizer push no GitHub:
```bash
# No seu computador
git add .
git commit -m "Minha atualização"
git push origin master
```

O Render detecta e faz deploy automaticamente!

---

## Resumo Visual do Processo

```
1. Criar conta no Render (render.com)
   ↓
2. New + → Web Service
   ↓
3. Conectar repositório (repositionFlow)
   ↓
4. Configurar:
   - Name: repositionflow
   - Build: npm install
   - Start: npm start
   - Plan: Free
   - Env: NODE_ENV=production
   ↓
5. Create Web Service
   ↓
6. Aguardar deploy (2-5 min)
   ↓
7. Acessar URL fornecida
   ↓
8. Testar aplicação! 🎉
```

---

## Troubleshooting (Resolução de Problemas)

### Problema: Deploy Falhou

**Erro: "Build failed"**
- Verifique os logs de erro
- Confirme que `npm install` está no Build Command
- Verifique se package.json está correto

**Erro: "Start command failed"**
- Confirme que `npm start` está no Start Command
- Verifique se server.js existe no repositório

### Problema: Aplicação Não Carrega

**"Application Error" ou página em branco**
- Aguarde 30-60 segundos (primeira carga é lenta)
- Verifique os logs no Render dashboard
- Confirme que a porta está configurada corretamente (usar process.env.PORT)

**Serviço está "Suspended"**
- No plano gratuito, após 15 minutos de inatividade, o serviço hiberna
- Acesse a URL novamente - ele vai "acordar" automaticamente
- Primeira requisição após hibernação demora ~30-50 segundos

### Problema: WebSocket Não Funciona

**Notificações em tempo real não aparecem**
- Verifique se está usando `wss://` (não `ws://`) na produção
- O código já está configurado para usar `window.location.origin.replace('http', 'ws')`
- Isso funciona automaticamente no Render

---

## URLs Importantes

- **Dashboard Render:** https://dashboard.render.com/
- **Documentação Render:** https://render.com/docs
- **Status Render:** https://status.render.com/
- **Seu Repositório:** https://github.com/eduardocaduuu/repositionFlow.git

---

## Próximos Passos Após Deploy

### Melhorias Recomendadas

1. **Adicionar Banco de Dados (Para persistência real)**
   - No Render: New + → PostgreSQL (tem plano free de 90 dias)
   - Conectar ao seu Web Service

2. **Monitoramento**
   - Acompanhe os logs regularmente
   - Verifique métricas de uso no dashboard

3. **Backup**
   - Configure backup automático do banco (se adicionar)
   - Mantenha o código no GitHub sempre atualizado

4. **Segurança**
   - Adicione autenticação real (JWT)
   - Configure CORS adequadamente
   - Use HTTPS (Render já fornece automaticamente)

---

## Suporte

**Se encontrar problemas:**
1. Verifique os logs no Render dashboard
2. Consulte a documentação: https://render.com/docs
3. Verifique o README.md do projeto
4. Abra uma issue no GitHub: https://github.com/eduardocaduuu/repositionFlow/issues

---

## Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] Serviço está "Live" (bolinha verde)
- [ ] URL abre e mostra a tela de login
- [ ] Consegue fazer login
- [ ] Dashboard carrega as tarefas
- [ ] Upload de planilha funciona
- [ ] Notificações em tempo real funcionam (teste com 2 abas)
- [ ] Cronômetro funciona
- [ ] Métricas são exibidas

---

**Parabéns! Sua aplicação está no ar! 🚀**

URL da sua aplicação: `https://repositionflow.onrender.com` (ou a URL fornecida pelo Render)

Compartilhe com sua equipe e comece a usar!

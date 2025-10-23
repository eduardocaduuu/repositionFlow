# 🔍 Guia de Teste - Correção de Navegação

## ✅ O QUE FOI CORRIGIDO

### Problema Original
- Botão "Nova Requisição" não respondia a cliques
- Console mostrava "Mudando para view: dashboard" mesmo ao clicar em "Nova Requisição"

### Solução Aplicada
1. **Event Listeners Diretos**: Cada botão agora tem seu próprio listener (em vez de delegação de eventos)
2. **Logs de Debug Completos**: Console mostra EXATAMENTE o que está acontecendo
3. **type="button" nos Botões HTML**: Evita comportamento indesejado de submit
4. **stopPropagation()**: Garante que o clique não seja capturado por outro elemento

---

## 📋 PASSO A PASSO PARA TESTAR

### 1️⃣ Aguardar Redeploy no Render (OBRIGATÓRIO)

**URL:** https://dashboard.render.com/

1. Acesse seu dashboard do Render
2. Clique no serviço `repositionflow`
3. Aguarde aparecer **"Live"** com bolinha verde (2-5 minutos)
4. **IMPORTANTE:** Aguarde o deploy completar ANTES de testar!

---

### 2️⃣ Abrir Console do Navegador (ANTES de acessar a aplicação)

**Chrome/Edge:**
- Pressione `F12` ou `Ctrl + Shift + I`

**Firefox:**
- Pressione `F12` ou `Ctrl + Shift + K`

**Safari:**
- Pressione `Cmd + Option + C`

**Deixe o console aberto durante TODO o teste!**

---

### 3️⃣ Acessar a Aplicação

1. Abra a URL do Render (ex: `https://repositionflow.onrender.com`)
2. **IMPORTANTE:** Force recarregamento SEM cache:
   - **Windows:** `Ctrl + Shift + R`
   - **Mac:** `Cmd + Shift + R`
3. Aguarde carregar completamente

---

### 4️⃣ Verificar Logs de Inicialização

No console, você DEVE ver:

```
=== INICIALIZANDO APLICAÇÃO ===
=== CONFIGURANDO NAVEGAÇÃO ===
✓ Listener Dashboard adicionado
✓ Listener Nova Requisição adicionado
✓ Listener Métricas adicionado
Inicialização completa
```

**❌ Se NÃO aparecer:** Houve erro de carregamento. Me envie screenshot do console.

**✅ Se aparecer:** Prossiga para próximo passo.

---

### 5️⃣ Fazer Login como Atendente

1. Preencha o formulário:
   - **Nome:** Seu nome (ex: João)
   - **Função:** **Atendente**
2. Clique em **"Entrar"**

---

### 6️⃣ Verificar Logs de Login

No console, você DEVE ver:

```
=== FAZENDO LOGIN ===
Nome: João
Papel: atendente
=== CONFIGURANDO VISIBILIDADE ===
Papel: atendente
Botão Nova Tarefa: <button...>
Botão Métricas: <button...>
✓ Atendente: Nova Tarefa visível, Métricas oculto
Classes Nova Tarefa após: nav-btn
Classes Métricas após: nav-btn hidden
Nova Tarefa visível? true
=== MUDANDO VIEW ===
Para: dashboard
...
```

**Pontos importantes:**
- ✅ "Nova Tarefa visível? **true**"
- ✅ "Classes Nova Tarefa após: **nav-btn**" (SEM hidden)
- ✅ "Classes Métricas após: **nav-btn hidden**" (COM hidden)

---

### 7️⃣ Clicar em "Nova Requisição"

1. Visualizar os botões no topo:
   - ✅ **Dashboard** (visível, azul/ativo)
   - ✅ **Nova Requisição** (visível)
   - ❌ **Métricas** (NÃO deve estar visível)
   - ✅ **Sair** (visível)

2. Clique em **"Nova Requisição"**

---

### 8️⃣ Verificar Logs do Clique

No console, você DEVE ver IMEDIATAMENTE:

```
>>> CLICK: Nova Requisição
=== MUDANDO VIEW ===
Para: nova-requisicao
Removendo active de: dashboard
Removendo active de: nova-requisicao
Removendo active de: metricas
View element: <div id="nova-requisicao"...>
Nav button: <button...>
✓ View ativada: nova-requisicao
✓ Botão ativado
```

---

### 9️⃣ Verificar Tela de Nova Requisição

A tela DEVE mostrar:

```
Nova Requisição de Reposição
┌─────────────────────────────────────┐
│ Nome do Atendente: [____________]  │
│ Nome da Loja:      [____________]  │
│ Prioridade:        [Média ▼]       │
│ Planilha Excel:    [Escolher...]  │
│                                     │
│ A planilha deve conter as colunas: │
│ SKU, Descrição, Quantidade_requerida│
│                                     │
│ [Enviar Requisição]                │
└─────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE SUCESSO

Marque cada item conforme testar:

- [ ] Console mostra "=== INICIALIZANDO APLICAÇÃO ==="
- [ ] Console mostra "✓ Listener Nova Requisição adicionado"
- [ ] Login como Atendente funciona
- [ ] Console mostra "Nova Tarefa visível? true"
- [ ] Botão "Nova Requisição" está VISÍVEL
- [ ] Console mostra ">>> CLICK: Nova Requisição" AO CLICAR
- [ ] Console mostra "✓ View ativada: nova-requisicao"
- [ ] Tela mostra formulário de Nova Requisição

---

## 🚨 TROUBLESHOOTING

### Problema: Logs não aparecem

**Causa:** Cache do navegador não foi limpo

**Solução:**
1. Feche TODAS as abas da aplicação
2. Limpe o cache: `Ctrl + Shift + Del` → Marcar "Imagens e arquivos em cache" → Limpar
3. Abra novamente e pressione `Ctrl + Shift + R`

---

### Problema: "✗ Botão Nova Requisição não encontrado!"

**Causa:** HTML não carregou corretamente

**Solução:**
1. Verifique se o redeploy do Render terminou
2. Aguarde 1 minuto
3. Force recarregamento: `Ctrl + Shift + R`

---

### Problema: Botão visível mas não clica

**Causa:** Outro elemento sobre o botão OU cache

**Solução:**
1. No console, digite: `document.getElementById('novaTarefaBtn').click()`
2. Se funcionar → cache não foi limpo
3. Se não funcionar → me envie screenshot

---

### Problema: Clica mas nada acontece

**Causa:** JavaScript com erro

**Solução:**
1. Olhe no console se há erros em VERMELHO
2. Me envie screenshot completo do console

---

## 📸 O QUE ME ENVIAR SE NÃO FUNCIONAR

1. **Screenshot do console COMPLETO** (F12)
2. **Responda:**
   - Você aguardou o redeploy completar no Render? (Sim/Não)
   - Você limpou o cache? (Sim/Não)
   - Qual navegador está usando?
   - Aparece algum erro em VERMELHO no console?

---

## 🎯 TESTE ADICIONAL (Opcional)

### Testar com papel Separador

1. Sair da aplicação
2. Fazer login como **Separador**
3. Verificar que:
   - ✅ Dashboard visível
   - ❌ Nova Requisição **NÃO** visível
   - ❌ Métricas **NÃO** visível

### Testar com papel Admin

1. Sair da aplicação
2. Fazer login como **Administrador**
3. Verificar que:
   - ✅ Dashboard visível
   - ✅ Nova Requisição visível
   - ✅ Métricas visível

---

## ⏱️ TIMELINE

- ✅ Código corrigido e enviado
- 🔄 Render fazendo redeploy (aguardar)
- ⏳ Você testa seguindo este guia
- 📣 Me avisa se funcionou!

---

**Esta é a correção DEFINITIVA. Com os logs detalhados, conseguiremos identificar EXATAMENTE onde está o problema se ainda houver algum.**

Boa sorte no teste! 🚀

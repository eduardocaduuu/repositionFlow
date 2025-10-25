# Funcionalidade de Exportação para Excel

## 📋 Visão Geral

Foi adicionada a funcionalidade de **exportar tarefas para Excel (XLSX)**, permitindo que separadores e outros usuários possam imprimir ou salvar uma planilha detalhada de todos os itens de uma requisição.

---

## 🎯 Para Quem é Útil

- **Separadores**: Podem imprimir a lista de itens para levar ao estoque
- **Atendentes**: Podem ter um registro da requisição
- **Administradores**: Podem arquivar requisições importantes

---

## 🚀 Como Usar

### Passo a Passo:

1. **Abrir Tarefa**
   - No Dashboard, clique em qualquer card de tarefa
   - O modal com detalhes será aberto

2. **Exportar**
   - No modal, acima da tabela de itens, clique no botão **📥 Exportar XLSX**
   - O arquivo será gerado e baixado automaticamente

3. **Nome do Arquivo**
   - Formato: `tarefa_[ID]_[DATA].xlsx`
   - Exemplo: `tarefa_a1b2c3d4_2025-01-24.xlsx`

---

## 📊 Conteúdo do Arquivo Excel

O arquivo exportado contém:

### 1. **Informações da Tarefa**
- ID da Tarefa
- Nome do Atendente
- Prioridade
- Status
- Data de Criação

### 2. **Lista Completa de Itens**

Colunas:
- **SKU** - Código do produto
- **Descrição** - Nome do produto
- **Qtd Pegar** - Quantidade a separar
- **Localização** - Onde encontrar no estoque
- **Estoque Disponível** - Quantidade disponível
- **Total Físico** - Total em estoque
- **Total Alocado** - Total já alocado
- **Status Separação** - OK / FALTANDO / -
- **Observação** - Notas adicionais

### 3. **Totais**
- Total de Itens Únicos
- Soma de Quantidades a Pegar

### 4. **Informações de Separação** (se aplicável)
- Nome do Separador
- Data/Hora de Início
- Data/Hora de Conclusão
- Duração Total

### 5. **Estatísticas** (se separação iniciada)
- Itens OK
- Itens Faltando
- Itens Pendentes

---

## 🎨 Interface

### Desktop
```
┌────────────────────────────────────────────────┐
│  Itens (25)              [📥 Exportar XLSX]   │
├────────────────────────────────────────────────┤
│ SKU    │ Descrição │ Qtd │ Localização │ ...  │
└────────────────────────────────────────────────┘
```

### Mobile
```
┌──────────────────────────────┐
│ Itens (25)                   │
├──────────────────────────────┤
│ [📥 Exportar XLSX]          │
│ (botão full-width)           │
├──────────────────────────────┤
│ Tabela com scroll horizontal │
└──────────────────────────────┘
```

---

## 🔧 Implementação Técnica

### Frontend (`app.js`)

**Função de Exportação:**
```javascript
async function exportTaskToExcel(taskId) {
    // Faz requisição ao backend
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/export-excel`);

    // Cria blob e faz download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarefa_${taskId.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
}
```

**Botão no Modal:**
```html
<div class="export-header">
    <h3>Itens (${task.items.length})</h3>
    <button class="btn btn-secondary" onclick="exportTaskToExcel('${task.id}')">
        📥 Exportar XLSX
    </button>
</div>
```

### Backend (`server.js`)

**Endpoint:**
```javascript
app.get('/api/tasks/:id/export-excel', (req, res) => {
    const task = tasks.find(t => t.id === req.params.id);

    // Cria workbook usando biblioteca xlsx
    const workbook = xlsx.utils.book_new();

    // Prepara dados em formato array de arrays
    const worksheetData = [
        ['INFORMAÇÕES DA TAREFA'],
        ['ID da Tarefa', task.id],
        // ... mais dados
    ];

    // Cria worksheet
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

    // Define largura das colunas
    worksheet['!cols'] = [
        { wch: 15 }, // SKU
        { wch: 40 }, // Descrição
        // ... outras colunas
    ];

    // Gera buffer e envia
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(excelBuffer);
});
```

### CSS Responsivo (`styles.css`)

**Desktop:**
```css
.export-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
```

**Mobile:**
```css
@media (max-width: 768px) {
    .export-header {
        flex-direction: column;
        gap: 10px;
    }

    .export-header .btn {
        width: 100%;
    }
}
```

---

## 📱 Responsividade

### Desktop (>768px)
- Botão ao lado direito do título
- Largura automática
- Botão compacto

### Mobile (≤768px)
- Botão abaixo do título
- Largura 100%
- Fácil de tocar

---

## 🎁 Recursos Extras

### 1. **Colunas Otimizadas**
Cada coluna tem largura pré-definida para melhor visualização:
- SKU: 15 caracteres
- Descrição: 40 caracteres
- Localização: 30 caracteres
- Etc.

### 2. **Formatação Automática**
- Datas formatadas para pt-BR
- Status traduzidos
- Valores numéricos corretos

### 3. **Estatísticas Automáticas**
Se a separação foi iniciada, calcula automaticamente:
- Quantos itens estão OK
- Quantos estão faltando
- Quantos ainda não foram processados

---

## 🔄 Casos de Uso

### Caso 1: Separador no Estoque
**Situação:** Separador quer levar lista impressa
1. Abre tarefa no celular
2. Clica em "Exportar XLSX"
3. Arquivo baixa automaticamente
4. Abre no Excel/Google Sheets
5. Imprime ou usa no tablet

### Caso 2: Atendente Acompanhando
**Situação:** Atendente quer arquivar requisição
1. Abre tarefa concluída
2. Exporta para Excel
3. Arquivo inclui estatísticas completas
4. Arquiva para histórico

### Caso 3: Administrador Auditando
**Situação:** Admin precisa revisar separações
1. Filtra tarefas concluídas
2. Exporta cada uma
3. Analisa estatísticas (OK/Faltando)
4. Identifica padrões de problemas

---

## ⚡ Performance

- **Geração Rápida**: Excel gerado em memória (< 1s)
- **Tamanho Pequeno**: ~10-50 KB para tarefas típicas
- **Compatível**: Funciona em Excel, LibreOffice, Google Sheets

---

## 🐛 Tratamento de Erros

**Tarefa não encontrada:**
```json
{
  "error": "Tarefa não encontrada"
}
```

**Erro ao gerar arquivo:**
```json
{
  "error": "Erro ao gerar arquivo Excel"
}
```

**Frontend exibe notificações:**
- ✅ Sucesso: "Arquivo Excel baixado com sucesso!"
- ❌ Erro: "Erro ao exportar para Excel"

---

## 📦 Dependências

Usa a biblioteca **xlsx** já instalada:
```json
"dependencies": {
  "xlsx": "^0.18.5"
}
```

Nenhuma dependência adicional necessária!

---

## 🎯 Benefícios

1. **Offline**: Separador pode trabalhar sem internet
2. **Portátil**: Arquivo pode ser compartilhado facilmente
3. **Editável**: Pode adicionar notas manualmente
4. **Imprimível**: Formato ideal para impressão
5. **Arquivável**: Registro permanente da requisição
6. **Universal**: Funciona em qualquer software de planilhas

---

## 🔜 Melhorias Futuras (Sugestões)

1. **Formatação Condicional**
   - Colorir linhas com status "FALTANDO" em vermelho
   - Destacar itens OK em verde

2. **Gráficos**
   - Pizza mostrando % OK vs Faltando
   - Barra de progresso visual

3. **Múltiplas Abas**
   - Aba "Resumo"
   - Aba "Itens"
   - Aba "Timeline"

4. **QR Code**
   - Incluir QR code com link para a tarefa online

5. **Logo**
   - Adicionar logo da empresa no cabeçalho

---

## 📝 Exemplo de Saída

```
INFORMAÇÕES DA TAREFA
ID da Tarefa      abc123de-f456-7890-gh12-ijklmn345678
Atendente         João Silva
Prioridade        Alta
Status            CONCLUIDO
Criado em         24/01/2025 14:30:00

SKU        Descrição           Qtd Pegar  Localização      Estoque Disp.  Total Físico  Total Alocado  Status      Observação
12345      Produto A           10         A-01-02          50             100           30             OK          -
67890      Produto B           5          B-03-01          2              10            8              FALTANDO    Verificar fornecedor
54321      Produto C           15         A-02-05          80             120           25             OK          -

TOTAL DE ITENS    3              30

INFORMAÇÕES DE SEPARAÇÃO
Separador         Maria Santos
Iniciado em       24/01/2025 14:35:00
Concluído em      24/01/2025 15:10:00
Duração           00:35:00

ESTATÍSTICAS
Itens OK          2
Itens Faltando    1
Itens Pendentes   0
```

---

Funcionalidade implementada e pronta para uso! 🎉

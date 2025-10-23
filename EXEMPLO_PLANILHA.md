# Exemplo de Planilha para Upload

## Formato Esperado

A planilha deve ser um arquivo Excel (.xlsx ou .xls) com as seguintes especificações:

### Nome da Aba
- Preferencial: `reposicao`
- Aceita: qualquer nome (usará a primeira aba)

### Colunas Obrigatórias

| Nome da Coluna       | Tipo    | Descrição                          | Exemplo    |
|----------------------|---------|-------------------------------------|------------|
| SKU                  | Texto   | Código único do produto             | 12345      |
| Descrição            | Texto   | Nome/descrição do produto           | Produto A  |
| Quantidade_requerida | Número  | Quantidade a ser separada           | 10         |

### Colunas Opcionais

| Nome da Coluna       | Tipo    | Descrição                          | Exemplo       |
|----------------------|---------|-------------------------------------|---------------|
| Unidade              | Texto   | Unidade de medida                   | un, kg, cx    |
| Local_estoque        | Texto   | Localização no estoque              | A-01-02       |
| Observações          | Texto   | Observações adicionais              | Frágil        |
| Prioridade           | Texto   | Prioridade do item                  | Alta          |

## Exemplo Completo

| SKU   | Descrição          | Quantidade_requerida | Unidade | Local_estoque | Observações    |
|-------|--------------------|---------------------|---------|---------------|----------------|
| 12345 | Detergente 500ml   | 24                  | un      | A-01-02       | Frágil         |
| 67890 | Sabão em Pó 1kg    | 12                  | cx      | A-02-05       |                |
| 11111 | Amaciante 2L       | 6                   | un      | A-01-03       | Produto pesado |
| 22222 | Esponja            | 100                 | un      | B-03-01       |                |
| 33333 | Pano de Limpeza    | 50                  | un      | B-03-02       |                |

## Regras de Validação

### Aprovadas
- ✅ Colunas obrigatórias presentes
- ✅ SKUs duplicados (quantidades serão somadas automaticamente)
- ✅ Colunas opcionais podem estar vazias
- ✅ Múltiplas linhas de produtos

### Rejeitadas
- ❌ Falta de colunas obrigatórias (SKU, Descrição, Quantidade_requerida)
- ❌ Arquivo não é Excel (.xlsx ou .xls)
- ❌ Arquivo corrompido
- ❌ Planilha completamente vazia

## Como Criar a Planilha

### Microsoft Excel
1. Abra o Microsoft Excel
2. Crie uma nova planilha
3. Nomeie a aba como "reposicao"
4. Adicione os cabeçalhos na primeira linha
5. Preencha os dados nas linhas seguintes
6. Salve como .xlsx

### Google Sheets
1. Abra o Google Sheets
2. Crie uma nova planilha
3. Adicione os cabeçalhos na primeira linha
4. Preencha os dados
5. Vá em Arquivo > Download > Microsoft Excel (.xlsx)

### LibreOffice Calc
1. Abra o LibreOffice Calc
2. Crie uma nova planilha
3. Nomeie a aba como "reposicao"
4. Adicione os cabeçalhos
5. Preencha os dados
6. Salve como > Formato: Microsoft Excel 2007-365 (.xlsx)

## Exemplo de Arquivo

Para facilitar, você pode criar um arquivo Excel seguindo este modelo:

```
Linha 1 (Cabeçalhos):
SKU | Descrição | Quantidade_requerida | Unidade | Local_estoque | Observações

Linha 2:
12345 | Detergente 500ml | 24 | un | A-01-02 | Frágil

Linha 3:
67890 | Sabão em Pó 1kg | 12 | cx | A-02-05 |

Linha 4:
11111 | Amaciante 2L | 6 | un | A-01-03 | Produto pesado
```

## Comportamento do Sistema

### Upload Bem-Sucedido
Ao fazer upload de uma planilha válida, você verá:
- ✅ Mensagem de sucesso
- 📊 Resumo: número de SKUs únicos, total de itens, número de linhas
- 🔔 Notificação enviada em tempo real para separadores

### Upload com Erro
Se houver problemas, você verá:
- ❌ Mensagem de erro específica
- 📋 Lista de colunas obrigatórias ausentes (se aplicável)
- 💡 Dica de como corrigir

## Dicas

1. **Organize por localização**: Agrupe itens do mesmo corredor para facilitar a separação
2. **Use prioridades**: Marque itens urgentes com prioridade "Alta"
3. **Seja específico nas descrições**: Ajuda o separador a identificar o produto correto
4. **Mantenha SKUs consistentes**: Use o mesmo formato sempre
5. **Teste com poucos itens primeiro**: Faça um upload de teste com 2-3 itens antes de enviar uma lista grande

## Suporte

Se tiver dúvidas sobre o formato da planilha ou encontrar problemas no upload, entre em contato com o administrador do sistema.

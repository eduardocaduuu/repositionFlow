# Exemplo de Planilha para Upload

## Formato Esperado

A planilha deve ser um arquivo Excel (.xlsx ou .xls) com as seguintes especificações:

### Nome da Aba
- Preferencial: `reposicao`
- Aceita: qualquer nome (usará a primeira aba)

### Colunas Obrigatórias

| Nome da Coluna  | Tipo   | Descrição                        | Exemplo              |
|-----------------|--------|----------------------------------|----------------------|
| Cod Material    | Texto  | SKU/Código do produto            | 12345                |
| Desc Material   | Texto  | Nome/descrição do produto        | Detergente 500ml     |
| pegar           | Número | Quantidade a ser separada        | 24                   |

### Colunas de Localização (Opcionais)

| Nome da Coluna        | Tipo   | Descrição                        | Exemplo    |
|-----------------------|--------|----------------------------------|------------|
| Coluna                | Texto  | Coluna no estoque                | A          |
| Estacao               | Texto  | Estação/Área                     | E1         |
| Rack                  | Texto  | Número do rack                   | R01        |
| Linha prod alocado    | Texto  | Linha do produto alocado         | L02        |
| Coluna prod alocado   | Texto  | Coluna do produto alocado        | C03        |

### Colunas de Estoque (Informativas - Opcionais)

| Nome da Coluna   | Tipo   | Descrição                        | Exemplo |
|------------------|--------|----------------------------------|---------|
| Total físico     | Número | Quantidade total no estoque      | 100     |
| Total alocado    | Número | Quantidade já alocada            | 20      |
| Total disponivel | Número | Quantidade disponível            | 80      |

## Exemplo Completo

| Cod Material | Desc Material    | pegar | Coluna | Estacao | Rack | Linha prod alocado | Coluna prod alocado | Total físico | Total alocado | Total disponivel |
|--------------|------------------|-------|--------|---------|------|-------------------|-------------------|------------|-------------|----------------|
| 12345        | Detergente 500ml | 24    | A      | E1      | R01  | L02               | C03               | 100        | 20          | 80             |
| 67890        | Sabão em Pó 1kg  | 12    | B      | E1      | R02  | L01               | C02               | 50         | 10          | 40             |
| 11111        | Amaciante 2L     | 6     | A      | E2      | R01  | L03               | C01               | 30         | 5           | 25             |
| 22222        | Esponja          | 100   | C      | E1      | R03  | L01               | C04               | 200        | 50          | 150            |
| 33333        | Pano de Limpeza  | 50    | B      | E2      | R02  | L02               | C02               | 150        | 30          | 120            |

## Regras de Validação

### Aprovadas
- ✅ Colunas obrigatórias presentes (Cod Material, Desc Material, pegar)
- ✅ SKUs duplicados (quantidades serão somadas automaticamente)
- ✅ Colunas opcionais podem estar vazias
- ✅ Múltiplas linhas de produtos
- ✅ Linhas com quantidade zero serão ignoradas

### Rejeitadas
- ❌ Falta de colunas obrigatórias (Cod Material, Desc Material, pegar)
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
Cod Material | Desc Material | pegar | Coluna | Estacao | Rack | Total disponivel

Linha 2:
12345 | Detergente 500ml | 24 | A | E1 | R01 | 80

Linha 3:
67890 | Sabão em Pó 1kg | 12 | B | E1 | R02 | 40

Linha 4:
11111 | Amaciante 2L | 6 | A | E2 | R01 | 25
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

# RepositionFlow

Sistema de controle de separação de estoque com cronômetro e upload de planilhas em tempo real.

## Descrição

RepositionFlow é uma aplicação web para otimizar o processo de separação de mercadorias do estoque para a loja. O sistema permite que atendentes façam upload de planilhas Excel com itens a serem repostos, e separadores recebam notificações em tempo real com cronômetro automático para medir o tempo de separação.

## Funcionalidades

### Para Atendentes
- Upload de planilhas Excel (.xlsx) com lista de reposição
- Acompanhamento em tempo real do status das tarefas
- Visualização do tempo de separação
- Histórico de requisições

### Para Separadores
- Notificações em tempo real de novas requisições
- Cronômetro automático ao iniciar separação
- Possibilidade de pausar e retomar separação
- Marcação de itens como OK ou FALTANDO
- Visualização detalhada dos itens e locais no estoque

### Para Administradores
- Painel de métricas e relatórios
- Tempo médio de separação
- Ranking de separadores por desempenho
- Exportação de relatórios em CSV
- Métricas por atendente e separador

## Formato da Planilha

A planilha Excel deve conter as seguintes colunas obrigatórias:

- **SKU**: Código do produto (string ou número)
- **Descrição**: Nome/descrição do produto
- **Quantidade_requerida**: Quantidade a ser separada (número inteiro)

Colunas opcionais:

- **Unidade**: Unidade de medida (un, kg, cx, etc.)
- **Local_estoque**: Localização no estoque (corredor/prateleira)
- **Observações**: Observações adicionais
- **Prioridade**: Prioridade do item

### Exemplo de Planilha

| SKU   | Descrição          | Quantidade_requerida | Unidade | Local_estoque |
|-------|--------------------|---------------------|---------|---------------|
| 12345 | Produto A          | 10                  | un      | A-01-02       |
| 67890 | Produto B          | 5                   | cx      | B-03-01       |

## Tecnologias Utilizadas

- **Backend**: Node.js, Express, WebSocket (ws)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Banco de Dados**: Firebase Firestore (NoSQL)
- **Processamento de Planilhas**: xlsx
- **Upload de Arquivos**: multer
- **Deploy**:
  - Frontend: Render (plano gratuito)
  - Backend: Koyeb (plano gratuito - sempre ativo!)

## Instalação Local

### Pré-requisitos

- Node.js 18 ou superior
- npm ou yarn

### Passos

1. Clone o repositório:
```bash
git clone https://github.com/eduardocaduuu/repositionFlow.git
cd repositionFlow
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor:
```bash
npm start
```

4. Acesse no navegador:
```
http://localhost:3000
```

## 🚀 Deploy em Produção

### Deploy Recomendado (24/7 - Sempre Ativo!)

**Frontend (Render) + Backend (Koyeb)** - Arquitetura separada que mantém o backend sempre ativo!

- **Frontend no Render**: HTML/CSS/JS estáticos (pode dormir após inatividade)
- **Backend no Koyeb**: Node.js + API + WebSocket (SEMPRE ATIVO no plano gratuito!)

📖 **Guia completo**: Veja [DEPLOYMENT.md](./DEPLOYMENT.md) para instruções passo a passo detalhadas.

### Deploy Simples (Monolítico no Render)

⚠️ **Limitação**: O serviço dorme após 15 minutos de inatividade.

1. Faça fork deste repositório
2. Acesse [Render Dashboard](https://dashboard.render.com/)
3. Clique em "New +" e selecione "Web Service"
4. Conecte seu repositório GitHub
5. O Render detectará automaticamente o `render.yaml`
6. Configure as variáveis de ambiente do Firebase (veja [FIREBASE_SETUP.md](./FIREBASE_SETUP.md))
7. Clique em "Create Web Service"

## Uso

### 1. Login

Ao acessar a aplicação, você verá uma tela de login. Selecione seu papel:

- **Atendente**: Para enviar requisições de reposição
- **Separador**: Para receber e processar requisições
- **Administrador**: Para visualizar métricas

### 2. Criando uma Requisição (Atendente)

1. Clique em "Nova Requisição"
2. Preencha os dados:
   - Nome do Atendente
   - Nome da Loja
   - Prioridade (Baixa, Média, Alta)
3. Faça upload da planilha Excel
4. Clique em "Enviar Requisição"

### 3. Processando uma Requisição (Separador)

1. Você receberá uma notificação em tempo real
2. Clique na tarefa no Dashboard
3. Clique em "Iniciar Separação" (o cronômetro inicia automaticamente)
4. Marque os itens como OK ou FALTANDO conforme separa
5. Use "Pausar" se precisar interromper temporariamente
6. Clique em "Concluir" quando finalizar

### 4. Visualizando Métricas (Administrador)

1. Clique em "Métricas"
2. Selecione o período (Últimas 24h, Última semana, Último mês)
3. Visualize:
   - Tempo médio de separação
   - Ranking de separadores
   - Estatísticas por atendente
   - Estatísticas por separador
4. Clique em "Exportar CSV" para baixar relatório

## Funcionalidades Detalhadas

### Cronômetro Inteligente

- Inicia automaticamente ao começar a separação
- Continua contando mesmo se o separador se desconectar
- Suporta pausas (tempo pausado não é contabilizado)
- Exibe tempo em tempo real para separador e atendente

### Notificações em Tempo Real

- Nova tarefa → Separadores são notificados
- Separação iniciada → Atendente vê em tempo real
- Item marcado → Atualização instantânea
- Tarefa concluída → Todos são notificados com tempo total

### Validação de Planilha

- Verifica colunas obrigatórias antes de aceitar
- Agrupa SKUs duplicados e soma quantidades
- Exibe resumo (número de linhas, SKUs únicos, total de itens)
- Rejeita arquivos com formato inválido

### Histórico e Auditoria

- Registro completo de todas as ações
- Timeline visual de eventos
- Armazena quem iniciou, pausou, concluiu
- Registra todas as pausas com duração

## Limitações e Soluções

### Deploy Monolítico no Render (Gratuito)

- ⚠️ O serviço dorme após 15 minutos de inatividade
- ⚠️ Primeira requisição pode demorar ~30 segundos para acordar

### Deploy Separado (Recomendado - Render + Koyeb)

- ✅ Backend sempre ativo no Koyeb (plano gratuito!)
- ✅ Frontend estático no Render (carrega instantaneamente)
- ✅ Persistência de dados com Firebase Firestore
- ✅ Zero custo mensal!

**Veja o guia completo em [DEPLOYMENT.md](./DEPLOYMENT.md)**

## Melhorias Futuras

- [x] Banco de dados persistente (Firebase Firestore) ✅
- [ ] Autenticação com JWT
- [ ] Atribuição automática de tarefas
- [ ] Roteirização otimizada baseada em local de estoque
- [ ] Integração com leitor de código de barras
- [ ] App mobile para separadores
- [ ] Gamificação com placares semanais
- [ ] Gráficos e dashboards avançados
- [ ] Notificações push
- [ ] Export em Excel além de CSV

## Estrutura do Projeto

```
repositionFlow/
├── public/                  # Frontend
│   ├── index.html          # HTML principal
│   ├── styles.css          # Estilos
│   ├── config.js           # Configuração da URL do backend
│   └── app.js              # Lógica do frontend
├── uploads/                # Arquivos enviados (gerado automaticamente)
├── server.js               # Servidor backend
├── database.js             # Módulo de acesso ao Firestore
├── package.json            # Dependências
├── .env                    # Variáveis de ambiente (local)
├── .koyeb.yaml             # Configuração do Koyeb
├── render.yaml             # Configuração do Render
├── DEPLOYMENT.md           # Guia de deploy separado
├── FIREBASE_SETUP.md       # Guia de configuração do Firebase
├── .gitignore             # Arquivos ignorados pelo Git
└── README.md              # Este arquivo
```

## API Endpoints

### Tarefas

- `POST /api/tasks` - Criar nova tarefa (upload de planilha)
- `GET /api/tasks` - Listar tarefas (com filtros)
- `GET /api/tasks/:id` - Obter detalhes de uma tarefa
- `POST /api/tasks/:id/start` - Iniciar separação
- `POST /api/tasks/:id/pause` - Pausar separação
- `POST /api/tasks/:id/resume` - Retomar separação
- `POST /api/tasks/:id/complete` - Concluir separação
- `PATCH /api/tasks/:id/items/:sku` - Atualizar status de item

### Métricas

- `GET /api/metrics` - Obter métricas (com filtro de período)
- `GET /api/export/csv` - Exportar relatório CSV

### Outros

- `GET /api/download/:filename` - Download de arquivo
- `GET /health` - Health check

## WebSocket Events

### Cliente → Servidor

- `register` - Registrar usuário (name, role)

### Servidor → Cliente

- `registered` - Confirmação de registro
- `new_task` - Nova tarefa criada
- `task_started` - Separação iniciada
- `task_paused` - Separação pausada
- `task_resumed` - Separação retomada
- `task_completed` - Separação concluída
- `item_updated` - Item atualizado

## Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## Licença

MIT License - veja o arquivo LICENSE para detalhes

## Suporte

Para reportar bugs ou solicitar features, abra uma issue no GitHub.

## Autor

Eduardo Cadu - [GitHub](https://github.com/eduardocaduuu)

---

Desenvolvido com Node.js e WebSocket para máxima performance em tempo real.

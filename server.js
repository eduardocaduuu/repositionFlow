// Carregar variáveis de ambiente primeiro
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const database = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Configuração CORS para aceitar frontend do Render
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*', // Em produção, definir URL específica do Render
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

// Criar diretório de uploads se não existir
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls) são permitidos'));
    }
  }
});

// Armazenamento
// Sistema usa Firebase Firestore se configurado, caso contrário usa memória
// O módulo database.js gerencia automaticamente o fallback
let users = []; // {id, name, role: 'atendente' | 'separador', ws} - sempre em memória (sessões WebSocket)

// Broadcast para todos os clientes conectados
function broadcast(message, filterRole = null) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      const user = users.find(u => u.ws === client);
      if (!filterRole || (user && user.role === filterRole)) {
        client.send(JSON.stringify(message));
      }
    }
  });
}

// Validar colunas obrigatórias da planilha
function validateExcelColumns(worksheet) {
  const headers = [];

  const range = xlsx.utils.decode_range(worksheet['!ref']);
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    if (cell && cell.v) {
      headers.push(cell.v.toString().trim());
    }
  }

  // Verificar se existem variações das colunas obrigatórias
  // NOTA: Quantidade NÃO é obrigatória, pois será preenchida pelo atendente na tela de preview
  const requiredColumnsVariations = {
    'Cod Material': ['Cod Material', 'Código Material', 'Codigo Material', 'SKU', 'Cód Material'],
    'Desc Material': ['Desc Material', 'Descrição', 'Descricao', 'Descrição Material', 'Descricao Material', 'Material']
  };

  const missingColumns = [];
  const foundColumns = {};

  // Verificar cada grupo de colunas obrigatórias
  for (const [key, variations] of Object.entries(requiredColumnsVariations)) {
    const found = variations.some(variation =>
      headers.some(header => header.toLowerCase() === variation.toLowerCase())
    );

    if (!found) {
      missingColumns.push(key);
    } else {
      // Encontrar qual variação foi encontrada
      const foundVariation = variations.find(variation =>
        headers.some(header => header.toLowerCase() === variation.toLowerCase())
      );
      foundColumns[key] = foundVariation;
    }
  }

  return {
    valid: missingColumns.length === 0,
    missingColumns,
    headers,
    foundColumns
  };
}

// Helper: Buscar valor de coluna com múltiplas variações de nomes
function getColumnValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  return null;
}

// Processar planilha Excel
function processExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'reposicao')
                    || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const validation = validateExcelColumns(worksheet);
  if (!validation.valid) {
    return {
      success: false,
      error: `Colunas obrigatórias ausentes: ${validation.missingColumns.join(', ')}`
    };
  }

  const data = xlsx.utils.sheet_to_json(worksheet);

  // Processar items e normalizar colunas
  const itemsMap = new Map();
  data.forEach(row => {
    // Buscar SKU com múltiplas variações
    const sku = getColumnValue(row, [
      'Cod Material', 'Código Material', 'Codigo Material', 'SKU', 'Cód Material'
    ])?.toString() || '';

    // Buscar quantidade com múltiplas variações (OPCIONAL - pode não existir na planilha)
    // Se não existir, será preenchida pelo atendente na tela de preview
    const quantidadePegar = parseInt(getColumnValue(row, [
      'pegar', 'Quantidade', 'Qtd', 'Quantidade Solicitada', 'Quantidade Requerida',
      'Qtd Solicitada', 'Qtd Requerida', 'Quantidade a Pegar', 'Qtd a Pegar'
    ])) || 0;

    // Pular apenas linhas sem SKU
    if (!sku) return;

    if (itemsMap.has(sku)) {
      // Se SKU duplicado, somar quantidades
      const existing = itemsMap.get(sku);
      existing.quantidade_pegar += quantidadePegar;
    } else {
      // Montar localização completa
      const localizacao = [
        row['Coluna'],
        row['Estacao'],
        row['Rack'],
        row['Linha prod alocado'],
        row['Coluna prod alocado']
      ].filter(Boolean).join(' - ') || 'Não informado';

      // Buscar estoque disponível com múltiplas variações
      const estoqueDisponivel = getColumnValue(row, [
        'Estoque Disponível',
        'Estoque Disponivel',
        'Total disponível',
        'Total disponivel',
        'Disponível',
        'Disponivel',
        'Qtd Disponível',
        'Qtd Disponivel'
      ]) || 0;

      const totalFisico = getColumnValue(row, [
        'Total Físico',
        'Total físico',
        'Total Fisico',
        'Estoque Físico',
        'Estoque físico',
        'Estoque Fisico'
      ]) || 0;

      const totalAlocado = getColumnValue(row, [
        'Total Alocado',
        'Total alocado',
        'Estoque Alocado',
        'Estoque alocado'
      ]) || 0;

      // Buscar descrição com múltiplas variações
      const descricao = getColumnValue(row, [
        'Desc Material', 'Descrição', 'Descricao', 'Descrição Material',
        'Descricao Material', 'Material'
      ]) || 'Sem descrição';

      itemsMap.set(sku, {
        sku: sku,
        descricao: descricao,
        quantidade_pegar: quantidadePegar,
        localizacao: localizacao,
        // Informações de estoque (opcional) - agora aceita múltiplas variações
        total_fisico: totalFisico,
        total_alocado: totalAlocado,
        total_disponivel: estoqueDisponivel,
        // Localização detalhada (para referência)
        coluna: row['Coluna'] || '',
        estacao: row['Estacao'] || '',
        rack: row['Rack'] || '',
        linha_prod_alocado: row['Linha prod alocado'] || '',
        coluna_prod_alocado: row['Coluna prod alocado'] || ''
      });
    }
  });

  const items = Array.from(itemsMap.values());

  return {
    success: true,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantidade_pegar, 0),
    uniqueSkus: items.length
  };
}

// Processar planilha de conclusão do separador
function processExcelConclusao(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Obter todas as colunas da planilha
  const data = xlsx.utils.sheet_to_json(worksheet);

  if (data.length === 0) {
    return {
      success: false,
      error: 'Planilha vazia'
    };
  }

  // Verificar colunas obrigatórias (aceitar variações)
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  const requiredColumns = [
    {
      names: ['Data movimentacao', 'Data movimentação', 'Data Movimentacao', 'Data Movimentação', 'Data', 'Data da movimentacao'],
      found: false,
      label: 'Data movimentacao'
    },
    {
      names: ['Tipo movimentacao', 'Tipo movimentação', 'Tipo Movimentacao', 'Tipo Movimentação', 'Tipo'],
      found: false,
      label: 'Tipo movimentacao'
    },
    {
      names: ['Quantidade material', 'Qtd material', 'Quantidade', 'Qtd Material', 'Quantidade Material'],
      found: false,
      label: 'Quantidade material'
    }
  ];

  // Verificar se cada coluna obrigatória existe (com variações)
  requiredColumns.forEach(reqCol => {
    reqCol.found = reqCol.names.some(name =>
      columns.some(col => col.toLowerCase().trim() === name.toLowerCase().trim())
    );
  });

  const missingColumns = requiredColumns.filter(col => !col.found).map(col => col.label);

  if (missingColumns.length > 0) {
    return {
      success: false,
      error: `Colunas obrigatórias ausentes na planilha de conclusão: ${missingColumns.join(', ')}`
    };
  }

  // Processar dados da planilha
  const movimentacoes = data.map(row => {
    // Buscar valores com múltiplas variações de nome
    const dataMovimentacao = getColumnValue(row, [
      'Data movimentacao', 'Data movimentação', 'Data Movimentacao',
      'Data Movimentação', 'Data', 'Data da movimentacao'
    ]);

    const tipoMovimentacao = getColumnValue(row, [
      'Tipo movimentacao', 'Tipo movimentação', 'Tipo Movimentacao',
      'Tipo Movimentação', 'Tipo'
    ]);

    const quantidadeMaterial = getColumnValue(row, [
      'Quantidade material', 'Qtd material', 'Quantidade',
      'Qtd Material', 'Quantidade Material'
    ]);

    return {
      data_movimentacao: dataMovimentacao,
      tipo_movimentacao: tipoMovimentacao,
      quantidade_material: quantidadeMaterial,
      // Capturar todas as outras colunas que possam existir
      dados_completos: row
    };
  });

  return {
    success: true,
    movimentacoes,
    totalLinhas: movimentacoes.length,
    totalQuantidade: movimentacoes.reduce((sum, mov) => {
      const qtd = parseInt(mov.quantidade_material) || 0;
      return sum + qtd;
    }, 0)
  };
}

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Novo cliente conectado');

  // Marcar conexão como viva
  ws.isAlive = true;

  // Responder a pings do cliente
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Responder a ping do cliente com pong
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'register') {
        // Registrar usuário
        const userId = uuidv4();
        users.push({
          id: userId,
          name: data.name,
          role: data.role,
          ws: ws
        });

        ws.send(JSON.stringify({
          type: 'registered',
          userId,
          message: 'Registrado com sucesso'
        }));

        console.log(`Usuário registrado: ${data.name} (${data.role})`);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem WebSocket:', error);
    }
  });

  ws.on('close', () => {
    users = users.filter(u => u.ws !== ws);
    console.log('Cliente desconectado');
  });
});

// Heartbeat: Enviar ping a cada 30 segundos para manter conexões vivas
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      // Cliente não respondeu ao último ping, desconectar
      return ws.terminate();
    }

    // Marcar como "não respondeu ainda"
    ws.isAlive = false;
    // Enviar ping (WebSocket nativo)
    ws.ping();
  });
}, 30000); // 30 segundos

// Limpar intervalo quando o servidor fechar
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// API Routes

// Preview de planilha (antes de criar tarefa)
app.post('/api/tasks/preview', upload.single('planilha'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    // Processar planilha
    const result = processExcel(req.file.path);

    if (!result.success) {
      // Remover arquivo inválido
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: result.error });
    }

    // Retornar dados para preview/edição
    // IMPORTANTE: Não remover o arquivo ainda, pois será usado na confirmação
    res.json({
      success: true,
      filename: req.file.filename, // Salvar para usar depois
      items: result.items.map(item => ({
        sku: item.sku,
        descricao: item.descricao,
        total_disponivel: item.total_disponivel || 0,
        quantidade_pegar: item.quantidade_pegar || 0, // Quantidade da planilha (pode ser editada)
        localizacao: item.localizacao,
        // Dados adicionais para referência
        total_fisico: item.total_fisico,
        total_alocado: item.total_alocado,
        coluna: item.coluna,
        estacao: item.estacao,
        rack: item.rack,
        linha_prod_alocado: item.linha_prod_alocado,
        coluna_prod_alocado: item.coluna_prod_alocado
      })),
      summary: {
        totalItems: result.totalItems,
        uniqueSkus: result.uniqueSkus,
        linhas: result.items.length
      }
    });

  } catch (error) {
    console.error('Erro ao fazer preview da planilha:', error);
    res.status(500).json({ error: 'Erro ao processar planilha' });
  }
});

// Criar nova tarefa (upload de planilha)
app.post('/api/tasks', upload.single('planilha'), async (req, res) => {
  try {
    const { nomeAtendente, prioridade, observacoes, items, originalFilename } = req.body;

    if (!nomeAtendente) {
      return res.status(400).json({ error: 'Nome do atendente é obrigatório' });
    }

    let taskItems;
    let arquivoOriginal;

    // Verifica se os dados vêm do preview (já processados)
    if (items && originalFilename) {
      // Dados já foram processados no preview
      taskItems = JSON.parse(items);
      arquivoOriginal = originalFilename;

      // CORREÇÃO: Validar cada item rigorosamente
      const invalidItems = taskItems.filter(item => {
        const qty = item.quantidade_pegar;
        const disponivel = item.total_disponivel || 0;

        // Se estoque = 0, não pode pegar nada
        if (disponivel === 0 && qty > 0) {
          return true;
        }

        // Se estoque > 0, quantidade não pode exceder disponível
        if (disponivel > 0 && qty > disponivel) {
          return true;
        }

        // Quantidade não pode ser negativa
        if (qty < 0) {
          return true;
        }

        return false;
      });

      if (invalidItems.length > 0) {
        return res.status(400).json({
          error: 'Não é possível requisitar itens sem estoque ou com quantidade maior que o disponível',
          invalidItems: invalidItems.map(i => ({
            sku: i.sku,
            descricao: i.descricao,
            solicitado: i.quantidade_pegar,
            disponivel: i.total_disponivel || 0,
            motivo: i.total_disponivel === 0 ? 'Item sem estoque' : 'Quantidade excede disponível'
          }))
        });
      }
    } else if (req.file) {
      // Upload direto sem preview (fluxo antigo para compatibilidade)
      const result = processExcel(req.file.path);

      if (!result.success) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: result.error });
      }

      taskItems = result.items;
      arquivoOriginal = req.file.filename;
    } else {
      return res.status(400).json({ error: 'Nenhum arquivo ou dados enviados' });
    }

    // Calcular totais
    const totalItems = taskItems.reduce((sum, item) => sum + item.quantidade_pegar, 0);
    const uniqueSkus = taskItems.length;

    // Criar tarefa
    const task = {
      id: uuidv4(),
      nomeAtendente,
      prioridade: prioridade || 'Média',
      observacoes: observacoes || '',
      status: 'PENDENTE',
      items: taskItems,
      totalItems,
      uniqueSkus,
      arquivoOriginal,
      createdAt: new Date().toISOString(),
      timeline: [{
        action: 'CRIADA',
        timestamp: new Date().toISOString(),
        user: nomeAtendente
      }]
    };

    await database.createTask(task);

    // Notificar separadores
    broadcast({
      type: 'new_task',
      task: {
        id: task.id,
        nomeAtendente: task.nomeAtendente,
        prioridade: task.prioridade,
        totalItems: task.totalItems,
        uniqueSkus: task.uniqueSkus,
        createdAt: task.createdAt
      }
    }, 'separador');

    res.json({
      success: true,
      taskId: task.id,
      message: 'Tarefa criada com sucesso',
      summary: {
        totalItems,
        uniqueSkus,
        linhas: taskItems.length
      }
    });

  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    res.status(500).json({ error: 'Erro ao processar planilha' });
  }
});

// Listar tarefas
app.get('/api/tasks', async (req, res) => {
  try {
    console.log('📋 GET /api/tasks - Iniciando busca de tarefas...');
    const { status, atendente, dataInicio, dataFim } = req.query;

    // Buscar tarefas do database
    const filters = {};
    if (status) filters.status = status;
    if (atendente) filters.nomeAtendente = atendente;

    console.log('🔍 Filtros aplicados:', filters);

    let filteredTasks = await database.getAllTasks(filters);
    console.log(`✅ Tarefas encontradas: ${filteredTasks.length}`);

    // Aplicar filtros de data (não suportados diretamente pelo database)
    if (dataInicio) {
      filteredTasks = filteredTasks.filter(t =>
        new Date(t.createdAt) >= new Date(dataInicio)
      );
    }

    if (dataFim) {
      filteredTasks = filteredTasks.filter(t =>
        new Date(t.createdAt) <= new Date(dataFim)
      );
    }

    console.log(`📤 Retornando ${filteredTasks.length} tarefas`);
    res.json(filteredTasks);
  } catch (error) {
    console.error('❌ ERRO ao listar tarefas:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: error.message || 'Erro ao buscar tarefas' });
  }
});

// Obter detalhes de uma tarefa
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    res.json(task);
  } catch (error) {
    console.error('Erro ao buscar tarefa:', error);
    res.status(500).json({ error: 'Erro ao buscar tarefa' });
  }
});

// Iniciar separação (iniciar cronômetro)
app.post('/api/tasks/:id/start', async (req, res) => {
  try {
    const { nomeSeparador } = req.body;
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    if (task.status === 'EM_SEPARACAO') {
      return res.status(400).json({
        error: 'Já existe uma separação em andamento',
        separador: task.nomeSeparador
      });
    }

    if (task.status === 'CONCLUIDO') {
      return res.status(400).json({ error: 'Tarefa já concluída' });
    }

    const startTime = new Date().toISOString();
    const timeline = task.timeline || [];
    timeline.push({
      action: 'INICIADA',
      timestamp: startTime,
      user: nomeSeparador
    });

    await database.updateTask(req.params.id, {
      status: 'EM_SEPARACAO',
      nomeSeparador,
      startTime,
      activeTime: 0,
      isPaused: false,
      pausas: [],
      timeline
    });

    // Notificar todos os clientes
    broadcast({
      type: 'task_started',
      taskId: task.id,
      nomeSeparador,
      startTime
    });

    res.json({
      success: true,
      message: 'Separação iniciada',
      task: {
        id: task.id,
        status: 'EM_SEPARACAO',
        startTime
      }
    });
  } catch (error) {
    console.error('Erro ao iniciar separação:', error);
    res.status(500).json({ error: 'Erro ao iniciar separação' });
  }
});

// Pausar separação
app.post('/api/tasks/:id/pause', async (req, res) => {
  try {
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    if (task.status !== 'EM_SEPARACAO') {
      return res.status(400).json({ error: 'Tarefa não está em separação' });
    }

    if (task.isPaused) {
      return res.status(400).json({ error: 'Tarefa já está pausada' });
    }

    const now = new Date().toISOString();
    const timeline = task.timeline || [];
    timeline.push({
      action: 'PAUSADA',
      timestamp: now,
      user: task.nomeSeparador
    });

    await database.updateTask(req.params.id, {
      isPaused: true,
      pauseStartTime: now,
      timeline
    });

    broadcast({
      type: 'task_paused',
      taskId: task.id,
      pauseTime: now
    });

    res.json({ success: true, message: 'Separação pausada' });
  } catch (error) {
    console.error('Erro ao pausar separação:', error);
    res.status(500).json({ error: 'Erro ao pausar separação' });
  }
});

// Retomar separação
app.post('/api/tasks/:id/resume', async (req, res) => {
  try {
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    if (!task.isPaused) {
      return res.status(400).json({ error: 'Tarefa não está pausada' });
    }

    const now = new Date().toISOString();
    const pauseDuration = (new Date(now) - new Date(task.pauseStartTime)) / 1000;

    const pausas = task.pausas || [];
    pausas.push({
      inicio: task.pauseStartTime,
      fim: now,
      duracao: pauseDuration
    });

    const timeline = task.timeline || [];
    timeline.push({
      action: 'RETOMADA',
      timestamp: now,
      user: task.nomeSeparador
    });

    await database.updateTask(req.params.id, {
      pausas,
      isPaused: false,
      pauseStartTime: null,
      timeline
    });

    broadcast({
      type: 'task_resumed',
      taskId: task.id,
      resumeTime: now
    });

    res.json({ success: true, message: 'Separação retomada' });
  } catch (error) {
    console.error('Erro ao retomar separação:', error);
    res.status(500).json({ error: 'Erro ao retomar separação' });
  }
});

// Atualizar status de item
app.patch('/api/tasks/:id/items/:sku', async (req, res) => {
  try {
    const { status, observacao } = req.body;
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    const items = task.items || [];
    const item = items.find(i => i.sku?.toString() === req.params.sku);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    item.status_separacao = status; // 'OK' ou 'FALTANDO'
    if (observacao) {
      item.observacao_separacao = observacao;
    }

    await database.updateTask(req.params.id, { items });

    broadcast({
      type: 'item_updated',
      taskId: task.id,
      sku: req.params.sku,
      status
    });

    res.json({ success: true, item });
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

// Concluir separação (com upload de planilha obrigatório)
app.post('/api/tasks/:id/complete', upload.single('planilhaConclusao'), async (req, res) => {
  try {
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    if (task.status !== 'EM_SEPARACAO') {
      return res.status(400).json({ error: 'Tarefa não está em separação' });
    }

    // Validar que arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({
        error: 'É obrigatório enviar a planilha de conclusão com as colunas: Data movimentacao, Tipo movimentacao, Quantidade material'
      });
    }

    // Processar planilha de conclusão
    const resultConclusao = processExcelConclusao(req.file.path);

    if (!resultConclusao.success) {
      // Remover arquivo inválido
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: resultConclusao.error });
    }

    const now = new Date().toISOString();

    // Calcular tempo ativo
    const totalTime = (new Date(now) - new Date(task.startTime)) / 1000;
    const pausas = task.pausas || [];
    const pauseTime = pausas.reduce((sum, p) => sum + p.duracao, 0);
    const activeTime = totalTime - pauseTime;

    // Formatar tempo para exibição
    const hours = Math.floor(activeTime / 3600);
    const minutes = Math.floor((activeTime % 3600) / 60);
    const seconds = Math.floor(activeTime % 60);
    const durationFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const timeline = task.timeline || [];
    timeline.push({
      action: 'CONCLUIDA',
      timestamp: now,
      user: task.nomeSeparador,
      detalhes: `Planilha de conclusão enviada: ${resultConclusao.totalLinhas} linhas, ${resultConclusao.totalQuantidade} itens`
    });

    const updatedTask = await database.updateTask(req.params.id, {
      status: 'CONCLUIDO',
      endTime: now,
      activeTime,
      durationFormatted,
      planilhaConclusao: {
        arquivo: req.file.filename,
        movimentacoes: resultConclusao.movimentacoes,
        totalLinhas: resultConclusao.totalLinhas,
        totalQuantidade: resultConclusao.totalQuantidade,
        uploadedAt: now
      },
      timeline
    });

    // Notificar todos os clientes
    broadcast({
      type: 'task_completed',
      taskId: task.id,
      task: {
        id: task.id,
        nomeAtendente: task.nomeAtendente,
        nomeSeparador: task.nomeSeparador,
        totalItems: task.totalItems
      },
      endTime: now,
      duration: durationFormatted,
      activeTime
    });

    res.json({
      success: true,
      message: 'Separação concluída com sucesso',
      duration: durationFormatted,
      activeTime,
      planilhaConclusao: {
        totalLinhas: resultConclusao.totalLinhas,
        totalQuantidade: resultConclusao.totalQuantidade
      }
    });
  } catch (error) {
    console.error('Erro ao concluir tarefa:', error);
    // Remover arquivo se houver erro
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erro ao processar conclusão da tarefa' });
  }
});

// Obter métricas
app.get('/api/metrics', async (req, res) => {
  try {
    console.log('📊 GET /api/metrics - Buscando métricas...');
    const { periodo } = req.query; // 'dia', 'semana', 'mes'

    const filteredTasks = await database.getCompletedTasks({ periodo });
    console.log(`✅ ${filteredTasks.length} tarefas concluídas encontradas`);

    // Tempo médio
    const avgTime = filteredTasks.length > 0
      ? filteredTasks.reduce((sum, t) => sum + (t.activeTime || 0), 0) / filteredTasks.length
      : 0;

    // Por atendente
    const porAtendente = {};
    filteredTasks.forEach(t => {
      if (t.nomeAtendente) {
        if (!porAtendente[t.nomeAtendente]) {
          porAtendente[t.nomeAtendente] = { count: 0, totalTime: 0 };
        }
        porAtendente[t.nomeAtendente].count++;
        porAtendente[t.nomeAtendente].totalTime += (t.activeTime || 0);
      }
    });

    // Por separador
    const porSeparador = {};
    filteredTasks.forEach(t => {
      if (t.nomeSeparador) {
        if (!porSeparador[t.nomeSeparador]) {
          porSeparador[t.nomeSeparador] = { count: 0, totalTime: 0 };
        }
        porSeparador[t.nomeSeparador].count++;
        porSeparador[t.nomeSeparador].totalTime += (t.activeTime || 0);
      }
    });

    // Ranking de separadores (melhores tempos médios)
    const rankingSeparadores = Object.entries(porSeparador)
      .map(([nome, data]) => ({
        nome,
        count: data.count,
        avgTime: data.totalTime / data.count
      }))
      .sort((a, b) => a.avgTime - b.avgTime);

    const response = {
      periodo: periodo || 'todos',
      totalTarefas: filteredTasks.length,
      tempoMedio: avgTime,
      porAtendente: porAtendente || {},
      porSeparador: porSeparador || {},
      rankingSeparadores: rankingSeparadores || []
    };

    console.log('📤 Retornando métricas:', {
      totalTarefas: response.totalTarefas,
      atendentes: Object.keys(porAtendente).length,
      separadores: Object.keys(porSeparador).length
    });

    res.json(response);
  } catch (error) {
    console.error('❌ ERRO ao obter métricas:', error);
    console.error('Stack:', error.stack);
    // Retornar estrutura vazia válida em caso de erro
    res.status(500).json({
      error: error.message || 'Erro ao obter métricas',
      periodo: req.query.periodo || 'todos',
      totalTarefas: 0,
      tempoMedio: 0,
      porAtendente: {},
      porSeparador: {},
      rankingSeparadores: []
    });
  }
});

// Exportar relatório CSV
app.get('/api/export/csv', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;

    let filteredTasks = await database.getCompletedTasks({});

    if (dataInicio) {
      filteredTasks = filteredTasks.filter(t =>
        new Date(t.createdAt) >= new Date(dataInicio)
      );
    }

    if (dataFim) {
      filteredTasks = filteredTasks.filter(t =>
        new Date(t.createdAt) <= new Date(dataFim)
      );
    }

    // Gerar CSV
    const headers = 'ID,Atendente,Loja,Separador,Prioridade,Criado em,Iniciado em,Concluído em,Duração,Itens Únicos,Total Itens\n';
    const rows = filteredTasks.map(t =>
      `${t.id},${t.nomeAtendente},${t.nomeLoja || ''},${t.nomeSeparador || ''},${t.prioridade},${t.createdAt},${t.startTime || ''},${t.endTime || ''},${t.durationFormatted || ''},${t.uniqueSkus},${t.totalItems}`
    ).join('\n');

    const csv = headers + rows;

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename=relatorio.csv');
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório CSV' });
  }
});

// Download de arquivo
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  res.download(filePath);
});

// Exportar tarefa para Excel
app.get('/api/tasks/:id/export-excel', async (req, res) => {
  try {
    console.log('📊 [EXCEL EXPORT] Versão simplificada (4 colunas) - Commit: a9983ad');

    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    // Criar workbook
    const workbook = xlsx.utils.book_new();

    // Preparar dados para a planilha - FORMATO ULTRA SIMPLIFICADO
    // APENAS A TABELA DE ITENS - SEM INFORMAÇÕES EXTRAS
    const worksheetData = [
      // Headers dos itens - APENAS 4 COLUNAS
      ['SKU', 'Descrição', 'Localização', 'Qtd a Pegar']
    ];

    console.log('📊 [EXCEL EXPORT] Formato ultra simplificado - APENAS tabela de itens');

    // Adicionar itens - APENAS 4 COLUNAS
    task.items.forEach(item => {
      worksheetData.push([
        item.sku,
        item.descricao,
        item.localizacao,
        item.quantidade_pegar
      ]);
    });

    // Criar worksheet
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

    // Definir largura das colunas - APENAS 4 COLUNAS
    worksheet['!cols'] = [
      { wch: 15 },  // SKU
      { wch: 50 },  // Descrição
      { wch: 35 },  // Localização
      { wch: 15 }   // Qtd a Pegar
    ];

    // Adicionar worksheet ao workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Itens da Tarefa');

    // Gerar buffer do Excel
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Nome do arquivo com timestamp para evitar cache
    const timestamp = Date.now();
    const fileName = `tarefa_${task.id.substring(0, 8)}_${new Date().toISOString().split('T')[0]}_${timestamp}.xlsx`;

    console.log('📊 [EXCEL EXPORT] Enviando arquivo:', fileName);

    // Enviar arquivo COM HEADERS ANTI-CACHE
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    // FORÇAR SEM CACHE
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(excelBuffer);

    console.log('✅ [EXCEL EXPORT] Arquivo enviado com sucesso - 4 colunas');

  } catch (error) {
    console.error('Erro ao exportar tarefa para Excel:', error);
    res.status(500).json({ error: 'Erro ao gerar arquivo Excel' });
  }
});

// Cancelar tarefa (exclusivo do atendente que criou)
app.post('/api/tasks/:id/cancel', async (req, res) => {
  try {
    const { nomeAtendente } = req.body;
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    if (!nomeAtendente) {
      return res.status(400).json({ error: 'Nome do atendente é obrigatório' });
    }

    // Atendentes podem cancelar suas próprias tarefas ou tarefas pendentes/em separação
    const canCancel = task.nomeAtendente === nomeAtendente ||
                      task.status === 'pendente' ||
                      task.status === 'separacao';

    if (!canCancel) {
      return res.status(403).json({
        error: 'Você só pode cancelar tarefas criadas por você ou tarefas pendentes/em separação',
        criador: task.nomeAtendente,
        solicitante: nomeAtendente,
        status: task.status
      });
    }

    // Tarefas já concluídas não podem ser canceladas
    if (task.status === 'CONCLUIDO') {
      return res.status(400).json({ error: 'Tarefas concluídas não podem ser canceladas' });
    }

    // Tarefas já canceladas não podem ser canceladas novamente
    if (task.status === 'CANCELADA') {
      return res.status(400).json({ error: 'Esta tarefa já foi cancelada' });
    }

    const now = new Date().toISOString();
    const timeline = task.timeline || [];
    timeline.push({
      action: 'CANCELADA',
      timestamp: now,
      user: nomeAtendente,
      detalhes: `Tarefa cancelada pelo atendente ${nomeAtendente}`
    });

    await database.updateTask(req.params.id, {
      status: 'CANCELADA',
      canceledBy: nomeAtendente,
      canceledAt: now,
      timeline
    });

    // Notificar todos os clientes
    broadcast({
      type: 'task_canceled',
      taskId: task.id,
      canceledBy: nomeAtendente,
      canceledAt: now
    });

    res.json({
      success: true,
      message: 'Tarefa cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar tarefa:', error);
    res.status(500).json({ error: 'Erro ao cancelar tarefa' });
  }
});

// Deletar tarefa fisicamente (exclusivo do administrador)
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { isAdmin } = req.body;
    const task = await database.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    // Apenas administradores podem deletar tarefas
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas administradores podem deletar tarefas' });
    }

    // Deletar arquivos associados se existirem
    if (task.arquivoOriginal) {
      const filePath = path.join(uploadDir, task.arquivoOriginal);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Arquivo deletado: ${task.arquivoOriginal}`);
        } catch (error) {
          console.error('Erro ao deletar arquivo:', error);
        }
      }
    }

    // Deletar planilha de conclusão se existir
    if (task.planilhaConclusao && task.planilhaConclusao.arquivo) {
      const filePath = path.join(uploadDir, task.planilhaConclusao.arquivo);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Planilha de conclusão deletada: ${task.planilhaConclusao.arquivo}`);
        } catch (error) {
          console.error('Erro ao deletar planilha de conclusão:', error);
        }
      }
    }

    // Deletar tarefa do banco de dados
    await database.deleteTask(req.params.id);

    // Notificar todos os clientes
    broadcast({
      type: 'task_deleted',
      taskId: task.id
    });

    console.log(`Tarefa ${task.id} deletada por administrador`);

    res.json({
      success: true,
      message: 'Tarefa deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar tarefa:', error);
    res.status(500).json({ error: 'Erro ao deletar tarefa' });
  }
});

// Autenticação de admin
app.post('/api/auth/admin', (req, res) => {
  const { username, password } = req.body;

  // Credenciais fixas para o admin
  if (username === 'acqua' && password === '13707') {
    res.json({
      success: true,
      message: 'Autenticação bem-sucedida',
      token: 'admin-authenticated' // Token simples para esta implementação
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Credenciais inválidas'
    });
  }
});

// Métricas detalhadas para dashboard admin
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const allTasks = await database.getAllTasks({});
    const completedTasks = allTasks.filter(t => t.status === 'CONCLUIDO');

    // Estatísticas por separador
    const separadorStats = {};
    completedTasks.forEach(task => {
      if (task.nomeSeparador) {
        if (!separadorStats[task.nomeSeparador]) {
          separadorStats[task.nomeSeparador] = {
            nome: task.nomeSeparador,
            totalSeparacoes: 0,
            totalItens: 0,
            tempoTotal: 0,
            tempos: []
          };
        }
        separadorStats[task.nomeSeparador].totalSeparacoes++;
        separadorStats[task.nomeSeparador].totalItens += task.totalItems;
        separadorStats[task.nomeSeparador].tempoTotal += (task.activeTime || 0);
        separadorStats[task.nomeSeparador].tempos.push(task.activeTime || 0);
      }
    });

    // Calcular médias, eficiência e ordenar por eficiência (mais itens em menos tempo)
    const separadores = Object.values(separadorStats).map(sep => {
      const tempoMedio = sep.tempoTotal / sep.totalSeparacoes;
      // Eficiência: itens por minuto (quanto maior, melhor)
      const eficiencia = sep.tempoTotal > 0 ? (sep.totalItens / (sep.tempoTotal / 60)) : 0;

      return {
        ...sep,
        tempoMedio,
        tempoMedioFormatado: formatTime(tempoMedio),
        eficiencia: eficiencia.toFixed(2), // itens/minuto
        eficienciaFormatada: `${eficiencia.toFixed(1)} itens/min`
      };
    }).sort((a, b) => b.eficiencia - a.eficiencia); // Ordenar por eficiência (maior = melhor)

    // Estatísticas por atendente
    const atendenteStats = {};
    allTasks.forEach(task => {
      if (!atendenteStats[task.nomeAtendente]) {
        atendenteStats[task.nomeAtendente] = {
          nome: task.nomeAtendente,
          totalListas: 0,
          totalItens: 0,
          listasConcluidas: 0,
          listasPendentes: 0
        };
      }
      atendenteStats[task.nomeAtendente].totalListas++;
      atendenteStats[task.nomeAtendente].totalItens += task.totalItems;
      if (task.status === 'CONCLUIDO') {
        atendenteStats[task.nomeAtendente].listasConcluidas++;
      } else {
        atendenteStats[task.nomeAtendente].listasPendentes++;
      }
    });

    const atendentes = Object.values(atendenteStats)
      .sort((a, b) => b.totalListas - a.totalListas);

    // Estatísticas gerais
    const stats = {
      totalTarefas: allTasks.length,
      tarefasPendentes: allTasks.filter(t => t.status === 'PENDENTE').length,
      tarefasEmSeparacao: allTasks.filter(t => t.status === 'EM_SEPARACAO').length,
      tarefasConcluidas: completedTasks.length,
      totalItens: allTasks.reduce((sum, t) => sum + t.totalItems, 0),
      tempoMedioSeparacao: completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + (t.activeTime || 0), 0) / completedTasks.length
        : 0
    };

    res.json({
      stats,
      separadores,
      atendentes,
      tarefasRecentes: allTasks
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
    });
  } catch (error) {
    console.error('Erro ao obter dashboard admin:', error);
    res.status(500).json({ error: 'Erro ao obter métricas do dashboard' });
  }
});

// Helper para formatar tempo
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Health check para o Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

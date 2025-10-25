const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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

// Armazenamento em memória (para plano gratuito do Render)
// Em produção, usar banco de dados
let tasks = [];
let users = []; // {id, name, role: 'atendente' | 'separador', ws}

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
  const requiredColumns = ['Cod Material', 'Desc Material', 'pegar'];
  const headers = [];

  const range = xlsx.utils.decode_range(worksheet['!ref']);
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    if (cell && cell.v) {
      headers.push(cell.v.toString().trim());
    }
  }

  const missingColumns = requiredColumns.filter(col => !headers.includes(col));

  return {
    valid: missingColumns.length === 0,
    missingColumns,
    headers
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
    const sku = row['Cod Material']?.toString() || '';
    const quantidadePegar = parseInt(row['pegar']) || 0;

    // Pular linhas sem SKU ou sem quantidade
    if (!sku || quantidadePegar <= 0) return;

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

      itemsMap.set(sku, {
        sku: sku,
        descricao: row['Desc Material'] || 'Sem descrição',
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

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Novo cliente conectado');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

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

// API Routes

// Criar nova tarefa (upload de planilha)
app.post('/api/tasks', upload.single('planilha'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { nomeAtendente, prioridade } = req.body;

    if (!nomeAtendente) {
      return res.status(400).json({ error: 'Nome do atendente é obrigatório' });
    }

    // Processar planilha
    const result = processExcel(req.file.path);

    if (!result.success) {
      // Remover arquivo inválido
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: result.error });
    }

    // Criar tarefa
    const task = {
      id: uuidv4(),
      nomeAtendente,
      prioridade: prioridade || 'Média',
      status: 'PENDENTE',
      items: result.items,
      totalItems: result.totalItems,
      uniqueSkus: result.uniqueSkus,
      arquivoOriginal: req.file.filename,
      createdAt: new Date().toISOString(),
      timeline: [{
        action: 'CRIADA',
        timestamp: new Date().toISOString(),
        user: nomeAtendente
      }]
    };

    tasks.push(task);

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
        totalItems: result.totalItems,
        uniqueSkus: result.uniqueSkus,
        linhas: result.items.length
      }
    });

  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    res.status(500).json({ error: 'Erro ao processar planilha' });
  }
});

// Listar tarefas
app.get('/api/tasks', (req, res) => {
  const { status, atendente, dataInicio, dataFim } = req.query;

  let filteredTasks = [...tasks];

  if (status) {
    filteredTasks = filteredTasks.filter(t => t.status === status);
  }

  if (atendente) {
    filteredTasks = filteredTasks.filter(t =>
      t.nomeAtendente.toLowerCase().includes(atendente.toLowerCase())
    );
  }

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

  // Ordenar por data de criação (mais recentes primeiro)
  filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(filteredTasks);
});

// Obter detalhes de uma tarefa
app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }

  res.json(task);
});

// Iniciar separação (iniciar cronômetro)
app.post('/api/tasks/:id/start', (req, res) => {
  const { nomeSeparador } = req.body;
  const task = tasks.find(t => t.id === req.params.id);

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

  task.status = 'EM_SEPARACAO';
  task.nomeSeparador = nomeSeparador;
  task.startTime = new Date().toISOString();
  task.activeTime = 0; // Tempo ativo em segundos
  task.isPaused = false;
  task.pausas = [];

  task.timeline.push({
    action: 'INICIADA',
    timestamp: task.startTime,
    user: nomeSeparador
  });

  // Notificar todos os clientes
  broadcast({
    type: 'task_started',
    taskId: task.id,
    nomeSeparador,
    startTime: task.startTime
  });

  res.json({
    success: true,
    message: 'Separação iniciada',
    task: {
      id: task.id,
      status: task.status,
      startTime: task.startTime
    }
  });
});

// Pausar separação
app.post('/api/tasks/:id/pause', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);

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
  task.isPaused = true;
  task.pauseStartTime = now;

  task.timeline.push({
    action: 'PAUSADA',
    timestamp: now,
    user: task.nomeSeparador
  });

  broadcast({
    type: 'task_paused',
    taskId: task.id,
    pauseTime: now
  });

  res.json({ success: true, message: 'Separação pausada' });
});

// Retomar separação
app.post('/api/tasks/:id/resume', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }

  if (!task.isPaused) {
    return res.status(400).json({ error: 'Tarefa não está pausada' });
  }

  const now = new Date().toISOString();
  const pauseDuration = (new Date(now) - new Date(task.pauseStartTime)) / 1000;

  task.pausas.push({
    inicio: task.pauseStartTime,
    fim: now,
    duracao: pauseDuration
  });

  task.isPaused = false;
  delete task.pauseStartTime;

  task.timeline.push({
    action: 'RETOMADA',
    timestamp: now,
    user: task.nomeSeparador
  });

  broadcast({
    type: 'task_resumed',
    taskId: task.id,
    resumeTime: now
  });

  res.json({ success: true, message: 'Separação retomada' });
});

// Atualizar status de item
app.patch('/api/tasks/:id/items/:sku', (req, res) => {
  const { status, observacao } = req.body;
  const task = tasks.find(t => t.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }

  const item = task.items.find(i => i.SKU?.toString() === req.params.sku);

  if (!item) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  item.status_separacao = status; // 'OK' ou 'FALTANDO'
  if (observacao) {
    item.observacao_separacao = observacao;
  }

  broadcast({
    type: 'item_updated',
    taskId: task.id,
    sku: req.params.sku,
    status
  });

  res.json({ success: true, item });
});

// Concluir separação
app.post('/api/tasks/:id/complete', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }

  if (task.status !== 'EM_SEPARACAO') {
    return res.status(400).json({ error: 'Tarefa não está em separação' });
  }

  const now = new Date().toISOString();

  // Calcular tempo ativo
  const totalTime = (new Date(now) - new Date(task.startTime)) / 1000;
  const pauseTime = task.pausas.reduce((sum, p) => sum + p.duracao, 0);
  task.activeTime = totalTime - pauseTime;

  task.status = 'CONCLUIDO';
  task.endTime = now;

  task.timeline.push({
    action: 'CONCLUIDA',
    timestamp: now,
    user: task.nomeSeparador
  });

  // Formatar tempo para exibição
  const hours = Math.floor(task.activeTime / 3600);
  const minutes = Math.floor((task.activeTime % 3600) / 60);
  const seconds = Math.floor(task.activeTime % 60);
  task.durationFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Notificar todos os clientes
  broadcast({
    type: 'task_completed',
    taskId: task.id,
    endTime: now,
    duration: task.durationFormatted,
    activeTime: task.activeTime
  });

  res.json({
    success: true,
    message: 'Separação concluída',
    duration: task.durationFormatted,
    activeTime: task.activeTime
  });
});

// Obter métricas
app.get('/api/metrics', (req, res) => {
  const { periodo } = req.query; // 'dia', 'semana', 'mes'

  let filteredTasks = tasks.filter(t => t.status === 'CONCLUIDO');

  const now = new Date();
  if (periodo === 'dia') {
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    filteredTasks = filteredTasks.filter(t => new Date(t.createdAt) >= oneDayAgo);
  } else if (periodo === 'semana') {
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    filteredTasks = filteredTasks.filter(t => new Date(t.createdAt) >= oneWeekAgo);
  } else if (periodo === 'mes') {
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    filteredTasks = filteredTasks.filter(t => new Date(t.createdAt) >= oneMonthAgo);
  }

  // Tempo médio
  const avgTime = filteredTasks.length > 0
    ? filteredTasks.reduce((sum, t) => sum + t.activeTime, 0) / filteredTasks.length
    : 0;

  // Por atendente
  const porAtendente = {};
  filteredTasks.forEach(t => {
    if (!porAtendente[t.nomeAtendente]) {
      porAtendente[t.nomeAtendente] = { count: 0, totalTime: 0 };
    }
    porAtendente[t.nomeAtendente].count++;
    porAtendente[t.nomeAtendente].totalTime += t.activeTime;
  });

  // Por separador
  const porSeparador = {};
  filteredTasks.forEach(t => {
    if (t.nomeSeparador) {
      if (!porSeparador[t.nomeSeparador]) {
        porSeparador[t.nomeSeparador] = { count: 0, totalTime: 0 };
      }
      porSeparador[t.nomeSeparador].count++;
      porSeparador[t.nomeSeparador].totalTime += t.activeTime;
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

  res.json({
    periodo: periodo || 'todos',
    totalTarefas: filteredTasks.length,
    tempoMedio: avgTime,
    porAtendente,
    porSeparador,
    rankingSeparadores
  });
});

// Exportar relatório CSV
app.get('/api/export/csv', (req, res) => {
  const { dataInicio, dataFim } = req.query;

  let filteredTasks = tasks.filter(t => t.status === 'CONCLUIDO');

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
    `${t.id},${t.nomeAtendente},${t.nomeLoja},${t.nomeSeparador || ''},${t.prioridade},${t.createdAt},${t.startTime},${t.endTime},${t.durationFormatted},${t.uniqueSkus},${t.totalItems}`
  ).join('\n');

  const csv = headers + rows;

  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename=relatorio.csv');
  res.send(csv);
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
app.get('/api/tasks/:id/export-excel', (req, res) => {
  try {
    const task = tasks.find(t => t.id === req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    // Criar workbook
    const workbook = xlsx.utils.book_new();

    // Preparar dados para a planilha
    const worksheetData = [
      // Informações da tarefa
      ['INFORMAÇÕES DA TAREFA'],
      ['ID da Tarefa', task.id],
      ['Atendente', task.nomeAtendente],
      ['Prioridade', task.prioridade],
      ['Status', task.status],
      ['Criado em', new Date(task.createdAt).toLocaleString('pt-BR')],
      [''],
      // Headers dos itens
      ['SKU', 'Descrição', 'Qtd Pegar', 'Localização', 'Estoque Disponível', 'Total Físico', 'Total Alocado', 'Status Separação', 'Observação']
    ];

    // Adicionar itens
    task.items.forEach(item => {
      worksheetData.push([
        item.sku,
        item.descricao,
        item.quantidade_pegar,
        item.localizacao,
        item.total_disponivel || '',
        item.total_fisico || '',
        item.total_alocado || '',
        item.status_separacao || '-',
        item.observacao_separacao || ''
      ]);
    });

    // Adicionar totais
    const totalPegar = task.items.reduce((sum, item) => sum + item.quantidade_pegar, 0);
    worksheetData.push([]);
    worksheetData.push(['TOTAL DE ITENS', task.items.length, totalPegar]);

    // Se tiver informações de separação
    if (task.nomeSeparador) {
      worksheetData.push([]);
      worksheetData.push(['INFORMAÇÕES DE SEPARAÇÃO']);
      worksheetData.push(['Separador', task.nomeSeparador]);

      if (task.startTime) {
        worksheetData.push(['Iniciado em', new Date(task.startTime).toLocaleString('pt-BR')]);
      }

      if (task.endTime) {
        worksheetData.push(['Concluído em', new Date(task.endTime).toLocaleString('pt-BR')]);
        worksheetData.push(['Duração', task.durationFormatted || '-']);
      }

      // Estatísticas de separação
      const itensOK = task.items.filter(i => i.status_separacao === 'OK').length;
      const itensFaltando = task.items.filter(i => i.status_separacao === 'FALTANDO').length;
      const itensPendentes = task.items.length - itensOK - itensFaltando;

      worksheetData.push([]);
      worksheetData.push(['ESTATÍSTICAS']);
      worksheetData.push(['Itens OK', itensOK]);
      worksheetData.push(['Itens Faltando', itensFaltando]);
      worksheetData.push(['Itens Pendentes', itensPendentes]);
    }

    // Criar worksheet
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

    // Definir largura das colunas
    worksheet['!cols'] = [
      { wch: 15 },  // SKU
      { wch: 40 },  // Descrição
      { wch: 12 },  // Qtd Pegar
      { wch: 30 },  // Localização
      { wch: 15 },  // Estoque Disponível
      { wch: 15 },  // Total Físico
      { wch: 15 },  // Total Alocado
      { wch: 15 },  // Status Separação
      { wch: 30 }   // Observação
    ];

    // Adicionar worksheet ao workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Itens da Tarefa');

    // Gerar buffer do Excel
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Nome do arquivo
    const fileName = `tarefa_${task.id.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Enviar arquivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(excelBuffer);

  } catch (error) {
    console.error('Erro ao exportar tarefa para Excel:', error);
    res.status(500).json({ error: 'Erro ao gerar arquivo Excel' });
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
app.get('/api/admin/dashboard', (req, res) => {
  const completedTasks = tasks.filter(t => t.status === 'CONCLUIDO');

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
      separadorStats[task.nomeSeparador].tempoTotal += task.activeTime;
      separadorStats[task.nomeSeparador].tempos.push(task.activeTime);
    }
  });

  // Calcular médias e ordenar
  const separadores = Object.values(separadorStats).map(sep => ({
    ...sep,
    tempoMedio: sep.tempoTotal / sep.totalSeparacoes,
    tempoMedioFormatado: formatTime(sep.tempoTotal / sep.totalSeparacoes)
  })).sort((a, b) => b.totalSeparacoes - a.totalSeparacoes);

  // Estatísticas por atendente
  const atendenteStats = {};
  tasks.forEach(task => {
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
    totalTarefas: tasks.length,
    tarefasPendentes: tasks.filter(t => t.status === 'PENDENTE').length,
    tarefasEmSeparacao: tasks.filter(t => t.status === 'EM_SEPARACAO').length,
    tarefasConcluidas: completedTasks.length,
    totalItens: tasks.reduce((sum, t) => sum + t.totalItems, 0),
    tempoMedioSeparacao: completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => sum + t.activeTime, 0) / completedTasks.length
      : 0
  };

  res.json({
    stats,
    separadores,
    atendentes,
    tarefasRecentes: tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
  });
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

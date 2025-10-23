// Estado global
const state = {
    user: null,
    ws: null,
    tasks: [],
    currentTask: null,
    cronometroInterval: null,
    cronometroStartTime: null,
    cronotrometroPausedTime: 0
};

// API Base URL
const API_BASE = window.location.origin;
const WS_BASE = window.location.origin.replace('http', 'ws');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('=== INICIALIZANDO APLICAÇÃO ===');

    // Event listeners do login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Event listeners de navegação - DIRETO em cada botão
    setupNavigation();

    document.querySelector('.logout-btn')?.addEventListener('click', handleLogout);

    // Event listeners de formulários
    document.getElementById('uploadForm')?.addEventListener('submit', handleUpload);
    document.getElementById('planilha')?.addEventListener('change', handleFileSelect);

    // Event listeners de filtros
    document.getElementById('filterStatus')?.addEventListener('change', loadTasks);
    document.getElementById('filterAtendente')?.addEventListener('input', debounce(loadTasks, 500));
    document.getElementById('btnRefresh')?.addEventListener('click', loadTasks);

    // Event listeners de métricas
    document.getElementById('periodFilter')?.addEventListener('change', loadMetrics);
    document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);

    // Event listener do modal
    document.querySelector('.close')?.addEventListener('click', closeTaskModal);
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeTaskModal();
        }
    });

    console.log('Inicialização completa');
}

// Setup de navegação com listeners diretos
function setupNavigation() {
    console.log('=== CONFIGURANDO NAVEGAÇÃO ===');

    // Botão Dashboard
    const btnDashboard = document.querySelector('[data-view="dashboard"]');
    if (btnDashboard) {
        btnDashboard.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('>>> CLICK: Dashboard');
            switchView('dashboard');
        });
        console.log('✓ Listener Dashboard adicionado');
    }

    // Botão Nova Requisição
    const btnNovaRequisicao = document.getElementById('novaTarefaBtn');
    if (btnNovaRequisicao) {
        btnNovaRequisicao.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('>>> CLICK: Nova Requisição');
            switchView('nova-requisicao');
        });
        console.log('✓ Listener Nova Requisição adicionado');
    } else {
        console.error('✗ Botão Nova Requisição não encontrado!');
    }

    // Botão Métricas
    const btnMetricas = document.getElementById('metricasBtn');
    if (btnMetricas) {
        btnMetricas.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('>>> CLICK: Métricas');
            switchView('metricas');
        });
        console.log('✓ Listener Métricas adicionado');
    } else {
        console.error('✗ Botão Métricas não encontrado!');
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();

    const userName = document.getElementById('userName').value.trim();
    const userRole = document.getElementById('userRole').value;

    if (!userName || !userRole) {
        showNotification('Por favor, preencha todos os campos', 'error');
        return;
    }

    state.user = { name: userName, role: userRole };

    // Conectar ao WebSocket
    connectWebSocket();

    // Mostrar interface
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('mainNav').classList.remove('hidden');
    document.querySelector('.user-info').textContent = `${userName} (${userRole})`;

    // Configurar visibilidade dos botões baseado no papel
    const novaTarefaBtn = document.getElementById('novaTarefaBtn');
    const metricasBtn = document.getElementById('metricasBtn');

    console.log('Configurando visibilidade para papel:', userRole);
    console.log('Botão Nova Tarefa encontrado:', novaTarefaBtn);
    console.log('Botão Métricas encontrado:', metricasBtn);

    if (userRole === 'atendente') {
        novaTarefaBtn.classList.remove('hidden');
        metricasBtn.classList.add('hidden');
        console.log('Atendente: Nova Tarefa visível, Métricas oculto');
    } else if (userRole === 'separador') {
        novaTarefaBtn.classList.add('hidden');
        metricasBtn.classList.add('hidden');
        console.log('Separador: Ambos ocultos');
    } else {
        novaTarefaBtn.classList.remove('hidden');
        metricasBtn.classList.remove('hidden');
        console.log('Admin: Ambos visíveis');
    }

    // Verificar classes após mudança
    console.log('Classes do botão Nova Tarefa:', novaTarefaBtn.className);
    console.log('Classes do botão Métricas:', metricasBtn.className);

    // Mostrar dashboard
    switchView('dashboard');
    loadTasks();
}

function handleLogout() {
    if (state.ws) {
        state.ws.close();
    }

    state.user = null;
    state.tasks = [];
    state.currentTask = null;

    document.getElementById('loginModal').classList.add('active');
    document.getElementById('mainNav').classList.add('hidden');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Limpar formulário
    document.getElementById('loginForm').reset();
}

// WebSocket
function connectWebSocket() {
    state.ws = new WebSocket(WS_BASE);

    state.ws.onopen = () => {
        console.log('WebSocket conectado');
        // Registrar usuário
        state.ws.send(JSON.stringify({
            type: 'register',
            name: state.user.name,
            role: state.user.role
        }));
    };

    state.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
        }
    };

    state.ws.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        showNotification('Erro de conexão em tempo real', 'error');
    };

    state.ws.onclose = () => {
        console.log('WebSocket desconectado');
        // Tentar reconectar após 5 segundos
        setTimeout(() => {
            if (state.user) {
                connectWebSocket();
            }
        }, 5000);
    };
}

function handleWebSocketMessage(data) {
    console.log('Mensagem WebSocket:', data);

    switch (data.type) {
        case 'registered':
            showNotification('Conectado ao sistema em tempo real', 'success');
            break;

        case 'new_task':
            if (state.user.role === 'separador') {
                showNotification(`Nova tarefa: ${data.task.nomeLoja} - ${data.task.totalItems} itens`, 'success');
                playNotificationSound();
            }
            loadTasks();
            break;

        case 'task_started':
            showNotification(`Separação iniciada por ${data.nomeSeparador}`, 'success');
            loadTasks();
            if (state.currentTask && state.currentTask.id === data.taskId) {
                loadTaskDetails(data.taskId);
            }
            break;

        case 'task_paused':
            showNotification('Separação pausada', 'warning');
            if (state.currentTask && state.currentTask.id === data.taskId) {
                loadTaskDetails(data.taskId);
            }
            break;

        case 'task_resumed':
            showNotification('Separação retomada', 'success');
            if (state.currentTask && state.currentTask.id === data.taskId) {
                loadTaskDetails(data.taskId);
            }
            break;

        case 'task_completed':
            showNotification(`Separação concluída em ${data.duration}`, 'success');
            loadTasks();
            if (state.currentTask && state.currentTask.id === data.taskId) {
                loadTaskDetails(data.taskId);
            }
            break;

        case 'item_updated':
            if (state.currentTask && state.currentTask.id === data.taskId) {
                loadTaskDetails(data.taskId);
            }
            break;
    }
}

// Navegação
function switchView(viewName) {
    console.log('Mudando para view:', viewName);

    // Ocultar todas as views (adicionar hidden, remover active)
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });

    // Desativar todos os botões
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const viewElement = document.getElementById(viewName);
    const navButton = document.querySelector(`[data-view="${viewName}"]`);

    console.log('View element encontrado:', viewElement);
    console.log('Nav button encontrado:', navButton);

    if (viewElement) {
        // IMPORTANTE: Remover hidden E adicionar active
        viewElement.classList.remove('hidden');
        viewElement.classList.add('active');
        console.log('✓ View mostrada:', viewName, '| Classes:', viewElement.className);
    } else {
        console.error('View não encontrada:', viewName);
    }

    if (navButton) {
        navButton.classList.add('active');
    }

    if (viewName === 'metricas') {
        loadMetrics();
    }
}

// Tarefas
async function loadTasks() {
    try {
        const status = document.getElementById('filterStatus')?.value || '';
        const atendente = document.getElementById('filterAtendente')?.value || '';

        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (atendente) params.append('atendente', atendente);

        const response = await fetch(`${API_BASE}/api/tasks?${params}`);
        const tasks = await response.json();

        state.tasks = tasks;
        renderTasks(tasks);
        updateStats(tasks);
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        showNotification('Erro ao carregar tarefas', 'error');
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');

    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="empty-state">Nenhuma tarefa encontrada</p>';
        return;
    }

    taskList.innerHTML = tasks.map(task => `
        <div class="task-card status-${task.status}" onclick="openTaskModal('${task.id}')">
            <div class="task-header">
                <div>
                    <div class="task-id">#${task.id.substring(0, 8)}</div>
                    <div>${task.nomeLoja}</div>
                </div>
                <span class="task-status status-${task.status}">${task.status.replace('_', ' ')}</span>
            </div>
            <div class="task-info">
                <div class="task-info-item">
                    <span class="task-info-label">Atendente:</span> ${task.nomeAtendente}
                </div>
                <div class="task-info-item">
                    <span class="task-info-label">Prioridade:</span> ${task.prioridade}
                </div>
                <div class="task-info-item">
                    <span class="task-info-label">Itens:</span> ${task.totalItems} (${task.uniqueSkus} SKUs)
                </div>
                <div class="task-info-item">
                    <span class="task-info-label">Criado:</span> ${formatDate(task.createdAt)}
                </div>
                ${task.nomeSeparador ? `
                    <div class="task-info-item">
                        <span class="task-info-label">Separador:</span> ${task.nomeSeparador}
                    </div>
                ` : ''}
                ${task.durationFormatted ? `
                    <div class="task-info-item">
                        <span class="task-info-label">Duração:</span> ${task.durationFormatted}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateStats(tasks) {
    const pendente = tasks.filter(t => t.status === 'PENDENTE').length;
    const emSeparacao = tasks.filter(t => t.status === 'EM_SEPARACAO').length;
    const concluido = tasks.filter(t => t.status === 'CONCLUIDO').length;

    document.getElementById('statPendente').textContent = pendente;
    document.getElementById('statEmSeparacao').textContent = emSeparacao;
    document.getElementById('statConcluido').textContent = concluido;
}

// Upload de planilha
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        showNotification(`Arquivo selecionado: ${file.name}`, 'success');
    }
}

async function handleUpload(e) {
    e.preventDefault();

    const nomeAtendente = document.getElementById('nomeAtendente').value.trim();
    const nomeLoja = document.getElementById('nomeLoja').value.trim();
    const prioridade = document.getElementById('prioridade').value;
    const planilha = document.getElementById('planilha').files[0];

    if (!nomeAtendente || !nomeLoja || !planilha) {
        showNotification('Por favor, preencha todos os campos', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('nomeAtendente', nomeAtendente);
    formData.append('nomeLoja', nomeLoja);
    formData.append('prioridade', prioridade);
    formData.append('planilha', planilha);

    try {
        const response = await fetch(`${API_BASE}/api/tasks`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(
                `Tarefa criada com sucesso! ${result.summary.uniqueSkus} SKUs únicos, ${result.summary.totalItems} itens totais`,
                'success'
            );
            document.getElementById('uploadForm').reset();
            switchView('dashboard');
            loadTasks();
        } else {
            showNotification(result.error || 'Erro ao criar tarefa', 'error');
        }
    } catch (error) {
        console.error('Erro ao enviar planilha:', error);
        showNotification('Erro ao enviar planilha', 'error');
    }
}

// Modal de detalhes da tarefa
async function openTaskModal(taskId) {
    state.currentTask = state.tasks.find(t => t.id === taskId);
    await loadTaskDetails(taskId);
    document.getElementById('taskModal').classList.add('active');
}

async function loadTaskDetails(taskId) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}`);
        const task = await response.json();

        state.currentTask = task;
        renderTaskDetails(task);

        // Iniciar cronômetro se estiver em separação
        if (task.status === 'EM_SEPARACAO') {
            startCronometro(task);
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showNotification('Erro ao carregar detalhes da tarefa', 'error');
    }
}

function renderTaskDetails(task) {
    const detailsContainer = document.getElementById('taskDetails');

    const isSeparador = state.user.role === 'separador';
    const canStart = task.status === 'PENDENTE' && isSeparador;
    const canControl = task.status === 'EM_SEPARACAO' && isSeparador && task.nomeSeparador === state.user.name;

    detailsContainer.innerHTML = `
        <h2>Tarefa #${task.id.substring(0, 8)}</h2>
        <div class="task-status status-${task.status}">${task.status.replace('_', ' ')}</div>

        <div class="task-info" style="margin: 20px 0;">
            <div class="task-info-item">
                <span class="task-info-label">Loja:</span> ${task.nomeLoja}
            </div>
            <div class="task-info-item">
                <span class="task-info-label">Atendente:</span> ${task.nomeAtendente}
            </div>
            <div class="task-info-item">
                <span class="task-info-label">Prioridade:</span> ${task.prioridade}
            </div>
            <div class="task-info-item">
                <span class="task-info-label">Criado em:</span> ${formatDate(task.createdAt)}
            </div>
            ${task.nomeSeparador ? `
                <div class="task-info-item">
                    <span class="task-info-label">Separador:</span> ${task.nomeSeparador}
                </div>
            ` : ''}
        </div>

        ${task.status === 'EM_SEPARACAO' ? `
            <div class="cronometro">
                <h3>Tempo de Separação</h3>
                <div class="cronometro-display" id="cronometroDisplay">00:00:00</div>
                ${canControl ? `
                    <div class="cronometro-controls">
                        ${task.isPaused ? `
                            <button class="btn btn-success" onclick="resumeTask('${task.id}')">Retomar</button>
                        ` : `
                            <button class="btn btn-warning" onclick="pauseTask('${task.id}')">Pausar</button>
                        `}
                        <button class="btn btn-primary" onclick="completeTask('${task.id}')">Concluir</button>
                    </div>
                ` : ''}
            </div>
        ` : ''}

        ${task.status === 'CONCLUIDO' ? `
            <div class="cronometro">
                <h3>Tempo Total</h3>
                <div class="cronometro-display">${task.durationFormatted || '00:00:00'}</div>
            </div>
        ` : ''}

        ${canStart ? `
            <button class="btn btn-primary" onclick="startTask('${task.id}')">Iniciar Separação</button>
        ` : ''}

        <h3>Itens (${task.items.length})</h3>
        <table class="items-table">
            <thead>
                <tr>
                    <th>SKU</th>
                    <th>Descrição</th>
                    <th>Quantidade</th>
                    <th>Local</th>
                    ${canControl ? '<th>Status</th>' : ''}
                    ${task.status === 'CONCLUIDO' ? '<th>Status</th>' : ''}
                    ${canControl ? '<th>Ações</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${task.items.map(item => `
                    <tr>
                        <td>${item.SKU}</td>
                        <td>${item['Descrição'] || item.Descricao || '-'}</td>
                        <td>${item.Quantidade_requerida}</td>
                        <td>${item.Local_estoque || '-'}</td>
                        ${canControl || task.status === 'CONCLUIDO' ? `
                            <td>
                                ${item.status_separacao === 'OK' ? '<span class="item-status-ok">OK</span>' : ''}
                                ${item.status_separacao === 'FALTANDO' ? '<span class="item-status-faltando">FALTANDO</span>' : ''}
                                ${!item.status_separacao ? '-' : ''}
                            </td>
                        ` : ''}
                        ${canControl ? `
                            <td class="item-actions">
                                <button class="btn btn-success" onclick="markItem('${task.id}', '${item.SKU}', 'OK')">OK</button>
                                <button class="btn btn-danger" onclick="markItem('${task.id}', '${item.SKU}', 'FALTANDO')">Falta</button>
                            </td>
                        ` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h3>Histórico</h3>
        <div class="timeline">
            ${task.timeline.map(item => `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-action">${item.action} - ${item.user}</div>
                        <div class="timeline-time">${formatDate(item.timestamp)}</div>
                    </div>
                </div>
            `).join('')}
        </div>

        ${task.pausas && task.pausas.length > 0 ? `
            <h3>Pausas (${task.pausas.length})</h3>
            <ul>
                ${task.pausas.map(p => `
                    <li>
                        ${formatDate(p.inicio)} - ${formatDate(p.fim)}
                        (${Math.floor(p.duracao / 60)}min ${Math.floor(p.duracao % 60)}s)
                    </li>
                `).join('')}
            </ul>
        ` : ''}
    `;
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    stopCronometro();
    state.currentTask = null;
}

// Ações de tarefa
async function startTask(taskId) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nomeSeparador: state.user.name })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Separação iniciada!', 'success');
            await loadTaskDetails(taskId);
        } else {
            showNotification(result.error || 'Erro ao iniciar separação', 'error');
        }
    } catch (error) {
        console.error('Erro ao iniciar tarefa:', error);
        showNotification('Erro ao iniciar separação', 'error');
    }
}

async function pauseTask(taskId) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Separação pausada', 'warning');
            await loadTaskDetails(taskId);
        } else {
            showNotification(result.error || 'Erro ao pausar', 'error');
        }
    } catch (error) {
        console.error('Erro ao pausar:', error);
        showNotification('Erro ao pausar separação', 'error');
    }
}

async function resumeTask(taskId) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Separação retomada', 'success');
            await loadTaskDetails(taskId);
        } else {
            showNotification(result.error || 'Erro ao retomar', 'error');
        }
    } catch (error) {
        console.error('Erro ao retomar:', error);
        showNotification('Erro ao retomar separação', 'error');
    }
}

async function completeTask(taskId) {
    if (!confirm('Tem certeza que deseja concluir esta separação?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(`Separação concluída em ${result.duration}!`, 'success');
            closeTaskModal();
            loadTasks();
        } else {
            showNotification(result.error || 'Erro ao concluir', 'error');
        }
    } catch (error) {
        console.error('Erro ao concluir:', error);
        showNotification('Erro ao concluir separação', 'error');
    }
}

async function markItem(taskId, sku, status) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/items/${encodeURIComponent(sku)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        const result = await response.json();

        if (response.ok) {
            await loadTaskDetails(taskId);
        } else {
            showNotification('Erro ao atualizar item', 'error');
        }
    } catch (error) {
        console.error('Erro ao marcar item:', error);
        showNotification('Erro ao atualizar item', 'error');
    }
}

// Cronômetro
function startCronometro(task) {
    stopCronometro();

    if (task.isPaused) {
        return;
    }

    const startTime = new Date(task.startTime).getTime();
    const pauseTime = task.pausas ? task.pausas.reduce((sum, p) => sum + (p.duracao * 1000), 0) : 0;

    state.cronometroInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime - pauseTime;

        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        const display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const displayElement = document.getElementById('cronometroDisplay');
        if (displayElement) {
            displayElement.textContent = display;
        }
    }, 1000);
}

function stopCronometro() {
    if (state.cronometroInterval) {
        clearInterval(state.cronometroInterval);
        state.cronometroInterval = null;
    }
}

// Métricas
async function loadMetrics() {
    try {
        const periodo = document.getElementById('periodFilter')?.value || '';

        const params = new URLSearchParams();
        if (periodo) params.append('periodo', periodo);

        const response = await fetch(`${API_BASE}/api/metrics?${params}`);
        const metrics = await response.json();

        renderMetrics(metrics);
    } catch (error) {
        console.error('Erro ao carregar métricas:', error);
        showNotification('Erro ao carregar métricas', 'error');
    }
}

function renderMetrics(metrics) {
    document.getElementById('metricTotal').textContent = metrics.totalTarefas;
    document.getElementById('metricAvgTime').textContent = formatSeconds(metrics.tempoMedio);

    // Ranking de separadores
    const rankingContainer = document.getElementById('rankingSeparadores');
    if (metrics.rankingSeparadores.length === 0) {
        rankingContainer.innerHTML = '<p class="empty-state">Nenhum dado disponível</p>';
    } else {
        rankingContainer.innerHTML = metrics.rankingSeparadores.map((sep, index) => `
            <div class="ranking-item">
                <span class="ranking-position">${index + 1}º</span>
                <span class="ranking-name">${sep.nome}</span>
                <span class="ranking-stats">
                    ${sep.count} tarefa(s) | Média: ${formatSeconds(sep.avgTime)}
                </span>
            </div>
        `).join('');
    }

    // Por atendente
    const atendenteContainer = document.getElementById('metricsAtendente');
    const atendenteData = Object.entries(metrics.porAtendente);
    if (atendenteData.length === 0) {
        atendenteContainer.innerHTML = '<p class="empty-state">Nenhum dado disponível</p>';
    } else {
        atendenteContainer.innerHTML = atendenteData.map(([nome, data]) => `
            <div class="metric-item">
                <span>${nome}</span>
                <span>${data.count} tarefa(s) | Total: ${formatSeconds(data.totalTime)}</span>
            </div>
        `).join('');
    }

    // Por separador
    const separadorContainer = document.getElementById('metricsSeparador');
    const separadorData = Object.entries(metrics.porSeparador);
    if (separadorData.length === 0) {
        separadorContainer.innerHTML = '<p class="empty-state">Nenhum dado disponível</p>';
    } else {
        separadorContainer.innerHTML = separadorData.map(([nome, data]) => `
            <div class="metric-item">
                <span>${nome}</span>
                <span>${data.count} tarefa(s) | Total: ${formatSeconds(data.totalTime)}</span>
            </div>
        `).join('');
    }
}

async function exportCSV() {
    try {
        window.open(`${API_BASE}/api/export/csv`, '_blank');
        showNotification('Relatório exportado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showNotification('Erro ao exportar relatório', 'error');
    }
}

// Utilidades
function showNotification(message, type = 'success') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function playNotificationSound() {
    // Som de notificação (opcional)
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGi56+ifUQ4PUKXh8LlkHgU7k9n0y3opByd6yPDck0MLFW2/7O2oWRQJPJXY8s17KwUpe8rx3I9DChVsvu3uqVwVCkCY3PLPfS4GK4DN8tqJNwgZaLvt559NEAxPpeLwtmMcBjiP1/DLeSsGJnfH7uCPQgsUXrHp66hVFApGnt/yvmwhBSqAzvHYijYIG2i56+mfUg4OTaPg77diHAU5kdP2y3srByd5xvDek0QOElSx6uihURcIT5rf8s1/MQYhcsPw2o5FDhJaq+vuqFoXCUKZ3vPOfDAGJHfG79uNQgwUW63o66lbFwlFnuH1vm4iByl+zPLaizsKFWe76+mgVBEMT6Dg8LdmHQY7lNjyy3grBid3xu/cjUQOElSw6uihURcIT5ne88x+MAYicsPv2I5GDhJYq+zuqVoXCUKY3fLNfTEGJHXF79qLQgwUW63n7KlcGAlGnuH1vm4iByl9y/HajDsKFWe76+mgVBEMT6Dg8LdmHQY7lNjyy3grBid3xu/cjUQOElSw6uihURcIT5ne88x+MAYicsPv2I5GDhJYq+zuqVoXCUKY3fLNfTEGJHXF79qLQgwUW63n7KlcGAlGnuH1vm4iByl9y/HajDsKFWe76+mgVBEMT6Dg8LdmHQY7lNjyy3grBid3xu/cjUQOElSw6uihURcIT5ne88x+MAYicsPv2I5GDhJYq+zuqVoXCUKY3fLNfTEGJHXF79qLQgwUW63n7KlcGAlGnuH1vm4iByl9y/HajDsKFWe76+mgVBEMT6Dg8LdmHQY7lNjyy3grBid3xu/cjUQOElSw6uihURcIT5ne88x+MAYicsPv2I5GDhJYq+zuqVoXCUKY3fLNfTEGJHXF79qLQgwUW63n7KlcGAlGnuH1vm4iByl9y/HajDsKFWe76+mgVBEMT6Dg8LdmHQY7lNjyy3grBid3xu/cjUQOElSw6uihURcIT5ne88x+MAYicsPv2I5GDhJYq+zuqVoXCUKY3fLNfTEGJHXF79qLQgwUW63n7KlcGAlGnuH1vm4iByl9y/HajDsKFWe76+mgVBEMT6Dg8LdmHQY7lNjyy3grBid3xu/cjUQOElSw6uihURcI');
    audio.play().catch(() => {});
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

function formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

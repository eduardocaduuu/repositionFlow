// ==========================================
// REPOSITIONFLOW - FRONTEND APPLICATION
// Modern Dark Theme with Real-time Updates
// ==========================================

// Global State
const state = {
    user: null,
    ws: null,
    tasks: [],
    currentView: 'dashboard',
    charts: {},
    timers: {}
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('repositionflow_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        showMainApp();
        connectWebSocket();
    } else {
        showRoleSelection();
    }

    setupEventListeners();
}

// ==========================================
// AUTHENTICATION
// ==========================================

function setupEventListeners() {
    // Role Selection Form
    document.getElementById('roleForm')?.addEventListener('submit', handleRoleSubmit);

    // Admin Login Form
    document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);
    document.getElementById('btnBackToRole')?.addEventListener('click', () => {
        hideElement('adminLoginScreen');
        showElement('roleSelectionScreen');
    });

    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (view) switchView(view);
        });
    });

    // Dashboard
    document.getElementById('btnRefresh')?.addEventListener('click', loadTasks);
    document.getElementById('filterStatus')?.addEventListener('change', loadTasks);
    document.getElementById('filterAtendente')?.addEventListener('input', debounce(loadTasks, 500));

    // Upload Form
    document.getElementById('uploadForm')?.addEventListener('submit', handleUploadForm);

    // Metrics Filter
    document.getElementById('metricsFilter')?.addEventListener('change', loadMetrics);

    // Modal
    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('taskModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'taskModal') closeModal();
    });
}

async function handleRoleSubmit(e) {
    e.preventDefault();
    const role = document.getElementById('userRole').value;

    if (!role) {
        showToast('Selecione sua função', 'error');
        return;
    }

    // Se for admin, mostrar tela de login
    if (role === 'admin') {
        hideElement('roleSelectionScreen');
        showElement('adminLoginScreen');
        return;
    }

    // Para atendente e separador, entrar direto (sem nome ainda)
    state.user = { role };
    localStorage.setItem('repositionflow_user', JSON.stringify(state.user));

    hideElement('roleSelectionScreen');
    showMainApp();
    connectWebSocket();
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;

    try {
        const response = await fetch('/api/auth/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            state.user = { name: 'Administrador', role: 'admin', token: data.token };
            localStorage.setItem('repositionflow_user', JSON.stringify(state.user));

            hideElement('adminLoginScreen');
            showMainApp();
            connectWebSocket();
        } else {
            showElement('adminLoginError');
            document.getElementById('adminLoginError').textContent = data.error || 'Credenciais inválidas';
        }
    } catch (error) {
        console.error('Erro no login admin:', error);
        showToast('Erro ao autenticar. Tente novamente.', 'error');
    }
}

function handleLogout() {
    if (state.ws) state.ws.close();
    localStorage.removeItem('repositionflow_user');
    state.user = null;
    state.tasks = [];

    // Destroy all charts
    Object.values(state.charts).forEach(chart => chart.destroy());
    state.charts = {};

    // Hide all views
    hideElement('mainApp');
    hideElement('dashboard');
    hideElement('nova-tarefa');
    hideElement('metricas');
    hideElement('admin-dashboard');

    // Hide all conditional buttons
    hideElement('novaTarefaBtn');
    hideElement('metricasBtn');
    hideElement('adminDashboardBtn');

    showElement('roleSelectionScreen');

    // Reset forms
    document.getElementById('roleForm').reset();
    document.getElementById('adminLoginForm')?.reset();
}

function showMainApp() {
    hideElement('roleSelectionScreen');
    hideElement('adminLoginScreen');
    showElement('mainApp');

    // Update user display
    const roleEmoji = {
        'atendente': '👤',
        'separador': '📋',
        'admin': '👑'
    };
    const roleLabel = {
        'atendente': 'Atendente',
        'separador': 'Separador',
        'admin': 'Administrador'
    };
    document.getElementById('userDisplay').textContent =
        state.user.name
            ? `${roleEmoji[state.user.role]} ${state.user.name}`
            : `${roleEmoji[state.user.role]} ${roleLabel[state.user.role]}`;

    // FIRST: Hide all conditional navigation buttons
    hideElement('novaTarefaBtn');
    hideElement('metricasBtn');
    hideElement('adminDashboardBtn');

    // THEN: Show only buttons appropriate for current role
    if (state.user.role === 'atendente' || state.user.role === 'admin') {
        showElement('novaTarefaBtn');
    }
    if (state.user.role === 'admin') {
        showElement('metricasBtn');
        showElement('adminDashboardBtn');
    }

    // Load initial data
    switchView('dashboard');
    loadTasks();
}

function showRoleSelection() {
    showElement('roleSelectionScreen');
    hideElement('adminLoginScreen');
    hideElement('mainApp');
}

// ==========================================
// WEBSOCKET CONNECTION
// ==========================================

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        console.log('WebSocket conectado');
        state.ws.send(JSON.stringify({
            type: 'register',
            name: state.user.name || state.user.role,
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
    };

    state.ws.onclose = () => {
        console.log('WebSocket desconectado. Reconectando em 5s...');
        setTimeout(() => {
            if (state.user) connectWebSocket();
        }, 5000);
    };
}

function handleWebSocketMessage(data) {
    console.log('WebSocket message:', data);

    switch (data.type) {
        case 'registered':
            console.log('Registrado no servidor');
            break;

        case 'new_task':
            if (state.user.role === 'separador') {
                showToast(`Nova tarefa disponível! ${data.task.totalItems} itens`, 'success');
                playNotificationSound();
            }
            loadTasks();
            break;

        case 'task_started':
        case 'task_paused':
        case 'task_resumed':
        case 'task_completed':
        case 'item_updated':
            loadTasks();
            break;
    }
}

// ==========================================
// VIEW MANAGEMENT
// ==========================================

function switchView(viewName) {
    // Security check: Prevent non-admin from accessing admin views
    if (viewName === 'admin-dashboard' && state.user.role !== 'admin') {
        showToast('Acesso negado: apenas administradores', 'error');
        return;
    }

    // Security check: Prevent separador from accessing nova-tarefa
    if (viewName === 'nova-tarefa' && state.user.role === 'separador') {
        showToast('Acesso negado: apenas atendentes e administradores', 'error');
        return;
    }

    // Security check: Prevent non-admin from accessing metricas
    if (viewName === 'metricas' && state.user.role !== 'admin') {
        showToast('Acesso negado: apenas administradores', 'error');
        return;
    }

    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });

    // Show selected view
    const targetView = document.getElementById(viewName);
    if (targetView) {
        targetView.classList.remove('hidden');
        state.currentView = viewName;

        // Load view-specific data
        if (viewName === 'dashboard') {
            loadTasks();
        } else if (viewName === 'metricas') {
            loadMetrics();
        } else if (viewName === 'admin-dashboard') {
            loadAdminDashboard();
        }
    }
}

// ==========================================
// DASHBOARD - TASK LIST
// ==========================================

async function loadTasks() {
    try {
        const status = document.getElementById('filterStatus')?.value || '';
        const atendente = document.getElementById('filterAtendente')?.value || '';

        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (atendente) params.append('atendente', atendente);

        const response = await fetch(`/api/tasks?${params}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao carregar tarefas');
        }

        const tasks = await response.json();

        // Verificar se tasks é um array
        if (!Array.isArray(tasks)) {
            console.error('Resposta inválida do servidor:', tasks);
            throw new Error('Formato de resposta inválido');
        }

        state.tasks = tasks;
        renderTasks(tasks);
        updateDashboardStats(tasks);
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        showToast(error.message || 'Erro ao carregar tarefas', 'error');
        // Renderizar lista vazia em caso de erro
        state.tasks = [];
        renderTasks([]);
        updateDashboardStats([]);
    }
}

function updateDashboardStats(tasks) {
    const pendentes = tasks.filter(t => t.status === 'PENDENTE').length;
    const emSeparacao = tasks.filter(t => t.status === 'EM_SEPARACAO').length;
    const concluidas = tasks.filter(t => t.status === 'CONCLUIDO').length;

    document.getElementById('statPendente').textContent = pendentes;
    document.getElementById('statEmSeparacao').textContent = emSeparacao;
    document.getElementById('statConcluido').textContent = concluidas;
}

function renderTasks(tasks) {
    const container = document.getElementById('taskList');

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="glass-card text-center">
                <p style="color: var(--text-secondary);">Nenhuma tarefa encontrada</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tasks.map(task => createTaskCard(task)).join('');

    // Add click listeners
    tasks.forEach(task => {
        const card = document.getElementById(`task-${task.id}`);
        if (card) {
            card.addEventListener('click', () => openTaskModal(task.id));
        }
    });
}

function createTaskCard(task) {
    const statusColors = {
        'PENDENTE': 'warning',
        'EM_SEPARACAO': 'info',
        'CONCLUIDO': 'success'
    };

    const statusLabels = {
        'PENDENTE': '🟡 Pendente',
        'EM_SEPARACAO': '🔵 Em Separação',
        'CONCLUIDO': '🟢 Concluído'
    };

    const prioridadeColors = {
        'Baixa': 'success',
        'Média': 'warning',
        'Alta': 'danger'
    };

    return `
        <div id="task-${task.id}" class="glass-card" style="cursor: pointer; transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin-bottom: 0.5rem;">Tarefa #${task.id.substring(0, 8)}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        👤 ${task.nomeAtendente}
                        ${task.nomeSeparador ? ` • 📋 ${task.nomeSeparador}` : ''}
                    </p>
                    ${task.observacoes ? `
                        <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px; border-left: 3px solid var(--accent-green);">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">📝 Observações:</div>
                            <div style="font-size: 0.85rem; color: var(--text-primary);">${task.observacoes}</div>
                        </div>
                    ` : ''}
                </div>
                <div style="display: flex; gap: 0.5rem; flex-direction: column; align-items: flex-end;">
                    <span class="badge badge-${statusColors[task.status]}">${statusLabels[task.status]}</span>
                    <span class="badge badge-${prioridadeColors[task.prioridade]}">${task.prioridade}</span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">SKUs Únicos</div>
                    <div style="font-size: 1.5rem; font-weight: 600;">${task.uniqueSkus}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">Total de Itens</div>
                    <div style="font-size: 1.5rem; font-weight: 600;">${task.totalItems}</div>
                </div>
                ${task.durationFormatted ? `
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">Duração</div>
                    <div style="font-size: 1.5rem; font-weight: 600;">${task.durationFormatted}</div>
                </div>
                ` : ''}
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; gap: 1.5rem; flex-wrap: wrap;">
                <div style="font-size: 0.85rem;">
                    <span style="color: var(--text-secondary);">🕒 Criada:</span>
                    <span style="color: var(--text-primary); font-weight: 500; margin-left: 0.25rem;">
                        ${new Date(task.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>
                ${task.endTime ? `
                <div style="font-size: 0.85rem;">
                    <span style="color: var(--text-secondary);">✅ Finalizada:</span>
                    <span style="color: var(--accent-green); font-weight: 500; margin-left: 0.25rem;">
                        ${new Date(task.endTime).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ==========================================
// TASK MODAL
// ==========================================

async function openTaskModal(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`);
        const task = await response.json();

        renderTaskModal(task);
        document.getElementById('taskModal').classList.add('active');

        // Start timer if task is in progress
        if (task.status === 'EM_SEPARACAO') {
            startTaskTimer(task);
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar detalhes da tarefa', 'error');
    }
}

function renderTaskModal(task) {
    const canControl = state.user.role === 'separador' &&
                      (task.status === 'PENDENTE' || task.status === 'EM_SEPARACAO');

    document.getElementById('modalTaskTitle').textContent = `Tarefa #${task.id.substring(0, 8)}`;

    let content = `
        <div style="margin-bottom: 2rem;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong>Atendente:</strong> ${task.nomeAtendente}
                </div>
                <div>
                    <strong>Prioridade:</strong> ${task.prioridade}
                </div>
                <div>
                    <strong>Status:</strong> <span class="badge badge-info">${task.status}</span>
                </div>
                <div>
                    <strong>Criado em:</strong> ${new Date(task.createdAt).toLocaleString('pt-BR')}
                </div>
            </div>
            ${task.nomeSeparador ? `<div><strong>Separador:</strong> ${task.nomeSeparador}</div>` : ''}
            ${task.observacoes ? `
                <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); border-left: 4px solid var(--accent-green);">
                    <strong style="color: var(--accent-green);">📝 Observações do Atendente:</strong>
                    <p style="margin-top: 0.5rem; color: var(--text-primary); line-height: 1.5;">${task.observacoes}</p>
                </div>
            ` : ''}
            ${task.status === 'EM_SEPARACAO' ? `
                <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                    <strong>⏱️ Tempo decorrido:</strong>
                    <span id="taskTimer" style="font-size: 1.5rem; font-weight: 700; color: var(--accent-green);">00:00:00</span>
                </div>
            ` : ''}
            ${task.durationFormatted ? `
                <div style="margin-top: 1rem;">
                    <strong>✓ Tempo total:</strong> ${task.durationFormatted}
                </div>
            ` : ''}
        </div>

        <!-- Control Buttons -->
        ${canControl ? `
            ${task.status === 'PENDENTE' ? `
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="startTask('${task.id}')">
                        ▶️ Iniciar Separação
                    </button>
                </div>
            ` : ''}
            ${task.status === 'EM_SEPARACAO' && !task.isPaused ? `
                <div style="margin-bottom: 2rem;">
                    <div class="glass-card" style="padding: 1.5rem; margin-bottom: 1rem; background: var(--bg-tertiary); border-left: 4px solid var(--accent-green);">
                        <h4 style="margin-bottom: 1rem; color: var(--accent-green);">📋 Para Concluir a Tarefa</h4>
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
                            Envie a planilha Excel com os dados da movimentação. A planilha deve conter as colunas obrigatórias:
                        </p>
                        <ul style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.5rem; padding-left: 1.5rem;">
                            <li><strong>Data movimentacao</strong> - Data da separação</li>
                            <li><strong>Tipo movimentacao</strong> - Tipo de movimentação</li>
                            <li><strong>Quantidade material</strong> - Quantidade separada</li>
                        </ul>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="planilhaConclusao-${task.id}" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                                Planilha de Conclusão (.xlsx) *
                            </label>
                            <input type="file" id="planilhaConclusao-${task.id}" accept=".xlsx,.xls" style="width: 100%;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="pauseTask('${task.id}')">
                            ⏸️ Pausar
                        </button>
                        <button class="btn btn-primary" onclick="completeTask('${task.id}')">
                            ✓ Concluir Separação
                        </button>
                    </div>
                </div>
            ` : ''}
            ${task.status === 'EM_SEPARACAO' && task.isPaused ? `
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="resumeTask('${task.id}')">
                        ▶️ Retomar
                    </button>
                </div>
            ` : ''}
        ` : ''}

        <!-- Export Button -->
        <div style="margin-bottom: 2rem;">
            <button class="btn btn-secondary" onclick="exportTaskToExcel('${task.id}')">
                📥 Exportar para Excel
            </button>
        </div>

        <!-- Items Table -->
        <h3 style="margin-bottom: 1rem;">Itens (${task.items.length})</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th>Descrição</th>
                        <th>Qtd</th>
                        <th>Localização</th>
                        <th>Disponível</th>
                        ${canControl || task.status === 'CONCLUIDO' ? '<th>Status</th>' : ''}
                        ${canControl ? '<th>Ações</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${task.items.map(item => `
                        <tr>
                            <td><code>${item.sku}</code></td>
                            <td>${item.descricao}</td>
                            <td><strong>${item.quantidade_pegar}</strong></td>
                            <td><small>${item.localizacao}</small></td>
                            <td>${item.total_disponivel || '-'}</td>
                            ${canControl || task.status === 'CONCLUIDO' ? `
                                <td>
                                    ${item.status_separacao === 'OK' ? '<span class="badge badge-success">OK</span>' : ''}
                                    ${item.status_separacao === 'FALTANDO' ? '<span class="badge badge-danger">FALTANDO</span>' : ''}
                                    ${!item.status_separacao ? '-' : ''}
                                </td>
                            ` : ''}
                            ${canControl ? `
                                <td>
                                    <button class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;" onclick="markItem('${task.id}', '${item.sku}', 'OK')">OK</button>
                                    <button class="btn btn-danger" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;" onclick="markItem('${task.id}', '${item.sku}', 'FALTANDO')">Falta</button>
                                </td>
                            ` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Timeline -->
        ${task.timeline && task.timeline.length > 0 ? `
            <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Histórico</h3>
            <div style="border-left: 2px solid var(--border-color); padding-left: 1rem;">
                ${task.timeline.map(event => `
                    <div style="margin-bottom: 1rem;">
                        <div style="font-weight: 600;">${event.action}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${event.user} • ${new Date(event.timestamp).toLocaleString('pt-BR')}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;

    document.getElementById('modalTaskContent').innerHTML = content;
}

function startTaskTimer(task) {
    // Clear existing timer
    if (state.timers[task.id]) {
        clearInterval(state.timers[task.id]);
    }

    const startTime = new Date(task.startTime).getTime();
    const pauseTime = task.pausas ? task.pausas.reduce((sum, p) => sum + p.duracao * 1000, 0) : 0;

    state.timers[task.id] = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime - pauseTime;

        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        const timerEl = document.getElementById('taskTimer');
        if (timerEl) {
            timerEl.textContent =
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('active');

    // Clear all timers
    Object.values(state.timers).forEach(timer => clearInterval(timer));
    state.timers = {};
}

// ==========================================
// TASK ACTIONS
// ==========================================

async function startTask(taskId) {
    try {
        // Pedir nome do separador se ainda não tiver
        let nomeSeparador = state.user.name;
        if (!nomeSeparador) {
            nomeSeparador = prompt('Digite seu nome para iniciar a separação:');
            if (!nomeSeparador || !nomeSeparador.trim()) {
                showToast('Nome é obrigatório para iniciar a separação', 'error');
                return;
            }
            nomeSeparador = nomeSeparador.trim();

            // Salvar nome do separador no estado
            state.user.name = nomeSeparador;
            localStorage.setItem('repositionflow_user', JSON.stringify(state.user));

            // Atualizar display do usuário
            const roleEmoji = { 'atendente': '👤', 'separador': '📋', 'admin': '👑' };
            document.getElementById('userDisplay').textContent = `${roleEmoji[state.user.role]} ${nomeSeparador}`;
        }

        const response = await fetch(`/api/tasks/${taskId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nomeSeparador })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Separação iniciada!', 'success');
            closeModal();
            loadTasks();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao iniciar tarefa:', error);
        showToast('Erro ao iniciar tarefa', 'error');
    }
}

async function pauseTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/pause`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Separação pausada', 'success');
            closeModal();
            loadTasks();
        }
    } catch (error) {
        console.error('Erro ao pausar tarefa:', error);
        showToast('Erro ao pausar tarefa', 'error');
    }
}

async function resumeTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/resume`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Separação retomada', 'success');
            closeModal();
            loadTasks();
        }
    } catch (error) {
        console.error('Erro ao retomar tarefa:', error);
        showToast('Erro ao retomar tarefa', 'error');
    }
}

async function completeTask(taskId) {
    // Verificar se o arquivo foi enviado
    const fileInput = document.getElementById(`planilhaConclusao-${taskId}`);
    const file = fileInput?.files[0];

    if (!file) {
        showToast('É obrigatório enviar a planilha de conclusão com as colunas: Data movimentacao, Tipo movimentacao, Quantidade material', 'error');
        return;
    }

    if (!confirm('Deseja realmente concluir esta separação?')) return;

    try {
        const formData = new FormData();
        formData.append('planilhaConclusao', file);

        const response = await fetch(`/api/tasks/${taskId}/complete`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Tarefa concluída! Tempo: ${data.duration}`, 'success');
            closeModal();
            loadTasks();
        } else {
            showToast(data.error || 'Erro ao concluir tarefa', 'error');
        }
    } catch (error) {
        console.error('Erro ao concluir tarefa:', error);
        showToast('Erro ao concluir tarefa', 'error');
    }
}

async function markItem(taskId, sku, status) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/items/${sku}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Item marcado como ${status}`, 'success');
            openTaskModal(taskId); // Reload modal
        }
    } catch (error) {
        console.error('Erro ao marcar item:', error);
        showToast('Erro ao atualizar item', 'error');
    }
}

async function exportTaskToExcel(taskId) {
    try {
        window.location.href = `/api/tasks/${taskId}/export-excel`;
        showToast('Download iniciado!', 'success');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showToast('Erro ao exportar', 'error');
    }
}

// ==========================================
// UPLOAD FORM
// ==========================================

async function handleUploadForm(e) {
    e.preventDefault();

    const nomeAtendente = document.getElementById('nomeAtendente').value.trim();
    const prioridade = document.getElementById('prioridade').value;
    const observacoes = document.getElementById('observacoes').value.trim();
    const file = document.getElementById('planilhaFile').files[0];

    if (!nomeAtendente) {
        showToast('Digite seu nome', 'error');
        return;
    }

    if (!file) {
        showToast('Selecione um arquivo', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('nomeAtendente', nomeAtendente);
    formData.append('prioridade', prioridade);
    formData.append('observacoes', observacoes);
    formData.append('planilha', file);

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // Salvar nome do atendente no estado do usuário
            state.user.name = nomeAtendente;
            localStorage.setItem('repositionflow_user', JSON.stringify(state.user));

            // Atualizar display do usuário
            const roleEmoji = { 'atendente': '👤', 'separador': '📋', 'admin': '👑' };
            document.getElementById('userDisplay').textContent = `${roleEmoji[state.user.role]} ${state.user.name}`;

            showToast(`Tarefa criada! ${data.summary.uniqueSkus} SKUs únicos, ${data.summary.totalItems} itens`, 'success');
            document.getElementById('uploadForm').reset();
            // Restaurar nome do atendente no campo
            document.getElementById('nomeAtendente').value = nomeAtendente;
            switchView('dashboard');
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao enviar planilha:', error);
        showToast('Erro ao enviar planilha', 'error');
    }
}

// ==========================================
// METRICS VIEW
// ==========================================

async function loadMetrics() {
    try {
        const periodo = document.getElementById('metricsFilter')?.value || '';
        const params = new URLSearchParams();
        if (periodo) params.append('periodo', periodo);

        const response = await fetch(`/api/metrics?${params}`);
        const data = await response.json();

        // Se houver erro no backend, ainda renderizar estrutura vazia
        const safeData = {
            totalTarefas: data.totalTarefas || 0,
            tempoMedio: data.tempoMedio || 0,
            rankingSeparadores: data.rankingSeparadores || [],
            porAtendente: data.porAtendente || {},
            porSeparador: data.porSeparador || {}
        };

        // Update stats
        document.getElementById('metricTotalTarefas').textContent = safeData.totalTarefas;
        document.getElementById('metricTempoMedio').textContent = formatSeconds(safeData.tempoMedio);

        // Render ranking
        renderRanking(safeData.rankingSeparadores);

        // Render detailed stats
        renderDetailedStats(safeData.porAtendente, safeData.porSeparador);

        // Mostrar mensagem se houver erro do backend
        if (data.error) {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar métricas:', error);
        showToast('Erro ao carregar métricas', 'error');

        // Renderizar dados vazios em caso de erro
        document.getElementById('metricTotalTarefas').textContent = '0';
        document.getElementById('metricTempoMedio').textContent = '00:00:00';
        renderRanking([]);
        renderDetailedStats({}, {});
    }
}

function renderRanking(ranking) {
    const container = document.getElementById('rankingSeparadores');

    if (!ranking || ranking.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Nenhum dado disponível</p>';
        return;
    }

    container.innerHTML = ranking.map((sep, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 1.5rem; font-weight: 700; color: ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'var(--text-secondary)'};">
                    ${index + 1}°
                </div>
                <div>
                    <div style="font-weight: 600;">${sep.nome}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${sep.count} tarefas</div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-green);">
                    ${formatSeconds(sep.avgTime)}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">tempo médio</div>
            </div>
        </div>
    `).join('');
}

function renderDetailedStats(porAtendente, porSeparador) {
    // Por Atendente
    const atendenteContainer = document.getElementById('statsPorAtendente');
    if (!porAtendente || Object.keys(porAtendente).length === 0) {
        atendenteContainer.innerHTML = '<p style="color: var(--text-secondary);">Nenhum dado</p>';
    } else {
        atendenteContainer.innerHTML = Object.entries(porAtendente).map(([nome, data]) => `
            <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">${nome}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${data.count} tarefas • ${formatSeconds(data.totalTime)} total
                </div>
            </div>
        `).join('');
    }

    // Por Separador
    const separadorContainer = document.getElementById('statsPorSeparador');
    if (!porSeparador || Object.keys(porSeparador).length === 0) {
        separadorContainer.innerHTML = '<p style="color: var(--text-secondary);">Nenhum dado</p>';
    } else {
        separadorContainer.innerHTML = Object.entries(porSeparador).map(([nome, data]) => `
            <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">${nome}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${data.count} tarefas • ${formatSeconds(data.totalTime / data.count)} médio
                </div>
            </div>
        `).join('');
    }
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================

async function loadAdminDashboard() {
    try {
        const response = await fetch('/api/admin/dashboard');
        const data = await response.json();

        // Update stats
        document.getElementById('adminStatTotal').textContent = data.stats.totalTarefas;
        document.getElementById('adminStatPendentes').textContent = data.stats.tarefasPendentes;
        document.getElementById('adminStatEmSeparacao').textContent = data.stats.tarefasEmSeparacao;
        document.getElementById('adminStatConcluidas').textContent = data.stats.tarefasConcluidas;
        document.getElementById('adminStatItens').textContent = data.stats.totalItens;
        document.getElementById('adminStatTempoMedio').textContent = formatSeconds(data.stats.tempoMedioSeparacao);

        // Render charts
        renderAdminCharts(data);

        // Render tables
        renderAdminTables(data);
    } catch (error) {
        console.error('Erro ao carregar dashboard admin:', error);
        showToast('Erro ao carregar dashboard', 'error');
    }
}

function renderAdminCharts(data) {
    const chartColors = {
        primary: '#7ee787',
        secondary: '#58a6ff',
        tertiary: '#ff6b35',
        quaternary: '#d29922'
    };

    // Destroy existing charts
    Object.values(state.charts).forEach(chart => chart.destroy());
    state.charts = {};

    // Chart 1: Top 5 Separadores - Total de Separações
    const top5Separadores = data.separadores.slice(0, 5);
    if (top5Separadores.length > 0) {
        const ctx1 = document.getElementById('chartSeparadores');
        state.charts.separadores = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: top5Separadores.map(s => s.nome),
                datasets: [{
                    label: 'Total de Separações',
                    data: top5Separadores.map(s => s.totalSeparacoes),
                    backgroundColor: chartColors.primary,
                    borderColor: chartColors.primary,
                    borderWidth: 1
                }]
            },
            options: getChartOptions('bar')
        });
    }

    // Chart 2: Tempo Médio por Separador
    if (top5Separadores.length > 0) {
        const ctx2 = document.getElementById('chartTemposSeparadores');
        state.charts.tempos = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: top5Separadores.map(s => s.nome),
                datasets: [{
                    label: 'Tempo Médio (minutos)',
                    data: top5Separadores.map(s => (s.tempoMedio / 60).toFixed(1)),
                    backgroundColor: 'rgba(88, 166, 255, 0.2)',
                    borderColor: chartColors.secondary,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: getChartOptions('line')
        });
    }

    // Chart 3: Top 5 Atendentes - Listas
    const top5Atendentes = data.atendentes.slice(0, 5);
    if (top5Atendentes.length > 0) {
        const ctx3 = document.getElementById('chartAtendentes');
        state.charts.atendentes = new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: top5Atendentes.map(a => a.nome),
                datasets: [{
                    data: top5Atendentes.map(a => a.totalListas),
                    backgroundColor: [
                        chartColors.primary,
                        chartColors.secondary,
                        chartColors.tertiary,
                        chartColors.quaternary,
                        '#8b5cf6'
                    ]
                }]
            },
            options: getDoughnutChartOptions()
        });
    }

    // Chart 4: Total de Itens por Atendente
    if (top5Atendentes.length > 0) {
        const ctx4 = document.getElementById('chartItensAtendentes');
        state.charts.itens = new Chart(ctx4, {
            type: 'bar',
            data: {
                labels: top5Atendentes.map(a => a.nome),
                datasets: [{
                    label: 'Total de Itens',
                    data: top5Atendentes.map(a => a.totalItens),
                    backgroundColor: chartColors.tertiary,
                    borderColor: chartColors.tertiary,
                    borderWidth: 1
                }]
            },
            options: getChartOptions('bar')
        });
    }
}

function getChartOptions(type) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: type === 'line',
                labels: {
                    color: '#e6edf3',
                    font: { size: 12 }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: '#7d8590' },
                grid: { color: 'rgba(48, 54, 61, 0.5)' }
            },
            x: {
                ticks: { color: '#7d8590' },
                grid: { color: 'rgba(48, 54, 61, 0.5)' }
            }
        }
    };
}

function getDoughnutChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#e6edf3',
                    font: { size: 12 },
                    padding: 15
                }
            }
        }
    };
}

function renderAdminTables(data) {
    // Table Separadores
    const tableSeparadores = document.getElementById('tableSeparadores');
    if (data.separadores.length === 0) {
        tableSeparadores.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Nenhum dado disponível</td></tr>';
    } else {
        tableSeparadores.innerHTML = data.separadores.map((sep, index) => `
            <tr>
                <td style="font-weight: 700; color: ${index < 3 ? 'var(--accent-green)' : 'inherit'};">${index + 1}</td>
                <td>${sep.nome}</td>
                <td>${sep.totalSeparacoes}</td>
                <td>${sep.totalItens}</td>
                <td>${sep.tempoMedioFormatado}</td>
            </tr>
        `).join('');
    }

    // Table Atendentes
    const tableAtendentes = document.getElementById('tableAtendentes');
    if (data.atendentes.length === 0) {
        tableAtendentes.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Nenhum dado disponível</td></tr>';
    } else {
        tableAtendentes.innerHTML = data.atendentes.map((atd, index) => `
            <tr>
                <td style="font-weight: 700; color: ${index < 3 ? 'var(--accent-blue)' : 'inherit'};">${index + 1}</td>
                <td>${atd.nome}</td>
                <td>${atd.totalListas}</td>
                <td>${atd.totalItens}</td>
                <td>${atd.listasConcluidas}</td>
            </tr>
        `).join('');
    }
}

// ==========================================
// UTILITIES
// ==========================================

function showElement(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function hideElement(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.25rem;">
            ${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'} ${type.toUpperCase()}
        </div>
        <div style="font-size: 0.9rem; color: var(--text-secondary);">${message}</div>
    `;

    const container = document.getElementById('toastContainer');
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function formatSeconds(seconds) {
    if (!seconds) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

function playNotificationSound() {
    // Create a simple beep sound
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Não foi possível reproduzir som de notificação');
    }
}

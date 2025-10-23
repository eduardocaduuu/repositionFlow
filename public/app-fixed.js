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
    console.log('=== APP INICIANDO ===');
    initializeApp();
});

function initializeApp() {
    console.log('Inicializando aplicação...');

    // Event listeners do login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Event listeners de navegação - MÉTODO DIRETO
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
    console.log('Configurando navegação...');

    // Botão Dashboard
    const btnDashboard = document.querySelector('[data-view="dashboard"]');
    if (btnDashboard) {
        btnDashboard.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('>>> DASHBOARD CLICADO');
            switchView('dashboard');
        });
        console.log('Listener Dashboard adicionado');
    }

    // Botão Nova Requisição
    const btnNovaRequisicao = document.getElementById('novaTarefaBtn');
    if (btnNovaRequisicao) {
        btnNovaRequisicao.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('>>> NOVA REQUISIÇÃO CLICADO');
            switchView('nova-requisicao');
        });
        console.log('Listener Nova Requisição adicionado');
    }

    // Botão Métricas
    const btnMetricas = document.getElementById('metricasBtn');
    if (btnMetricas) {
        btnMetricas.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('>>> MÉTRICAS CLICADO');
            switchView('metricas');
        });
        console.log('Listener Métricas adicionado');
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();

    const userName = document.getElementById('userName').value.trim();
    const userRole = document.getElementById('userRole').value;

    console.log('=== FAZENDO LOGIN ===');
    console.log('Nome:', userName);
    console.log('Papel:', userRole);

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

    console.log('=== CONFIGURANDO VISIBILIDADE ===');
    console.log('Papel:', userRole);
    console.log('Botão Nova Tarefa:', novaTarefaBtn);
    console.log('Botão Métricas:', metricasBtn);

    if (userRole === 'atendente') {
        novaTarefaBtn.classList.remove('hidden');
        metricasBtn.classList.add('hidden');
        console.log('✓ Atendente: Nova Tarefa visível, Métricas oculto');
    } else if (userRole === 'separador') {
        novaTarefaBtn.classList.add('hidden');
        metricasBtn.classList.add('hidden');
        console.log('✓ Separador: Ambos ocultos');
    } else {
        novaTarefaBtn.classList.remove('hidden');
        metricasBtn.classList.remove('hidden');
        console.log('✓ Admin: Ambos visíveis');
    }

    // Verificar classes após mudança
    console.log('Classes Nova Tarefa após:', novaTarefaBtn.className);
    console.log('Classes Métricas após:', metricasBtn.className);
    console.log('Nova Tarefa visível?', novaTarefaBtn.offsetWidth > 0 && novaTarefaBtn.offsetHeight > 0);

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
    console.log('=== MUDANDO VIEW ===');
    console.log('Para:', viewName);

    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        console.log('Removendo active de:', v.id);
    });

    document.querySelectorAll('.nav-btn:not(.logout-btn)').forEach(b => {
        b.classList.remove('active');
    });

    const viewElement = document.getElementById(viewName);
    const navButton = document.querySelector(`[data-view="${viewName}"]`);

    console.log('View element:', viewElement);
    console.log('Nav button:', navButton);

    if (viewElement) {
        viewElement.classList.add('active');
        console.log('✓ View ativada:', viewName);
    } else {
        console.error('✗ ERRO: View não encontrada:', viewName);
    }

    if (navButton) {
        navButton.classList.add('active');
        console.log('✓ Botão ativado');
    }

    if (viewName === 'metricas') {
        loadMetrics();
    }
}

// CONTINUA NO PRÓXIMO ARQUIVO...
// (O restante das funções permanece igual ao app.js original)

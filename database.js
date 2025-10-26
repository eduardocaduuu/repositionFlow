// ==========================================
// FIREBASE FIRESTORE DATABASE MODULE
// ==========================================

const admin = require('firebase-admin');

// Inicializar Firebase Admin
function initializeFirebase() {
  try {
    // Verificar se variáveis de ambiente estão configuradas
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.warn('⚠️  Firebase não configurado. Usando armazenamento em memória.');
      return null;
    }

    // Processar private key - aceita tanto \n literal quanto quebras de linha reais
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('FIREBASE_PRIVATE_KEY não definida');
    }

    // Se a chave vier com aspas, remover
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.slice(1, -1);
    }

    // Substituir \n literal por quebra de linha real
    privateKey = privateKey.replace(/\\n/g, '\n');

    // Verificar se a chave tem o formato correto
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY inválida - formato incorreto');
    }

    console.log('🔑 Configurando Firebase Admin SDK...');
    console.log('   Project ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('   Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
    console.log('   Private Key:', privateKey.substring(0, 50) + '...');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });

    console.log('✅ Firebase Firestore conectado com sucesso!');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Erro ao conectar Firebase:', error.message);
    console.error('Detalhes:', error);
    console.warn('⚠️  Usando armazenamento em memória como fallback.');
    return null;
  }
}

const db = initializeFirebase();

// ==========================================
// TASKS COLLECTION
// ==========================================

const COLLECTIONS = {
  TASKS: 'tasks',
  USERS: 'users'
};

class Database {
  constructor() {
    this.useFirestore = !!db;
    // Fallback: armazenamento em memória
    this.memoryTasks = [];
    this.memoryUsers = [];
  }

  // ==========================================
  // TASKS - CREATE
  // ==========================================

  async createTask(taskData) {
    if (this.useFirestore) {
      try {
        const docRef = db.collection(COLLECTIONS.TASKS).doc(taskData.id);
        await docRef.set({
          ...taskData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return taskData;
      } catch (error) {
        console.error('Erro ao criar task no Firestore:', error);
        throw error;
      }
    } else {
      // Fallback: memória
      this.memoryTasks.push(taskData);
      return taskData;
    }
  }

  // ==========================================
  // TASKS - READ
  // ==========================================

  async getAllTasks(filters = {}) {
    if (this.useFirestore) {
      try {
        console.log('📊 [Firestore] Buscando tarefas com filtros:', filters);
        let query = db.collection(COLLECTIONS.TASKS);

        // Aplicar filtros
        if (filters.status) {
          query = query.where('status', '==', filters.status);
        }
        if (filters.nomeAtendente) {
          query = query.where('nomeAtendente', '==', filters.nomeAtendente);
        }

        // Ordenar por data de criação (mais recentes primeiro)
        query = query.orderBy('createdAt', 'desc');

        console.log('🔄 [Firestore] Executando query...');
        const snapshot = await query.get();
        const tasks = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          // Converter Timestamp para ISO string
          if (data.createdAt && data.createdAt.toDate) {
            data.createdAt = data.createdAt.toDate().toISOString();
          }
          if (data.updatedAt && data.updatedAt.toDate) {
            data.updatedAt = data.updatedAt.toDate().toISOString();
          }
          tasks.push(data);
        });

        console.log(`✅ [Firestore] ${tasks.length} tarefas recuperadas`);
        return tasks;
      } catch (error) {
        console.error('❌ [Firestore] Erro ao buscar tasks:', error.message);
        console.error('Stack:', error.stack);
        throw error;
      }
    } else {
      // Fallback: memória
      console.log('💾 [Memória] Buscando tarefas com filtros:', filters);
      let tasks = [...this.memoryTasks];

      if (filters.status) {
        tasks = tasks.filter(t => t.status === filters.status);
      }
      if (filters.nomeAtendente) {
        tasks = tasks.filter(t => t.nomeAtendente.toLowerCase().includes(filters.nomeAtendente.toLowerCase()));
      }

      console.log(`✅ [Memória] ${tasks.length} tarefas recuperadas`);
      return tasks;
    }
  }

  async getTaskById(taskId) {
    if (this.useFirestore) {
      try {
        const doc = await db.collection(COLLECTIONS.TASKS).doc(taskId).get();

        if (!doc.exists) {
          return null;
        }

        const data = doc.data();
        // Converter Timestamp para ISO string
        if (data.createdAt && data.createdAt.toDate) {
          data.createdAt = data.createdAt.toDate().toISOString();
        }
        if (data.updatedAt && data.updatedAt.toDate) {
          data.updatedAt = data.updatedAt.toDate().toISOString();
        }

        return data;
      } catch (error) {
        console.error('Erro ao buscar task por ID no Firestore:', error);
        throw error;
      }
    } else {
      // Fallback: memória
      return this.memoryTasks.find(t => t.id === taskId) || null;
    }
  }

  // ==========================================
  // TASKS - UPDATE
  // ==========================================

  async updateTask(taskId, updates) {
    if (this.useFirestore) {
      try {
        const docRef = db.collection(COLLECTIONS.TASKS).doc(taskId);
        await docRef.update({
          ...updates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Retornar task atualizada
        return await this.getTaskById(taskId);
      } catch (error) {
        console.error('Erro ao atualizar task no Firestore:', error);
        throw error;
      }
    } else {
      // Fallback: memória
      const task = this.memoryTasks.find(t => t.id === taskId);
      if (task) {
        Object.assign(task, updates);
        return task;
      }
      return null;
    }
  }

  // ==========================================
  // TASKS - DELETE
  // ==========================================

  async deleteTask(taskId) {
    if (this.useFirestore) {
      try {
        await db.collection(COLLECTIONS.TASKS).doc(taskId).delete();
        return true;
      } catch (error) {
        console.error('Erro ao deletar task no Firestore:', error);
        throw error;
      }
    } else {
      // Fallback: memória
      const index = this.memoryTasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.memoryTasks.splice(index, 1);
        return true;
      }
      return false;
    }
  }

  // ==========================================
  // ANALYTICS & METRICS
  // ==========================================

  async getCompletedTasks(filters = {}) {
    const allTasks = await this.getAllTasks({ status: 'CONCLUIDO' });

    // Aplicar filtros de período
    if (filters.periodo) {
      const now = new Date();
      let startDate;

      switch (filters.periodo) {
        case 'dia':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'semana':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'mes':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        return allTasks.filter(t => new Date(t.createdAt) >= startDate);
      }
    }

    return allTasks;
  }

  // ==========================================
  // UTILITY
  // ==========================================

  isUsingFirestore() {
    return this.useFirestore;
  }

  async healthCheck() {
    if (this.useFirestore) {
      try {
        // Testar conexão
        await db.collection('_health').doc('check').set({ timestamp: new Date() });
        await db.collection('_health').doc('check').delete();
        return { status: 'ok', database: 'firestore' };
      } catch (error) {
        return { status: 'error', database: 'firestore', error: error.message };
      }
    } else {
      return { status: 'ok', database: 'memory' };
    }
  }
}

module.exports = new Database();

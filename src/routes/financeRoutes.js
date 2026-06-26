const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const authController = require('../controllers/authController');

// ============================================
// ROTAS PÚBLICAS (NÃO PRECISAM DE LOGIN)
// ============================================
router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.get('/register', authController.showRegister);
router.post('/register', authController.register);
router.get('/logout', authController.logout);

// Rota de health check (pública)
router.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Servidor rodando!',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================
// Só aplica a partir daqui para baixo
router.use((req, res, next) => {
    console.log('🔍 Verificando autenticação...');
    console.log('📍 Rota:', req.url);
    console.log('👤 Sessão:', req.session ? 'Existe' : 'Não existe');
    console.log('🆔 userId:', req.session?.userId);
    
    if (!req.session || !req.session.userId) {
        console.log('❌ Usuário não autenticado - redirecionando para login');
        req.flash('error', 'Faça login para acessar esta página');
        return res.redirect('/login');
    }
    
    console.log('✅ Usuário autenticado:', req.session.userId);
    next();
});

// ============================================
// DADOS DO USUÁRIO PARA VIEWS
// ============================================
router.use((req, res, next) => {
    if (req.session && req.session.userId) {
        res.locals.isAuthenticated = true;
        res.locals.user = {
            id: req.session.userId,
            name: req.session.userName || 'Usuário',
            email: req.session.userEmail || ''
        };
    } else {
        res.locals.isAuthenticated = false;
        res.locals.user = null;
    }
    next();
});

// ============================================
// DADOS COMUNS PARA VIEWS
// ============================================
router.use(financeController.addCommonData);

// ============================================
// ROTAS PROTEGIDAS (PRECISAM DE LOGIN)
// ============================================
router.get('/', financeController.getFinances);
router.get('/add', financeController.showAddForm);
router.post('/add', financeController.addFinance);
router.get('/edit/:id', financeController.showEditForm);
router.put('/edit/:id', financeController.updateFinance);
router.delete('/delete/:id', financeController.deleteFinance);

// Rotas de API
router.post('/toggle/:id', financeController.toggleStatus);
router.get('/api/stats', financeController.getStats);
router.get('/api/export', financeController.exportData);
router.get('/export/pdf', financeController.exportPDF);
router.get('/test-data', financeController.addTestData);

// Rota de fallback - se chegar aqui, é 404
router.use((req, res) => {
    res.status(404).render('404', {
        title: 'Página não encontrada',
        message: 'A página que você procura não existe.'
    });
});

module.exports = router;
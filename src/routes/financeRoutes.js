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

// Rota de health check
router.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Servidor rodando!',
        session: req.session?.userId || 'Nenhuma sessão',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ROTAS PROTEGIDAS
// ============================================
router.use(authController.isAuthenticated);
router.use(authController.addUserToLocals);
router.use(financeController.addCommonData);

// Rotas principais
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
router.get('/export/pdf', financeController.exportPDF); // esta aqui
router.get('/test-data', financeController.addTestData);

// Rota de fallback 404
router.use((req, res) => {
    res.status(404).render('404', {
        title: 'Página não encontrada',
        message: 'A página que você procura não existe.'
    });
});

module.exports = router;
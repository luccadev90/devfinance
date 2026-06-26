const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');

// Middleware para dados comuns
router.use(financeController.addCommonData);

// ===== ROTAS PRINCIPAIS =====
router.get('/', financeController.getFinances);
router.get('/add', financeController.showAddForm);
router.post('/add', financeController.addFinance);
router.get('/edit/:id', financeController.showEditForm);
router.put('/edit/:id', financeController.updateFinance);
router.delete('/delete/:id', financeController.deleteFinance);

// ===== ROTAS DE API =====
router.post('/toggle/:id', financeController.toggleStatus);
router.get('/api/stats', financeController.getStats);
router.get('/api/export', financeController.exportData);

// ===== ROTA DE TESTE =====
router.get('/test-data', financeController.addTestData);

// ===== ROTA DE EXPORTAÇÃO PDF =====
router.get('/export/pdf', financeController.exportPDF);

module.exports = router;
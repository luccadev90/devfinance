const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const authController = require('../controllers/authController');
const Finance = require('../models/Finance'); // Importar o modelo

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
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ROTAS PROTEGIDAS (PRECISAM DE LOGIN)
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
router.get('/export/pdf', financeController.exportPDF);
router.get('/test-data', financeController.addTestData);

// ============================================
// ROTA DE TESTE - VERIFICAR MESES DISPONÍVEIS
// ============================================
router.get('/test-months', async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Faça login primeiro' });
        }

        console.log('🔍 Testando meses para usuário:', userId);

        // Buscar todos os registros do usuário
        const allData = await Finance.find({ userId: userId })
            .select('description month year date status')
            .sort({ year: -1, month: -1 })
            .lean();

        console.log(`📊 Total de registros: ${allData.length}`);

        // Extrair meses únicos
        const monthMap = new Map();
        allData.forEach(item => {
            if (item.month && item.year) {
                const key = `${item.year}-${item.month}`;
                if (!monthMap.has(key)) {
                    monthMap.set(key, {
                        year: item.year,
                        month: item.month,
                        count: 0,
                        items: []
                    });
                }
                monthMap.get(key).count++;
                monthMap.get(key).items.push({
                    description: item.description,
                    date: item.date,
                    status: item.status
                });
            }
        });

        // Converter para array
        const availableMonths = Array.from(monthMap.values())
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            });

        res.json({
            success: true,
            totalRecords: allData.length,
            recordsWithMonth: allData.filter(d => d.month && d.year).length,
            availableMonths: availableMonths,
            sampleData: allData.slice(0, 5)
        });
    } catch (error) {
        console.error('❌ Erro no test-months:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Rota de fallback 404
router.use((req, res) => {
    res.status(404).render('404', {
        title: 'Página não encontrada',
        message: 'A página que você procura não existe.'
    });
});

module.exports = router;
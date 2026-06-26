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

// Rota para migrar dados (apenas desenvolvimento)
router.get('/migrate', async (req, res) => {
    try {
        const finances = await Finance.find({});
        let count = 0;
        
        for (const finance of finances) {
            if (finance.month !== undefined && finance.year !== undefined) continue;
            
            const date = finance.date ? new Date(finance.date) : finance.createdAt;
            finance.month = date.getMonth() + 1;
            finance.year = date.getFullYear();
            await finance.save();
            count++;
        }
        
        res.send(`✅ Migração concluída! ${count} registros atualizados.`);
    } catch (error) {
        res.status(500).send('❌ Erro na migração: ' + error.message);
    }
});

// Rota para testar dados
router.get('/test-data', financeController.addTestData);
router.get('/test-months', async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect('/login');
        }

        // Buscar todos os meses disponíveis
        const months = await Finance.aggregate([
            { $match: { userId: userId } },
            { $group: {
                _id: { year: '$year', month: '$month' },
                year: { $first: '$year' },
                month: { $first: '$month' },
                count: { $sum: 1 }
            }},
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);

        // Buscar todos os dados
        const allData = await Finance.find({ userId: userId })
            .sort({ year: -1, month: -1, date: -1 })
            .lean();

        res.json({
            success: true,
            totalRecords: allData.length,
            availableMonths: months,
            sampleData: allData.slice(0, 5).map(d => ({
                description: d.description,
                month: d.month,
                year: d.year,
                date: d.date,
                status: d.status
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota Sobre (pública)
router.get('/sobre', (req, res) => {
    res.render('sobre', {
        title: 'Sobre - DevFinance',
        isAuthenticated: req.session && req.session.userId ? true : false,
        user: req.session ? {
            name: req.session.userName,
            email: req.session.userEmail
        } : null
    });
});

// Rota de fallback 404
router.use((req, res) => {
    res.status(404).render('404', {
        title: 'Página não encontrada',
        message: 'A página que você procura não existe.'
    });
});

module.exports = router;
const Finance = require('../models/Finance');

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

// Calcular balanços a partir dos dados
const calculateBalances = (finances) => {
    let totalIncome = 0;
    let totalExpense = 0;
    let pendingIncome = 0;
    let pendingExpense = 0;
    let paidIncome = 0;
    let paidExpense = 0;

    finances.forEach(finance => {
        const amount = parseFloat(finance.amount);
        
        if (finance.type === 'income') {
            totalIncome += amount;
            if (finance.status === 'paid') {
                paidIncome += amount;
            } else {
                pendingIncome += amount;
            }
        } else {
            totalExpense += amount;
            if (finance.status === 'paid') {
                paidExpense += amount;
            } else {
                pendingExpense += amount;
            }
        }
    });

    return {
        totalIncome,
        totalExpense,
        pendingIncome,
        pendingExpense,
        paidIncome,
        paidExpense,
        balance: totalIncome - totalExpense,
        pendingBalance: pendingIncome - pendingExpense,
        paidBalance: paidIncome - paidExpense
    };
};

// ============================================
// MIDDLEWARES
// ============================================

// Adiciona dados comuns a todas as views
exports.addCommonData = async (req, res, next) => {
    try {
        const totalItems = await Finance.countDocuments();
        res.locals.totalItems = totalItems;
        next();
    } catch (error) {
        console.error('Erro ao contar documentos:', error);
        res.locals.totalItems = 0;
        next();
    }
};

// ============================================
// CONTROLADORES - ROTAS PRINCIPAIS
// ============================================

// GET / - Listar todas as finanças com filtros
exports.getFinances = async (req, res) => {
    try {
        const statusFilter = req.query.status || 'all';
        const typeFilter = req.query.type || 'all';

        // Construir filtro
        const filter = {};
        if (statusFilter !== 'all') filter.status = statusFilter;
        if (typeFilter !== 'all') filter.type = typeFilter;

        // Buscar do banco
        const finances = await Finance.find(filter)
            .sort({ createdAt: -1 })
            .lean(); // .lean() para objetos JS puros

        const totalItems = await Finance.countDocuments();
        const balances = calculateBalances(finances);

        res.render('index', {
            title: 'DevFinance - Dashboard',
            finances: finances,
            balances: balances,
            totalItems: totalItems,
            filteredItems: finances.length,
            statusFilter: statusFilter,
            typeFilter: typeFilter
        });
    } catch (error) {
        console.error('Erro ao buscar finanças:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar os dados. Tente novamente.'
        });
    }
};

// GET /add - Mostrar formulário de adição
exports.showAddForm = (req, res) => {
    res.render('add', {
        title: 'Adicionar Finança'
    });
};

// POST /add - Adicionar nova finança
exports.addFinance = async (req, res) => {
    try {
        const { description, amount, type, status, date } = req.body;

        // Validar e corrigir dados
        const newFinance = new Finance({
            description: description.trim(),
            amount: parseFloat(amount),
            type: type || 'income',
            status: status || 'pending',
            date: date || new Date().toISOString().split('T')[0]
        });

        await newFinance.save();
        console.log(`✅ Adicionado: ${newFinance.description} (${newFinance.status})`);
        
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao adicionar finança:', error);
        res.status(400).render('add', {
            title: 'Adicionar Finança',
            error: error.message
        });
    }
};

// GET /edit/:id - Mostrar formulário de edição
exports.showEditForm = async (req, res) => {
    try {
        const id = req.params.id;
        const finance = await Finance.findById(id);

        if (!finance) {
            return res.status(404).render('404', {
                title: 'Finança não encontrada',
                message: 'A finança que você procura não existe.'
            });
        }

        res.render('edit', {
            title: 'Editar Finança',
            finance: finance
        });
    } catch (error) {
        console.error('Erro ao buscar finança:', error);
        res.status(404).render('404', {
            title: 'Erro',
            message: 'Finança não encontrada'
        });
    }
};

// PUT /edit/:id - Atualizar finança
exports.updateFinance = async (req, res) => {
    try {
        const id = req.params.id;
        const { description, amount, type, status, date } = req.body;

        const updateData = {
            description: description.trim(),
            amount: parseFloat(amount),
            type: type || 'income',
            status: status || 'pending',
            date: date || new Date().toISOString().split('T')[0],
            updatedAt: new Date()
        };

        const finance = await Finance.findByIdAndUpdate(id, updateData, {
            new: true, // Retorna o documento atualizado
            runValidators: true // Valida os dados
        });

        if (!finance) {
            return res.status(404).render('404', {
                title: 'Finança não encontrada',
                message: 'A finança que você procura não existe.'
            });
        }

        console.log(`✏️ Atualizado: ${finance.description} (${finance.status})`);
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao atualizar finança:', error);
        res.status(400).send('Erro ao atualizar. Verifique os dados.');
    }
};

// DELETE /delete/:id - Excluir finança
exports.deleteFinance = async (req, res) => {
    try {
        const id = req.params.id;
        const finance = await Finance.findByIdAndDelete(id);

        if (!finance) {
            return res.status(404).render('404', {
                title: 'Finança não encontrada',
                message: 'A finança que você procura não existe.'
            });
        }

        console.log(`🗑️ Excluído: ${finance.description}`);
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao excluir finança:', error);
        res.status(500).send('Erro ao excluir. Tente novamente.');
    }
};

// ============================================
// CONTROLADORES - ROTAS DE API
// ============================================

// POST /toggle/:id - Alternar status
// POST /toggle/:id - Alternar status
exports.toggleStatus = async (req, res) => {
    try {
        const id = req.params.id;
        console.log(`🔄 Recebendo toggle para ID: ${id}`); // Debug
        
        // Buscar a finança pelo ID
        const finance = await Finance.findById(id);

        if (!finance) {
            console.log(`❌ Finança ID ${id} não encontrada`);
            return res.status(404).json({ 
                success: false, 
                error: 'Finança não encontrada' 
            });
        }

        // Alternar status
        const newStatus = finance.status === 'paid' ? 'pending' : 'paid';
        finance.status = newStatus;
        finance.updatedAt = new Date();
        
        await finance.save();

        console.log(`✅ Status alternado: ${finance.description} -> ${finance.status}`);

        res.json({
            success: true,
            status: finance.status,
            message: `Status alterado para ${finance.status === 'paid' ? 'Pago' : 'Pendente'}`
        });
    } catch (error) {
        console.error('❌ Erro ao alternar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao alternar status: ' + error.message
        });
    }
};
// GET /api/stats - Obter estatísticas
exports.getStats = async (req, res) => {
    try {
        const finances = await Finance.find().lean();
        const balances = calculateBalances(finances);
        
        res.json({
            ...balances,
            totalTransactions: finances.length,
            totalIncomeCount: finances.filter(f => f.type === 'income').length,
            totalExpenseCount: finances.filter(f => f.type === 'expense').length,
            pendingCount: finances.filter(f => f.status === 'pending').length,
            paidCount: finances.filter(f => f.status === 'paid').length
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
};

// GET /api/export - Exportar todos os dados
exports.exportData = async (req, res) => {
    try {
        const finances = await Finance.find().lean();
        const stats = calculateBalances(finances);
        
        const data = {
            finances: finances,
            stats: stats,
            exportedAt: new Date().toISOString(),
            totalRecords: finances.length
        };
        
        res.json(data);
    } catch (error) {
        console.error('Erro ao exportar dados:', error);
        res.status(500).json({ error: 'Erro ao exportar dados' });
    }
};

// ============================================
// ROTA DE TESTE
// ============================================

// GET /test-data - Adicionar dados de exemplo
exports.addTestData = async (req, res) => {
    try {
        const testData = [
            { description: 'Salário Mensal', amount: 5000, type: 'income', status: 'paid' },
            { description: 'Aluguel', amount: 1200, type: 'expense', status: 'pending' },
            { description: 'Freelance', amount: 800, type: 'income', status: 'pending' },
            { description: 'Supermercado', amount: 450, type: 'expense', status: 'paid' },
            { description: 'Internet', amount: 100, type: 'expense', status: 'paid' },
            { description: 'Energia', amount: 200, type: 'expense', status: 'pending' },
            { description: 'Venda de Curso', amount: 350, type: 'income', status: 'paid' }
        ];

        // Verificar se já existem dados
        const count = await Finance.countDocuments();
        if (count > 0) {
            return res.redirect('/');
        }

        await Finance.insertMany(testData);
        console.log(`🧪 Dados de teste adicionados: ${testData.length} registros`);
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao adicionar dados de teste:', error);
        res.status(500).send('Erro ao adicionar dados de teste');
    }
};
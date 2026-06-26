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

// GET / - Listar finanças com filtro mensal
exports.getFinances = async (req, res) => {
    try {
        const userId = req.session.userId;
        const statusFilter = req.query.status || 'all';
        const typeFilter = req.query.type || 'all';
        const monthFilter = req.query.month || 'current';
        const yearFilter = req.query.year || new Date().getFullYear();

        console.log(`📅 Filtro: Mês=${monthFilter}, Ano=${yearFilter}`);

        // Construir filtro base
        const filter = { userId: userId };

        // ===== FILTRO POR MÊS E ANO =====
        let selectedMonth, selectedYear;
        
        if (monthFilter === 'current') {
            // Mês atual
            const now = new Date();
            selectedMonth = now.getMonth() + 1;
            selectedYear = now.getFullYear();
        } else if (monthFilter && !isNaN(monthFilter)) {
            // Mês específico
            selectedMonth = parseInt(monthFilter);
            selectedYear = parseInt(yearFilter);
        } else {
            // Fallback: mês atual
            const now = new Date();
            selectedMonth = now.getMonth() + 1;
            selectedYear = now.getFullYear();
        }

        // Aplicar filtro de mês/ano
        filter.month = selectedMonth;
        filter.year = selectedYear;

        // FILTROS ADICIONAIS
        if (statusFilter !== 'all') filter.status = statusFilter;
        if (typeFilter !== 'all') filter.type = typeFilter;

        console.log('🔍 Filtro aplicado:', filter);

        // ===== BUSCAR TRANSAÇÕES DO MÊS SELECIONADO =====
        const finances = await Finance.find(filter)
            .sort({ date: -1, createdAt: -1 })
            .lean();

        console.log(`📊 Transações do mês ${selectedMonth}/${selectedYear}: ${finances.length}`);

        // ===== BUSCAR PENDÊNCIAS DE MESES ANTERIORES (se for mês atual) =====
        let pendingFromPrevious = [];
        if (monthFilter === 'current') {
            pendingFromPrevious = await Finance.find({
                userId: userId,
                status: 'pending',
                $or: [
                    { year: { $lt: selectedYear } },
                    { year: selectedYear, month: { $lt: selectedMonth } }
                ]
            })
            .sort({ year: -1, month: -1, createdAt: -1 })
            .lean();
            
            console.log(`📊 Pendências de meses anteriores: ${pendingFromPrevious.length}`);
        }

        // ===== COMBINAR RESULTADOS =====
        // Primeiro as pendências anteriores, depois as do mês atual
        const allFinances = [...pendingFromPrevious, ...finances];

        // ===== CALCULAR TOTAIS =====
        const totalItems = await Finance.countDocuments({ userId: userId });
        const balances = calculateBalances(allFinances);

        // ===== LISTA DE MESES DISPONÍVEIS =====
        const availableMonths = await Finance.aggregate([
            { $match: { userId: userId } },
            { $group: {
                _id: { year: '$year', month: '$month' },
                year: { $first: '$year' },
                month: { $first: '$month' },
                count: { $sum: 1 }
            }},
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);

        // ===== MÊS ATUAL =====
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        res.render('index', {
            title: 'DevFinance - Dashboard',
            finances: allFinances,
            balances: balances,
            totalItems: totalItems,
            filteredItems: allFinances.length,
            statusFilter: statusFilter,
            typeFilter: typeFilter,
            monthFilter: monthFilter,
            yearFilter: yearFilter,
            selectedMonth: selectedMonth,
            selectedYear: selectedYear,
            availableMonths: availableMonths,
            currentMonth: currentMonth,
            currentYear: currentYear
        });
    } catch (error) {
        console.error('❌ Erro ao buscar finanças:', error);
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
        const userId = req.session.userId;

        const parsedDate = date ? new Date(date) : new Date();
        const month = parsedDate.getMonth() + 1;
        const year = parsedDate.getFullYear();

        const newFinance = new Finance({
            description: description.trim(),
            amount: parseFloat(amount),
            type: type || 'income',
            status: status || 'pending',
            date: date || new Date().toISOString().split('T')[0],
            month: month,
            year: year,
            userId: userId
        });

        await newFinance.save();
        console.log(`✅ Adicionado: ${newFinance.description} (${newFinance.status}) - ${month}/${year}`);
        
        res.redirect('/');
    } catch (error) {
        console.error('❌ Erro ao adicionar finança:', error);
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
        const userId = req.session.userId;
        
        // Buscar apenas se for do usuário logado
        const finance = await Finance.findOne({ _id: id, userId: userId });

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
        const userId = req.session.userId;
        const { description, amount, type, status, date } = req.body;

        // Se a data mudou, atualizar mês e ano
        let month, year;
        if (date) {
            const parsedDate = new Date(date);
            month = parsedDate.getMonth() + 1;
            year = parsedDate.getFullYear();
        }

        const updateData = {
            description: description.trim(),
            amount: parseFloat(amount),
            type: type || 'income',
            status: status || 'pending',
            date: date || new Date().toISOString().split('T')[0],
            updatedAt: new Date()
        };

        if (month && year) {
            updateData.month = month;
            updateData.year = year;
        }

        const finance = await Finance.findOneAndUpdate(
            { _id: id, userId: userId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!finance) {
            return res.status(404).render('404', {
                title: 'Finança não encontrada',
                message: 'A finança que você procura não existe.'
            });
        }

        console.log(`✏️ Atualizado: ${finance.description} - ${finance.month}/${finance.year}`);
        res.redirect('/');
    } catch (error) {
        console.error('❌ Erro ao atualizar finança:', error);
        res.status(400).send('Erro ao atualizar. Verifique os dados.');
    }
};


// DELETE /delete/:id - Excluir finança
exports.deleteFinance = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.userId;

        // Excluir apenas se for do usuário logado
        const finance = await Finance.findOneAndDelete({ _id: id, userId: userId });

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
exports.toggleStatus = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.userId;
        
        console.log('🔄 ID recebido:', id);
        
        // Buscar apenas se for do usuário logado
        const finance = await Finance.findOne({ _id: id, userId: userId });

        if (!finance) {
            return res.status(404).json({ error: 'Finança não encontrada' });
        }

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

// GET /api/stats - Estatísticas do usuário logado
exports.getStats = async (req, res) => {
    try {
        const userId = req.session.userId;
        const finances = await Finance.find({ userId: userId }).lean();
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

// GET /api/export - Exportar dados do usuário
exports.exportData = async (req, res) => {
    try {
        const userId = req.session.userId;
        const finances = await Finance.find({ userId: userId }).lean();
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

// GET /test-data - Adicionar dados de teste para o usuário
exports.addTestData = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const testData = [
            { description: 'Salario Mensal', amount: 5000, type: 'income', status: 'paid' },
            { description: 'Aluguel', amount: 1200, type: 'expense', status: 'pending' },
            { description: 'Freelance', amount: 800, type: 'income', status: 'pending' },
            { description: 'Supermercado', amount: 450, type: 'expense', status: 'paid' },
            { description: 'Internet', amount: 100, type: 'expense', status: 'paid' },
            { description: 'Energia', amount: 200, type: 'expense', status: 'pending' },
            { description: 'Venda de Curso', amount: 350, type: 'income', status: 'paid' }
        ];

        const count = await Finance.countDocuments({ userId: userId });
        if (count > 0) {
            req.flash('info', 'Você já possui dados cadastrados');
            return res.redirect('/');
        }

        const dataToInsert = testData.map(item => ({
            ...item,
            userId: userId
        }));

        await Finance.insertMany(dataToInsert);
        console.log(`🧪 Dados de teste adicionados: ${testData.length} registros`);
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao adicionar dados de teste:', error);
        res.status(500).send('Erro ao adicionar dados de teste');
    }
};

// ============================================
// EXPORTAR PARA PDF
// ============================================

const PDFDocument = require('pdfkit');

// ============================================
// EXPORTAR PARA PDF - VERSÃO CORRIGIDA
// ============================================

const fs = require('fs');
const path = require('path');

exports.exportPDF = async (req, res) => {
    try {
        console.log('📄 Iniciando geração de PDF...');
        
        const userId = req.session.userId;
        console.log('🆔 Usuário ID:', userId);
        
        const finances = await Finance.find({ userId: userId }).sort({ createdAt: -1 });
        console.log('📊 Total de registros:', finances.length);
        
        if (finances.length === 0) {
            console.log('⚠️ Nenhum dado para exportar');
            req.flash('info', 'Não há dados para exportar em PDF');
            return res.redirect('/');
        }
        
        const balances = calculateBalances(finances);
        console.log('📊 Balanços calculados');
        
        // Criar documento PDF
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
                Title: 'Relatório de Finanças',
                Author: 'DevFinance',
                Subject: 'Relatório Financeiro'
            }
        });

        // Configurar resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio-financas-${new Date().toISOString().split('T')[0]}.pdf`);
        
        doc.pipe(res);

        console.log('📄 Configurando cabeçalho do PDF...');

        // ===== CABEÇALHO =====
        doc
            .fontSize(22)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text('RELATORIO DE FINANCAS', { align: 'center' })
            .moveDown(0.5);

        doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#7f8c8d')
            .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })
            .moveDown(1.5);

        // Linha separadora
        doc
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke('#3498db')
            .moveDown(1);

        // ===== RESUMO =====
        doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text('RESUMO FINANCEIRO', { underline: true })
            .moveDown(0.5);

        const summaryData = [
            { label: 'Total de Receitas', value: `R$ ${balances.totalIncome.toFixed(2)}`, color: '#27ae60' },
            { label: 'Total de Despesas', value: `R$ ${balances.totalExpense.toFixed(2)}`, color: '#e74c3c' },
            { label: 'Saldo Total', value: `R$ ${balances.balance.toFixed(2)}`, color: balances.balance >= 0 ? '#2980b9' : '#e74c3c' },
            { label: 'Total de Transacoes', value: `${finances.length}`, color: '#8e44ad' }
        ];

        const col1X = 50;
        const col2X = 300;
        let yPos = doc.y;

        summaryData.forEach((item, index) => {
            const xPos = index < 2 ? col1X : col2X;
            const yOffset = index < 2 ? index * 35 : (index - 2) * 35;
            
            doc
                .fontSize(9)
                .font('Helvetica')
                .fillColor('#34495e')
                .text(item.label, xPos, yPos + yOffset);
            
            doc
                .fontSize(11)
                .font('Helvetica-Bold')
                .fillColor(item.color)
                .text(item.value, xPos, yPos + yOffset + 14);
        });

        doc.moveDown(3);

        // ===== LISTA DE TRANSAÇÕES =====
        doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text('LISTA DE TRANSACOES', { underline: true })
            .moveDown(0.5);

        const tableTop = doc.y;
        const colWidths = [30, 150, 70, 70, 70, 70];
        const headers = ['#', 'Descricao', 'Tipo', 'Valor', 'Data', 'Status'];

        // Fundo do cabeçalho
        doc
            .rect(50, tableTop - 5, 495, 25)
            .fill('#3498db');

        // Texto do cabeçalho
        doc.fillColor('#ffffff');
        let currentX = 50;
        headers.forEach((header, i) => {
            doc
                .fontSize(9)
                .font('Helvetica-Bold')
                .text(header, currentX, tableTop, { width: colWidths[i], align: 'center' });
            currentX += colWidths[i];
        });

        // Dados da tabela
        let rowY = tableTop + 25;
        doc.fillColor('#2c3e50');

        finances.forEach((finance, index) => {
            // Verificar se precisa de nova página
            if (rowY > 700) {
                doc.addPage();
                rowY = 50;
                
                // Reimprimir cabeçalho na nova página
                doc.rect(50, rowY - 5, 495, 25).fill('#3498db');
                doc.fillColor('#ffffff');
                let currentX2 = 50;
                headers.forEach((header, i) => {
                    doc
                        .fontSize(9)
                        .font('Helvetica-Bold')
                        .text(header, currentX2, rowY, { width: colWidths[i], align: 'center' });
                    currentX2 += colWidths[i];
                });
                rowY += 25;
                doc.fillColor('#2c3e50');
            }

            // Cor alternada para linhas
            if (index % 2 === 0) {
                doc.rect(50, rowY - 3, 495, 18).fill('#f8f9fa');
            }

            const rowData = [
                (index + 1).toString(),
                finance.description.length > 20 ? finance.description.substring(0, 20) + '...' : finance.description,
                finance.type === 'income' ? 'Receita' : 'Despesa',
                `R$ ${finance.amount.toFixed(2)}`,
                new Date(finance.date).toLocaleDateString('pt-BR'),
                finance.status === 'paid' ? 'Pago' : 'Pendente'
            ];

            doc.fillColor('#2c3e50');
            let currentX3 = 50;
            rowData.forEach((text, i) => {
                doc
                    .fontSize(8)
                    .font('Helvetica')
                    .text(text, currentX3, rowY, { 
                        width: colWidths[i], 
                        align: i === 0 ? 'center' : 'left' 
                    });
                currentX3 += colWidths[i];
            });

            rowY += 20;
        });

        // ===== RODAPÉ =====
        doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#7f8c8d')
            .text(`Total de registros: ${finances.length}`, 50, 780, { align: 'center' })
            .text('Relatorio gerado automaticamente pelo DevFinance', 50, 795, { align: 'center' });

        console.log('📄 Finalizando PDF...');
        doc.end();

    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        console.error('❌ Stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar PDF: ' + error.message
        });
    }
};
const Finance = require('../models/Finance');
const PDFDocument = require('pdfkit');

// ============================================
// FUNÇÕES AUXILIARES (SERVIÇO)
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

exports.addCommonData = async (req, res, next) => {
    try {
        const totalItems = await Finance.countDocuments({ userId: req.session.userId });
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
        
        // Recuperar filtros da sessão ou query
        const statusFilter = req.query.status || req.session.statusFilter || 'all';
        const typeFilter = req.query.type || req.session.typeFilter || 'all';
        let monthFilter = req.query.month || req.session.monthFilter || 'current';
        let yearFilter = req.query.year || req.session.yearFilter || new Date().getFullYear();

        // Se veio da query, salvar na sessão
        if (req.query.month) req.session.monthFilter = req.query.month;
        if (req.query.year) req.session.yearFilter = req.query.year;
        if (req.query.status) req.session.statusFilter = req.query.status;
        if (req.query.type) req.session.typeFilter = req.query.type;

        let selectedMonth, selectedYear;
        let isCurrentMonth = false;
        
        if (monthFilter === 'current') {
            const now = new Date();
            selectedMonth = now.getMonth() + 1;
            selectedYear = now.getFullYear();
            isCurrentMonth = true;
        } else {
            selectedMonth = parseInt(monthFilter);
            selectedYear = parseInt(yearFilter);
            isCurrentMonth = false;
        }

        // ===== BUSCAR TODAS AS TRANSAÇÕES DO USUÁRIO =====
        const allTransactions = await Finance.find({ userId: userId })
            .sort({ year: 1, month: 1, date: 1 })
            .lean();

        // ===== CALCULAR SALDO ACUMULADO REAL (MÊS A MÊS) =====
        let monthBalances = [];

        // Agrupar transações por mês
        const monthGroups = {};
        allTransactions.forEach(t => {
            if (t.month && t.year) {
                const key = `${t.year}-${t.month}`;
                if (!monthGroups[key]) {
                    monthGroups[key] = {
                        year: t.year,
                        month: t.month,
                        income: 0,
                        expense: 0,
                        balance: 0,
                        transactions: []
                    };
                }
                if (t.type === 'income' && t.status === 'paid') {
                    monthGroups[key].income += t.amount;
                } else if (t.type === 'expense' && t.status === 'paid') {
                    monthGroups[key].expense += t.amount;
                }
                monthGroups[key].transactions.push(t);
            }
        });

        // Calcular saldo de cada mês e acumular
        const sortedMonths = Object.keys(monthGroups).sort();
        let runningBalance = 0;

        sortedMonths.forEach(key => {
            const month = monthGroups[key];
            month.balance = month.income - month.expense;
            runningBalance += month.balance;
            month.accumulatedBalance = runningBalance;
            monthBalances.push(month);
        });

        // ===== SALDO ACUMULADO ATÉ O MÊS SELECIONADO =====
        let accumulatedBalanceUpToMonth = 0;
        let accumulatedIncomeUpToMonth = 0;
        let accumulatedExpenseUpToMonth = 0;

        const monthsUpToSelected = monthBalances.filter(m => 
            m.year < selectedYear || (m.year === selectedYear && m.month <= selectedMonth)
        );

        monthsUpToSelected.forEach(m => {
            accumulatedIncomeUpToMonth += m.income;
            accumulatedExpenseUpToMonth += m.expense;
            accumulatedBalanceUpToMonth += m.balance;
        });

        // ===== SALDO DO MÊS ANTERIOR =====
        const previousMonthData = monthBalances.filter(m => 
            m.year < selectedYear || (m.year === selectedYear && m.month < selectedMonth)
        );
        const previousMonth = previousMonthData[previousMonthData.length - 1];
        const previousMonthBalance = previousMonth ? previousMonth.balance : 0;
        const previousMonthAccumulated = previousMonth ? previousMonth.accumulatedBalance : 0;

        // ===== FILTRAR TRANSAÇÕES DO MÊS SELECIONADO =====
        let filteredByMonth = allTransactions.filter(t => 
            t.month === selectedMonth && t.year === selectedYear
        );

        // ===== PENDÊNCIAS DE MESES ANTERIORES =====
        let pendingFromPrevious = [];
        if (isCurrentMonth) {
            pendingFromPrevious = allTransactions.filter(t => 
                t.status === 'pending' && 
                (t.year < selectedYear || (t.year === selectedYear && t.month < selectedMonth))
            );
        }

        // ===== COMBINAR =====
        let finances = [...pendingFromPrevious, ...filteredByMonth];

        // ===== APLICAR FILTROS =====
        if (statusFilter !== 'all') {
            finances = finances.filter(t => t.status === statusFilter);
        }
        if (typeFilter !== 'all') {
            finances = finances.filter(t => t.type === typeFilter);
        }

        // ===== CALCULAR BALANÇOS DO MÊS =====
        const balances = calculateBalances(finances);

        // ===== MESES DISPONÍVEIS =====
        const availableMonths = monthBalances.map(m => ({
            year: m.year,
            month: m.month,
            count: m.transactions.length,
            balance: m.balance,
            accumulated: m.accumulatedBalance
        })).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // ===== TOTAL DE PENDÊNCIAS =====
        const totalPending = allTransactions
            .filter(t => t.status === 'pending' && (t.year < selectedYear || (t.year === selectedYear && t.month <= selectedMonth)))
            .reduce((sum, t) => sum + t.amount, 0);

        // ===== DADOS DO MÊS ATUAL =====
        const currentMonthData = monthBalances.find(m => 
            m.year === selectedYear && m.month === selectedMonth
        );

        const currentMonthIncome = currentMonthData ? currentMonthData.income : 0;
        const currentMonthExpense = currentMonthData ? currentMonthData.expense : 0;
        const currentMonthBalance = currentMonthData ? currentMonthData.balance : 0;

        // ===== RENDERIZAR =====
        res.render('index', {
            title: 'DevFinance - Dashboard',
            finances: finances,
            balances: balances,
            totalItems: allTransactions.length,
            filteredItems: finances.length,
            statusFilter: statusFilter,
            typeFilter: typeFilter,
            monthFilter: monthFilter,
            yearFilter: yearFilter,
            selectedMonth: selectedMonth,
            selectedYear: selectedYear,
            isCurrentMonth: isCurrentMonth,
            availableMonths: availableMonths,
            currentMonth: currentMonth,
            currentYear: currentYear,
            accumulatedBalance: accumulatedBalanceUpToMonth,
            accumulatedIncome: accumulatedIncomeUpToMonth,
            accumulatedExpense: accumulatedExpenseUpToMonth,
            previousMonthBalance: previousMonthBalance,
            previousMonthAccumulated: previousMonthAccumulated,
            totalPending: totalPending,
            currentMonthIncome: currentMonthIncome,
            currentMonthExpense: currentMonthExpense,
            currentMonthBalance: currentMonthBalance,
            monthBalances: monthBalances
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        req.flash('error', 'Erro ao carregar dados. Tente novamente.');
        res.redirect('/');
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

        // ===== CORREÇÃO DA DATA - FUSO HORÁRIO BRASIL =====
        let month, year, formattedDate;
        
        if (date) {
            // A data vem no formato YYYY-MM-DD do input type="date"
            const dateParts = date.split('-');
            year = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]);
            
            // Manter a data exatamente como o usuário selecionou
            formattedDate = date;
            
            console.log(`📅 Data selecionada: ${formattedDate}`);
        } else {
            // Se não veio data, usar a data atual com fuso horário local
            const now = new Date();
            const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            year = localDate.getFullYear();
            month = localDate.getMonth() + 1;
            formattedDate = localDate.toISOString().split('T')[0];
        }

        console.log(`📝 Nova transação: ${description}, Data: ${formattedDate}, Mês: ${month}/${year}`);

        const newFinance = new Finance({
            description: description.trim(),
            amount: parseFloat(amount),
            type: type || 'income',
            status: status || 'pending',
            date: formattedDate, // Salvar como YYYY-MM-DD
            month: month,
            year: year,
            userId: userId
        });

        await newFinance.save();
        
        req.flash('success', `✅ ${newFinance.description} adicionado com sucesso!`);
        res.redirect('/');
    } catch (error) {
        console.error('❌ Erro ao adicionar:', error);
        req.flash('error', 'Erro ao adicionar. Verifique os dados.');
        res.redirect('/add');
    }
};
// GET /edit/:id - Mostrar formulário de edição
exports.showEditForm = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.userId;
        
        const finance = await Finance.findOne({ _id: id, userId: userId });

        if (!finance) {
            req.flash('error', 'Transação não encontrada');
            return res.redirect('/');
        }

        res.render('edit', {
            title: 'Editar Finança',
            finance: finance
        });
    } catch (error) {
        console.error('Erro ao buscar:', error);
        req.flash('error', 'Erro ao carregar edição');
        res.redirect('/');
    }
};

// PUT /edit/:id - Atualizar finança
exports.updateFinance = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.userId;
        const { description, amount, type, status, date } = req.body;

        // ===== CORREÇÃO DA DATA - FUSO HORÁRIO BRASIL =====
        let month, year, formattedDate;
        
        if (date) {
            // A data vem no formato YYYY-MM-DD do input type="date"
            const dateParts = date.split('-');
            year = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]);
            formattedDate = date;
        } else {
            // Se não veio data, usar a data atual com fuso horário local
            const now = new Date();
            const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            year = localDate.getFullYear();
            month = localDate.getMonth() + 1;
            formattedDate = localDate.toISOString().split('T')[0];
        }

        const updateData = {
            description: description.trim(),
            amount: parseFloat(amount),
            type: type || 'income',
            status: status || 'pending',
            date: formattedDate,
            month: month,
            year: year,
            updatedAt: new Date()
        };

        const finance = await Finance.findOneAndUpdate(
            { _id: id, userId: userId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!finance) {
            req.flash('error', 'Transação não encontrada');
            return res.redirect('/');
        }

        req.flash('success', `✏️ ${finance.description} atualizado com sucesso!`);
        res.redirect('/');
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error);
        req.flash('error', 'Erro ao atualizar. Verifique os dados.');
        res.redirect(`/edit/${req.params.id}`);
    }
};

// DELETE /delete/:id - Excluir finança
exports.deleteFinance = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.userId;

        const finance = await Finance.findOneAndDelete({ _id: id, userId: userId });

        if (!finance) {
            req.flash('error', 'Transação não encontrada');
            return res.redirect('/');
        }

        req.flash('success', `🗑️ ${finance.description} excluído com sucesso!`);
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao excluir:', error);
        req.flash('error', 'Erro ao excluir. Tente novamente.');
        res.redirect('/');
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
        
        const finance = await Finance.findOne({ _id: id, userId: userId });

        if (!finance) {
            return res.status(404).json({ error: 'Finança não encontrada' });
        }

        const newStatus = finance.status === 'paid' ? 'pending' : 'paid';
        finance.status = newStatus;
        finance.updatedAt = new Date();
        
        await finance.save();

        res.json({
            success: true,
            status: finance.status,
            message: `Status alterado para ${finance.status === 'paid' ? 'Pago' : 'Pendente'}`
        });
    } catch (error) {
        console.error('❌ Erro ao alternar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao alternar status'
        });
    }
};

// GET /api/stats - Estatísticas do usuário
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

// GET /api/export - Exportar dados
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
        console.error('Erro ao exportar:', error);
        res.status(500).json({ error: 'Erro ao exportar dados' });
    }
};

// ============================================
// ROTA DE TESTE (APENAS EM DESENVOLVIMENTO)
// ============================================

exports.addTestData = async (req, res) => {
    // Proteger para apenas desenvolvimento
    if (process.env.NODE_ENV === 'production') {
        req.flash('error', 'Função disponível apenas em desenvolvimento');
        return res.redirect('/');
    }

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
            userId: userId,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        }));

        await Finance.insertMany(dataToInsert);
        req.flash('success', '🧪 Dados de teste adicionados com sucesso!');
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao adicionar dados de teste:', error);
        req.flash('error', 'Erro ao adicionar dados de teste');
        res.redirect('/');
    }
};

// ============================================
// EXPORTAR PARA PDF - VERSÃO BONITA E ALINHADA
// ============================================

exports.exportPDF = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // ===== PEGAR O MÊS E ANO DA QUERY OU SESSÃO =====
        let monthFilter = req.query.month || req.session.monthFilter || 'current';
        let yearFilter = req.query.year || req.session.yearFilter || new Date().getFullYear();
        
        let selectedMonth, selectedYear;
        
        if (monthFilter === 'current') {
            const now = new Date();
            selectedMonth = now.getMonth() + 1;
            selectedYear = now.getFullYear();
        } else {
            selectedMonth = parseInt(monthFilter);
            selectedYear = parseInt(yearFilter);
        }
        
        console.log(`📄 Gerando PDF para: ${selectedMonth}/${selectedYear}`);
        
        // ===== BUSCAR APENAS TRANSAÇÕES DO MÊS SELECIONADO =====
        const finances = await Finance.find({ 
            userId: userId,
            month: selectedMonth,
            year: selectedYear
        }).sort({ date: 1 });
        
        // ===== BUSCAR PENDÊNCIAS DE MESES ANTERIORES (SE FOR MÊS ATUAL) =====
        let pendingFromPrevious = [];
        if (monthFilter === 'current') {
            pendingFromPrevious = await Finance.find({ 
                userId: userId,
                status: 'pending',
                $or: [
                    { year: { $lt: selectedYear } },
                    { year: selectedYear, month: { $lt: selectedMonth } }
                ]
            }).sort({ date: 1 });
        }
        
        // ===== COMBINAR TRANSAÇÕES =====
        const allFinances = [...pendingFromPrevious, ...finances];
        
        if (allFinances.length === 0) {
            req.flash('info', `Não há dados para exportar em PDF do mês ${selectedMonth}/${selectedYear}`);
            return res.redirect('/');
        }
        
        const balances = calculateBalances(allFinances);
        
        // ===== NOME DO MÊS =====
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const nomeMes = monthNames[selectedMonth - 1];
        
        // ===== CRIAR PDF =====
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            info: {
                Title: `Relatório Financeiro - ${nomeMes}/${selectedYear}`,
                Author: 'DevFinance',
                Subject: 'Relatório Financeiro Mensal'
            }
        });

        // Configurar cabeçalhos da resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio-${selectedMonth}-${selectedYear}.pdf`);
        
        doc.pipe(res);

        // ===== CORES =====
        const colors = {
            primary: '#2c3e50',
            secondary: '#34495e',
            accent: '#3498db',
            success: '#27ae60',
            danger: '#e74c3c',
            warning: '#f39c12',
            light: '#ecf0f1',
            white: '#ffffff',
            gray: '#95a5a6',
            darkGray: '#7f8c8d'
        };

        // ============================================
        // CABEÇALHO
        // ============================================
        doc
            .fontSize(24)
            .font('Helvetica-Bold')
            .fillColor(colors.primary)
            .text('RELATÓRIO FINANCEIRO', { align: 'center' })
            .moveDown(0.3);

        doc
            .fontSize(16)
            .font('Helvetica')
            .fillColor(colors.secondary)
            .text(`${nomeMes} de ${selectedYear}`, { align: 'center' })
            .moveDown(0.2);

        doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor(colors.darkGray)
            .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })
            .moveDown(1);

        // Linha separadora
        doc
            .moveTo(40, doc.y)
            .lineTo(570, doc.y)
            .stroke(colors.accent)
            .moveDown(1);

        // ============================================
        // RESUMO FINANCEIRO (CARDS)
        // ============================================
        doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor(colors.primary)
            .text('RESUMO DO MÊS', { underline: true })
            .moveDown(0.5);

        // Criar caixas de resumo
        const summaryY = doc.y;
        const boxWidth = 120;
        const boxHeight = 60;
        const spacing = 15;
        const startX = 40;

        const summaryItems = [
            { label: 'Total Receitas', value: `R$ ${balances.totalIncome.toFixed(2)}`, color: colors.success },
            { label: 'Total Despesas', value: `R$ ${balances.totalExpense.toFixed(2)}`, color: colors.danger },
            { label: 'Saldo do Mês', value: `R$ ${balances.balance.toFixed(2)}`, color: balances.balance >= 0 ? colors.success : colors.danger },
            { label: 'Transações', value: `${allFinances.length}`, color: colors.accent }
        ];

        summaryItems.forEach((item, index) => {
            const x = startX + (index * (boxWidth + spacing));
            
            // Fundo do card
            doc
                .rect(x, summaryY, boxWidth, boxHeight)
                .fill(colors.light)
                .stroke(colors.darkGray);
            
            // Label
            doc
                .fontSize(9)
                .font('Helvetica')
                .fillColor(colors.secondary)
                .text(item.label, x + 10, summaryY + 10, { width: boxWidth - 20, align: 'center' });
            
            // Valor
            doc
                .fontSize(14)
                .font('Helvetica-Bold')
                .fillColor(item.color)
                .text(item.value, x + 10, summaryY + 30, { width: boxWidth - 20, align: 'center' });
        });

        doc.moveDown(3);

        // ============================================
        // LISTA DE TRANSAÇÕES
        // ============================================
       doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(colors.primary)
        .text('LISTA DE TRANSAÇÕES', 40, doc.y, { underline: true })
        .moveDown(0.5);
            
        
           

        // ===== CONFIGURAÇÃO DA TABELA =====
        const tableTop = doc.y;
        const tableLeft = 40;
        const tableWidth = 530;
        const col1 = 35;   // #
        const col2 = 170;  // Descrição
        const col3 = 70;   // Tipo
        const col4 = 80;   // Valor
        const col5 = 75;   // Data
        const col6 = 80;   // Status
        const rowHeight = 22;
        let currentY = tableTop;

        // ===== CABEÇALHO DA TABELA =====
        // Fundo do cabeçalho
        doc
            .rect(tableLeft, currentY, tableWidth, rowHeight)
            .fill(colors.accent);

        // Texto do cabeçalho (branco)
        doc.fillColor(colors.white);
        doc.fontSize(9);
        doc.font('Helvetica-Bold');

        // Posições das colunas
        const colPositions = [
            { x: tableLeft + 5, w: col1 - 10, align: 'center' },
            { x: tableLeft + col1 + 5, w: col2 - 10, align: 'left' },
            { x: tableLeft + col1 + col2 + 5, w: col3 - 10, align: 'center' },
            { x: tableLeft + col1 + col2 + col3 + 5, w: col4 - 10, align: 'right' },
            { x: tableLeft + col1 + col2 + col3 + col4 + 5, w: col5 - 10, align: 'center' },
            { x: tableLeft + col1 + col2 + col3 + col4 + col5 + 5, w: col6 - 10, align: 'center' }
        ];

        const headers = ['#', 'Descrição', 'Tipo', 'Valor', 'Data', 'Status'];
        headers.forEach((header, i) => {
            doc.text(header, colPositions[i].x, currentY + 5, {
                width: colPositions[i].w,
                align: colPositions[i].align
            });
        });

        currentY += rowHeight;

        // ===== DADOS DA TABELA =====
        let rowCount = 0;
        const maxRowsPerPage = 28; // Aproximadamente 28 linhas por página A4

        allFinances.forEach((finance, index) => {
            // Verificar se precisa de nova página
            if (rowCount >= maxRowsPerPage) {
                doc.addPage();
                currentY = 50;
                rowCount = 0;
                
                // Reimprimir cabeçalho na nova página
                doc
                    .rect(tableLeft, currentY, tableWidth, rowHeight)
                    .fill(colors.accent);
                
                doc.fillColor(colors.white);
                doc.fontSize(9);
                doc.font('Helvetica-Bold');
                
                headers.forEach((header, i) => {
                    doc.text(header, colPositions[i].x, currentY + 5, {
                        width: colPositions[i].w,
                        align: colPositions[i].align
                    });
                });
                
                currentY += rowHeight;
            }

            // Cor alternada para linhas
            if (index % 2 === 0) {
                doc
                    .rect(tableLeft, currentY, tableWidth, rowHeight)
                    .fill(colors.light);
            }

            // Dados da linha
            doc.fillColor(colors.secondary);
            doc.fontSize(8);
            doc.font('Helvetica');

            const rowData = [
                { text: (index + 1).toString(), align: 'center' },
                { text: finance.description.length > 25 ? finance.description.substring(0, 25) + '...' : finance.description, align: 'left' },
                { text: finance.type === 'income' ? 'Receita' : 'Despesa', align: 'center' },
                { text: `R$ ${finance.amount.toFixed(2)}`, align: 'right' },
                { text: new Date(finance.date).toLocaleDateString('pt-BR'), align: 'center' },
                { text: finance.status === 'paid' ? 'Pago' : 'Pendente', align: 'center' }
            ];

            rowData.forEach((item, i) => {
                // Cor especial para valores
                if (i === 3) {
                    doc.fillColor(finance.type === 'income' ? colors.success : colors.danger);
                    doc.font('Helvetica-Bold');
                } else {
                    doc.fillColor(colors.secondary);
                    doc.font('Helvetica');
                }
                
                doc.text(item.text, colPositions[i].x, currentY + 5, {
                    width: colPositions[i].w,
                    align: item.align
                });
            });

            currentY += rowHeight;
            rowCount++;
        });

        // ============================================
        // RODAPÉ
        // ============================================
        // Linha separadora antes do rodapé
        doc
            .moveTo(40, currentY + 15)
            .lineTo(570, currentY + 15)
            .stroke(colors.light)
            .moveDown(1);

        doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor(colors.darkGray)
            .text(`Total de registros: ${allFinances.length}`, 40, currentY + 25, { align: 'left' })
            .text(`Mês: ${nomeMes} de ${selectedYear}`, 40, currentY + 40, { align: 'left' })
            .text('Relatório gerado automaticamente pelo DevFinance', 40, currentY + 55, { align: 'center' });

        // ===== RODAPÉ COM PÁGINA =====
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc
                .fontSize(8)
                .font('Helvetica')
                .fillColor(colors.gray)
                .text(`Página ${i + 1} de ${pageCount}`, 40, doc.page.height - 30, { align: 'center' });
        }

        // Finalizar PDF
        doc.end();

    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        req.flash('error', 'Erro ao gerar PDF. Tente novamente.');
        res.redirect('/');
    }
};
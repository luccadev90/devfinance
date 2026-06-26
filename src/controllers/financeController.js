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
        const finances = await Finance.find().sort({ createdAt: -1 });
        const balances = calculateBalances(finances);
        
        // Criar documento PDF com suporte a Unicode
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
                Title: 'Relatório de Finanças',
                Author: 'DevFinance',
                Subject: 'Relatório Financeiro',
                Keywords: 'finanças, relatório, devfinance'
            }
        });

        // Configurar resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio-financas-${new Date().toISOString().split('T')[0]}.pdf`);
        
        doc.pipe(res);

        // ===== FUNÇÃO PARA ESCREVER TEXTO COM ACENTOS =====
        // Usar uma fonte que suporta caracteres especiais
        // O PDFKit já usa Helvetica por padrão, mas vamos usar uma fonte embutida

        // ===== CABEÇALHO =====
        doc
            .fontSize(22)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text('RELATÓRIO DE FINANÇAS', { align: 'center' })
            .moveDown(0.5);

        // Data
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

        // Cards de resumo
        const summaryData = [
            { label: 'Total de Receitas', value: `R$ ${balances.totalIncome.toFixed(2)}`, color: '#27ae60' },
            { label: 'Total de Despesas', value: `R$ ${balances.totalExpense.toFixed(2)}`, color: '#e74c3c' },
            { label: 'Saldo Total', value: `R$ ${balances.balance.toFixed(2)}`, color: balances.balance >= 0 ? '#2980b9' : '#e74c3c' },
            { label: 'Total de Transacoes', value: `${finances.length}`, color: '#8e44ad' }
        ];

        // Layout em 2 colunas
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

        // Cabeçalho da tabela
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

        if (finances.length === 0) {
            doc
                .fontSize(10)
                .font('Helvetica')
                .text('Nenhuma transacao encontrada', 50, rowY, { align: 'center' });
        } else {
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

                // Dados da linha
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
        }

        // ===== RODAPÉ =====
        doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#7f8c8d')
            .text(`Total de registros: ${finances.length}`, 50, 780, { align: 'center' })
            .text('Relatorio gerado automaticamente pelo DevFinance', 50, 795, { align: 'center' });

        // Finalizar PDF
        doc.end();

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar PDF: ' + error.message
        });
    }
};
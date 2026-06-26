const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const financeRoutes = require('./routes/financeRoutes');

const app = express();
const PORT = process.env.PORT || 3030;

// ===== CONECTAR AO MONGODB =====
connectDB();

// ===== CONFIGURAÇÕES =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== MIDDLEWARES =====
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ===== ROTAS =====
app.use('/', financeRoutes);

// ===== ROTA 404 =====
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Página não encontrada',
        message: 'A página que você procura não existe.'
    });
});

// ===== TRATAMENTO DE ERROS =====
app.use((err, req, res, next) => {
    console.error('❌ Erro:', err.stack);
    res.status(500).render('error', {
        title: 'Erro no Servidor',
        message: 'Ocorreu um erro interno. Tente novamente mais tarde.'
    });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Acesse: http://localhost:${PORT}`);
});
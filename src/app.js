const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
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

// ===== SESSÃO =====
app.use(session({
    secret: process.env.SESSION_SECRET || 'devfinance-super-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        secure: process.env.NODE_ENV === 'production'
    }
}));

// ===== FLASH MESSAGES =====
app.use(flash());

// ===== MIDDLEWARE DE LOG (para debug) =====
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url}`);
    console.log('📦 Session:', req.session?.userId || 'Nenhuma');
    next();
});

// ===== MIDDLEWARE PARA VARIÁVEIS GLOBAIS =====
app.use((req, res, next) => {
    // Flash messages
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    res.locals.info = req.flash('info');
    
    // Dados do usuário
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Acesse: http://localhost:${PORT}`);
    console.log('🔑 Rotas públicas: /login, /register, /health');
});
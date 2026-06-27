const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();

// Importação correta do connect-mongo para versão 4.x
const MongoStore = require('connect-mongo');

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

// ===== CONFIGURAÇÃO DE SESSÃO COM MONGOSTORE =====
const isProduction = process.env.NODE_ENV === 'production';

console.log(`🔧 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);

// Configurar MongoDB Store para sessões - VERSÃO COMPATÍVEL
const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/devfinance',
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60, // 7 dias
    autoRemove: 'native'
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'devfinance-super-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: isProduction ? true : false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    },
    name: 'devfinance.sid'
}));

// ===== FLASH MESSAGES =====
app.use(flash());

// ===== MIDDLEWARE DE LOG (apenas em desenvolvimento) =====
if (!isProduction) {
    app.use((req, res, next) => {
        console.log(`🌐 ${req.method} ${req.url}`);
        next();
    });
}

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
    
    res.locals.isDevelopment = !isProduction;
    
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
    
    const errorMessage = isProduction 
        ? 'Ocorreu um erro interno. Tente novamente mais tarde.'
        : err.message;
    
    res.status(500).render('error', {
        title: 'Erro no Servidor',
        message: errorMessage
    });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Acesse: http://localhost:${PORT}`);
    console.log(`🔧 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
    console.log('🔑 Rotas públicas: /login, /register, /health');
});
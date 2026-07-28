import express from 'express';
import bodyParser from 'body-parser';
import methodOverride from 'method-override';
import path from 'path';
import session from 'express-session';
import flash from 'connect-flash';
import MongoStore from 'connect-mongo';
import { fileURLToPath } from 'url';
import { formatMoney } from './utils/moneyUtils.js'; // 👈 IMPORTE A FUNÇÃO

import 'dotenv/config';

import connectDB from './config/database.js';
import financeRoutes from './routes/financeRoutes.js';

const app = express();
const PORT = process.env.PORT;

// ===== CONECTAR AO MONGODB =====
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIGURAÇÕES =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// 👇 REGISTRE A FUNÇÃO AQUI (DEPOIS de configurar o EJS)
app.locals.formatMoney = formatMoney; // ✅ TORNA A FUNÇÃO DISPONÍVEL EM TODOS OS TEMPLATES

// ===== MIDDLEWARES =====
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));


// ===== CONFIGURAÇÃO DE SESSÃO =====
// Detecta se está em produção (Render) ou desenvolvimento
const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.RENDER === 'true' || process.env.RENDER;

console.log(`🔧 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
console.log(`🔧 Render: ${isRender ? 'SIM' : 'NÃO'}`);

app.use(session({
    secret: process.env.SESSION_SECRET || 'devfinance-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        // IMPORTANTE: No Render, confiar no proxy
        secure: process.env.NODE_ENV === 'production' ? false : true, // ✅ Correto, // Mudar para false para funcionar no Render
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        sameSite: 'lax'
    },
    name: 'devfinance.sid'
}));

// ===== FLASH MESSAGES =====
app.use(flash());

// ===== MIDDLEWARE DE LOG (para debug) =====
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url}`);
    console.log('📦 Session ID:', req.session?.id || 'Nenhum');
    console.log('👤 Usuário logado:', req.session?.userId || 'Não');
    console.log('🔒 Cookie secure:', req.session?.cookie?.secure);
    next();
});


// ===== MIDDLEWARE PARA VARIÁVEIS GLOBAIS =====
// app.use((req, res, next) => {
//     // Flash messages
//     res.locals.error = req.flash('error');
//     res.locals.success = req.flash('success');
//     res.locals.info = req.flash('info');

//     // Dados do usuário
//     if (req.session && req.session.userId) {
//         res.locals.isAuthenticated = true;
//         res.locals.user = {
//             id: req.session.userId,
//             name: req.session.userName || 'Usuário',
//             email: req.session.userEmail || ''
//         };
//         console.log('✅ Usuário na sessão:', req.session.userName);
//     } else {
//         res.locals.isAuthenticated = false;
//         res.locals.user = null;
//         console.log('❌ Nenhum usuário na sessão');
//     }

//     next();
// });
// ===== TRATAMENTO DE ERROS - VERSÃO DETALHADA =====
app.use((err, req, res, next) => {
    console.error('❌ ===== ERRO DETALHADO =====');
    console.error('❌ Mensagem:', err.message);
    console.error('❌ Stack:', err.stack);
    console.error('❌ URL:', req.url);
    console.error('❌ Método:', req.method);
    console.error('❌ Session:', req.session);
    console.error('❌ ===== FIM DO ERRO =====');

    res.status(500).render('error', {
        title: 'Erro no Servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Ocorreu um erro interno. Tente novamente mais tarde.',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
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
    console.log(`🔧 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
    console.log('🔑 Rotas públicas: /login, /register, /health');
});








const User = require('../models/User');
const bcrypt = require('bcryptjs'); // <-- ADICIONE ESTA LINHA

// ============================================
// TELA DE LOGIN
// ============================================
exports.showLogin = (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    
    res.render('auth/login', {
        title: 'Login - DevFinance',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

// ============================================
// TELA DE CADASTRO
// ============================================
exports.showRegister = (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    
    res.render('auth/register', {
        title: 'Cadastro - DevFinance',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

// ============================================
// PROCESSAR CADASTRO
// ============================================
exports.register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        if (!name || !email || !password || !confirmPassword) {
            req.flash('error', 'Preencha todos os campos');
            return res.redirect('/register');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'As senhas não coincidem');
            return res.redirect('/register');
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            req.flash('error', 'Este email já está cadastrado');
            return res.redirect('/register');
        }

        // ===== CRIPTOGRAFAR SENHA AQUI =====
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            name: name.trim(),
            email: email.toLowerCase(),
            password: hashedPassword // <-- SENHA JÁ CRIPTOGRAFADA
        });

        await user.save();

        req.flash('success', 'Cadastro realizado com sucesso! Faça login.');
        res.redirect('/login');
    } catch (error) {
        console.error('❌ Erro no cadastro:', error);
        req.flash('error', 'Erro ao cadastrar. Verifique os dados.');
        res.redirect('/register');
    }
};

// ============================================
// PROCESSAR LOGIN
// ============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('📝 Tentativa de login:', email);

        if (!email || !password) {
            console.log('❌ Campos vazios');
            req.flash('error', 'Preencha todos os campos');
            return res.redirect('/login');
        }

        // Buscar usuário
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('❌ Usuário não encontrado:', email);
            req.flash('error', 'Email ou senha incorretos');
            return res.redirect('/login');
        }

        console.log('✅ Usuário encontrado:', user.name);
        console.log('🔑 Senha no banco:', user.password.substring(0, 10) + '...');

        // Comparar senha
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('🔍 Resultado da comparação:', isMatch);

        if (!isMatch) {
            console.log('❌ Senha incorreta');
            req.flash('error', 'Email ou senha incorretos');
            return res.redirect('/login');
        }

        console.log('✅ Senha correta!');

        // Criar sessão
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;

        console.log('📦 Sessão criada:', req.session);
        console.log('🆔 userId:', req.session.userId);

        req.session.save((err) => {
            if (err) {
                console.error('❌ Erro ao salvar sessão:', err);
                req.flash('error', 'Erro ao fazer login. Tente novamente.');
                return res.redirect('/login');
            }
            
            console.log('✅ Sessão salva com sucesso!');
            console.log('🔀 Redirecionando para dashboard...');
            req.flash('success', `Bem-vindo(a) ${user.name}!`);
            return res.redirect('/');
        });

    } catch (error) {
        console.error('❌ Erro no login:', error);
        req.flash('error', 'Erro ao fazer login. Tente novamente.');
        res.redirect('/login');
    }
};
// ============================================
// LOGOUT
// ============================================
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Erro ao fazer logout:', err);
        }
        res.redirect('/login');
    });
};

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================
exports.isAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        req.flash('error', 'Faça login para acessar esta página');
        return res.redirect('/login');
    }
    next();
};

// ============================================
// MIDDLEWARE - DADOS DO USUÁRIO PARA VIEWS
// ============================================
exports.addUserToLocals = (req, res, next) => {
    if (req.session && req.session.userId) {
        res.locals.user = {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail
        };
        res.locals.isAuthenticated = true;
    } else {
        res.locals.user = null;
        res.locals.isAuthenticated = false;
    }
    next();
};
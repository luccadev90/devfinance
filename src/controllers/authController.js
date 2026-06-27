const User = require('../models/User');

// ============================================
// TELA DE LOGIN
// ============================================
exports.showLogin = (req, res) => {
    if (req.session && req.session.userId) {
        console.log('👤 Usuário já logado, redirecionando para dashboard');
        return res.redirect('/');
    }
    
    res.render('auth/login', {
        title: 'Login - DevFinance'
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
        title: 'Cadastro - DevFinance'
    });
};

// ============================================
// PROCESSAR LOGIN
// ============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('error', 'Preencha todos os campos');
            return res.redirect('/login');
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.flash('error', 'Email ou senha incorretos');
            return res.redirect('/login');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error', 'Email ou senha incorretos');
            return res.redirect('/login');
        }

        // Criar sessão
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;
        
        // Inicializar filtros na sessão
        req.session.monthFilter = 'current';
        req.session.yearFilter = new Date().getFullYear();
        req.session.statusFilter = 'all';
        req.session.typeFilter = 'all';

        // Salvar explicitamente
        req.session.save((err) => {
            if (err) {
                console.error('❌ Erro ao salvar sessão:', err);
                req.flash('error', 'Erro ao fazer login. Tente novamente.');
                return res.redirect('/login');
            }
            
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

        if (password.length < 6) {
            req.flash('error', 'A senha deve ter no mínimo 6 caracteres');
            return res.redirect('/register');
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            req.flash('error', 'Este email já está cadastrado');
            return res.redirect('/register');
        }

        const user = new User({
            name: name.trim(),
            email: email.toLowerCase(),
            password: password
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
// LOGOUT
// ============================================
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Erro ao fazer logout:', err);
        }
        console.log('👋 Logout realizado');
        res.redirect('/login');
    });
};

// ============================================
// MIDDLEWARE - VERIFICAR SE ESTÁ LOGADO
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
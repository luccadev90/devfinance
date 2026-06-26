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
// PROCESSAR LOGIN - COM MAIS LOGS
// ============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('📝 Tentativa de login:', email);
        console.log('📦 Body recebido:', req.body);

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

        // Verificar senha
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Senha incorreta para:', email);
            req.flash('error', 'Email ou senha incorretos');
            return res.redirect('/login');
        }

        console.log('✅ Senha correta!');

        // Criar sessão
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;

        // Salvar a sessão explicitamente
        req.session.save((err) => {
            if (err) {
                console.error('❌ Erro ao salvar sessão:', err);
                req.flash('error', 'Erro ao fazer login. Tente novamente.');
                return res.redirect('/login');
            }
            
            console.log('✅ Sessão salva com sucesso!');
            console.log('🆔 userId:', req.session.userId);
            console.log('👤 userName:', req.session.userName);
            
            req.flash('success', `Bem-vindo(a) ${user.name}!`);
            res.redirect('/');
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

        console.log('📝 Tentativa de cadastro:', email);
        console.log('📦 Body recebido:', req.body);

        if (!name || !email || !password || !confirmPassword) {
            console.log('❌ Campos vazios');
            req.flash('error', 'Preencha todos os campos');
            return res.redirect('/register');
        }

        if (password !== confirmPassword) {
            console.log('❌ Senhas não coincidem');
            req.flash('error', 'As senhas não coincidem');
            return res.redirect('/register');
        }

        if (password.length < 6) {
            console.log('❌ Senha muito curta');
            req.flash('error', 'A senha deve ter no mínimo 6 caracteres');
            return res.redirect('/register');
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('❌ Email já existe:', email);
            req.flash('error', 'Este email já está cadastrado');
            return res.redirect('/register');
        }

        const user = new User({
            name: name.trim(),
            email: email.toLowerCase(),
            password: password
        });

        await user.save();

        console.log('✅ Cadastro bem-sucedido:', user.name);
        console.log('🆔 ID do usuário:', user._id);

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
    console.log('🔍 Verificando autenticação...');
    console.log('📦 Session:', req.session);
    console.log('🆔 userId:', req.session?.userId);
    
    if (!req.session || !req.session.userId) {
        console.log('❌ Não autenticado - redirecionando para login');
        req.flash('error', 'Faça login para acessar esta página');
        return res.redirect('/login');
    }
    
    console.log('✅ Usuário autenticado:', req.session.userId);
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
const UserNew = require('../models/UserNew');

// ===== TESTE DE CADASTRO =====
exports.testRegister = async (req, res) => {
    try {
        console.log('🔥 TESTE: Rota /test-register foi chamada!');
        console.log('📦 Body recebido:', req.body);

        const { name, email, password } = req.body;

        // Validar campos
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios'
            });
        }

        // Verificar se o usuário já existe
        const existingUser = await UserNew.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email já cadastrado'
            });
        }

        // Criar usuário
        const user = new UserNew({
            name: name.trim(),
            email: email.toLowerCase(),
            password: password
        });

        await user.save();
        console.log('✅ Usuário salvo no banco! ID:', user._id);

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso!',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('❌ Erro no teste de cadastro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cadastrar usuário',
            error: error.message
        });
    }
};

// ===== TESTE DE LOGIN =====
exports.testLogin = async (req, res) => {
    try {
        console.log('🔥 TESTE: Rota /test-login foi chamada!');
        console.log('📦 Body recebido:', req.body);

        const { email, password } = req.body;

        // Validar campos
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email e senha são obrigatórios'
            });
        }

        // Buscar usuário
        const user = await UserNew.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        // Verificar senha
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Senha incorreta'
            });
        }

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('❌ Erro no teste de login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer login',
            error: error.message
        });
    }
};
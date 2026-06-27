const mongoose = require('mongoose');
require('dotenv').config();

// Conectar ao MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devfinance';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conectado ao MongoDB'))
    .catch(err => console.error('❌ Erro:', err));

// Schema simples para teste
const testSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    createdAt: { type: Date, default: Date.now }
});

const TestUser = mongoose.model('TestUser', testSchema);

// Função para testar
async function testSave() {
    try {
        console.log('📝 Tentando salvar usuário...');
        
        const user = new TestUser({
            name: 'Teste Manual',
            email: 'manual@teste.com',
            password: '123456'
        });
        
        const result = await user.save();
        console.log('✅ Usuário salvo com sucesso!');
        console.log('📊 Dados salvos:', result);
        
    } catch (error) {
        console.error('❌ Erro ao salvar:', error.message);
        console.error('📚 Detalhes:', error);
    } finally {
        mongoose.disconnect();
    }
}

testSave();
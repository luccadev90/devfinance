const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devfinance';

const connectDB = async () => {
    try {
        // Remove as opções obsoletas
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Conectado ao MongoDB com sucesso!');
        console.log(`📊 Banco de dados: ${mongoose.connection.name}`);
        console.log(`📊 Host: ${mongoose.connection.host}`);
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error.message);
        // Não encerra o processo, apenas mostra o erro
        console.log('⚠️ O servidor continuará rodando sem banco de dados');
    }
};

module.exports = connectDB;
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devfinance';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 30000, // 30 segundos (padrão é 5s)
            socketTimeoutMS: 45000, // 45 segundos
            connectTimeoutMS: 30000, // 30 segundos
            retryWrites: true,
            retryReads: true
        });
        console.log('✅ Conectado ao MongoDB com sucesso!');
        console.log(`📊 Banco de dados: ${mongoose.connection.name}`);
        console.log(`📊 Host: ${mongoose.connection.host}`);
        
        if (process.env.NODE_ENV !== 'production') {
            mongoose.set('debug', true);
        }
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error.message);
        console.log('⚠️ O servidor continuará rodando sem banco de dados');
    }
};

module.exports = connectDB;
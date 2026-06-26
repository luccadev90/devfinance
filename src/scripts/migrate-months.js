const mongoose = require('mongoose');
const Finance = require('../models/Finance');
require('dotenv').config();

async function migrateMonths() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        const finances = await Finance.find({ month: { $exists: false } });
        console.log(`📊 Encontrados ${finances.length} registros para migrar`);

        for (const finance of finances) {
            const date = new Date(finance.date || finance.createdAt);
            finance.month = date.getMonth() + 1;
            finance.year = date.getFullYear();
            await finance.save();
            console.log(`✅ Migrado: ${finance.description} -> ${finance.month}/${finance.year}`);
        }

        console.log('🎉 Migração concluída!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

migrateMonths();
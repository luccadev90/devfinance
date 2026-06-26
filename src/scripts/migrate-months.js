const mongoose = require('mongoose');
const Finance = require('../models/Finance');
require('dotenv').config();

async function migrateMonths() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        // Verificar se já existe o campo month
        const sample = await Finance.findOne({});
        if (sample && sample.month !== undefined) {
            console.log('✅ Dados já migrados!');
            process.exit(0);
        }

        const finances = await Finance.find({});
        console.log(`📊 Encontrados ${finances.length} registros para migrar`);

        for (const finance of finances) {
            const date = finance.date ? new Date(finance.date) : finance.createdAt;
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            
            finance.month = month;
            finance.year = year;
            await finance.save();
            console.log(`✅ Migrado: ${finance.description} -> ${month}/${year}`);
        }

        console.log('🎉 Migração concluída!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

migrateMonths();
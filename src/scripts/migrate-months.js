const mongoose = require('mongoose');
const Finance = require('../models/Finance');
require('dotenv').config();

async function migrateMonths() {
    try {
        // Conectar ao MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        // Buscar todos os registros
        const finances = await Finance.find({});
        console.log(`📊 Encontrados ${finances.length} registros`);

        let count = 0;

        for (const finance of finances) {
            // Se já tem month e year, pular
            if (finance.month !== undefined && finance.year !== undefined) {
                continue;
            }

            // Determinar data
            let date;
            if (finance.date) {
                date = new Date(finance.date);
            } else if (finance.createdAt) {
                date = new Date(finance.createdAt);
            } else {
                date = new Date();
            }

            // Extrair mês e ano
            const month = date.getMonth() + 1;
            const year = date.getFullYear();

            // Atualizar documento
            finance.month = month;
            finance.year = year;
            await finance.save();
            
            count++;
            console.log(`✅ Migrado: ${finance.description} -> ${month}/${year}`);
        }

        console.log(`🎉 Migração concluída! ${count} registros atualizados.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

migrateMonths();
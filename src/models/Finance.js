const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
    description: {
        type: String,
        required: [true, 'Descrição é obrigatória'],
        trim: true,
        minlength: [3, 'Descrição deve ter pelo menos 3 caracteres'],
        maxlength: [100, 'Descrição deve ter no máximo 100 caracteres']
    },
    amount: {
        type: Number,
        required: [true, 'Valor é obrigatório'],
        min: [0.01, 'Valor deve ser maior que 0']
    },
    type: {
        type: String,
        required: [true, 'Tipo é obrigatório'],
        enum: ['income', 'expense'],
        default: 'income'
    },
    status: {
        type: String,
        required: [true, 'Status é obrigatório'],
        enum: ['pending', 'paid'],
        default: 'pending'
    },
    date: {
        type: String,
        required: [true, 'Data é obrigatória'],
        default: () => new Date().toISOString().split('T')[0]
    },
     // NOVOS CAMPOS PARA CONTROLE MENSAL
    month: {
        type: Number,
        required: true,
        default: () => new Date().getMonth() + 1 // 1-12
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear()
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Índice para consultas rápidas
financeSchema.index({ userId: 1, year: 1, month: 1, createdAt: -1 });
financeSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Finance', financeSchema);
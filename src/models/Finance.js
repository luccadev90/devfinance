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
    month: {
        type: Number,
        required: true,
        default: () => new Date().getMonth() + 1,
        min: [1, 'Mês deve ser entre 1 e 12'],
        max: [12, 'Mês deve ser entre 1 e 12']
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
        min: [2000, 'Ano deve ser maior que 2000']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Índices para consultas rápidas
financeSchema.index({ userId: 1, year: 1, month: 1, createdAt: -1 });
financeSchema.index({ userId: 1, createdAt: -1 });
financeSchema.index({ userId: 1, status: 1 });
financeSchema.index({ userId: 1, type: 1 });

// ===== MIDDLEWARE PRE-SAVE REMOVIDO PARA EVITAR ERROS =====
// A validação de month/year é feita no controller

module.exports = mongoose.model('Finance', financeSchema);
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
        enum: {
            values: ['income', 'expense'],
            message: 'Tipo deve ser "income" ou "expense"'
        },
        default: 'income'
    },
    status: {
        type: String,
        required: [true, 'Status é obrigatório'],
        enum: {
            values: ['pending', 'paid'],
            message: 'Status deve ser "pending" ou "paid"'
        },
        default: 'pending'
    },
    date: {
        type: String,
        required: [true, 'Data é obrigatória'],
        default: () => new Date().toISOString().split('T')[0]
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date
    }
}, {
    timestamps: true, // Cria automaticamente createdAt e updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual para formatar valor em reais
financeSchema.virtual('formattedAmount').get(function() {
    return `R$ ${this.amount.toFixed(2)}`;
});

// Virtual para exibir status em português
financeSchema.virtual('statusLabel').get(function() {
    return this.status === 'paid' ? 'Pago' : 'Pendente';
});

// Virtual para exibir tipo em português
financeSchema.virtual('typeLabel').get(function() {
    return this.type === 'income' ? 'Receita' : 'Despesa';
});

// Middleware para atualizar updatedAt
financeSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: new Date() });
    next();
});

module.exports = mongoose.model('Finance', financeSchema);
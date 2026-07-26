// src/utils/moneyUtils.js

/**
 * Formata um valor numérico para o padrão brasileiro (R$ 22.222,99)
 * @param {number|string} value - Valor a ser formatado
 * @returns {string} Valor formatado
 */
export const formatMoney = (value) => {
    // Converte para número se for string
    const number = typeof value === 'string' ? parseFloat(value) : value;
    
    // Verifica se é um número válido
    if (isNaN(number)) return 'R$ 0,00';
    
    // Formata para o padrão brasileiro
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

export const toNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.'));
    }
    return 0;
}

/**
 * Formata um valor sem o símbolo R$ (apenas números)
 * @param {number|string} value - Valor a ser formatado
 * @returns {string} Valor formatado (ex: 22.222,99)
 */
export const formatMoneySimple = (value) => {
    const number = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(number)) return '0,00';
    
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

/**
 * Converte uma string formatada para número
 * @param {string} value - String formatada (ex: R$ 22.222,99)
 * @returns {number} Valor numérico
 */
export const parseMoney = (value) => {
    if (!value) return 0;
    
    // Remove R$ e espaços
    let cleanValue = value.replace(/[R$\s]/g, '');
    // Troca ponto por nada e vírgula por ponto
    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    
    return parseFloat(cleanValue) || 0;
};

export default {
    formatMoney,
    toNumber,
    formatMoneySimple,
    parseMoney
};
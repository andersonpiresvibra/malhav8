
/**
 * Determina o turno atual com base na hora do sistema.
 * 
 * MANHÃ: 06h00 - 13h59
 * TARDE: 14h00 - 21h59
 * NOITE: 22h00 - 05h59
 */
export const getCurrentShift = (withTilde: boolean = true): string => {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 14) {
        return withTilde ? 'MANHÃ' : 'MANHA';
    }
    
    if (hour >= 14 && hour < 22) {
        return 'TARDE';
    }
    
    return 'NOITE';
};

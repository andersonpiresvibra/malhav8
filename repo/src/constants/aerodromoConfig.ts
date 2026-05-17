export type PositionType = 'PIT' | 'REMOTA';

export interface PositionMetadata {
    type: PositionType;
    patio: string;
}

export const POSITIONS_METADATA: Record<string, PositionMetadata> = {
    // PÁTIO 1
    '101L': { patio: '1', type: 'PIT' }, '101': { patio: '1', type: 'PIT' }, '101R': { patio: '1', type: 'PIT' },
    '102': { patio: '1', type: 'PIT' }, '103L': { patio: '1', type: 'PIT' }, '103R': { patio: '1', type: 'PIT' },
    '104': { patio: '1', type: 'PIT' }, '105L': { patio: '1', type: 'PIT' }, '105R': { patio: '1', type: 'PIT' },
    '106': { patio: '1', type: 'PIT' }, '107L': { patio: '1', type: 'PIT' }, '107R': { patio: '1', type: 'PIT' },
    '108L': { patio: '1', type: 'PIT' }, '108R': { patio: '1', type: 'PIT' }, '109': { patio: '1', type: 'PIT' },
    '110': { patio: '1', type: 'REMOTA' }, '111': { patio: '1', type: 'PIT' }, '112L': { patio: '1', type: 'PIT' },
    '112': { patio: '1', type: 'PIT' }, '112R': { patio: '1', type: 'PIT' }, '113': { patio: '1', type: 'PIT' },
    '113L': { patio: '1', type: 'PIT' }, '113R': { patio: '1', type: 'PIT' }, '114': { patio: '1', type: 'REMOTA' },
    '115': { patio: '1', type: 'REMOTA' },

    // PÁTIO 2
    '201': { patio: '2', type: 'PIT' }, '202': { patio: '2', type: 'PIT' }, '202L': { patio: '2', type: 'PIT' },
    '202R': { patio: '2', type: 'PIT' }, '203': { patio: '2', type: 'PIT' }, '204L': { patio: '2', type: 'PIT' },
    '204': { patio: '2', type: 'PIT' }, '204R': { patio: '2', type: 'PIT' }, '205': { patio: '2', type: 'PIT' },
    '206': { patio: '2', type: 'PIT' }, '207': { patio: '2', type: 'PIT' }, '208': { patio: '2', type: 'PIT' },
    '209': { patio: '2', type: 'PIT' }, '210': { patio: '2', type: 'PIT' }, '211L': { patio: '2', type: 'PIT' },
    '211': { patio: '2', type: 'PIT' }, '211R': { patio: '2', type: 'PIT' }, '212L': { patio: '2', type: 'PIT' },
    '212R': { patio: '2', type: 'PIT' },

    // PÁTIO 3
    '301': { patio: '3', type: 'PIT' }, '302L': { patio: '3', type: 'PIT' }, '302R': { patio: '3', type: 'PIT' },
    '303L': { patio: '3', type: 'PIT' }, '303R': { patio: '3', type: 'PIT' }, '304': { patio: '3', type: 'PIT' },
    '305': { patio: '3', type: 'PIT' }, '306': { patio: '3', type: 'PIT' }, '307': { patio: '3', type: 'PIT' },
    '308': { patio: '3', type: 'PIT' }, '309': { patio: '3', type: 'PIT' }, '310': { patio: '3', type: 'PIT' },
    '311': { patio: '3', type: 'PIT' }, '312': { patio: '3', type: 'PIT' },

    // PÁTIO 4
    '401': { patio: '4', type: 'PIT' }, '402L': { patio: '4', type: 'PIT' }, '402': { patio: '4', type: 'PIT' },
    '402R': { patio: '4', type: 'PIT' }, '403': { patio: '4', type: 'PIT' }, '404': { patio: '4', type: 'PIT' },
    '405': { patio: '4', type: 'PIT' }, '406': { patio: '4', type: 'PIT' }, '407': { patio: '4', type: 'PIT' },
    '408': { patio: '4', type: 'PIT' }, '409': { patio: '4', type: 'PIT' }, '410L': { patio: '4', type: 'PIT' },
    '410R': { patio: '4', type: 'PIT' }, '411': { patio: '4', type: 'PIT' }, '411L': { patio: '4', type: 'PIT' },
    '411R': { patio: '4', type: 'PIT' }, '412': { patio: '4', type: 'PIT' },

    // PÁTIO 5
    '503': { patio: '5', type: 'PIT' }, '504L': { patio: '5', type: 'PIT' }, '504': { patio: '5', type: 'PIT' },
    '504R': { patio: '5', type: 'PIT' }, '505': { patio: '5', type: 'PIT' }, '505R': { patio: '5', type: 'PIT' },
    '506': { patio: '5', type: 'PIT' }, '507L': { patio: '5', type: 'PIT' }, '507': { patio: '5', type: 'PIT' },
    '507R': { patio: '5', type: 'PIT' }, '508L': { patio: '5', type: 'PIT' }, '508R': { patio: '5', type: 'PIT' },
    '509L': { patio: '5', type: 'PIT' }, '509': { patio: '5', type: 'PIT' }, '509R': { patio: '5', type: 'PIT' },
    '510L': { patio: '5', type: 'PIT' }, '510R': { patio: '5', type: 'PIT' }, '510': { patio: '5', type: 'PIT' },
    '511L': { patio: '5', type: 'PIT' }, '511': { patio: '5', type: 'PIT' }, '511R': { patio: '5', type: 'PIT' },
    '512': { patio: '5', type: 'PIT' }, '513': { patio: '5', type: 'PIT' },
    '501L': { patio: '5', type: 'REMOTA' }, '502': { patio: '5', type: 'REMOTA' }, '502R': { patio: '5', type: 'REMOTA' },

    // PÁTIO 6
    '601L': { patio: '6', type: 'PIT' }, '601R': { patio: '6', type: 'PIT' }, '602L': { patio: '6', type: 'PIT' },
    '602R': { patio: '6', type: 'PIT' }, '603L': { patio: '6', type: 'PIT' }, '603R': { patio: '6', type: 'PIT' },
    '604L': { patio: '6', type: 'PIT' }, '604R': { patio: '6', type: 'PIT' }, '605L': { patio: '6', type: 'PIT' },
    '605R': { patio: '6', type: 'PIT' }, '606L': { patio: '6', type: 'PIT' }, '606': { patio: '6', type: 'PIT' },
    '606R': { patio: '6', type: 'PIT' }, '607L': { patio: '6', type: 'PIT' }, '607R': { patio: '6', type: 'PIT' },
    '608L': { patio: '6', type: 'PIT' }, '608R': { patio: '6', type: 'PIT' }, '609L': { patio: '6', type: 'PIT' },
    '609R': { patio: '6', type: 'PIT' }, '610L': { patio: '6', type: 'PIT' }, '610R': { patio: '6', type: 'PIT' },
    '611L': { patio: '6', type: 'PIT' }, '611R': { patio: '6', type: 'PIT' }, '612L': { patio: '6', type: 'PIT' },
    '612R': { patio: '6', type: 'PIT' },

    // PÁTIO 7
    '701L': { patio: '7', type: 'PIT' }, '701R': { patio: '7', type: 'PIT' }, '702L': { patio: '7', type: 'PIT' },
    '702R': { patio: '7', type: 'PIT' }, '703L': { patio: '7', type: 'PIT' }, '703R': { patio: '7', type: 'PIT' },
    '713L': { patio: '7', type: 'PIT' }, '713R': { patio: '7', type: 'PIT' }, '714L': { patio: '7', type: 'PIT' },
    '714R': { patio: '7', type: 'PIT' }, '715L': { patio: '7', type: 'PIT' }, '715R': { patio: '7', type: 'PIT' },

    // PVIP (Assumindo remota/especial)
    'V1': { patio: 'VIP', type: 'REMOTA' }, 'V2': { patio: 'VIP', type: 'REMOTA' }, 'V3': { patio: 'VIP', type: 'REMOTA' },
};

// Derived helper for components that still need lists
export const POSITIONS_BY_PATIO: Record<string, string[]> = Object.entries(POSITIONS_METADATA).reduce((acc, [id, meta]) => {
    if (!acc[meta.patio]) acc[meta.patio] = [];
    acc[meta.patio].push(id);
    return acc;
}, {} as Record<string, string[]>);

export const PATIO_LABELS = [
    { id: '1', label: 'P1' }, { id: '2', label: 'P2' }, { id: '3', label: 'P3' },
    { id: '4', label: 'P4' }, { id: '5', label: 'P5' }, { id: '6', label: 'P6' }, { id: '7', label: 'P7' }, { id: 'VIP', label: 'PVIP' }
];


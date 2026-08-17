// JETFUEL-SIM — Adversity Engine (Motor de Adversidades)
// Gera, escalona e aplica consequências de eventos operacionais (situações SIMULADAS).
// Fonte: JETFUEL_PLANO_MESTRE.pdf §3.

import {
  AdversityCategory,
  AdversityEvent,
  DifficultyLevel,
} from '../types/game';

interface DifficultyProfile {
  intervalMin: number; // segundos entre eventos
  intervalMax: number;
  timerAvg: number;
  maxConcurrent: number;
  consequenceMultiplier: number;
  noTimerChance: number; // 0..1
}

const DIFFICULTY: Record<DifficultyLevel, DifficultyProfile> = {
  TREINAMENTO: { intervalMin: 480, intervalMax: 720, timerAvg: 480, maxConcurrent: 1, consequenceMultiplier: 0.5, noTimerChance: 0 },
  OPERACIONAL: { intervalMin: 300, intervalMax: 480, timerAvg: 300, maxConcurrent: 2, consequenceMultiplier: 1, noTimerChance: 0 },
  PICO: { intervalMin: 180, intervalMax: 300, timerAvg: 180, maxConcurrent: 3, consequenceMultiplier: 1.25, noTimerChance: 0 },
  EXTREMO: { intervalMin: 60, intervalMax: 180, timerAvg: 90, maxConcurrent: 3, consequenceMultiplier: 1.5, noTimerChance: 0.3 },
};

// Catálogo (resumo do Plano Mestre §3.2 — 5 categorias)
const CATALOG: Omit<AdversityEvent, 'id' | 'startedAt'>[] = [
  // METEOROLOGIA
  {
    category: 'METEOROLOGIA', title: '⛈ Alerta de Raios (SIGMET)',
    description: 'REDEMET emite SIGMET para área de pátio. Operação de risco.',
    timerSeconds: 180, scoreImpactOnIgnore: -15,
    actions: [
      { id: 'suspend', label: 'Suspender operações externas por 20 min', scoreImpact: 20, consequence: 'Equipe segura, sem exposição.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -15, consequence: 'Operador exposto → advertência + -15 pts.' },
    ],
  },
  {
    category: 'METEOROLOGIA', title: '🌫 Névoa densa (RVR < 400m)',
    description: 'Visibilidade reduzida. CTAs não circulam no pátio.',
    timerSeconds: 300, scoreImpactOnIgnore: -15,
    actions: [
      { id: 'redirect', label: 'Redirecionar CTAs para posições cobertas', scoreImpact: 20, consequence: 'Circulação segura.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -15, consequence: 'Bloqueio ANAC.' },
    ],
  },
  // VOOS
  {
    category: 'VOO', title: '✈ Troca de aeronave',
    description: 'B737-800 vira A321neo. Volume diferente; veículo pode ser incompatível.',
    timerSeconds: 240, scoreImpactOnIgnore: -20,
    actions: [
      { id: 'recalc', label: 'Recalcular volume e confirmar veículo', scoreImpact: 20, consequence: 'Abastecimento correto.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -20, consequence: 'Retrabalho +25 min.' },
    ],
  },
  {
    category: 'VOO', title: '🔁 Voo alternado não programado',
    description: 'Aeronave pousou de alternado. Sem posição reservada.',
    timerSeconds: 360, scoreImpactOnIgnore: -15,
    actions: [
      { id: 'allocate', label: 'Alocar posição vaga e designar operador', scoreImpact: 20, consequence: 'Cobertura garantida.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -15, consequence: 'Aeronave parada > 20 min.' },
    ],
  },
  // EQUIPAMENTO
  {
    category: 'EQUIPAMENTO', title: '🚛 CTA com pane no pátio',
    description: 'Veículo para no meio da operação. Motor travado na posição.',
    timerSeconds: 300, scoreImpactOnIgnore: -15,
    actions: [
      { id: 'maint', label: 'Acionar manutenção + redesignar voo', scoreImpact: 20, consequence: '-1 CTA por 45 min, mas voo coberto.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -15, consequence: '-1 CTA disponível por 45 min.' },
    ],
  },
  {
    category: 'EQUIPAMENTO', title: '🔴 PIT sem pressão',
    description: 'Hidrante da posição sem pressão. SRV não abastece.',
    timerSeconds: 240, scoreImpactOnIgnore: -20,
    actions: [
      { id: 'swap', label: 'Trocar para CTA ou reposicionar voo', scoreImpact: 20, consequence: 'Abastecimento retomado.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -20, consequence: 'Abastecimento parado → atraso crítico.' },
    ],
  },
  // OPERADOR
  {
    category: 'OPERADOR', title: '📋 Certificação vencida',
    description: 'Sistema detecta ATVE vencida. Operador não pode operar.',
    timerSeconds: 0, scoreImpactOnIgnore: -30,
    actions: [
      { id: 'remove', label: 'Afastar imediatamente', scoreImpact: 20, consequence: 'Conformidade mantida.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -30, consequence: 'Missão irregular → afastamento.' },
    ],
  },
  {
    category: 'OPERADOR', title: '😤 Conflito entre operadores',
    description: 'Dois operadores em desentendimento na posição 42.',
    timerSeconds: 300, scoreImpactOnIgnore: -15,
    actions: [
      { id: 'intervene', label: 'Intervir, separar e registrar', scoreImpact: 20, consequence: 'Clima restaurado.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -15, consequence: 'SESMT acionado; dois afastados.' },
    ],
  },
  // REGULATORIO
  {
    category: 'REGULATORIO', title: '🔍 Fiscalização ANAC surpresa',
    description: 'Fiscal da ANAC chega para inspeção aleatória.',
    timerSeconds: 0, scoreImpactOnIgnore: -15,
    actions: [
      { id: 'docs', label: 'Reunir documentação e acionar supervisor', scoreImpact: 20, consequence: 'Inspeção tranquila.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -15, consequence: 'Advertência formal.' },
    ],
  },
  {
    category: 'REGULATORIO', title: '🚨 Derramamento de combustível',
    description: 'Sensor detecta combustível no piso da posição 71.',
    timerSeconds: 60, scoreImpactOnIgnore: -25,
    actions: [
      { id: 'sesmt', label: 'Acionar SESMT e isolar posição', scoreImpact: 20, consequence: 'Risco contido.' },
      { id: 'ignore', label: 'Ignorar', scoreImpact: -25, consequence: 'Evacuação do pátio.' },
    ],
  },
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `adv-${Date.now()}-${counter}`;
}

export function drawAdversity(level: DifficultyLevel): AdversityEvent {
  const profile = DIFFICULTY[level];
  const base = CATALOG[rand(0, CATALOG.length - 1)];
  const noTimer = Math.random() < profile.noTimerChance;
  const timer = noTimer ? 0 : Math.max(30, Math.round(profile.timerAvg * (0.8 + Math.random() * 0.4)));
  return {
    ...base,
    id: nextId(),
    startedAt: Date.now(),
    timerSeconds: timer,
    // consequência agravada conforme dificuldade
    scoreImpactOnIgnore: Math.round(base.scoreImpactOnIgnore * profile.consequenceMultiplier),
    actions: base.actions.map((a) => ({
      ...a,
      scoreImpact:
        a.id === 'ignore'
          ? Math.round(a.scoreImpact * profile.consequenceMultiplier)
          : a.scoreImpact,
    })),
  };
}

export function nextInterval(level: DifficultyLevel): number {
  const p = DIFFICULTY[level];
  return rand(p.intervalMin, p.intervalMax) * 1000; // ms
}

export function maxConcurrent(level: DifficultyLevel): number {
  return DIFFICULTY[level].maxConcurrent;
}

export const ADVERSITY_CATEGORY_ICON: Record<AdversityCategory, string> = {
  METEOROLOGIA: '🌩',
  VOO: '✈',
  EQUIPAMENTO: '🚛',
  OPERADOR: '👤',
  REGULATORIO: '📋',
};

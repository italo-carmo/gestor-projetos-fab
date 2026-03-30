"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MISSION_CHECKLIST_DEFAULT_SECTIONS = exports.MISSION_CHECKLIST_CLASSIFICATION_DEFAULT_META = exports.MISSION_CHECKLIST_SECTION_TITLE_BY_ID = exports.MISSION_CHECKLIST_SECTION_IDS = exports.DEFAULT_MISSION_CHECKLIST_CLASSIFICATION = exports.MISSION_CHECKLIST_CLASSIFICATIONS = void 0;
exports.MISSION_CHECKLIST_CLASSIFICATIONS = [
    'FORTE_CONSOLIDADA',
    'OPORTUNIDADE_MELHORIA',
    'NECESSITA_ANALISE',
    'POSSIVEL_RISCO',
];
exports.DEFAULT_MISSION_CHECKLIST_CLASSIFICATION = 'NECESSITA_ANALISE';
exports.MISSION_CHECKLIST_SECTION_IDS = [
    'lideranca',
    'acompanhamento_recrutas',
    'analise_riscos',
];
exports.MISSION_CHECKLIST_SECTION_TITLE_BY_ID = {
    lideranca: 'Liderança',
    acompanhamento_recrutas: 'Acompanhamento de Recrutas',
    analise_riscos: 'Análise de Riscos',
};
exports.MISSION_CHECKLIST_CLASSIFICATION_DEFAULT_META = {
    FORTE_CONSOLIDADA: {
        label: 'Dimensão forte/consolidada',
        colorHex: '#2E7D32',
        sortOrder: 10,
    },
    OPORTUNIDADE_MELHORIA: {
        label: 'Dimensão com oportunidades de melhoria',
        colorHex: '#F9A825',
        sortOrder: 20,
    },
    NECESSITA_ANALISE: {
        label: 'Dimensão necessita de maior análise',
        colorHex: null,
        sortOrder: 30,
    },
    POSSIVEL_RISCO: {
        label: 'Possível Risco',
        colorHex: '#C62828',
        sortOrder: 40,
    },
};
exports.MISSION_CHECKLIST_DEFAULT_SECTIONS = [
    {
        id: 'lideranca',
        title: 'Liderança',
        items: [
            {
                id: 'lideranca_atuacao',
                title: 'Atuação de lideranças',
            },
            {
                id: 'lideranca_coesao_equipe',
                title: 'Coesão da equipe de instrução e inclusão de instrutoras do sexo feminino',
            },
            {
                id: 'lideranca_preparo_instrutoras',
                title: 'Preparo das instrutoras mulheres',
            },
        ],
    },
    {
        id: 'acompanhamento_recrutas',
        title: 'Acompanhamento de Recrutas',
        items: [
            {
                id: 'acompanhamento_motivacao',
                title: 'Percepção de motivação das recrutas',
            },
            {
                id: 'acompanhamento_suporte_psicossocial',
                title: 'Suporte psicossocial (psicólogo, assistente social e jurídico)',
            },
            {
                id: 'acompanhamento_engajamento_familiar',
                title: 'Engajamento familiar',
            },
            {
                id: 'acompanhamento_infraestrutura',
                title: 'Infraestrutura e condições',
            },
        ],
    },
    {
        id: 'analise_riscos',
        title: 'Análise de Riscos',
        items: [
            {
                id: 'riscos_reputacional_juridico',
                title: 'Avaliação do risco reputacional e jurídico para a equipe de instrução',
                prompt: 'Existe clareza sobre os limites da atuação dos instrutores? A equipe compreende que determinadas condutas, mesmo sem intenção, podem configurar assédio?',
            },
            {
                id: 'riscos_subnotificacao',
                title: 'Risco de subnotificação: ambiente que inibe denúncias',
                prompt: 'O ambiente de instrução é percebido pelas recrutas como seguro para denunciar? Há sinais de que denúncias são desencorajadas, minimizadas ou expostas?',
            },
            {
                id: 'riscos_tratamento_desigual',
                title: 'Risco de tratamento desigual percebido como discriminação',
                prompt: 'As diferenças de tratamento entre recrutas masculinos e femininos são explicadas institucionalmente? Há risco de que sejam lidas como privilégio ou discriminação por qualquer das partes?',
            },
            {
                id: 'riscos_abertura_mudancas',
                title: 'Abertura para mudanças e adaptações do processo',
                prompt: 'A liderança demonstra flexibilidade para ajustar práticas com base nos aprendizados do SMIF?',
            },
            {
                id: 'riscos_participacao_boas_praticas',
                title: 'Participação ativa no ciclo de boas práticas',
                prompt: 'A equipe engajou com qualidade nas atividades propostas? Trouxe reflexões genuínas?',
            },
            {
                id: 'riscos_valorizacao_presenca_feminina',
                title: 'Valorização da presença feminina na instrução e na formação',
                prompt: 'Há reconhecimento genuíno, e não apenas formal, da importância deste momento histórico?',
            },
        ],
    },
];
//# sourceMappingURL=mission-checklist.constants.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCpcaCaseDto = exports.CPCA_RETALIATION_AGAINST_OPTIONS = exports.CPCA_RETALIATION_REPORTED_OPTIONS = exports.CPCA_PROCEDURE_CURRENT_SITUATIONS = exports.CPCA_ADMIN_PROCEDURES = exports.CPCA_OCCURRENCE_FORMS = exports.CPCA_HIERARCHICAL_RELATIONS = exports.CPCA_INCIDENT_FREQUENCIES = exports.CPCA_AGE_RANGES = exports.CPCA_OCCURRENCE_LOCATIONS = exports.CPCA_HARASSMENT_CONTEXTS = exports.CPCA_DETAILED_VIOLENCE_TYPES = exports.CPCA_GENDERS = exports.CPCA_PROCEDURE_TYPES = exports.CPCA_CASE_STATUSES = exports.CPCA_NOTIFIER_TYPES = exports.CPCA_COMPLAINT_TYPES = void 0;
const class_validator_1 = require("class-validator");
exports.CPCA_COMPLAINT_TYPES = ['MORAL', 'SEXUAL'];
exports.CPCA_NOTIFIER_TYPES = [
    'VITIMA',
    'TESTEMUNHA',
    'TERCEIRO',
];
exports.CPCA_CASE_STATUSES = [
    'RECEIVED',
    'PROTECTION_MEASURES',
    'PRELIMINARY_ANALYSIS',
    'PROCEDURE_DEFINED',
    'INVESTIGATION',
    'CONCLUDED',
    'ARCHIVED',
];
exports.CPCA_PROCEDURE_TYPES = [
    'NOT_DEFINED',
    'PATD',
    'SINDICANCIA',
    'PAD',
    'IPM',
    'BOLETIM_OCORRENCIA',
    'INQUERITO_CIVIL',
    'NAO_HOUVE',
    'INQUERITO_POLICIAL_COMUM',
    'NOTICIA_FATO',
    'CONSELHO_DISCIPLINA',
    'CONSELHO_JUSTIFICACAO',
];
exports.CPCA_GENDERS = ['MASCULINO', 'FEMININO', 'NAO_INFORMADO'];
exports.CPCA_DETAILED_VIOLENCE_TYPES = [
    'ASSEDIO_MORAL',
    'ASSEDIO_SEXUAL',
    'VIOLENCIA_DOMESTICA_FISICA',
    'VIOLENCIA_DOMESTICA_PSICOLOGICA',
    'VIOLENCIA_DOMESTICA_MORAL',
    'VIOLENCIA_DOMESTICA_PATRIMONIAL',
    'VIOLENCIA_DOMESTICA_SEXUAL',
];
exports.CPCA_HARASSMENT_CONTEXTS = ['PRESENCIAL', 'VIRTUAL'];
exports.CPCA_OCCURRENCE_LOCATIONS = [
    'INTERIOR_OM',
    'EVENTO_EXTERNO_RELACIONADO_TRABALHO',
    'EVENTO_EXTERNO_NAO_RELACIONADO_TRABALHO',
    'AMBIENTE_PESSOAL',
    'VIA_PUBLICA',
    'TRANSPORTE_PUBLICO',
    'TRANSPORTE_INSTITUCIONAL',
    'RESIDENCIA_ACUSADOR',
    'APLICATIVOS_MENSAGERIA',
    'EMAIL',
    'REUNIAO_ONLINE_TRABALHO',
    'REDES_SOCIAIS',
    'RESIDENCIA_VITIMA_NOTICIANTE',
];
exports.CPCA_AGE_RANGES = [
    '15_18',
    '19_25',
    '26_30',
    '31_35',
    '36_40',
    '41_45',
    '46_50',
    '51_55',
    'MAIOR_55',
];
exports.CPCA_INCIDENT_FREQUENCIES = [
    'UMA_VEZ',
    'DUAS_VEZES',
    'TRES_VEZES',
    'QUATRO_VEZES',
    'CINCO_VEZES',
    'MAIOR_CINCO',
];
exports.CPCA_HIERARCHICAL_RELATIONS = [
    'SUPERIOR_HIERARQUICO',
    'CHEFE_IMEDIATO',
    'SUBORDINADO',
    'SUBORDINADO_DIRETO',
    'MESMA_GRADUACAO',
    'INSTRUTOR_PROFESSOR',
    'ALUNO',
    'PRESTADOR_SERVICO',
    'CONJUGE',
    'OUTROS',
    'CIVIL',
    'CONJUGE_MILITAR',
    'FAMILIAR',
];
exports.CPCA_OCCURRENCE_FORMS = [
    'HUMILHACAO_PUBLICA',
    'EXCLUSAO_ISOLAMENTO',
    'AMEACAS_INTIMIDACAO',
    'CRITICAS_EXCESSIVAS',
    'INJUSTICAS',
    'COMENTARIOS_SEXISTAS',
    'CONTATO_FISICO_INDESEJADO',
    'TENTATIVA_CONTATO_FISICO_INDEVIDO',
    'CHANTAGEM_INTIMIDACAO_FAVOR_SEXUAL',
    'VIOLENCIA_FISICA',
    'VIOLENCIA_PSICOLOGICA',
    'VIOLENCIA_PATRIMONIAL',
    'OUTROS',
    'VIOLENCIA_SEXUAL',
    'VIOLENCIA_MORAL',
    'VIGILANCIA_EXCESSIVA',
    'EXIBICAO_MATERIAL_PORNOGRAFICO',
];
exports.CPCA_ADMIN_PROCEDURES = [
    'SINDICANCIA',
    'IPM',
    'PATD',
    'PAD',
    'BOLETIM_OCORRENCIA',
    'INQUERITO_CIVIL',
    'NAO_HOUVE',
    'INQUERITO_POLICIAL_COMUM',
    'NOTICIA_FATO',
    'CONSELHO_DISCIPLINA',
    'CONSELHO_JUSTIFICACAO',
];
exports.CPCA_PROCEDURE_CURRENT_SITUATIONS = [
    'EM_ANDAMENTO',
    'MEDIDA_DISCIPLINAR_APLICADA',
    'OFERECIDA_DENUNCIA',
    'ARQUIVADO_PELA_JUSTICA',
    'CONDENADO_PELA_JUSTICA',
    'TRANSFERENCIA_ACUSADO',
    'TRANSFERENCIA_ACUSADOR',
    'MEDIDA_PROTETIVA',
    'OUTROS',
    'NAO_APLICAVEL',
];
exports.CPCA_RETALIATION_REPORTED_OPTIONS = [
    'SIM',
    'NAO',
    'NAO_INFORMADO',
];
exports.CPCA_RETALIATION_AGAINST_OPTIONS = [
    'VITIMA',
    'TESTEMUNHAS',
    'SINDICANTE',
    'ENCARREGADO_INQUERITO',
    'NAO_OCORREU_RETALIACAO',
];
class CreateCpcaCaseDto {
    omId;
    localityId;
    complaintType;
    notifierType;
    status;
    procedureType;
    incidentDate;
    aggressorRank;
    aggressorGender;
    aggressorAgeRange;
    victimRank;
    victimGender;
    victimAgeRange;
    detailedViolenceType;
    harassmentContext;
    occurrenceLocation;
    incidentFrequency;
    hierarchicalFunctionalRelation;
    occurrenceForm;
    administrativeProcedure;
    procedureCurrentSituation;
    retaliationReported;
    retaliationAgainst;
    evidenceCount;
    evidenceSummary;
    confidentialityTermSigned;
    confidentialityHandlingNotes;
    cpcaMembersExcludedFromInquiry;
    immediateProtectionMeasures;
    privateSupportActions;
    psychologicalSupportProvided;
    medicalSupportProvided;
    socialSupportProvided;
    legalSupportProvided;
    contactRestrictionApplied;
    preliminaryAnalysis;
    preliminaryReportGenerated;
    preliminaryReportDate;
    procedureReference;
    procedureNotes;
    womenLedHandlingPrioritized;
    victimAccusedSeparationEvaluated;
    victimAccusedSeparationApplied;
    accusedDefenseEnsured;
    outcomeSummary;
    notifierFeedbackSummary;
    victimFeedbackSummary;
    notifierFeedbackDate;
    victimFeedbackDate;
    retaliationRisk;
    retaliationNotes;
    outsourcedAccused;
    contractorReferralDate;
    contractorFollowUpNotes;
}
exports.CreateCpcaCaseDto = CreateCpcaCaseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "omId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "localityId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.CPCA_COMPLAINT_TYPES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "complaintType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_NOTIFIER_TYPES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "notifierType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_CASE_STATUSES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_PROCEDURE_TYPES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "procedureType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "incidentDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "aggressorRank", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.CPCA_GENDERS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "aggressorGender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_AGE_RANGES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "aggressorAgeRange", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "victimRank", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.CPCA_GENDERS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "victimGender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_AGE_RANGES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "victimAgeRange", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_DETAILED_VIOLENCE_TYPES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "detailedViolenceType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_HARASSMENT_CONTEXTS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "harassmentContext", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_OCCURRENCE_LOCATIONS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "occurrenceLocation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_INCIDENT_FREQUENCIES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "incidentFrequency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_HIERARCHICAL_RELATIONS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "hierarchicalFunctionalRelation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_OCCURRENCE_FORMS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "occurrenceForm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_ADMIN_PROCEDURES),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "administrativeProcedure", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_PROCEDURE_CURRENT_SITUATIONS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "procedureCurrentSituation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_RETALIATION_REPORTED_OPTIONS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "retaliationReported", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CPCA_RETALIATION_AGAINST_OPTIONS),
    __metadata("design:type", Object)
], CreateCpcaCaseDto.prototype, "retaliationAgainst", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateCpcaCaseDto.prototype, "evidenceCount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "evidenceSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "confidentialityTermSigned", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "confidentialityHandlingNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "cpcaMembersExcludedFromInquiry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "immediateProtectionMeasures", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "privateSupportActions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "psychologicalSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "medicalSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "socialSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "legalSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "contactRestrictionApplied", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "preliminaryAnalysis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "preliminaryReportGenerated", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "preliminaryReportDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "procedureReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "procedureNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "womenLedHandlingPrioritized", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "victimAccusedSeparationEvaluated", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "victimAccusedSeparationApplied", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "accusedDefenseEnsured", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "outcomeSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "notifierFeedbackSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "victimFeedbackSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "notifierFeedbackDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "victimFeedbackDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "retaliationRisk", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "retaliationNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCpcaCaseDto.prototype, "outsourcedAccused", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "contractorReferralDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateCpcaCaseDto.prototype, "contractorFollowUpNotes", void 0);
//# sourceMappingURL=create-cpca-case.dto.js.map
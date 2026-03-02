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
exports.UpdateCpcaCaseDto = void 0;
const class_validator_1 = require("class-validator");
const create_cpca_case_dto_1 = require("./create-cpca-case.dto");
class UpdateCpcaCaseDto {
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
    archivedAt;
    statusChangeNote;
}
exports.UpdateCpcaCaseDto = UpdateCpcaCaseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "omId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "localityId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_COMPLAINT_TYPES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "complaintType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_NOTIFIER_TYPES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "notifierType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_CASE_STATUSES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_PROCEDURE_TYPES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "procedureType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "incidentDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "aggressorRank", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_GENDERS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "aggressorGender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_AGE_RANGES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "aggressorAgeRange", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "victimRank", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_GENDERS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "victimGender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_AGE_RANGES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "victimAgeRange", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_DETAILED_VIOLENCE_TYPES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "detailedViolenceType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_HARASSMENT_CONTEXTS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "harassmentContext", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_OCCURRENCE_LOCATIONS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "occurrenceLocation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_INCIDENT_FREQUENCIES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "incidentFrequency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_HIERARCHICAL_RELATIONS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "hierarchicalFunctionalRelation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_OCCURRENCE_FORMS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "occurrenceForm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_ADMIN_PROCEDURES),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "administrativeProcedure", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_PROCEDURE_CURRENT_SITUATIONS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "procedureCurrentSituation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_RETALIATION_REPORTED_OPTIONS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "retaliationReported", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(create_cpca_case_dto_1.CPCA_RETALIATION_AGAINST_OPTIONS),
    __metadata("design:type", Object)
], UpdateCpcaCaseDto.prototype, "retaliationAgainst", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateCpcaCaseDto.prototype, "evidenceCount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "evidenceSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "confidentialityTermSigned", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "confidentialityHandlingNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "cpcaMembersExcludedFromInquiry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "immediateProtectionMeasures", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "privateSupportActions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "psychologicalSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "medicalSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "socialSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "legalSupportProvided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "contactRestrictionApplied", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "preliminaryAnalysis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "preliminaryReportGenerated", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "preliminaryReportDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "procedureReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "procedureNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "womenLedHandlingPrioritized", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "victimAccusedSeparationEvaluated", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "victimAccusedSeparationApplied", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "accusedDefenseEnsured", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "outcomeSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "notifierFeedbackSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "victimFeedbackSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "notifierFeedbackDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "victimFeedbackDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "retaliationRisk", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "retaliationNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCpcaCaseDto.prototype, "outsourcedAccused", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "contractorReferralDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "contractorFollowUpNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "archivedAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1200),
    __metadata("design:type", String)
], UpdateCpcaCaseDto.prototype, "statusChangeNote", void 0);
//# sourceMappingURL=update-cpca-case.dto.js.map
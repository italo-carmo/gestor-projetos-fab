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
exports.UpsertLdapUserDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const trimText = ({ value }) => typeof value === 'string' ? value.trim() : value;
const trimUuidNullable = ({ value }) => {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};
class UpsertLdapUserDto {
    uid;
    roleId;
    replaceExistingRoles;
    localityId;
    specialtyId;
    eloRoleId;
}
exports.UpsertLdapUserDto = UpsertLdapUserDto;
__decorate([
    (0, class_transformer_1.Transform)(trimText),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", String)
], UpsertLdapUserDto.prototype, "uid", void 0);
__decorate([
    (0, class_transformer_1.Transform)(trimText),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", String)
], UpsertLdapUserDto.prototype, "roleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertLdapUserDto.prototype, "replaceExistingRoles", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimUuidNullable),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", Object)
], UpsertLdapUserDto.prototype, "localityId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimUuidNullable),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", Object)
], UpsertLdapUserDto.prototype, "specialtyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimUuidNullable),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", Object)
], UpsertLdapUserDto.prototype, "eloRoleId", void 0);
//# sourceMappingURL=upsert-ldap-user.dto.js.map
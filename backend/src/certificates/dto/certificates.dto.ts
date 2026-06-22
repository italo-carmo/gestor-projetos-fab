export type CertificateQuestionDto = {
  id?: string;
  label: string;
  type: 'TEXT' | 'MULTIPLE_CHOICE' | 'CHECKBOXES';
  required?: boolean;
  options?: string[];
};

export class CreateCertificateTemplateDto {
  name!: string;
  description?: string | null;
  layoutJson!: Record<string, unknown>;
  isActive?: boolean;
}

export class UpdateCertificateTemplateDto {
  name?: string;
  description?: string | null;
  layoutJson?: Record<string, unknown>;
  isActive?: boolean;
}

export class CreateCertificateEventDto {
  name!: string;
  location!: string;
  eventDate!: string;
  eventTime!: string;
  description?: string | null;
  certificateTemplateId?: string | null;
}

export class UpdateCertificateEventDto {
  name?: string;
  location?: string;
  eventDate?: string;
  eventTime?: string;
  description?: string | null;
  certificateTemplateId?: string | null;
}

export class UpdateCertificateFormDto {
  formTitle?: string | null;
  formDescription?: string | null;
  formIsPublished?: boolean;
  questions?: CertificateQuestionDto[];
}

export class SubmitCertificateFormDto {
  fullName!: string;
  email!: string;
  answers?: Record<string, unknown>;
}

export class SendCertificateEmailsDto {
  responseIds?: string[];
}

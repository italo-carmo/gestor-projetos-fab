import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateCpcaCaseDto,
  CPCA_DETAILED_VIOLENCE_TYPES,
  CPCA_PROCEDURE_CURRENT_SITUATIONS,
  CPCA_SELECTABLE_DETAILED_VIOLENCE_TYPES,
} from './create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './update-cpca-case.dto';

describe('vítimas do reporte', () => {
  const base = {
    complaintType: 'MORAL',
    aggressorRank: '1S',
    aggressorGender: 'MASCULINO',
    victimRank: '2S',
    victimGender: 'FEMININO',
  };
  const victim = {
    id: 'v1',
    victimRank: '2S',
    victimGender: 'FEMININO',
    victimAgeRange: '19_25',
    incidentFrequency: 'DUAS_VEZES',
    hierarchicalFunctionalRelation: 'MESMA_GRADUACAO',
    occurrenceForms: ['HUMILHACAO_PUBLICA'],
    isNotifier: true,
  };
  it('aceita várias vítimas com perfis e ocorrências próprias', async () => {
    const dto = plainToInstance(CreateCpcaCaseDto, {
      ...base,
      victims: [
        victim,
        {
          ...victim,
          id: 'v2',
          victimGender: 'MASCULINO',
          incidentFrequency: 'UMA_VEZ',
          isNotifier: false,
        },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
  });
  it.each([
    { victimGender: 'INVALIDO' },
    { victimAgeRange: 'INVALIDO' },
    { incidentFrequency: 'INVALIDO' },
    { hierarchicalFunctionalRelation: 'INVALIDO' },
    { occurrenceForms: ['INVALIDO'] },
    { isNotifier: 'sim' },
  ])('valida também os campos da segunda vítima: %j', async (invalid) => {
    const dto = plainToInstance(CreateCpcaCaseDto, {
      ...base,
      victims: [victim, { ...victim, id: 'v2', isNotifier: false, ...invalid }],
    });
    expect(
      (await validate(dto)).some(
        (error) => error.property === 'victims' && error.children?.length,
      ),
    ).toBe(true);
  });
  it('rejeita uma lista vazia de vítimas', async () => {
    expect(
      (
        await validate(
          plainToInstance(CreateCpcaCaseDto, { ...base, victims: [] }),
        )
      ).some((error) => error.property === 'victims'),
    ).toBe(true);
  });
  it.each([CreateCpcaCaseDto, UpdateCpcaCaseDto])(
    'preserva e valida vítimas ao passar pela validação HTTP: %p',
    async (Dto) => {
      const pipe = new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      });
      const victims = [victim, { ...victim, id: 'v2', isNotifier: false }];
      const result = await pipe.transform(
        { ...base, victims },
        { type: 'body', metatype: Dto },
      );
      expect(result.victims).toEqual(victims);
      await expect(
        pipe.transform(
          {
            ...base,
            victims: [
              victim,
              { ...victim, id: 'v2', incidentFrequency: 'INVALIDO' },
            ],
          },
          { type: 'body', metatype: Dto },
        ),
      ).rejects.toThrow();
      await expect(
        pipe.transform(
          { ...base, victims: [] },
          { type: 'body', metatype: Dto },
        ),
      ).rejects.toThrow();
    },
  );
});

describe('CPCA_DETAILED_VIOLENCE_TYPES', () => {
  it('inclui os novos tipos de violencia aceitos nas denuncias CPCA e SMIF', () => {
    expect(CPCA_DETAILED_VIOLENCE_TYPES).toContain(
      'VIOLENCIA_DOMESTICA_VICARIA',
    );
    expect(CPCA_DETAILED_VIOLENCE_TYPES).toContain('DISCRIMINACAO');
    expect(CPCA_DETAILED_VIOLENCE_TYPES).not.toContain('HOMOFOBIA');
  });

  it('limita as novas opções à natureza do relato definida para CPCA e SMIF', () => {
    expect(CPCA_SELECTABLE_DETAILED_VIOLENCE_TYPES).toEqual([
      'ASSEDIO_MORAL',
      'ASSEDIO_SEXUAL',
      'VIOLENCIA_DOMESTICA_FISICA',
      'VIOLENCIA_DOMESTICA_PSICOLOGICA',
      'VIOLENCIA_DOMESTICA_MORAL',
      'VIOLENCIA_DOMESTICA_PATRIMONIAL',
      'VIOLENCIA_DOMESTICA_SEXUAL',
      'VIOLENCIA_DOMESTICA_VICARIA',
      'IMPORTUNACAO_SEXUAL',
      'DISCRIMINACAO',
    ]);
  });
});

describe('CPCA_PROCEDURE_CURRENT_SITUATIONS', () => {
  it('expõe somente os resultados atuais da triagem e apuração', () => {
    expect(CPCA_PROCEDURE_CURRENT_SITUATIONS).toContain(
      'ARQUIVADO_PELA_ADMINISTRACAO',
    );
    expect(CPCA_PROCEDURE_CURRENT_SITUATIONS).not.toContain('EM_ANDAMENTO');
    expect(CPCA_PROCEDURE_CURRENT_SITUATIONS).not.toContain(
      'TRANSFERENCIA_ACUSADO',
    );
    expect(CPCA_PROCEDURE_CURRENT_SITUATIONS).not.toContain(
      'TRANSFERENCIA_ACUSADOR',
    );
    expect(CPCA_PROCEDURE_CURRENT_SITUATIONS).not.toContain('MEDIDA_PROTETIVA');
  });
});

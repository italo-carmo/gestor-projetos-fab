import path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL ?? 'postgresql://smif:smif@localhost:5432/smif_gestao';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PT_PREPOSITIONS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd']);
const ROMAN_NUMERALS = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/;
const TOKEN_REGEX = /[0-9A-Za-zÀ-ÖØ-öø-ÿ]+/g;

const STATIC_ACRONYMS = [
  'GSD',
  'TI',
  'SMIF',
  'CIPAVD',
  'CPCA',
  'SSO',
  'QOCON',
  'QSS',
  'SAD',
  'AQV',
  'SGS',
  'SJU',
  'OM',
  'EB',
  'FAB',
  'INF',
  'MAJ',
  'CAP',
  'TEN',
  'SGT',
  'SO',
  'RJ',
  'SP',
  'MG',
  'DF',
  'GO',
  'RS',
  'PR',
  'SC',
  'CE',
  'BA',
  'RN',
  'AM',
  'PA',
  'MA',
  'PE',
  'RE',
  'AL',
  'AP',
  'AC',
  'RO',
  'RR',
  'TO',
  'PI',
  'PB',
  'SE',
  'ES',
  'MT',
  'MS',
];

function hasCamelCase(value: string) {
  return /[a-zà-ÿ][A-ZÀ-Ý]/.test(value);
}

function capitalizeWord(value: string) {
  const lower = value.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

function normalizeToken(token: string, isFirstWord: boolean, acronyms: Set<string>): string {
  if (!token) return token;
  if (hasCamelCase(token)) {
    const split = token.replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, '$1 $2').split(/\s+/).filter(Boolean);
    const expanded: string[] = [];
    for (let index = 0; index < split.length; index += 1) {
      const current = split[index];
      const lowerCurrent = current.toLocaleLowerCase('pt-BR');
      const hasNext = index < split.length - 1;

      if (
        hasNext &&
        lowerCurrent.length > 3 &&
        (lowerCurrent.endsWith('de') ||
          lowerCurrent.endsWith('da') ||
          lowerCurrent.endsWith('do') ||
          lowerCurrent.endsWith('dos') ||
          lowerCurrent.endsWith('das'))
      ) {
        const separator = lowerCurrent.endsWith('das')
          ? 'das'
          : lowerCurrent.endsWith('dos')
            ? 'dos'
            : lowerCurrent.endsWith('de')
              ? 'de'
              : lowerCurrent.endsWith('da')
                ? 'da'
                : 'do';
        expanded.push(current.slice(0, current.length - separator.length), separator);
      } else {
        expanded.push(current);
      }
    }

    return expanded
      .map((part, index) => normalizeToken(part, isFirstWord && index === 0, acronyms))
      .join(' ');
  }

  const upper = token.toLocaleUpperCase('pt-BR');
  const lower = token.toLocaleLowerCase('pt-BR');

  if (/\d/.test(token)) return upper;
  if (acronyms.has(upper)) return upper;
  if (ROMAN_NUMERALS.test(upper)) return upper;
  if (!isFirstWord && PT_PREPOSITIONS.has(lower)) return lower;

  return capitalizeWord(token);
}

function normalizeLabel(value: string | null | undefined, acronyms: Set<string>): string | null | undefined {
  if (!value) return value;
  const compact = value.trim().replace(/\s+/g, ' ');
  if (!compact) return compact;

  let wordIndex = 0;
  const normalized = compact.replace(TOKEN_REGEX, (token) => {
    const next = normalizeToken(token, wordIndex === 0, acronyms);
    const producedWords = next.split(/\s+/).filter(Boolean).length || 1;
    wordIndex += producedWords;
    return next;
  });

  return normalized.replace(/\s+/g, ' ').trim();
}

async function buildAcronyms() {
  const [localities, eloRoles, postos] = await prisma.$transaction([
    prisma.locality.findMany({ select: { code: true } }),
    prisma.eloRole.findMany({ select: { code: true } }),
    prisma.posto.findMany({ select: { code: true } }),
  ]);

  const acronyms = new Set(STATIC_ACRONYMS.map((entry) => entry.toLocaleUpperCase('pt-BR')));

  for (const collection of [localities, eloRoles, postos]) {
    for (const item of collection) {
      if (!item.code) continue;
      item.code
        .split(/[^A-Za-z0-9]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => part.length <= 4)
        .forEach((part) => acronyms.add(part.toLocaleUpperCase('pt-BR')));
    }
  }

  return acronyms;
}

async function normalizeUsers(acronyms: Set<string>) {
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
  });

  let changed = 0;
  for (const user of users) {
    const nextName = normalizeLabel(user.name, acronyms);
    if (!nextName || nextName === user.name) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: { name: nextName },
    });
    changed += 1;
  }

  return changed;
}

async function normalizeLocalities(acronyms: Set<string>) {
  const localities = await prisma.locality.findMany({
    select: {
      id: true,
      name: true,
      commandName: true,
      commanderName: true,
    },
  });

  let changed = 0;
  for (const locality of localities) {
    const nextName = normalizeLabel(locality.name, acronyms);
    const nextCommandName = normalizeLabel(locality.commandName, acronyms) ?? null;
    const nextCommanderName = normalizeLabel(locality.commanderName, acronyms) ?? null;

    if (
      nextName === locality.name &&
      nextCommandName === locality.commandName &&
      nextCommanderName === locality.commanderName
    ) {
      continue;
    }

    await prisma.locality.update({
      where: { id: locality.id },
      data: {
        name: nextName ?? locality.name,
        commandName: nextCommandName,
        commanderName: nextCommanderName,
      },
    });
    changed += 1;
  }

  return changed;
}

async function normalizeSpecialties(acronyms: Set<string>) {
  const specialties = await prisma.specialty.findMany({
    select: { id: true, name: true },
  });

  let changed = 0;
  for (const specialty of specialties) {
    const nextName = normalizeLabel(specialty.name, acronyms);
    if (!nextName || nextName === specialty.name) continue;
    await prisma.specialty.update({
      where: { id: specialty.id },
      data: { name: nextName },
    });
    changed += 1;
  }

  return changed;
}

async function normalizeEloRoles(acronyms: Set<string>) {
  const roles = await prisma.eloRole.findMany({
    select: { id: true, name: true },
  });

  let changed = 0;
  for (const role of roles) {
    const nextName = normalizeLabel(role.name, acronyms);
    if (!nextName || nextName === role.name) continue;
    await prisma.eloRole.update({
      where: { id: role.id },
      data: { name: nextName },
    });
    changed += 1;
  }

  return changed;
}

async function normalizeElos(acronyms: Set<string>) {
  const elos = await prisma.elo.findMany({
    select: { id: true, name: true, om: true },
  });

  let changed = 0;
  for (const elo of elos) {
    const nextName = normalizeLabel(elo.name, acronyms);
    const nextOm = normalizeLabel(elo.om, acronyms) ?? null;

    if (nextName === elo.name && nextOm === elo.om) continue;

    await prisma.elo.update({
      where: { id: elo.id },
      data: {
        name: nextName ?? elo.name,
        om: nextOm,
      },
    });
    changed += 1;
  }

  return changed;
}

async function normalizePostos(acronyms: Set<string>) {
  const postos = await prisma.posto.findMany({
    select: { id: true, name: true },
  });

  let changed = 0;
  for (const posto of postos) {
    const nextName = normalizeLabel(posto.name, acronyms);
    if (!nextName || nextName === posto.name) continue;
    await prisma.posto.update({
      where: { id: posto.id },
      data: { name: nextName },
    });
    changed += 1;
  }

  return changed;
}

async function main() {
  const acronyms = await buildAcronyms();

  const [users, localities, specialties, eloRoles, elos, postos] = await Promise.all([
    normalizeUsers(acronyms),
    normalizeLocalities(acronyms),
    normalizeSpecialties(acronyms),
    normalizeEloRoles(acronyms),
    normalizeElos(acronyms),
    normalizePostos(acronyms),
  ]);

  const total = users + localities + specialties + eloRoles + elos + postos;
  console.log(
    JSON.stringify(
      {
        users,
        localities,
        specialties,
        eloRoles,
        elos,
        postos,
        total,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

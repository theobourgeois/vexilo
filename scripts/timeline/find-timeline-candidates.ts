import 'dotenv/config';

import { writeFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

import {
  isHistoricalVersion,
  lineageKey as baseName,
  timelineKey,
  normalizeName as normalize,
  stripFormalPrefix as stripFormal,
} from '../../src/lib/timeline/flag-names';

/**
 * Finds the flags worth giving a history timeline: countries, first-level subdivisions, and any flag
 * whose earlier versions are already in the catalogue. Read-only.
 *
 * Usage:
 *   tsx scripts/timeline/find-timeline-candidates.ts
 *   tsx scripts/timeline/find-timeline-candidates.ts --samples 40 --out /tmp/timeline-candidates.json
 */

type Row = {
  id: string;
  name: string;
  tags: string[];
  aiTags: string[] | null;
  periodTags: string[] | null;
  historyLength: number;
};

type Reason = 'country' | 'subdivision' | 'lineage';

const args = process.argv.slice(2);
const option = (key: string) => {
  const index = args.indexOf(key);
  return index === -1 ? undefined : args[index + 1];
};
const sampleSize = Number(option('--samples') ?? 25);
const outPath = option('--out');

// ─── Countries and territories, from the ISO 3166-1 region names built into Intl ───

// Groupings, private-use codes, and retired or reserved codes (SU and UK would otherwise shadow RU and GB).
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ', 'AQ', 'SU', 'UK', 'ZR', 'CP', 'DG', 'EA', 'IC', 'TA', 'AC']);
const ALIASES: Record<string, string[]> = {
  US: ['united states of america', 'usa'],
  CN: ["people's republic of china", 'prc'],
  TW: ['republic of china', 'roc', 'republic of china (taiwan)'],
  IR: ['islamic republic of iran', 'persia'],
  SY: ['syrian arab republic'],
  AF: ['islamic emirate of afghanistan', 'islamic republic of afghanistan'],
  RU: ['russian federation'],
  LA: ['lao pdr', "lao people's democratic republic"],
  VN: ['socialist republic of vietnam'],
  GB: ['united kingdom of great britain and northern ireland', 'great britain', 'uk'],
  CZ: ['czech republic'],
  CI: ['ivory coast', 'cote d’ivoire', "cote d'ivoire", "côte d'ivoire"],
  MM: ['myanmar', 'burma'],
  CD: ['democratic republic of the congo', 'dr congo', 'congo-kinshasa'],
  CG: ['republic of the congo', 'congo', 'congo-brazzaville'],
  HK: ['hong kong'],
  AX: ['aland'],
  VC: ['saint vincent and the grenadines'],
  MO: ['macau', 'macao'],
  PS: ['palestine'],
  KP: ['north korea'],
  KR: ['south korea'],
  VA: ['vatican city', 'holy see'],
  TR: ['turkey', 'türkiye'],
  SZ: ['swaziland', 'eswatini'],
  MK: ['north macedonia', 'macedonia'],
  CV: ['cape verde'],
  TL: ['east timor', 'timor-leste'],
  FM: ['micronesia', 'federated states of micronesia'],
  BS: ['bahamas'],
  GM: ['gambia'],
  XK: ['kosovo'],
};

function countryNames() {
  const display = new Intl.DisplayNames(['en'], { type: 'region' });
  const names = new Map<string, string>();
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (NOT_COUNTRIES.has(code)) continue;
      const name = display.of(code);
      if (!name || name === code) continue;
      names.set(normalize(name), code);
      // "Myanmar (Burma)", "Congo - Kinshasa", "Hong Kong SAR China"
      names.set(normalize(name.replace(/\s*\(.*\)|\s+SAR China/g, '')), code);
    }
  }
  for (const [code, aliases] of Object.entries(ALIASES)) for (const alias of aliases) names.set(normalize(alias), code);
  return names;
}

// ─── Exclusions: fiction, games, proposals, military ranks, parties and other non-places ───

const EXCLUDED_TAGS = new Set(
  ['fictional', 'hoi4', 'tno', 'tfr', 'saa', 'proposal', 'unofficial', 'what', 'military', 'military flag', 'war flag', 'terrorist', 'jihad', 'political', 'meme', 'alternate history'].map((t) => t.toLowerCase()),
);
const EXCLUDED_NAME =
  /propos|fiction|concept|redesign|alternat|fantasy|minecraft|hoi4|\bmeme\b|\b(army|navy|naval|air force|corps|guard|general|admiral|captain|colonel|commander|chief|president|governor|minister|ensign|jack|standard|burgee|yacht|party|movement|front|brigade|battalion|regiment|division|militia|club|union of|association|people$)\b/i;

// ─── Subdivisions: AI tags, user tags, and name patterns ───

const SUBDIVISION_TAGS = new Set(
  ['us_state', 'state_flag', 'provincial', 'regional', 'canton', 'province', 'prefecture', 'state', 'oblast', 'subdivision', 'region'].map((t) => t.toLowerCase()),
);
const SUBDIVISION_NAME =
  /\b(province|prefecture|state|oblast|krai|governorate|voivodeship|canton|county|region|department|departamento|emirate|län|amt|land)\b/i;

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    select f.id, f.name, f.tags,
      m.tags_draft as "aiTags",
      array(select jsonb_array_elements_text(m.structured_data->'periodTags')) as "periodTags",
      length(coalesce(m.historical_context, ''))::int as "historyLength"
    from vexilo_flag f
    left join vexilo_flag_ai_metadata m on m.flag_id = f.id
  `) as Row[];

  const countries = countryNames();
  // Falls back to the name without its remaining parentheticals: "the United Kingdom (3-5)", "Mayotte (Local)".
  const countryCode = (key: string) => {
    const bare = key.replace(/\s*\([^)]*\)/g, '').trim();
    return countries.get(key) ?? countries.get(stripFormal(key)) ?? countries.get(bare) ?? countries.get(stripFormal(bare));
  };

  const lower = (list: string[] | null) => (list ?? []).map((t) => t.toLowerCase());
  const isExcluded = (row: Row) =>
    [...lower(row.tags), ...lower(row.aiTags)].some((t) => EXCLUDED_TAGS.has(t)) || EXCLUDED_NAME.test(row.name);

  // Group every flag by its base name so "Libya", "Libya (1972–1977)" and "Libya (1977–2011)" form one lineage.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = timelineKey(row.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const lineageKeys = new Set(
    [...groups].filter(([, members]) => members.length >= 2 && members.some((m) => isHistoricalVersion(m.name))).map(([key]) => key),
  );

  const reasons = new Map<string, Set<Reason>>();
  const add = (row: Row, reason: Reason) => {
    const set = reasons.get(row.id) ?? new Set<Reason>();
    set.add(reason);
    reasons.set(row.id, set);
  };

  let excludedCount = 0;
  for (const row of rows) {
    if (isExcluded(row)) {
      excludedCount++;
      continue;
    }
    const key = baseName(row.name);
    const tags = [...lower(row.tags), ...lower(row.aiTags)];

    // Countries: the base name is a country, or the AI tagged it national. Historical versions count too.
    if (countryCode(key) || tags.includes('national') || tags.includes('un member')) add(row, 'country');
    // Ignore parentheticals so "Omutninsk (Kirov oblast)", a town, isn't read as an oblast.
    const bareName = row.name.replace(/\s*\([^)]*\)/g, '');
    if (tags.some((t) => SUBDIVISION_TAGS.has(t)) || SUBDIVISION_NAME.test(bareName)) add(row, 'subdivision');
    if (lineageKeys.has(timelineKey(row.name))) add(row, 'lineage');
  }

  const candidates = rows.filter((row) => reasons.has(row.id));
  const count = (reason: Reason) => candidates.filter((row) => reasons.get(row.id)!.has(reason)).length;
  const current = candidates.filter((row) => !isHistoricalVersion(row.name));
  const withHistory = candidates.filter((row) => row.historyLength > 0);
  const countryCodesHit = new Set(
    candidates.filter((r) => !isHistoricalVersion(r.name)).map((r) => countryCode(baseName(r.name))).filter(Boolean),
  );

  console.log(`Flags in catalogue          ${rows.length}`);
  console.log(`Excluded (fiction, military, proposals, parties…) ${excludedCount}`);
  console.log(`Timeline candidates         ${candidates.length}`);
  console.log(`  current flags             ${current.length}   (no year in the name; these get the timeline)`);
  console.log(`  historical versions       ${candidates.length - current.length}   (dated versions that feed a timeline)`);
  console.log(`  already have history text ${withHistory.length}`);
  console.log(`By reason (a flag can have several):`);
  console.log(`  country                   ${count('country')}   (${countryCodesHit.size} distinct current countries/territories matched)`);
  console.log(`  subdivision               ${count('subdivision')}`);
  console.log(`  lineage                   ${count('lineage')}   in ${lineageKeys.size} lineages`);

  const currentWith = (reason: Reason) => current.filter((row) => reasons.get(row.id)!.has(reason)).length;
  console.log(`Current flags by reason:`);
  console.log(`  country                   ${currentWith('country')}`);
  console.log(`  subdivision only          ${current.filter((row) => [...reasons.get(row.id)!].join() === 'subdivision').length}`);
  console.log(`  has older versions here   ${currentWith('lineage')}   (timeline can link versions we already have)`);

  const lineageSizes = [...lineageKeys].map((k) => groups.get(k)!.length).sort((a, b) => b - a);
  console.log(`Biggest lineages: ${[...lineageKeys].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length).slice(0, 12).map((k) => `${k} (${groups.get(k)!.length})`).join(', ')}`);
  console.log(`Lineages with 3+ versions: ${lineageSizes.filter((n) => n >= 3).length}`);

  const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5);
  for (const reason of ['country', 'subdivision', 'lineage'] as Reason[]) {
    const sample = shuffle(candidates.filter((row) => reasons.get(row.id)!.has(reason))).slice(0, sampleSize);
    console.log(`\nSample · ${reason}:\n  ${sample.map((row) => row.name).join('\n  ')}`);
  }
  const missedCountries = [...new Set(countries.values())].filter((code) => !countryCodesHit.has(code));
  console.log(`\nCountry codes with no current flag matched (${missedCountries.length}): ${missedCountries.join(' ')}`);

  if (outPath) {
    writeFileSync(
      outPath,
      JSON.stringify(candidates.map((row) => ({ id: row.id, name: row.name, reasons: [...reasons.get(row.id)!], lineage: baseName(row.name) })), null, 2),
    );
    console.log(`\nWrote ${candidates.length} candidates to ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

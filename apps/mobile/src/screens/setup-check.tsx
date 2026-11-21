import {
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appConfig } from '@/config';
import { signupSchema } from '@shared/auth-validation';
import { contestPhase, slugify } from '@shared/contest';
import { parseFlagQuery } from '@shared/flag-search-terms';
import { puzzleNumber, seededRandom } from '@shared/games/daily';
import { generateGrid } from '@shared/games/grid';
import { searchCountries } from '@shared/games/pool';
import { flagHeadline, flagPath } from '@shared/seo';
import { normalizeName, parseYearSpan } from '@shared/timeline/flag-names';

// The website gets these exact values from the same code on Node. Hermes isn't
// Node, so this screen shows whether packages/shared behaves the same on the
// phone's engine (Unicode normalization, regexes, seeded randomness, zod).
const CHECKS: [label: string, actual: () => unknown, expected: string][] = [
  ['Headline', () => flagHeadline('Canada'), 'Flag of Canada'],
  [
    'Flag path',
    () => flagPath('Côte d’Ivoire'),
    '/flag/C%C3%B4te%20d%E2%80%99Ivoire',
  ],
  [
    'Slug',
    () => slugify('Côte d’Ivoire: Flag Redesign!'),
    'cote-d-ivoire-flag-redesign',
  ],
  [
    'Year span',
    () => JSON.stringify(parseYearSpan('Libya (1972–1977)')),
    '{"start":1972,"end":1977}',
  ],
  ['Name', () => normalizeName('São Tomé & Príncipe'), 'sao tome and principe'],
  [
    'Search query',
    () => {
      const { colors, traits } = parseFlagQuery('red and white with a cross');
      return JSON.stringify({ colors, traits });
    },
    '{"colors":["red","white"],"traits":["cross"]}',
  ],
  ['Puzzle number', () => puzzleNumber('2026-11-21'), '31'],
  ['Country search', () => searchCountries('cote')[0]?.name, 'Ivory Coast'],
  [
    'Vexigrid',
    () => JSON.stringify(generateGrid(seededRandom(42))),
    '{"rows":["colors:2","region:AS","color:k"],"cols":["trait:st","no:w","trait:hs"]}',
  ],
  [
    'Contest phase',
    () =>
      contestPhase(
        {
          published: true,
          startsAt: new Date('2026-11-01'),
          votingStartsAt: new Date('2026-11-15'),
          endsAt: new Date('2026-11-30'),
          announcedAt: null,
          winnerEntryId: null,
        },
        new Date('2026-11-21'),
      ),
    'voting',
  ],
  [
    'Sign-up (zod)',
    () =>
      signupSchema.safeParse({
        name: ' Ada ',
        email: ' Ada@Example.COM ',
        password: 'correct horse battery',
      }).data?.email,
    'ada@example.com',
  ],
];

function run(actual: () => unknown) {
  try {
    return String(actual());
  } catch (error) {
    return `threw ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function SetupCheck() {
  const dark = useColorScheme() === 'dark';
  const colors = dark
    ? { background: '#131416', text: '#ecebe7', subtle: '#b0afab' }
    : { background: '#f3f2ef', text: '#1b1c1f', subtle: '#56575c' };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Vexilo</Text>
        <Text style={[styles.detail, { color: colors.subtle }]}>
          Variant: {appConfig.variant}
        </Text>
        <Text style={[styles.detail, { color: colors.subtle }]}>
          API: {appConfig.apiUrl}
        </Text>

        <Text style={[styles.heading, { color: colors.text }]}>
          Shared code
        </Text>
        {CHECKS.map(([label, actual, expected]) => {
          const value = run(actual);
          const matches = value === expected;
          return (
            <View key={label} style={styles.row}>
              <Text style={[styles.label, { color: colors.subtle }]}>
                {label}
              </Text>
              <Text
                style={[styles.value, matches ? styles.match : styles.mismatch]}
              >
                {matches ? '✓' : `${value} (expected ${expected})`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  detail: { fontSize: 14 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 14 },
  value: { fontSize: 14, flexShrink: 1, textAlign: 'right' },
  match: { color: '#1f7a4d' },
  mismatch: { color: '#c0362c' },
});

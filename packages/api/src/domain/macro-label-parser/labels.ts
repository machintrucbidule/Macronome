// Line classification for the macro-label parser (spec/logic/macro-label-parser.md §3).
// Pure string logic: given one normalised (lowercased, accent-stripped) line, decide
// which macro its LEADING label denotes — or that it is a subset/non-macro line to skip.
// Taking the leading label (not "contains") is what lets a merged "Matières grasses dont
// 0,20 g" still read as fat while a "dont acides gras saturés" line is dropped.

export type MacroKind = 'energy' | 'fat' | 'carb' | 'protein';

// Subset breakdowns ("dont …"/"of which …") and non-macro nutrients. Checked FIRST so a
// saturates/sugars/mineral line never falls through to a macro.
const SKIP_PREFIXES = [
  'dont',
  'of which',
  'acides gras satur',
  'acide gras satur',
  'ag satur',
  'satur',
  'graisses satur',
  'graisse satur',
  'sucres',
  'sugars',
  'polyols',
  'amidon',
  'starch',
  'fibre',
  'fiber',
  'sel',
  'salt',
  'sodium',
  'sels mineraux',
  'mineraux',
  'minerals',
  'magnesium',
  'calcium',
  'potassium',
  'phosphore',
  'zinc',
  'fer',
  'iode',
  'vitamine',
  'vitamin',
  'mono',
  'poly',
  'omega',
  'cholesterol',
];

const ENERGY_PREFIXES = [
  'energie',
  'valeur energetique',
  'valeurs energetiques',
  'apport energetique',
  'energy',
  'calories',
];

const FAT_PREFIXES = [
  'matieres grasses',
  'matiere grasse',
  'lipides',
  'lipide',
  'graisses',
  'graisse',
  'fat',
  'fats',
];

const CARB_PREFIXES = ['glucides', 'glucide', 'carbohydrates', 'carbohydrate', 'carbs', 'carb'];

const PROTEIN_PREFIXES = ['proteines', 'proteine', 'matieres proteiques', 'protein', 'proteins'];

const ALL_PREFIXES = [
  ...SKIP_PREFIXES,
  ...ENERGY_PREFIXES,
  ...FAT_PREFIXES,
  ...CARB_PREFIXES,
  ...PROTEIN_PREFIXES,
];

function startsWithAny(line: string, prefixes: string[]): boolean {
  return prefixes.some((p) => line.startsWith(p));
}

/** Classify a normalised line by its leading label, or null (skip/unknown line). */
export function classify(normLine: string): MacroKind | null {
  const s = normLine.trim();
  if (!s) return null;
  if (startsWithAny(s, SKIP_PREFIXES)) return null;
  if (startsWithAny(s, ENERGY_PREFIXES)) return 'energy';
  if (startsWithAny(s, FAT_PREFIXES)) return 'fat';
  if (startsWithAny(s, CARB_PREFIXES)) return 'carb';
  if (startsWithAny(s, PROTEIN_PREFIXES)) return 'protein';
  return null;
}

/** Whether a normalised line begins with any recognised label (macro or skip). Used by
 * the vertical-layout look-ahead to know it has reached the next label row. */
export function isLabelLine(normLine: string): boolean {
  return startsWithAny(normLine.trim(), ALL_PREFIXES);
}

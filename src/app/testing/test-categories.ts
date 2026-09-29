import { CategoryOutputDto, CategoryReference } from '../core/models/outputs/category-output-dto';

function category(id: string, name: string, color: string, extra: Partial<CategoryOutputDto> = {}) {
  return {
    id,
    name,
    color,
    transactionCount: 0,
    ruleCount: 0,
    isFallback: false,
    builtInReason: null,
    ...extra,
  } satisfies CategoryOutputDto;
}

/** Categories as the API gives them, for specs (a few of the ones every database starts with). */
export const TEST_CATEGORIES = {
  dining: category('c-dining', 'Dining', '#1F76B5'),
  groceries: category('c-groceries', 'Groceries', '#2CA12D'),
  other: category('c-other', 'Other', '#9466BC', {
    isFallback: true,
    builtInReason: 'Built in: transactions that no rule matches go here.',
  }),
  pet: category('c-pet', 'Pet', '#8C564B'),
  rent: category('c-rent', 'Rent', '#E277C3', {
    builtInReason:
      'Built in: a rent payment in it on chequing replaces the generated monthly rent.',
  }),
  shopping: category('c-shopping', 'Shopping', '#7F7E7E'),
  transportation: category('c-transportation', 'Transportation', '#16BFCF'),
};

/** All of them, by name, as GET /api/Categories lists them. */
export const TEST_CATEGORY_LIST = Object.values(TEST_CATEGORIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

/** Categories as reports list them, by name: with the fixture's id and colour when it has that one. */
export function categoryRefs(...names: string[]): CategoryReference[] {
  return names.map((name) => {
    const known = TEST_CATEGORY_LIST.find((c) => c.name === name);
    return {
      id: known?.id ?? `c-${name.toLowerCase()}`,
      name,
      color: known?.color ?? '#000000',
    };
  });
}

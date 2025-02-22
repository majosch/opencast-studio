import languages from './languages';

it('includes English as a language', () => {
  expect(languages.find(({ long }) => long === 'English')).not.toBeUndefined();
});

it('contains `short` for every language', () => {
  expect(languages.every(lang => 'short' in lang)).toBe(true);
});

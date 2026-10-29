// Mağaza metinleri karakter sınırlarını aşarsa yükleme reddedilir; burada önceden yakalıyoruz.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', 'fastlane', 'metadata');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8').trim();

const IOS_LIMITS: Record<string, number> = { name: 30, subtitle: 30, keywords: 100, promotional_text: 170, description: 4000, release_notes: 4000 };
const PLAY_LIMITS: Record<string, number> = { title: 30, short_description: 80, full_description: 4000 };

describe('mağaza meta verileri', () => {
  for (const lang of readdirSync(join(root, 'ios'))) {
    it(`App Store ${lang}: sınırlar ve zorunlu alanlar`, () => {
      for (const [f, max] of Object.entries(IOS_LIMITS)) {
        const v = read('ios', lang, `${f}.txt`);
        expect(v.length, `${lang}/${f}`).toBeGreaterThan(0);
        expect([...v].length, `${lang}/${f}`).toBeLessThanOrEqual(max);
      }
      expect(read('ios', lang, 'privacy_url.txt')).toMatch(/^https:\/\//);
      expect(read('ios', lang, 'keywords.txt')).not.toMatch(/,\s/); // virgülden sonra boşluk karakter harcar
    });
  }
  for (const lang of readdirSync(join(root, 'android'))) {
    it(`Google Play ${lang}: sınırlar`, () => {
      for (const [f, max] of Object.entries(PLAY_LIMITS)) {
        const v = read('android', lang, `${f}.txt`);
        expect(v.length, `${lang}/${f}`).toBeGreaterThan(0);
        expect([...v].length, `${lang}/${f}`).toBeLessThanOrEqual(max);
      }
      expect([...read('android', lang, 'changelogs', 'default.txt')].length).toBeLessThanOrEqual(500);
    });
  }
  it('ücretli/eski model ifadeleri kalmadı', () => {
    for (const dir of ['ios', 'android'])
      for (const lang of readdirSync(join(root, dir))) {
        const d = read(dir, lang, dir === 'ios' ? 'description.txt' : 'full_description.txt');
        expect(d).not.toMatch(/tek seferlik ödeme|one-time purchase/i);
      }
  });
});

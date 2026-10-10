// Sahte yanıtlar (Adım 1–4). iOS MockStoryAPI ile aynı içerik, Türkçe + İngilizce.
// Adım 5'te gerçek LLM + TTS hattıyla değişecek.
import type { CharacterID, Language, LibraryItem, Region, Story, StoryRequest } from "./contract.ts";
import { dative, locative } from "./turkish.ts";

export const REGION_TITLES: Record<Language, Record<Region, string>> = {
  tr: {
    sleep_house: "Uyku Evi", whisper_forest: "Fısıltı Ormanı", star_hill: "Yıldız Tepesi",
    lighthouse_cove: "Deniz Feneri Koyu", storyteller_plane: "Masalcı Çınarı", feelings_garden: "Duygu Bahçesi",
    treasure_chest: "Hazine Sandığı",
  },
  en: {
    sleep_house: "Sleep House", whisper_forest: "Whisper Forest", star_hill: "Star Hill",
    lighthouse_cove: "Lighthouse Cove", storyteller_plane: "Storyteller Tree", feelings_garden: "Feelings Garden",
    treasure_chest: "Treasure Chest",
  },
};

export const CHARACTER_NAMES: Record<Language, Record<CharacterID, string>> = {
  tr: { pamuk: "Pamuk", findik: "Fındık", lodos: "Lodos", nur: "Bilge Baykuş Nur", yildiz: "Yıldız", kaptan_midye: "Kaptan Midye" },
  en: { pamuk: "Pamuk", findik: "Fındık", lodos: "Lodos", nur: "Wise Owl Nur", yildiz: "Yıldız", kaptan_midye: "Captain Mussel" },
};

/** "Fısıltı Ormanı'nda" / "in Whisper Forest" (iOS: Region.locativeTitle(in:)) */
export function inRegion(region: Region, lang: Language): string {
  const t = REGION_TITLES[lang][region];
  if (lang === "tr") return locative(t, true);
  if (region === "whisper_forest" || region === "lighthouse_cove") return `in ${t}`;
  if (region === "star_hill") return `on ${t}`;
  if (region === "storyteller_plane") return `under the ${t}`;
  return `in the ${t}`;
}

type Emotion = Story["paragraphs"][number]["emotion"];

export function mockStory(r: StoryRequest, id: string = crypto.randomUUID()): Story {
  const lang = r.language ?? "tr";
  const name = r.child_name;
  const buddy = CHARACTER_NAMES[lang][r.companion_character];
  const place = inRegion(r.region, lang);
  const tr = lang === "tr";
  const texts: [string, Emotion][] = tr
    ? [
      [`Bir varmış bir yokmuş, ${place} ${name} adında meraklı bir çocuk yaşarmış. En yakın arkadaşı ${buddy} her akşam onun penceresine gelirmiş.`, "smiling"],
      [`Bir akşam ${buddy} heyecanla gelmiş: "${name}, ağaçların arasında küçük bir fener kaybolmuş! Onu bulursak bütün orman ışıl ışıl olacak."`, "surprised"],
      [`${name} ile ${buddy} el ele vermişler. Yaprakların altına, çiçeklerin arkasına bakmışlar. Sonunda feneri bir sincap yuvasının yanında bulmuşlar.`, "neutral"],
      [`Fenerin sahibi küçük bir tavşanmış. Feneri ona uzatmışlar, tavşan da kocaman gülümsemiş. Paylaşınca ışık iki katına çıkmış.`, "smiling"],
      [`Orman yavaş yavaş sessizleşmiş. Ateş böcekleri tek tek yanmış. ${buddy} uzun uzun esnemiş.`, "whisper"],
      [`${name} sıcacık battaniyesine sarılmış. Yıldızlar göz kırpmış. Gözleri yavaşça kapanmış.`, "sleepy"],
      [`Gökten üç elma düşmüş: biri ${dative(name)}, biri ${dative(buddy)}, biri de bu masalı dinleyen herkese. İyi geceler.`, "sleepy"],
    ]
    : [
      [`Once upon a time, ${place}, there lived a curious child named ${name}. Every evening, ${buddy}, the very best of friends, came to visit at the window.`, "smiling"],
      [`One evening ${buddy} arrived, all excited: "${name}, a little lantern is lost among the trees! If we find it, the whole forest will sparkle."`, "surprised"],
      [`${buddy} and ${name} set off hand in hand. They looked under the leaves and behind the flowers, and at last they found the lantern beside a squirrel's nest.`, "neutral"],
      [`The lantern belonged to a tiny bunny. They handed it back, and the bunny gave the biggest smile. When they shared, the light grew twice as bright.`, "smiling"],
      [`Little by little, the forest grew quiet. One by one, the fireflies lit up. ${buddy} gave a long, slow yawn.`, "whisper"],
      [`${name} snuggled into a warm, cozy blanket. The stars winked. Sleepy eyes slowly closed.`, "sleepy"],
      [`Three apples fell from the sky: one for ${name}, one for ${buddy}, and one for everyone who listened to this story. Good night.`, "sleepy"],
    ];
  return {
    id,
    title: tr ? `${name} ve Kayıp Fener` : `${name} and the Lost Lantern`,
    cover_scene: { region: r.region, time_of_day: "dusk" },
    characters: ["pamuk", r.companion_character],
    paragraphs: texts.map(([text, emotion], index) => ({
      index, text, emotion, scene_hint: `${r.region}_${index}`, audio_url: null,
    })),
    moral: tr ? "Paylaşınca ışık çoğalır." : "When we share, the light grows.",
    new_recurring_character: tr
      ? { name: "Fener Tavşan", card: "Küçük, beyaz, utangaç bir tavşan; elinde sarı bir fener taşır." }
      : { name: "Lantern Bunny", card: "A small, shy white bunny who carries a little yellow lantern." },
    duration_minutes: r.duration_minutes,
    mood: r.mood,
    is_fallback: false,
  };
}

const LIB: [string, string, string, Region, number, boolean][] = [
  ["lib-keloglan-1", "Keloğlan ile Sihirli Kaşık", "Keloğlan and the Magic Spoon", "storyteller_plane", 10, true],
  ["lib-hoca-1", "Nasreddin Hoca ve Göldeki Ay", "Nasreddin Hodja and the Moon in the Lake", "storyteller_plane", 5, true],
  ["lib-dedekorkut-1", "Dede Korkut'un Kopuzu", "Dede Korkut's Lute", "storyteller_plane", 15, false],
  ["lib-forest-1", "Fındık'ın Kış Hazırlığı", "Fındık Gets Ready for Winter", "whisper_forest", 10, true],
  ["lib-forest-2", "Fısıldayan Yapraklar", "The Whispering Leaves", "whisper_forest", 5, false],
  ["lib-star-1", "Yıldız'ın İlk Gecesi", "Yıldız's First Night", "star_hill", 15, false],
  ["lib-star-2", "Teleskoptaki Göz Kırpan Ay", "The Moon That Winked", "star_hill", 10, true],
  ["lib-sea-1", "Kaptan Midye ve Şarkı Söyleyen Deniz", "Captain Mussel and the Singing Sea", "lighthouse_cove", 10, false],
  ["lib-sea-2", "Fenerin Uykucu Işığı", "The Lighthouse's Sleepy Light", "lighthouse_cove", 5, true],
  ["lib-feel-1", "Lodos Kardeşini Bekliyor", "Lodos Waits for a Baby Sibling", "feelings_garden", 10, false],
  ["lib-feel-2", "Karanlık Aslında Ne Renk?", "What Colour Is the Dark, Really?", "feelings_garden", 10, true],
  ["lib-home-1", "Pamuk'un Yumuşacık Yastığı", "Pamuk's Fluffy Pillow", "sleep_house", 5, true],
];

export function mockLibrary(lang: Language): LibraryItem[] {
  return LIB.map(([id, tr, en, region, duration_minutes, is_free]) => ({
    id, title: lang === "tr" ? tr : en, region, duration_minutes, is_free,
  }));
}

// Sahte yanıtlar (Adım 1). iOS MockStoryAPI ile aynı içerik. Adım 5'te gerçek LLM + TTS hattıyla değişecek.
import type { CharacterID, LibraryItem, Region, Story, StoryRequest } from "./contract.ts";
import { dative, locative } from "./turkish.ts";

export const REGION_TITLES: Record<Region, string> = {
  sleep_house: "Uyku Evi",
  whisper_forest: "Fısıltı Ormanı",
  star_hill: "Yıldız Tepesi",
  lighthouse_cove: "Deniz Feneri Koyu",
  storyteller_plane: "Masalcı Çınarı",
  feelings_garden: "Duygu Bahçesi",
  treasure_chest: "Hazine Sandığı",
};

export const CHARACTER_NAMES: Record<CharacterID, string> = {
  pamuk: "Pamuk", findik: "Fındık", lodos: "Lodos", nur: "Bilge Baykuş Nur", yildiz: "Yıldız",
  kaptan_midye: "Kaptan Midye",
};

export function mockStory(r: StoryRequest, id: string = crypto.randomUUID()): Story {
  const name = r.child_name;
  const buddy = CHARACTER_NAMES[r.companion_character];
  const place = locative(REGION_TITLES[r.region], true);
  const texts: [string, Story["paragraphs"][number]["emotion"]][] = [
    [`Bir varmış bir yokmuş, ${place} ${name} adında meraklı bir çocuk yaşarmış. En yakın arkadaşı ${buddy} her akşam onun penceresine gelirmiş.`, "smiling"],
    [`Bir akşam ${buddy} heyecanla gelmiş: "${name}, ağaçların arasında küçük bir fener kaybolmuş! Onu bulursak bütün orman ışıl ışıl olacak."`, "surprised"],
    [`${name} ile ${buddy} el ele vermişler. Yaprakların altına, çiçeklerin arkasına bakmışlar. Sonunda feneri bir sincap yuvasının yanında bulmuşlar.`, "neutral"],
    [`Fenerin sahibi küçük bir tavşanmış. Feneri ona uzatmışlar, tavşan da kocaman gülümsemiş. Paylaşınca ışık iki katına çıkmış.`, "smiling"],
    [`Orman yavaş yavaş sessizleşmiş. Ateş böcekleri tek tek yanmış. ${buddy} uzun uzun esnemiş.`, "whisper"],
    [`${name} sıcacık battaniyesine sarılmış. Yıldızlar göz kırpmış. Gözleri yavaşça kapanmış.`, "sleepy"],
    [`Gökten üç elma düşmüş: biri ${dative(name)}, biri ${dative(buddy)}, biri de bu masalı dinleyen herkese. İyi geceler.`, "sleepy"],
  ];
  return {
    id,
    title: `${name} ve Kayıp Fener`,
    cover_scene: { region: r.region, time_of_day: "dusk" },
    characters: ["pamuk", r.companion_character],
    paragraphs: texts.map(([text, emotion], index) => ({
      index, text, emotion, scene_hint: `${r.region}_${index}`, audio_url: null,
    })),
    moral: "Paylaşınca ışık çoğalır.",
    new_recurring_character: { name: "Fener Tavşan", card: "Küçük, beyaz, utangaç bir tavşan; elinde sarı bir fener taşır." },
    duration_minutes: r.duration_minutes,
    mood: r.mood,
    is_fallback: false,
  };
}

export const MOCK_LIBRARY: LibraryItem[] = [
  { id: "lib-keloglan-1", title: "Keloğlan ile Sihirli Kaşık", region: "storyteller_plane", duration_minutes: 10, is_free: true },
  { id: "lib-hoca-1", title: "Nasreddin Hoca ve Göldeki Ay", region: "storyteller_plane", duration_minutes: 5, is_free: true },
  { id: "lib-forest-1", title: "Fındık'ın Kış Hazırlığı", region: "whisper_forest", duration_minutes: 10, is_free: true },
  { id: "lib-star-1", title: "Yıldız'ın İlk Gecesi", region: "star_hill", duration_minutes: 15, is_free: false },
  { id: "lib-sea-1", title: "Kaptan Midye ve Şarkı Söyleyen Deniz", region: "lighthouse_cove", duration_minutes: 10, is_free: false },
  { id: "lib-feel-1", title: "Lodos Kardeşini Bekliyor", region: "feelings_garden", duration_minutes: 10, is_free: false },
];

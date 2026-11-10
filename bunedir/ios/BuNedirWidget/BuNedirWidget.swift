import SwiftUI
import WidgetKit

// Uygulama hiç açılmasa da çalışır: zaman çizelgesi önümüzdeki 24 saatin 3 saatlik dilimlerini
// önceden hesaplar (günün kelimesi + dönen sahne + "hatırla" kartları), sonra iOS yenisini ister.

struct WordEntry: TimelineEntry {
    let date: Date
    let daily: Daily.Entry
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WordEntry {
        WordEntry(date: .now, daily: Daily.entry(day: 8, slot: 0))
    }

    func getSnapshot(in context: Context, completion: @escaping (WordEntry) -> Void) {
        completion(WordEntry(date: .now, daily: Daily.entry(at: .now)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WordEntry>) -> Void) {
        let starts = Daily.slotStarts(from: .now, count: Daily.slotsPerDay + 1)
        let entries = starts.enumerated().map { i, date in
            // İlk giriş "şimdi" olmalı; dilim başlangıcı geçmişte kalır.
            WordEntry(date: i == 0 ? .now : date, daily: Daily.entry(at: date))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct WordWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WordEntry

    /// Kartta gösterilecek kelime: bölüm kelimesi ya da (15:00 diliminde) sözlükten bir kelime.
    private struct Shown {
        let title: String, origin: String, meaning: String
        let story: String?, oneLiner: String?
        let url: URL
    }

    private var shown: Shown {
        if let d = entry.daily.dict {
            return Shown(title: d.word, origin: d.origin, meaning: d.meaning, story: nil, oneLiner: nil,
                         url: URL(string: "bunedir://dict/\(d.id)")!)
        }
        let w = entry.daily.word
        return Shown(title: w.word, origin: w.origin, meaning: w.meaning, story: w.story, oneLiner: w.oneLiner,
                     url: URL(string: "bunedir://word/\(w.no)")!)
    }

    private var labelColor: Color { entry.daily.kind == .today ? Theme.ink.opacity(0.55) : Theme.review }
    private var label: String {
        switch (entry.daily.kind, entry.daily.daysAgo) {
        case (.dictionary, _): "Sözlükten"
        case (_, 0): "Günün kelimesi"
        case (_, 1): "Hatırla · dün"
        case (_, 7): "Hatırla · geçen hafta"
        case (_, let n): "Hatırla · \(n) gün önce"
        }
    }

    var body: some View {
        content
            .padding(family.isAccessory ? 0 : 12)
            .widgetURL(shown.url)
            .containerBackground(for: .widget) {
                if family.isAccessory { Color.clear } else { SceneBackground(path: entry.daily.image, aspect: family == .systemMedium ? 2.1 : 1) }
            }
    }

    @ViewBuilder private var content: some View {
        let s = shown
        switch family {
        case .accessoryInline:
            Text("\(s.title): \(s.meaning)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(s.title).font(Theme.word(15)).widgetAccentable()
                Text(s.meaning).font(.caption2).lineLimit(3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .systemSmall:
            VStack {
                Spacer()
                PaperCard(tilt: -1.5, padding: 8) {
                    VStack(spacing: 2) {
                        Text(label.uppercased()).font(Theme.body(8, weight: .semibold)).foregroundStyle(labelColor)
                        Text(s.title).font(Theme.word(20)).foregroundStyle(Theme.accent).minimumScaleFactor(0.5).lineLimit(1)
                        Text(s.origin).font(Theme.body(9)).foregroundStyle(Theme.ink.opacity(0.7)).lineLimit(1)
                    }
                }
            }
        case .systemMedium:
            HStack {
                Spacer(minLength: 120)
                PaperCard(tilt: 1, padding: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(label.uppercased()).font(Theme.body(9, weight: .semibold)).foregroundStyle(labelColor)
                        Text(s.title).font(Theme.word(22)).foregroundStyle(Theme.accent).minimumScaleFactor(0.6).lineLimit(1)
                        Text(s.meaning).font(Theme.body(11)).foregroundStyle(Theme.ink).lineLimit(3)
                        Text(s.origin).font(Theme.body(9)).foregroundStyle(Theme.ink.opacity(0.6))
                    }
                }
            }
        default: // systemLarge ve üstü
            VStack(spacing: 10) {
                Spacer()
                PaperCard(tilt: -1, padding: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(label.uppercased()).font(Theme.body(10, weight: .semibold)).foregroundStyle(labelColor)
                        Text(s.title).font(Theme.word(30)).foregroundStyle(Theme.accent).minimumScaleFactor(0.5).lineLimit(1)
                        Text("\(s.origin) · \(s.meaning)").font(Theme.body(12)).foregroundStyle(Theme.ink).lineLimit(3)
                        if let story = s.story {
                            Text(story).font(Theme.body(11, weight: .regular)).foregroundStyle(Theme.ink.opacity(0.8)).lineLimit(5)
                        }
                    }
                }
                if let line = s.oneLiner {
                    PaperCard(tilt: 1.5, padding: 6) {
                        Text("“\(line)”").font(Theme.body(11, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(2)
                    }
                }
            }
        }
    }
}

private extension WidgetFamily {
    var isAccessory: Bool { [.accessoryInline, .accessoryRectangular, .accessoryCircular].contains(self) }
}

struct BuNedirWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BuNedirWidget", provider: Provider()) { entry in
            WordWidgetView(entry: entry)
        }
        .configurationDisplayName("Günün Kelimesi")
        .description("Her gün bir kelime, hikâyesiyle. Arka plan gün boyu değişir; öğleden sonra 1000 kelimelik sözlükten bir kelime, akşam eski kelimeleri hatırlatır.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

@main
struct BuNedirWidgetBundle: WidgetBundle {
    var body: some Widget { BuNedirWidget() }
}

#Preview(as: .systemMedium) {
    BuNedirWidget()
} timeline: {
    WordEntry(date: .now, daily: Daily.entry(day: 8, slot: 0))
    WordEntry(date: .now, daily: Daily.entry(day: 8, slot: 4))
}

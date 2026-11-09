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

    private var word: Word { entry.daily.word }
    private var isReview: Bool { entry.daily.kind == .review }
    private var label: String {
        switch entry.daily.daysAgo {
        case 0: "Günün kelimesi"
        case 1: "Hatırla · dün"
        case 7: "Hatırla · geçen hafta"
        default: "Hatırla · \(entry.daily.daysAgo) gün önce"
        }
    }

    var body: some View {
        content
            .padding(family.isAccessory ? 0 : 12)
            .widgetURL(URL(string: "bunedir://word/\(word.no)"))
            .containerBackground(for: .widget) {
                if family.isAccessory { Color.clear } else { SceneBackground(path: entry.daily.image) }
            }
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryInline:
            Text("\(word.word): \(word.meaning)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(word.word).font(Theme.word(15)).widgetAccentable()
                Text(word.meaning).font(.caption2).lineLimit(3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .systemSmall:
            VStack {
                Spacer()
                PaperCard(tilt: -1.5, padding: 8) {
                    VStack(spacing: 2) {
                        Text(label.uppercased()).font(Theme.body(8, weight: .semibold)).foregroundStyle(isReview ? Theme.review : Theme.ink.opacity(0.55))
                        Text(word.word).font(Theme.word(20)).foregroundStyle(Theme.accent).minimumScaleFactor(0.5).lineLimit(1)
                        Text(word.origin).font(Theme.body(9)).foregroundStyle(Theme.ink.opacity(0.7)).lineLimit(1)
                    }
                }
            }
        case .systemMedium:
            HStack {
                Spacer(minLength: 120)
                PaperCard(tilt: 1, padding: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(label.uppercased()).font(Theme.body(9, weight: .semibold)).foregroundStyle(isReview ? Theme.review : Theme.ink.opacity(0.55))
                        Text(word.word).font(Theme.word(22)).foregroundStyle(Theme.accent).minimumScaleFactor(0.6).lineLimit(1)
                        Text(word.meaning).font(Theme.body(11)).foregroundStyle(Theme.ink).lineLimit(3)
                        Text(word.origin).font(Theme.body(9)).foregroundStyle(Theme.ink.opacity(0.6))
                    }
                }
            }
        default: // systemLarge ve üstü
            VStack(spacing: 10) {
                Spacer()
                PaperCard(tilt: -1, padding: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(label.uppercased()).font(Theme.body(10, weight: .semibold)).foregroundStyle(isReview ? Theme.review : Theme.ink.opacity(0.55))
                        Text(word.word).font(Theme.word(30)).foregroundStyle(Theme.accent).minimumScaleFactor(0.5).lineLimit(1)
                        Text("\(word.origin) · \(word.meaning)").font(Theme.body(12)).foregroundStyle(Theme.ink).lineLimit(3)
                        Text(word.story).font(Theme.body(11, weight: .regular)).foregroundStyle(Theme.ink.opacity(0.8)).lineLimit(5)
                    }
                }
                PaperCard(tilt: 1.5, padding: 6) {
                    Text("“\(word.oneLiner)”").font(Theme.body(11, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(2)
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
        .description("Her gün bir kelime, hikâyesiyle. Arka plan gün boyu değişir; arada eski kelimeleri hatırlatır.")
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

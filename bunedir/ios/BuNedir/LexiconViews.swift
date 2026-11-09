import SwiftUI

/// Kelimeler sekmesi: 50 hikâye (kapaklarla) ve 1000+ kelimelik sözlük (arama + dil süzgeci).
struct WordsTab: View {
    enum Mode: String, CaseIterable { case dictionary = "Sözlük", stories = "Hikâyeler" }
    @State private var mode: Mode = .dictionary

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Görünüm", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { m in
                        Text(m == .dictionary ? "Sözlük · \(Lexicon.entries.count)" : "Hikâyeler · \(Content.words.count)").tag(m)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.bottom, 6)
                switch mode {
                case .dictionary: LexiconList()
                case .stories: StoriesGrid()
                }
            }
            .navigationTitle("Kelimeler")
            .navigationDestination(for: Word.self) { WordDetailView(word: $0) }
            .navigationDestination(for: DictEntry.self) { DictEntryView(entry: $0) }
        }
    }
}

struct LexiconList: View {
    @State private var query = ""
    @State private var family: Lexicon.Family = .all

    var body: some View {
        let results = Lexicon.search(query, family: family)
        List {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(Lexicon.Family.allCases) { f in
                            Button(f.rawValue) { family = f }
                                .buttonStyle(.bordered)
                                .tint(family == f ? Theme.accent : Theme.ink.opacity(0.5))
                        }
                    }
                }
                .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
            }
            Section(results.count == 1 ? "1 kelime" : "\(results.count) kelime") {
                ForEach(results) { e in
                    NavigationLink(value: e) { DictRow(entry: e) }
                }
            }
        }
        .listStyle(.plain)
        .searchable(text: $query, prompt: "Kelime ya da anlam ara")
        .overlay {
            if results.isEmpty { ContentUnavailableView.search(text: query) }
        }
    }
}

struct DictRow: View {
    let entry: DictEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                Text(entry.word).font(Theme.word(18)).foregroundStyle(Theme.accent)
                Text(entry.origin).font(Theme.body(11, weight: .semibold)).foregroundStyle(.secondary)
                if entry.episode != nil {
                    Image(systemName: "play.rectangle.fill").font(.caption).foregroundStyle(Theme.accent)
                        .accessibilityLabel("Hikâyesi var")
                }
            }
            Text(entry.meaning).font(Theme.body(14, weight: .regular)).foregroundStyle(Theme.ink).lineLimit(2)
        }
        .padding(.vertical, 2)
    }
}

/// Sözlükteki bir kelime. Bölüm kelimesiyse hikâye sayfasının kendisi açılır.
struct DictEntryView: View {
    let entry: DictEntry
    var showsClose = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let w = entry.episodeWord {
            WordDetailView(word: w, showsClose: showsClose)
        } else {
            ScrollView {
                VStack(spacing: 22) {
                    PaperCard(tilt: -1, padding: 18) {
                        VStack(spacing: 6) {
                            Text(entry.origin.uppercased()).font(Theme.body(11, weight: .bold)).foregroundStyle(Theme.ink.opacity(0.5))
                            Text(entry.word).font(Theme.word(36)).foregroundStyle(Theme.accent).multilineTextAlignment(.center)
                            Text("buna denir.").font(Theme.word(15)).foregroundStyle(Theme.ink)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    Text(entry.meaning).font(Theme.body(19)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)
                    ShareLink(item: "\(entry.word) (\(entry.origin)): \(entry.meaning)\n\(Content.shared.instagram)") {
                        Label("Paylaş", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered).controlSize(.large)
                }
                .padding(24)
                .padding(.top, 40)
            }
            .background(Theme.paper.opacity(0.5))
            .overlay(alignment: .topTrailing) {
                if showsClose {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill").font(.title).symbolRenderingMode(.palette).foregroundStyle(Theme.ink, Theme.paper)
                    }
                    .padding().accessibilityLabel("Kapat")
                }
            }
        }
    }
}

struct StoriesGrid: View {
    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 10)]
    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 14) {
                ForEach(Content.words) { w in
                    NavigationLink(value: w) {
                        VStack(spacing: 4) {
                            SceneBackground(path: w.cover, maxPixel: 400)
                                .frame(height: 170).clipped()
                                .overlay(alignment: .topLeading) {
                                    if w == Daily.today() {
                                        Text("BUGÜN").font(Theme.body(9, weight: .bold)).padding(4)
                                            .background(Theme.accent).foregroundStyle(.white).padding(4)
                                    }
                                }
                            Text(String(format: "%02d · %@", w.no, w.word)).font(Theme.body(12, weight: .semibold))
                                .foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7)
                        }
                    }
                    .accessibilityLabel("\(w.no). \(w.word)")
                }
            }
            .padding()
        }
    }
}

/// İlham klavyesini açma rehberi (Ayarlar'dan ve Bugün ekranından açılır).
struct KeyboardGuideView: View {
    @Environment(\.openURL) private var openURL
    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text("İlham klavyesi").font(Theme.word(26)).foregroundStyle(Theme.accent)
                    Text("Nerede yazarsan yaz, klavyenin üstündeki şerit seninle konuşur: \"özledim\" yazınca \"Buna saudade denir\", \"lagom\" yazınca \"Bu budur\" der; boştayken bir tek söz fısıldar.")
                        .font(Theme.body(15))
                    Label("Yazdıkların cihazından hiç çıkmaz. Klavyenin internet erişimi yok, \"Tam Erişim\" istemez.", systemImage: "lock.shield")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)
            }
            Section("Nasıl açılır?") {
                Label("Ayarlar › Genel › Klavye › Klavyeler", systemImage: "1.circle")
                Label("Yeni Klavye Ekle… › \"Bu Nedir?\"", systemImage: "2.circle")
                Label("Yazarken 🌐 tuşuyla \"Bu Nedir?\" klavyesine geç", systemImage: "3.circle")
                Button("Ayarlar'ı aç") { openURL(URL(string: UIApplication.openSettingsURLString)!) }
            }
            Section("Burada dene") {
                KeyboardTryField()
            }
        }
        .navigationTitle("Klavye")
    }
}

/// Klavye açık değilse bile motoru uygulama içinde denemek için.
struct KeyboardTryField: View {
    @State private var text = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("ör. Seni çok özledim ", text: $text, axis: .vertical)
            if let s = Muse.suggest(text) {
                MuseChip(suggestion: s)
            } else {
                Text(Muse.idleLine()).font(Theme.body(13, weight: .regular)).italic().foregroundStyle(.secondary)
            }
        }
    }
}

struct MuseChip: View {
    let suggestion: Muse.Suggestion
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(suggestion.kind == .word ? "Bu budur: \(suggestion.entry.word)" : "Buna “\(suggestion.entry.word)” denir (\(suggestion.entry.origin))")
                .font(Theme.body(14, weight: .bold)).foregroundStyle(Theme.accent)
            Text(suggestion.entry.meaning).font(Theme.body(13, weight: .regular)).foregroundStyle(Theme.ink)
        }
        .padding(10)
        .background(Theme.paper)
    }
}

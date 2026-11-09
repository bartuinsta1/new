import SwiftUI

struct TodayView: View {
    @State private var showSettings = false
    var body: some View {
        NavigationStack {
            WordDetailView(word: Daily.today(), label: "Günün kelimesi")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showSettings = true } label: { Image(systemName: "gearshape") }
                            .accessibilityLabel("Ayarlar")
                    }
                }
                .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }
}

/// Bir kelimenin tam sayfası: sahne, kart, kısa hikâye, tek söz, Instagram'da izle.
struct WordDetailView: View {
    let word: Word
    var label: String? = nil
    var showsClose = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var sceneIndex = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .bottom) {
                    TabView(selection: $sceneIndex) {
                        ForEach(Array(word.images.enumerated()), id: \.offset) { i, path in
                            SceneBackground(path: path, maxPixel: 1400).tag(i)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: word.images.count > 1 ? .automatic : .never))
                    .frame(height: 360)
                    .clipped()

                    PaperCard(tilt: -1, padding: 14) {
                        VStack(spacing: 4) {
                            if let label {
                                Text(label.uppercased()).font(Theme.body(11, weight: .semibold)).foregroundStyle(Theme.ink.opacity(0.55))
                            }
                            Text(word.word).font(Theme.word(38)).foregroundStyle(Theme.accent)
                            Text("buna denir.").font(Theme.word(16)).foregroundStyle(Theme.ink)
                        }
                    }
                    .offset(y: 30)
                }
                VStack(alignment: .leading, spacing: 18) {
                    section("Anlamı") {
                        Text(word.origin).font(Theme.body(13, weight: .bold)).foregroundStyle(Theme.accent)
                        Text(word.meaning).font(Theme.body(17))
                    }
                    section("Hikâyesi") { Text(word.story).font(Theme.body(16, weight: .regular)).lineSpacing(3) }
                    PaperCard(tilt: 0.8, padding: 12) {
                        Text("“\(word.oneLiner)”").font(Theme.body(16, weight: .semibold)).frame(maxWidth: .infinity)
                    }
                    Button {
                        openURL(Content.instagramURL(for: word))
                    } label: {
                        Label(word.reel == nil ? "Hikâyeleri Instagram'da izle" : "Bu hikâyeyi Instagram'da izle", systemImage: "play.rectangle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    ShareLink(item: "\(word.word) (\(word.origin)): \(word.meaning)\n“\(word.oneLiner)”\n\(Content.shared.instagram)") {
                        Label("Paylaş", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                }
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 20)
                .padding(.top, 52)
                .padding(.bottom, 32)
            }
        }
        .background(Theme.paper.opacity(0.5))
        .ignoresSafeArea(edges: .top)
        .overlay(alignment: .topTrailing) {
            if showsClose {
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill").font(.title).symbolRenderingMode(.palette)
                        .foregroundStyle(Theme.ink, Theme.paper)
                }
                .padding()
                .accessibilityLabel("Kapat")
            }
        }
    }

    private func section(_ title: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).font(Theme.body(12, weight: .bold)).foregroundStyle(Theme.ink.opacity(0.5))
            content()
        }
    }
}

struct ArchiveView: View {
    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 10)]
    var body: some View {
        NavigationStack {
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
            .navigationTitle("Kelimeler")
            .navigationDestination(for: Word.self) { WordDetailView(word: $0) }
        }
    }
}

/// "Hatırla": son iki haftanın kelimelerinden anlam → kelime eşleştirme. Yanlışta doğru cevap gösterilir.
struct QuizView: View {
    @AppStorage("quiz.streak") private var streak = 0
    @AppStorage("quiz.best") private var best = 0
    @State private var question = QuizView.makeQuestion()
    @State private var picked: Word?

    struct Question { let answer: Word; let options: [Word] }

    static func makeQuestion() -> Question {
        var pool = Daily.recentWords(days: 14)
        if pool.count < 3 { pool = Content.words }
        let answer = pool.randomElement()!
        let others = Content.words.filter { $0 != answer }.shuffled().prefix(2)
        return Question(answer: answer, options: ([answer] + others).shuffled())
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                HStack {
                    Label("\(streak) seri", systemImage: "flame")
                    Spacer()
                    Text("En iyi: \(best)")
                }
                .font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink.opacity(0.7))

                PaperCard(tilt: -0.8, padding: 18) {
                    VStack(spacing: 8) {
                        Text("HANGİ KELİME?").font(Theme.body(11, weight: .bold)).foregroundStyle(Theme.ink.opacity(0.5))
                        Text(question.answer.meaning).font(Theme.body(18)).multilineTextAlignment(.center).foregroundStyle(Theme.ink)
                    }
                    .frame(maxWidth: .infinity)
                }

                ForEach(question.options) { w in
                    Button { choose(w) } label: {
                        Text(w.word).font(Theme.word(20)).frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.bordered)
                    .tint(color(for: w))
                    .disabled(picked != nil)
                }

                if let picked {
                    VStack(spacing: 10) {
                        Text(picked == question.answer ? "Doğru! " + question.answer.oneLiner : "Doğrusu: \(question.answer.word)")
                            .font(Theme.body(15, weight: .semibold)).multilineTextAlignment(.center)
                        Button("Sıradaki") { question = Self.makeQuestion(); self.picked = nil }
                            .buttonStyle(.borderedProminent)
                    }
                }
                Spacer()
            }
            .padding(20)
            .navigationTitle("Hatırla")
        }
    }

    private func color(for w: Word) -> Color {
        guard let picked else { return Theme.ink }
        if w == question.answer { return .green }
        return w == picked ? Theme.review : Theme.ink.opacity(0.4)
    }

    private func choose(_ w: Word) {
        picked = w
        if w == question.answer { streak += 1; best = max(best, streak) } else { streak = 0 }
    }
}

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var remindersOn = Reminders.isEnabled
    @State private var hour = Reminders.hour

    var body: some View {
        NavigationStack {
            Form {
                Section("Günlük hatırlatma") {
                    Toggle("Her gün bildirim gönder", isOn: $remindersOn)
                    if remindersOn {
                        Picker("Saat", selection: $hour) {
                            ForEach(6..<23, id: \.self) { Text(String(format: "%02d:00", $0)).tag($0) }
                        }
                    }
                }
                Section("Widget nasıl eklenir?") {
                    Text("Ana ekranda boş bir yere basılı tut → sol üstteki + → \"Bu Nedir?\" → boyut seç. Kilit ekranı için kilit ekranına basılı tut → Özelleştir → Kilit Ekranı → widget alanı.")
                        .font(.callout)
                    Text("Widget gün boyu sahneyi değiştirir; öğlen, akşam ve gece önceki kelimeleri hatırlatır.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section {
                    Button("Instagram: @bu.nedir1") { openURL(URL(string: Content.shared.instagram)!) }
                    Link("Gizlilik politikası", destination: URL(string: "https://bunedir.app/gizlilik")!)
                }
            }
            .navigationTitle("Ayarlar")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Tamam") { dismiss() } } }
            .onChange(of: remindersOn) { _, on in
                Task {
                    if on { remindersOn = await Reminders.enable(hour: hour) } else { Reminders.disable() }
                }
            }
            .onChange(of: hour) { _, h in
                Task { if remindersOn { _ = await Reminders.enable(hour: h) } }
            }
        }
    }
}

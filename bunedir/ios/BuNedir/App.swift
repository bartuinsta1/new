import SwiftUI
import WidgetKit

@main
struct BuNedirApp: App {
    @StateObject private var account = Account()
    @State private var route = Route()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(account)
                .environment(route)
                .onOpenURL { route.open($0) }
                .onChange(of: phase) { _, p in
                    guard p == .active else { return }
                    Task { await Reminders.reschedule() }
                    WidgetCenter.shared.reloadAllTimelines()
                }
        }
    }
}

/// Widget'tan ya da bildirimden gelen bağlantı: bunedir://word/9
@Observable
final class Route {
    var tab: Tab = .today
    var openWord: Word?
    var openEntry: DictEntry?

    enum Tab: Hashable { case today, words, quiz, gift }

    func open(_ url: URL) {
        guard url.scheme == "bunedir" else { return }
        if url.host == "word", let no = Int(url.lastPathComponent), let w = Content.word(no: no) {
            tab = .today
            openWord = w == Daily.today() ? nil : w
        } else if url.host == "dict", let e = Lexicon.entry(id: url.lastPathComponent) {
            tab = .today
            openEntry = e
        } else if url.host == "gift" {
            tab = .gift
        }
    }
}

struct RootView: View {
    @Environment(Route.self) private var route

    var body: some View {
        @Bindable var route = route
        TabView(selection: $route.tab) {
            TodayView().tabItem { Label("Bugün", systemImage: "sun.max") }.tag(Route.Tab.today)
            WordsTab().tabItem { Label("Kelimeler", systemImage: "character.book.closed") }.tag(Route.Tab.words)
            QuizView().tabItem { Label("Hatırla", systemImage: "brain.head.profile") }.tag(Route.Tab.quiz)
            GiftView().tabItem { Label("2 Ay Hediye", systemImage: "gift") }.tag(Route.Tab.gift)
        }
        .tint(Theme.accent)
        .sheet(item: $route.openWord) { WordDetailView(word: $0, showsClose: true) }
        .sheet(item: $route.openEntry) { DictEntryView(entry: $0, showsClose: true) }
    }
}

import SwiftUI
import UIKit

/// "Bu Nedir?" ilham klavyesi. Yazılanı yalnızca cihazda okur (Tam Erişim istemez, ağ yok):
/// sözlükten bir kelime yakalarsa "Bu budur", bir his yakalarsa "Buna X denir" der; boştayken bir tek söz fısıldar.
final class KeyboardViewController: UIInputViewController {
    private let model = KeyboardModel()
    private var host: UIHostingController<KeyboardView>?

    override func viewDidLoad() {
        super.viewDidLoad()
        model.proxy = { [weak self] in self?.textDocumentProxy }
        model.nextKeyboard = { [weak self] in self?.advanceToNextInputMode() }
        let host = UIHostingController(rootView: KeyboardView(model: model))
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        addChild(host)
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            view.heightAnchor.constraint(equalToConstant: KeyboardView.height),
        ])
        host.didMove(toParent: self)
        self.host = host
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        model.showsGlobe = needsInputModeSwitchKey
        model.refresh()
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        model.refresh()
    }
}

@MainActor
final class KeyboardModel: ObservableObject {
    enum Layer { case letters, numbers, symbols }
    enum Shift { case off, once, locked }

    @Published var layer: Layer = .letters
    @Published var shift: Shift = .once
    @Published var suggestion: Muse.Suggestion?
    @Published var idle: String = Muse.idleLine()
    @Published var expanded: DictEntry?
    @Published var showsGlobe = true

    var proxy: () -> UITextDocumentProxy? = { nil }
    var nextKeyboard: () -> Void = {}
    private var lastShown: String?

    private var before: String { proxy()?.documentContextBeforeInput ?? "" }

    func refresh() {
        let text = before
        let s = Muse.suggest(text)
        // Aynı öneriyi aynı cümlede tekrar tekrar gösterme; yeni bir şey yakalayınca değişsin.
        if let s { suggestion = s; lastShown = s.entry.id } else if text.isEmpty || text.hasSuffix(". ") || text.hasSuffix("\n") {
            suggestion = nil
            idle = Muse.idleLine()
        }
        if text.trimmingCharacters(in: .whitespaces).isEmpty || text.hasSuffix(". ") || text.hasSuffix("! ") || text.hasSuffix("? ") || text.hasSuffix("\n") {
            if shift == .off { shift = .once }
        }
    }

    func type(_ key: String) {
        let s = shift == .off ? key : key.uppercased(with: Locale(identifier: "tr_TR"))
        proxy()?.insertText(s)
        if shift == .once { shift = .off }
        refresh()
    }

    func space() { proxy()?.insertText(" "); refresh() }
    func newline() { proxy()?.insertText("\n"); refresh() }
    func backspace() { proxy()?.deleteBackward(); refresh() }

    func toggleShift() {
        switch shift {
        case .off: shift = .once
        case .once: shift = .locked
        case .locked: shift = .off
        }
    }

    /// Önerilen kelimeyi metne ekler (hissi anlatan kelimenin yanına).
    func insert(_ entry: DictEntry) {
        let text = before
        let sep = text.isEmpty || text.hasSuffix(" ") || text.hasSuffix("\n") ? "" : " "
        proxy()?.insertText("\(sep)\(entry.word) ")
        expanded = nil
        refresh()
    }
}

struct KeyboardView: View {
    static let height: CGFloat = 48 + 4 * 52 + 12
    @ObservedObject var model: KeyboardModel

    private let letters: [[String]] = [
        ["q", "w", "e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i"],
        ["z", "x", "c", "v", "b", "n", "m", "ö", "ç"],
    ]
    private let numbers: [[String]] = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["-", "/", ":", ";", "(", ")", "₺", "&", "@", "\""],
        [".", ",", "?", "!", "'"],
    ]
    private let symbols: [[String]] = [
        ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="],
        ["_", "\\", "|", "~", "<", ">", "€", "$", "£", "•"],
        [".", ",", "?", "!", "'"],
    ]

    var body: some View {
        VStack(spacing: 0) {
            Strip(model: model).frame(height: 48)
            if let e = model.expanded {
                ExpandedCard(entry: e, model: model)
            } else {
                keys
            }
        }
        .padding(.bottom, 4)
        .background(Color(red: 0.93, green: 0.91, blue: 0.86))
    }

    private var rows: [[String]] {
        switch model.layer {
        case .letters: letters
        case .numbers: numbers
        case .symbols: symbols
        }
    }

    private var keys: some View {
        VStack(spacing: 8) {
            ForEach(0..<2, id: \.self) { r in
                HStack(spacing: 4) { ForEach(rows[r], id: \.self) { key($0) } }
            }
            HStack(spacing: 4) {
                if model.layer == .letters {
                    Special(symbol: model.shift == .locked ? "capslock.fill" : (model.shift == .once ? "shift.fill" : "shift"), width: 44) { model.toggleShift() }
                } else {
                    Special(text: model.layer == .numbers ? "#+=" : "123", width: 44) { model.layer = model.layer == .numbers ? .symbols : .numbers }
                }
                ForEach(rows[2], id: \.self) { key($0) }
                Special(symbol: "delete.left", width: 44, repeats: true) { model.backspace() }
            }
            HStack(spacing: 4) {
                Special(text: model.layer == .letters ? "123" : "ABC", width: 50) { model.layer = model.layer == .letters ? .numbers : .letters }
                if model.showsGlobe { Special(symbol: "globe", width: 40) { model.nextKeyboard() } }
                Button { model.space() } label: {
                    Text("boşluk").font(.system(size: 15)).frame(maxWidth: .infinity, minHeight: 44)
                        .background(Color.white).clipShape(RoundedRectangle(cornerRadius: 6))
                        .foregroundStyle(Theme.ink)
                }
                Special(symbol: "return", width: 64) { model.newline() }
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 6)
    }

    private func key(_ k: String) -> some View {
        let label = model.shift == .off || model.layer != .letters ? k : k.uppercased(with: Locale(identifier: "tr_TR"))
        return Button { model.type(k) } label: {
            Text(label).font(.system(size: 21)).frame(maxWidth: .infinity, minHeight: 44)
                .background(Color.white).clipShape(RoundedRectangle(cornerRadius: 6))
                .shadow(color: .black.opacity(0.25), radius: 0, y: 1)
                .foregroundStyle(Theme.ink)
        }
        .accessibilityLabel(label)
    }
}

private struct Special: View {
    var symbol: String? = nil
    var text: String? = nil
    let width: CGFloat
    var repeats = false
    let action: () -> Void
    @State private var timer: Timer?

    var body: some View {
        Group {
            if let symbol { Image(systemName: symbol).font(.system(size: 17)) } else { Text(text ?? "").font(.system(size: 15)) }
        }
        .frame(width: width, height: 44)
        .background(Color(red: 0.78, green: 0.75, blue: 0.70))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .foregroundStyle(Theme.ink)
        .contentShape(Rectangle())
        .onTapGesture { action() }
        .onLongPressGesture(minimumDuration: 0.4, pressing: { pressing in
            guard repeats else { return }
            timer?.invalidate()
            timer = pressing ? Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { _ in Task { @MainActor in action() } } : nil
        }, perform: {})
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(text ?? symbol ?? "")
    }
}

/// Klavyenin üstündeki konuşan şerit.
private struct Strip: View {
    @ObservedObject var model: KeyboardModel
    var body: some View {
        HStack(spacing: 8) {
            Text("?").font(.system(size: 18, weight: .black, design: .rounded))
                .frame(width: 30, height: 30).background(Color(red: 0.97, green: 0.83, blue: 0.24)).clipShape(Circle())
                .foregroundStyle(Theme.ink)
            if let s = model.suggestion {
                Button { model.expanded = s.entry } label: {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(s.kind == .word ? "Bu budur: \(s.entry.word)" : "Buna “\(s.entry.word)” denir")
                            .font(Theme.body(14, weight: .bold)).foregroundStyle(Theme.accent)
                        Text(s.entry.meaning).font(Theme.body(11, weight: .regular)).foregroundStyle(Theme.ink).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Text(model.idle).font(Theme.body(13, weight: .regular)).italic().foregroundStyle(Theme.ink.opacity(0.75))
                    .lineLimit(2).minimumScaleFactor(0.8).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 10)
        .frame(maxHeight: .infinity)
        .background(Theme.paper)
    }
}

private struct ExpandedCard: View {
    let entry: DictEntry
    @ObservedObject var model: KeyboardModel
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(entry.word).font(Theme.word(28)).foregroundStyle(Theme.accent)
                Text(entry.origin).font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.ink.opacity(0.6))
            }
            Text(entry.meaning).font(Theme.body(16)).foregroundStyle(Theme.ink)
            if let w = entry.episodeWord {
                Text("“\(w.oneLiner)”").font(Theme.body(13, weight: .semibold)).italic().foregroundStyle(Theme.ink.opacity(0.8))
            }
            Spacer(minLength: 0)
            HStack {
                Button("Yazıya ekle") { model.insert(entry) }.buttonStyle(.borderedProminent).tint(Theme.accent)
                Button("Kapat") { model.expanded = nil }.buttonStyle(.bordered).tint(Theme.ink)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.paper)
    }
}

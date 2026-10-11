import SwiftUI
import SwiftData

// MARK: 6 — Avatar + yoldaş

struct AvatarStepView: View {
    @Bindable var model: OnboardingModel
    @Environment(\.modelContext) private var context

    var body: some View {
        OnboardingScaffold(step: .avatar, primaryTitle: "Hazırım!", primaryIcon: "sparkles",
                           onPrimary: { model.finish(in: context) }, onBack: model.back) {
            VStack(spacing: Metrics.spacingM) {
                VoicePromptPlayer(text: String(localized: "Kendine bir görünüş seç, sonra bir yol arkadaşı!"),
                                  recordingKey: "vp_avatar", speaker: .pamuk, autoplay: true)
                AvatarEditor(avatar: $model.avatar, companion: $model.companion)
            }
        }
    }
}

/// Avatar + yoldaş düzenleyici: önizleme, simgeli sekmeler, seçenek ızgarası.
/// Onboarding'de ve Ebeveyn Köşesi'nde (profil düzenleme) kullanılır.
struct AvatarEditor: View {
    @Binding var avatar: AvatarConfig
    @Binding var companion: CharacterID
    @Environment(\.theme) private var theme
    @State private var tab: Tab = .face

    enum Tab: CaseIterable, Identifiable {
        case face, skin, hair, hairColor, pajama, companion
        var id: Self { self }
        var icon: String {
            switch self {
            case .face: "face.smiling"
            case .skin: "hand.raised.fill"
            case .hair: "scissors"
            case .hairColor: "paintpalette.fill"
            case .pajama: "tshirt.fill"
            case .companion: "pawprint.fill"
            }
        }
        var label: String {
            switch self {
            case .face: String(localized: "Yüz")
            case .skin: String(localized: "Ten rengi")
            case .hair: String(localized: "Saç")
            case .hairColor: String(localized: "Saç rengi")
            case .pajama: String(localized: "Pijama")
            case .companion: String(localized: "Yol arkadaşı")
            }
        }
    }

    var body: some View {
        VStack(spacing: Metrics.spacingM) {
            // Önizleme: avatar + seçilen yoldaş, Uyku Evi önünde duracakları gibi.
            HStack(alignment: .bottom, spacing: -12) {
                AvatarView(config: avatar, size: 170)
                CharacterView(character: companion, size: 120, speaksOnTap: true)
            }
            .padding(.vertical, Metrics.spacingS)
            .frame(maxWidth: .infinity)
            .background(Ellipse().fill(Palette.grass.opacity(theme.mode == .day ? 0.45 : 0.25)).frame(height: 60)
                .offset(y: 70))

            // Sekmeler: simgeli kabarcıklar (metin minimum; VoiceOver için etiketli).
            HStack(spacing: 8) {
                ForEach(Tab.allCases) { t in
                    Button { tab = t } label: {
                        Image(systemName: t.icon).font(.system(size: 22, weight: .bold))
                            .frame(width: 48, height: 48)
                    }
                    .buttonStyle(BubbleButtonStyle(color: tab == t ? .grape : .sky, shape: .circle))
                    .saturation(tab == t ? 1 : 0.4)
                    .accessibilityLabel(Text(t.label))
                    .accessibilityAddTraits(tab == t ? .isSelected : [])
                }
            }
            Text(tab.label).masalFont(.headline).foregroundStyle(theme.ink)
            options
        }
    }

    @ViewBuilder private var options: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 16) {
            switch tab {
            case .face:
                ForEach(0..<6, id: \.self) { i in
                    optionButton(selected: avatar.faceTemplate == i, label: Text("Yüz \(i + 1)")) {
                        avatar.faceTemplate = i
                    } content: { AvatarFacePreview(config: withChange(\.faceTemplate, i)) }
                }
            case .skin:
                ForEach(0..<6, id: \.self) { i in
                    optionButton(selected: avatar.skinTone == i, label: Text("Ten rengi \(i + 1)")) {
                        avatar.skinTone = i
                    } content: { swatch(AvatarPalette.skin[i]) }
                }
            case .hair:
                ForEach(0..<6, id: \.self) { i in
                    optionButton(selected: avatar.hairStyle == i, label: Text("Saç \(i + 1)")) {
                        avatar.hairStyle = i
                    } content: { AvatarFacePreview(config: withChange(\.hairStyle, i)) }
                }
            case .hairColor:
                ForEach(0..<6, id: \.self) { i in
                    optionButton(selected: avatar.hairColor == i, label: Text("Saç rengi \(i + 1)")) {
                        avatar.hairColor = i
                    } content: { swatch(AvatarPalette.hair[i]) }
                }
            case .pajama:
                ForEach(0..<6, id: \.self) { i in
                    optionButton(selected: avatar.pajamaColor == i, label: Text("Pijama \(i + 1)")) {
                        avatar.pajamaColor = i
                    } content: { swatch(AvatarPalette.pajama[i]) }
                }
            case .companion:
                ForEach(CharacterID.allCases) { c in
                    optionButton(selected: companion == c, label: Text(c.displayName)) {
                        companion = c
                        VoicePrompter.shared.speak(c.reactionLines[0])
                    } content: { CharacterView(character: c, size: 70, isInteractive: false) }
                }
            }
        }
    }

    private func withChange(_ key: WritableKeyPath<AvatarConfig, Int>, _ value: Int) -> AvatarConfig {
        var c = avatar
        c[keyPath: key] = value
        return c
    }

    private func swatch(_ color: Color) -> some View {
        Circle().fill(color).frame(width: 52, height: 52)
            .overlay(Circle().strokeBorder(theme.outline, lineWidth: 2))
    }

    private func optionButton<C: View>(selected: Bool, label: Text, action: @escaping () -> Void,
                                       @ViewBuilder content: () -> C) -> some View {
        Button {
            Feedback.tap()
            action()
        } label: {
            content()
                .frame(width: 84, height: 84)
                .background(Circle().fill(theme.surface))
                .overlay(Circle().strokeBorder(selected ? Palette.grass : theme.outline, lineWidth: selected ? 6 : 3))
                .scaleEffect(selected ? 1.06 : 1)
                .animation(Motion.daySpring, value: selected)
        }
        .buttonStyle(.plain)
        .frame(minWidth: Metrics.minTapTarget, minHeight: Metrics.minTapTarget)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

/// Seçenek düğmesinde yalnızca kafa (gövdesiz) önizleme.
struct AvatarFacePreview: View {
    let config: AvatarConfig
    @Environment(\.theme) private var theme
    var body: some View {
        AvatarArt(config: config, mode: theme.mode)
            .scaleEffect(0.62)
            .frame(width: 124, height: 124)
            .offset(y: 14)
            .frame(width: 80, height: 80)
            .clipShape(Circle())
    }
}

// MARK: Kutlama → doğrudan ilk masal

struct OnboardingFinaleView: View {
    let model: OnboardingModel
    var onEnter: () -> Void

    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var burst = false

    var body: some View {
        ZStack {
            (theme.mode == .day ? Palette.sky.opacity(0.55) : Palette.nightSky).ignoresSafeArea()
            // Yıldız patlaması
            ForEach(0..<14, id: \.self) { i in
                let angle = Double(i) / 14 * 2 * .pi
                RoundedStar()
                    .fill([Palette.sun, Palette.berry, Palette.grass, Palette.grape, Palette.orange][i % 5])
                    .overlay(RoundedStar().stroke(theme.outline, lineWidth: 2))
                    .frame(width: 26, height: 26)
                    .offset(x: burst ? cos(angle) * 170 : 0, y: burst ? sin(angle) * 220 - 60 : -60)
                    .opacity(burst ? 1 : 0)
                    .rotationEffect(.degrees(burst ? 180 : 0))
            }
            VStack(spacing: Metrics.spacingL) {
                Spacer()
                Text(String(localized: "Masal Adası'na hoş geldin, \(model.trimmedName)!"))
                    .masalFont(.display).multilineTextAlignment(.center)
                    .foregroundStyle(theme.ink)
                    .padding(.horizontal)
                HStack(alignment: .bottom, spacing: -16) {
                    CharacterView(character: .pamuk, size: 120, isInteractive: false)
                    AvatarView(config: model.avatar, size: 180)
                    CharacterView(character: model.companion, size: 120, isInteractive: false)
                }
                Spacer()
                BubbleButton("Adaya git", systemImage: "map.fill", color: .sun, size: .large, action: onEnter)
                    .padding(.bottom, Metrics.spacingXL)
            }
        }
        .onAppear {
            Feedback.success()
            VoicePrompter.shared.speak(String(localized: "Masal Adası'na hoş geldin, \(model.spokenName)!"), recordingKey: nil)
            withAnimation(reduceMotion ? Motion.reduced : .spring(response: 0.9, dampingFraction: 0.55)) { burst = true }
        }
        .task {
            // Ebeveyn dokunmazsa birkaç saniye sonra kendiliğinden adaya geçilir.
            try? await Task.sleep(for: .seconds(6))
            onEnter()
        }
    }
}

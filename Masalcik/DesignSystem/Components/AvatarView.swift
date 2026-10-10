import SwiftUI

/// Çocuğun avatarı (§2.5): 6 yüz şablonu, ten rengi, 6 saç modeli + renk, pijama rengi.
/// Karakterler gibi 200×200'lük tuvalde çizilir; gerçek illüstrasyon katmanları gelince değiştirilecek.
struct AvatarView: View {
    var config: AvatarConfig = .default
    var size: CGFloat = 120
    var mood: CharacterMood = .happy

    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathing = false

    var body: some View {
        AvatarArt(config: config, mood: mood, mode: theme.mode)
            .scaleEffect(size / 200)
            .frame(width: size, height: size)
            .scaleEffect(x: 1, y: breathing ? 1.02 : 1, anchor: .bottom)
            .onAppear {
                guard let anim = Motion.idle(theme.mode, reduceMotion: reduceMotion) else { return }
                withAnimation(anim) { breathing = true }
            }
            .accessibilityElement()
            .accessibilityLabel(Text("Senin avatarın"))
    }
}

struct AvatarArt: View {
    var config: AvatarConfig
    var mood: CharacterMood = .happy
    var mode: DisplayMode = .day

    private func tone(_ c: Color) -> Color { mode == .day ? c : c.desaturated(0.4) }
    private var skin: Color { tone(AvatarPalette.skin[clamp(config.skinTone)]) }
    private var hair: Color { tone(AvatarPalette.hair[clamp(config.hairColor)]) }
    private var pajama: Color { tone(AvatarPalette.pajama[clamp(config.pajamaColor)]) }
    private func clamp(_ i: Int) -> Int { min(max(i, 0), 5) }

    var body: some View {
        ZStack {
            hairBack
            // Pijama gövdesi
            Inked(RoundedRectangle(cornerRadius: 40, style: .continuous), pajama).at(100, 168, 116, 76)
            ForEach([150.0, 170], id: \.self) { y in
                Circle().fill(Color.white.opacity(0.85)).frame(width: 8, height: 8).position(x: 100, y: y)
            }
            Inked(Capsule(), pajama.darkened(0.12)).at(100, 132, 60, 16)
            // Kulaklar + kafa
            Inked(Circle(), skin).at(48, 92, 24, 24)
            Inked(Circle(), skin).at(152, 92, 24, 24)
            Inked(Circle(), skin).at(100, 88, 108, 108)
            hairFront
            face
        }
        .frame(width: 200, height: 200)
    }

    // MARK: Saç (arka katman: yüzün arkasında kalan uzun saçlar)
    @ViewBuilder private var hairBack: some View {
        switch clamp(config.hairStyle) {
        case 1: Inked(Ellipse(), hair).at(100, 98, 140, 128)                       // küt
        case 3: Inked(Ellipse(), hair).at(162, 104, 36, 64, rotation: -15)          // at kuyruğu
        case 5: Inked(RoundedRectangle(cornerRadius: 60, style: .continuous), hair).at(100, 118, 140, 150) // uzun
        default: EmptyView()
        }
    }

    // MARK: Saç (ön katman)
    @ViewBuilder private var hairFront: some View {
        switch clamp(config.hairStyle) {
        case 2: // kıvırcık
            ZStack {
                ForEach(Array([(56.0, 62.0), (70, 44), (90, 34), (110, 34), (130, 44), (144, 62)].enumerated()), id: \.offset) { _, p in
                    Inked(Circle(), hair).at(p.0, p.1, 36, 36)
                }
            }
        case 4: // iki topuz
            ZStack {
                Inked(Circle(), hair).at(56, 42, 38, 38)
                Inked(Circle(), hair).at(144, 42, 38, 38)
                Inked(HairCapShape(), hair).at(100, 56, 112, 52)
            }
        default:
            Inked(HairCapShape(), hair).at(100, 56, 114, 54)
        }
    }

    // MARK: Yüz şablonları
    @ViewBuilder private var face: some View {
        let template = clamp(config.faceTemplate)
        let eyeSize: CGFloat = template == 4 ? 20 : 15
        ZStack {
            ForEach([-1.0, 1.0], id: \.self) { side in
                Group {
                    if mood == .sleepy {
                        ClosedEye().stroke(Palette.ink, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .frame(width: 18, height: 6)
                    } else if template == 3 {
                        // Mutlu kapalı göz (^^)
                        ClosedEye().stroke(Palette.ink, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .frame(width: 18, height: 6).rotationEffect(.degrees(180))
                    } else {
                        ZStack {
                            Circle().fill(Palette.ink)
                            Circle().fill(.white).frame(width: eyeSize * 0.36).offset(x: eyeSize * 0.16, y: -eyeSize * 0.16)
                        }
                        .frame(width: eyeSize, height: eyeSize)
                    }
                }
                .position(x: 100 + side * 22, y: 92)
            }
            // Yanaklar + çiller
            ForEach([-1.0, 1.0], id: \.self) { side in
                Ellipse().fill(Palette.berry.opacity(0.4)).frame(width: 16, height: 10).position(x: 100 + side * 34, y: 108)
                if template == 2 || template == 5 {
                    ForEach(0..<3, id: \.self) { i in
                        Circle().fill(Color(hex: "#B5764F").opacity(0.7)).frame(width: 3, height: 3)
                            .position(x: 100 + side * (28 + CGFloat(i) * 5), y: 102 + CGFloat(i % 2) * 3)
                    }
                }
            }
            // Ağız
            if mood == .sleepy {
                Ellipse().fill(Color(hex: "#C2344F")).frame(width: 10, height: 7).position(x: 100, y: 114)
            } else if template == 1 || template == 3 || template == 5 {
                SmileShape().fill(Color(hex: "#C2344F"))
                    .overlay(SmileShape().stroke(Palette.ink, style: StrokeStyle(lineWidth: 3, lineJoin: .round)))
                    .frame(width: 22, height: 11).position(x: 100, y: 110)
            } else {
                ClosedEye().stroke(Palette.ink, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                    .frame(width: 18, height: 6).position(x: 100, y: 110)
            }
        }
    }
}

/// Kafanın üstünü saran yuvarlak saç kepi (alt kenarı hafif dalgalı perçem).
struct HairCapShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.maxY))
        p.addCurve(to: CGPoint(x: r.maxX, y: r.maxY),
                   control1: CGPoint(x: r.minX - r.width * 0.02, y: r.minY - r.height * 0.35),
                   control2: CGPoint(x: r.maxX + r.width * 0.02, y: r.minY - r.height * 0.35))
        p.addQuadCurve(to: CGPoint(x: r.midX + r.width * 0.12, y: r.maxY - r.height * 0.18),
                       control: CGPoint(x: r.maxX - r.width * 0.15, y: r.maxY - r.height * 0.45))
        p.addQuadCurve(to: CGPoint(x: r.minX, y: r.maxY),
                       control: CGPoint(x: r.minX + r.width * 0.2, y: r.maxY - r.height * 0.6))
        p.closeSubpath()
        return p
    }
}

#Preview("AvatarView — 6 şablon") {
    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3)) {
        ForEach(0..<6, id: \.self) { i in
            AvatarView(config: AvatarConfig(faceTemplate: i, skinTone: i, hairStyle: i, hairColor: (i + 1) % 6, pajamaColor: i),
                       size: 110)
        }
    }
    .padding()
    .background(Palette.cream)
    .themed(.day)
}

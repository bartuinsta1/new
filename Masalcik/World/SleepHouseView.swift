import SwiftUI

/// Uyku Evi (§2.3 merkez): çocuğun evi. Penceresinden sıcak ışık gelir; uyku saati yaklaşınca parlar.
/// Önünde çocuğun avatarı ve yoldaş karakteri durur. "Bu Gece" masalı buradan başlar.
struct SleepHouseView: View {
    var avatar: AvatarConfig = .default
    var companion: CharacterID = .pamuk
    var companionOutfit: Outfit? = nil
    var isBedtimeNear = false
    var size: CGFloat = WorldLayout.sleepHouseSize
    var action: () -> Void = {}

    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var glowPulse = false

    private var windowLit: Bool { isBedtimeNear || theme.mode == .night }

    var body: some View {
        Button(action: action) {
            ZStack {
                house
                    .frame(width: size, height: size)
                HStack(alignment: .bottom, spacing: -size * 0.06) {
                    AvatarView(config: avatar, size: size * 0.42, mood: theme.mode == .night ? .sleepy : .happy)
                    CharacterView(character: companion, mood: theme.mode == .night ? .sleepy : .happy,
                                  size: size * 0.36, isInteractive: false, outfit: companionOutfit)
                }
                .offset(y: size * 0.42)
            }
            .frame(width: size, height: size * 1.3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(Region.sleepHouse.title))
        .accessibilityHint(Text("Bu gecenin masalını başlatır"))
        .onAppear(perform: startGlow)
        .onChange(of: isBedtimeNear) { _, _ in startGlow() }
    }

    private func startGlow() {
        guard windowLit, !reduceMotion else { glowPulse = false; return }
        withAnimation(.easeInOut(duration: isBedtimeNear ? 1.0 : 2.4).repeatForever(autoreverses: true)) { glowPulse = true }
    }

    private var house: some View {
        let wall = theme.mode == .day ? Color(hex: "#FFF1DA") : Color(hex: "#FFF1DA").desaturated(0.4)
        let roof = AccentColor.berry.color(for: theme.mode)
        let glowColor = theme.mode == .day ? Palette.sun : Palette.firefly
        return ZStack {
            // Pencere ışık halesi
            if windowLit {
                Circle()
                    .fill(RadialGradient(colors: [glowColor.opacity(0.75), glowColor.opacity(0)], center: .center,
                                         startRadius: 4, endRadius: 70))
                    .frame(width: 150, height: 150)
                    .scaleEffect(glowPulse ? 1.18 : 0.92)
                    .position(x: 128, y: 112)
            }
            // Baca
            Inked(RoundedRectangle(cornerRadius: 6), Color(hex: "#C7745A")).at(146, 50, 22, 40)
            // Duvarlar (2.5D gölge şeridi + gövde)
            Inked(RoundedRectangle(cornerRadius: 22, style: .continuous), wall.darkened(0.18)).at(100, 132, 132, 96)
            Inked(RoundedRectangle(cornerRadius: 22, style: .continuous), wall).at(100, 124, 132, 96)
            // Çatı
            Inked(RoofShape(), roof).at(100, 66, 168, 72)
            // Kapı
            Inked(UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22, style: .continuous),
                  Color(hex: "#8C6A52")).at(78, 146, 36, 52)
            Circle().fill(Palette.sun).frame(width: 6, height: 6).position(x: 88, y: 148)
            // Pencere
            Inked(RoundedRectangle(cornerRadius: 10, style: .continuous),
                  windowLit ? glowColor : Color(hex: "#BFE8FA")).at(128, 112, 38, 34)
            Path { p in
                p.move(to: CGPoint(x: 128, y: 96)); p.addLine(to: CGPoint(x: 128, y: 128))
                p.move(to: CGPoint(x: 110, y: 112)); p.addLine(to: CGPoint(x: 146, y: 112))
            }
            .stroke(theme.outline.opacity(0.6), style: StrokeStyle(lineWidth: 3, lineCap: .round))
        }
        .frame(width: 200, height: 200)
        .scaleEffect(size / 200)
    }
}

/// Köşeleri yuvarlak üçgen çatı.
struct RoofShape: Shape {
    func path(in r: CGRect) -> Path {
        let top = CGPoint(x: r.midX, y: r.minY), right = CGPoint(x: r.maxX, y: r.maxY), left = CGPoint(x: r.minX, y: r.maxY)
        let v = [top, right, left]
        func lerp(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint { CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t) }
        var p = Path()
        p.move(to: lerp(v[0], v[1], 0.18))
        for i in 0..<3 {
            let cur = v[(i + 1) % 3], prev = v[i], next = v[(i + 2) % 3]
            p.addLine(to: lerp(cur, prev, 0.12))
            p.addQuadCurve(to: lerp(cur, next, 0.12), control: cur)
        }
        p.closeSubpath()
        return p
    }
}

#Preview("SleepHouseView") {
    HStack {
        SleepHouseView(companion: .findik).themed(.day)
        SleepHouseView(companion: .findik, isBedtimeNear: true).background(Palette.nightSky).themed(.night)
    }
}

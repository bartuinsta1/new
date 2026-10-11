import SwiftUI

/// Kıyafet aksesuarı: karakterin 200×200 tuvalindeki baş/boyun noktasına çizilir.
struct OutfitAccessory: View {
    let outfit: Outfit
    let character: CharacterID
    var mode: DisplayMode = .day

    private var color: Color { outfit.color.color(for: mode) }

    /// Karakter başına baş üstü ve boyun noktaları (CharacterArt geometrisiyle uyumlu).
    private var anchors: (head: CGPoint, neck: CGPoint) {
        switch character {
        case .pamuk: (CGPoint(x: 104, y: 46), CGPoint(x: 100, y: 152))
        case .findik: (CGPoint(x: 98, y: 44), CGPoint(x: 98, y: 162))
        case .lodos: (CGPoint(x: 100, y: 24), CGPoint(x: 100, y: 174))
        case .nur: (CGPoint(x: 100, y: 36), CGPoint(x: 100, y: 152))
        case .yildiz: (CGPoint(x: 100, y: 18), CGPoint(x: 100, y: 160))
        case .kaptanMidye: (CGPoint(x: 100, y: 20), CGPoint(x: 100, y: 164))
        }
    }

    var body: some View {
        ZStack {
            switch outfit.style {
            case .nightcap:
                ZStack {
                    Inked(NightcapShape(), color).frame(width: 78, height: 62)
                    Inked(Capsule(), .white).frame(width: 74, height: 16).offset(y: 26)
                    // Uçtaki "gece lambası": sıcak sarı ponpon
                    Circle().fill(Palette.firefly.opacity(0.5)).frame(width: 30, height: 30).blur(radius: 6).offset(x: 40, y: -22)
                    Inked(Circle(), Palette.sun).frame(width: 18, height: 18).offset(x: 40, y: -22)
                }
                .rotationEffect(.degrees(12))
                .position(x: anchors.head.x, y: anchors.head.y)
            case .scarf:
                ZStack {
                    Inked(Capsule(), color).frame(width: 112, height: 24)
                    Inked(RoundedRectangle(cornerRadius: 8, style: .continuous), color).frame(width: 22, height: 40)
                        .rotationEffect(.degrees(-12)).offset(x: 28, y: 22)
                    ForEach([-30.0, 0, 30], id: \.self) { x in
                        RoundedStar().fill(Color.white.opacity(0.9)).frame(width: 10, height: 10).offset(x: x)
                    }
                }
                .position(x: anchors.neck.x, y: anchors.neck.y)
            case .crown:
                ZStack {
                    Inked(CrownShape(), Palette.moon).frame(width: 62, height: 36)
                    Inked(Circle(), color).frame(width: 12, height: 12).offset(y: 4)
                }
                .position(x: anchors.head.x, y: anchors.head.y)
            case .bow:
                ZStack {
                    Inked(Ellipse(), color).frame(width: 30, height: 22).offset(x: -14)
                    Inked(Ellipse(), color).frame(width: 30, height: 22).offset(x: 14)
                    Inked(Circle(), color.darkened(0.15)).frame(width: 14, height: 14)
                }
                .position(x: anchors.neck.x, y: anchors.neck.y)
            }
        }
        .frame(width: 200, height: 200)
        .allowsHitTesting(false)
    }
}

/// Eğik, yumuşak uçlu uyku şapkası.
struct NightcapShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.maxY))
        p.addCurve(to: CGPoint(x: r.maxX, y: r.minY + r.height * 0.1),
                   control1: CGPoint(x: r.minX + r.width * 0.1, y: r.minY),
                   control2: CGPoint(x: r.midX, y: r.minY - r.height * 0.1))
        p.addQuadCurve(to: CGPoint(x: r.maxX - r.width * 0.05, y: r.minY + r.height * 0.3),
                       control: CGPoint(x: r.maxX + r.width * 0.05, y: r.minY + r.height * 0.25))
        p.addCurve(to: CGPoint(x: r.maxX - r.width * 0.05, y: r.maxY),
                   control1: CGPoint(x: r.midX + r.width * 0.15, y: r.minY + r.height * 0.4),
                   control2: CGPoint(x: r.maxX - r.width * 0.1, y: r.maxY - r.height * 0.2))
        p.closeSubpath()
        return p
    }
}

/// Yuvarlak uçlu üç sivri taç (köşesiz).
struct CrownShape: Shape {
    func path(in r: CGRect) -> Path {
        let w = r.width, h = r.height
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.minY + h * 0.25))
        p.addQuadCurve(to: CGPoint(x: r.minX + w * 0.3, y: r.minY + h * 0.55), control: CGPoint(x: r.minX + w * 0.12, y: r.minY + h * 0.55))
        p.addQuadCurve(to: CGPoint(x: r.midX, y: r.minY), control: CGPoint(x: r.minX + w * 0.42, y: r.minY + h * 0.1))
        p.addQuadCurve(to: CGPoint(x: r.maxX - w * 0.3, y: r.minY + h * 0.55), control: CGPoint(x: r.maxX - w * 0.42, y: r.minY + h * 0.1))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.minY + h * 0.25), control: CGPoint(x: r.maxX - w * 0.12, y: r.minY + h * 0.55))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

extension ChildProfile {
    /// Karaktere giydirilmiş kıyafet (çocuk Hazine Sandığı'ndan değiştirir).
    func outfit(for character: CharacterID) -> Outfit? {
        Outfit.find(equippedOutfits[character.rawValue])
    }

    var newRewardCount: Int { stickers.filter(\.isNew).count }
}

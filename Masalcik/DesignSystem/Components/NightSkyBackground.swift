import SwiftUI

/// Yıldızlı, ateş böcekli, katmanlı (parallax) gece arka planı (§2.2).
/// `dimming` 0…1: masal ilerledikçe ekranı kademeli karartmak için (son %20'de neredeyse siyah).
/// "Hareketi Azalt" açıkken statik çizilir.
struct NightSkyBackground: View {
    var dimming: Double = 0
    /// Kaydırma/eğim ile verilen parallax kayması (pt). Uzak katmanlar daha az kayar.
    var parallax: CGSize = .zero
    var showsFireflies = true
    var showsMoon = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Hareketi Azalt açıksa ya da masalın son bölümünde (kararma ≥ %80) gökyüzü durağandır.
    private var isStatic: Bool { reduceMotion || dimming >= 0.8 }

    private static let stars: [Star] = Star.generate(count: 70, seed: 7)
    private static let fireflies: [Star] = Star.generate(count: 14, seed: 42)

    var body: some View {
        // Pil: 24 fps yeterli (yıldız kırpışması yavaş); ekran neredeyse karardığında animasyon tamamen durur.
        TimelineView(.animation(minimumInterval: 1 / 24, paused: isStatic)) { context in
            let t = isStatic ? 0 : context.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                // Gökyüzü gradyanı
                ctx.fill(Path(CGRect(origin: .zero, size: size)),
                         with: .linearGradient(Gradient(colors: [Palette.nightSky, Palette.dusk, Color(hex: "#5A3F7A")]),
                                               startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)))
                // Uzak katman: yıldızlar (parallax ×0.2)
                let far = CGSize(width: parallax.width * 0.2, height: parallax.height * 0.2)
                for s in Self.stars {
                    let twinkle = 0.55 + 0.45 * sin(t * s.speed + s.phase)
                    let r = s.radius
                    let p = CGPoint(x: s.x * size.width + far.width, y: s.y * size.height * 0.75 + far.height)
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                             with: .color(Palette.moon.opacity(twinkle)))
                }
                // Ay
                if showsMoon {
                    let mid = CGSize(width: parallax.width * 0.4, height: parallax.height * 0.4)
                    let c = CGPoint(x: size.width * 0.78 + mid.width, y: size.height * 0.16 + mid.height)
                    ctx.fill(Path(ellipseIn: CGRect(x: c.x - 70, y: c.y - 70, width: 140, height: 140)),
                             with: .color(Palette.moon.opacity(0.12)))
                    ctx.fill(Path(ellipseIn: CGRect(x: c.x - 34, y: c.y - 34, width: 68, height: 68)),
                             with: .color(Palette.moon))
                }
                // Tepeler (yakın katman, parallax ×0.8)
                let near = CGSize(width: parallax.width * 0.8, height: parallax.height * 0.8)
                var hills = Path()
                hills.move(to: CGPoint(x: -40 + near.width, y: size.height))
                hills.addCurve(to: CGPoint(x: size.width + 40 + near.width, y: size.height * 0.8),
                               control1: CGPoint(x: size.width * 0.3 + near.width, y: size.height * 0.66),
                               control2: CGPoint(x: size.width * 0.6 + near.width, y: size.height * 0.92))
                hills.addLine(to: CGPoint(x: size.width + 40, y: size.height))
                hills.closeSubpath()
                ctx.fill(hills, with: .color(Color(hex: "#2A2260")))
                // Ateş böcekleri (en yakın katman)
                if showsFireflies {
                    for f in Self.fireflies {
                        let dx = sin(t * f.speed * 0.3 + f.phase) * 18
                        let dy = cos(t * f.speed * 0.25 + f.phase) * 12
                        let glow = 0.4 + 0.6 * max(0, sin(t * f.speed * 0.6 + f.phase))
                        let p = CGPoint(x: f.x * size.width + dx + parallax.width,
                                        y: (0.55 + f.y * 0.42) * size.height + dy + parallax.height)
                        ctx.fill(Path(ellipseIn: CGRect(x: p.x - 9, y: p.y - 9, width: 18, height: 18)),
                                 with: .color(Palette.firefly.opacity(0.18 * glow)))
                        ctx.fill(Path(ellipseIn: CGRect(x: p.x - 2.5, y: p.y - 2.5, width: 5, height: 5)),
                                 with: .color(Palette.firefly.opacity(glow)))
                    }
                }
                // Kademeli kararma
                if dimming > 0 {
                    ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.black.opacity(min(0.92, dimming))))
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    struct Star {
        let x: Double, y: Double, radius: Double, speed: Double, phase: Double

        /// Deterministik dağılım (her açılışta aynı gökyüzü; snapshot testleri için de gerekli).
        static func generate(count: Int, seed: UInt64) -> [Star] {
            var rng = SplitMix64(seed: seed)
            return (0..<count).map { _ in
                Star(x: rng.nextUnit(), y: rng.nextUnit(), radius: 0.8 + rng.nextUnit() * 1.8,
                     speed: 0.6 + rng.nextUnit() * 1.6, phase: rng.nextUnit() * .pi * 2)
            }
        }
    }
}

/// Basit deterministik rastgele sayı üreteci.
struct SplitMix64: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
    mutating func nextUnit() -> Double { Double(next() >> 11) / Double(1 << 53) }
}

/// Oynatıcıda masal ilerlemesine göre kararma oranı: ilk %50 hiç, %50–80 yavaşça, son %20'de neredeyse siyah.
enum DimmingCurve {
    static func dimming(forProgress p: Double) -> Double {
        let p = min(max(p, 0), 1)
        switch p {
        case ..<0.5: return 0
        case ..<0.8: return (p - 0.5) / 0.3 * 0.5          // 0 → 0.5
        default: return 0.5 + (p - 0.8) / 0.2 * 0.4         // 0.5 → 0.9
        }
    }
}

#Preview("NightSkyBackground") {
    NightSkyBackground()
}

#Preview("NightSkyBackground — %90 ilerleme") {
    NightSkyBackground(dimming: DimmingCurve.dimming(forProgress: 0.9))
}

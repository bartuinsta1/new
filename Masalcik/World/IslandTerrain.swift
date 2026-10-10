import SwiftUI

/// Adanın statik zemini: deniz, dalgalar, 2.5D ada tabanı, kum kıyısı, çimen, patikalar ve süs ağaçları.
/// Tek bir Canvas'ta çizilir (60 fps için: binlerce view yerine tek çizim). Animasyonlu öğeler ayrı katmandadır.
struct IslandTerrain: View {
    var mode: DisplayMode

    private static let outline: [CGPoint] = IslandShape.outlinePoints(seed: 11)
    private static let waves: [NightSkyBackground.Star] = NightSkyBackground.Star.generate(count: 46, seed: 5)
    private static let trees: [CGPoint] = IslandShape.decorationPoints(seed: 23, count: 26)

    private func c(_ hex: String) -> Color {
        mode == .day ? Color(hex: hex) : Color(hex: hex).desaturated(0.4)
    }

    var body: some View {
        Canvas { ctx, size in
            let rect = CGRect(origin: .zero, size: size)
            // Deniz
            ctx.fill(Path(rect), with: .color(mode == .day ? Color(hex: "#8EDCF9") : Color(hex: "#211D55")))
            for w in Self.waves {
                let p = CGPoint(x: w.x * size.width, y: w.y * size.height)
                guard hypot(p.x - WorldLayout.islandCenter.x, p.y - WorldLayout.islandCenter.y) > WorldLayout.islandRadius + 40 else { continue }
                var arc = Path()
                arc.move(to: CGPoint(x: p.x - 14, y: p.y))
                arc.addQuadCurve(to: CGPoint(x: p.x + 14, y: p.y), control: CGPoint(x: p.x, y: p.y - 9))
                let waveColor = mode == .day ? Color.white.opacity(0.7) : Palette.moon.opacity(0.25 + 0.3 * w.radius / 2.6)
                ctx.stroke(arc, with: .color(waveColor), style: StrokeStyle(lineWidth: 4, lineCap: .round))
            }
            // 2.5D taban: adanın koyu alt kenarı
            let island = IslandShape.path(Self.outline)
            ctx.fill(island.offsetBy(dx: 0, dy: 34), with: .color(c("#C98F4E")))
            ctx.stroke(island.offsetBy(dx: 0, dy: 34), with: .color(outlineColor), lineWidth: 3)
            // Kum
            ctx.fill(island, with: .color(c("#FFE2A6")))
            ctx.stroke(island, with: .color(outlineColor), lineWidth: 3)
            // Çimen (kumdan biraz içeride)
            let grass = IslandShape.path(Self.outline, inset: 30)
            ctx.fill(grass, with: .color(c("#8FE065")))
            // Çimen dokusu
            for t in Self.trees.prefix(12) {
                var tuft = Path()
                tuft.move(to: CGPoint(x: t.x - 6, y: t.y + 40))
                tuft.addQuadCurve(to: CGPoint(x: t.x + 6, y: t.y + 40), control: CGPoint(x: t.x, y: t.y + 30))
                ctx.stroke(tuft, with: .color(c("#6CC448")), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            }
            // Patikalar: Uyku Evi'nden her bölgeye
            let home = WorldLayout.position(of: .sleepHouse)
            for region in Region.allCases where region != .sleepHouse {
                let to = WorldLayout.position(of: region)
                var path = Path()
                path.move(to: home)
                path.addQuadCurve(to: to, control: CGPoint(x: (home.x + to.x) / 2 + (to.y - home.y) * 0.15,
                                                           y: (home.y + to.y) / 2 - (to.x - home.x) * 0.15))
                ctx.stroke(path, with: .color(c("#F6D58E")), style: StrokeStyle(lineWidth: 22, lineCap: .round))
                ctx.stroke(path, with: .color(c("#FFF1C9")), style: StrokeStyle(lineWidth: 6, lineCap: .round, dash: [2, 18]))
            }
            // Süs ağaçları (bölgelerden uzak noktalarda)
            for t in Self.trees where Region.allCases.allSatisfy({ hypot(t.x - WorldLayout.position(of: $0).x, t.y - WorldLayout.position(of: $0).y) > 120 }) {
                ctx.fill(Path(ellipseIn: CGRect(x: t.x - 4, y: t.y + 4, width: 8, height: 22)), with: .color(c("#8C6A52")))
                let crown = Path(ellipseIn: CGRect(x: t.x - 22, y: t.y - 30, width: 44, height: 44))
                ctx.fill(crown, with: .color(c("#4FB35A")))
                ctx.stroke(crown, with: .color(outlineColor), lineWidth: 3)
                ctx.fill(Path(ellipseIn: CGRect(x: t.x - 12, y: t.y - 22, width: 12, height: 10)), with: .color(Color.white.opacity(0.25)))
            }
        }
        .frame(width: WorldLayout.size.width, height: WorldLayout.size.height)
        .accessibilityHidden(true)
    }

    private var outlineColor: Color { mode == .day ? Palette.ink : Color(hex: "#14112F") }
}

/// Organik ada silueti: merkez etrafında hafif dalgalı yarıçaplı noktalar, Catmull-Rom ile yumuşatılır.
enum IslandShape {
    static func outlinePoints(seed: UInt64, count: Int = 18) -> [CGPoint] {
        var rng = SplitMix64(seed: seed)
        let c = WorldLayout.islandCenter, r = WorldLayout.islandRadius
        return (0..<count).map { i in
            let a = Double(i) / Double(count) * 2 * .pi
            let wobble = 0.96 + rng.nextUnit() * 0.1
            return CGPoint(x: c.x + cos(a) * r * wobble, y: c.y + sin(a) * r * wobble)
        }
    }

    /// Merkeze doğru `inset` kadar küçültülmüş kapalı yumuşak yol.
    static func path(_ points: [CGPoint], inset: CGFloat = 0) -> Path {
        let c = WorldLayout.islandCenter
        let pts = points.map { p -> CGPoint in
            let dx = p.x - c.x, dy = p.y - c.y
            let d = max(hypot(dx, dy), 1)
            let k = (d - inset) / d
            return CGPoint(x: c.x + dx * k, y: c.y + dy * k)
        }
        var path = Path()
        let n = pts.count
        guard n > 2 else { return path }
        path.move(to: pts[0])
        for i in 0..<n {
            let p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
            let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
            let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
            path.addCurve(to: p2, control1: c1, control2: c2)
        }
        path.closeSubpath()
        return path
    }

    /// Adanın çimen alanı içinde deterministik süs noktaları.
    static func decorationPoints(seed: UInt64, count: Int) -> [CGPoint] {
        var rng = SplitMix64(seed: seed)
        let c = WorldLayout.islandCenter
        return (0..<count).map { _ in
            let a = rng.nextUnit() * 2 * .pi
            let d = (0.35 + rng.nextUnit() * 0.5) * WorldLayout.islandRadius
            return CGPoint(x: c.x + cos(a) * d, y: c.y + sin(a) * d)
        }
    }
}

#Preview("IslandTerrain") {
    ScrollView([.horizontal, .vertical]) { IslandTerrain(mode: .day) }
}

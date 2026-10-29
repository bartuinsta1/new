import SwiftUI

// MARK: - Yer tutucu karakter çizimleri (§2.4)
// Gerçek illüstrasyonlar gelene kadar her karakter SwiftUI şekilleriyle çizilir.
// Tüm çizimler 200×200'lük bir tuvalde tasarlanır ve hedef boyuta ölçeklenir.
// Kurallar: sivri köşe yok, 3 pt `ink` dış çizgi, büyük kafa, kocaman göz.
// Gerçek görseller eklendiğinde `CharacterView` önce `char_<id>_<mood>` asset'ini arar.

/// Dolgu + mürekkep dış çizgi.
struct Inked<S: Shape>: View {
    let shape: S
    let fill: Color
    var line: CGFloat = Metrics.outlineWidth
    @Environment(\.theme) private var theme

    init(_ shape: S, _ fill: Color, line: CGFloat = Metrics.outlineWidth) {
        self.shape = shape
        self.fill = fill
        self.line = line
    }

    var body: some View {
        shape.fill(fill)
            .overlay(shape.stroke(theme.outline, style: StrokeStyle(lineWidth: line, lineCap: .round, lineJoin: .round)))
    }
}

/// Konumlu parça yardımcı: 200'lük tuvalde merkez (x,y) ve boyut (w,h).
extension View {
    func at(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, rotation: Double = 0) -> some View {
        frame(width: w, height: h)
            .rotationEffect(.degrees(rotation))
            .position(x: x, y: y)
    }
}

/// Duyguya göre göz + ağız + yanak.
struct CharacterFace: View {
    var mood: CharacterMood
    var eyeSize: CGFloat = 26
    var eyeSpacing: CGFloat = 46
    var blink: Bool = false
    @Environment(\.theme) private var theme

    var body: some View {
        ZStack {
            // Gözler
            ForEach([CGFloat(-1), CGFloat(1)], id: \.self) { (side: CGFloat) in
                eye.position(x: 100 + side * eyeSpacing / 2, y: 92)
            }
            // Yanaklar
            ForEach([CGFloat(-1), CGFloat(1)], id: \.self) { (side: CGFloat) in
                Ellipse().fill(Palette.berry.opacity(0.45))
                    .frame(width: 20, height: 12)
                    .position(x: 100 + side * (eyeSpacing / 2 + 18), y: 114)
            }
            mouth.position(x: 100, y: 120)
        }
        .frame(width: 200, height: 200)
    }

    @ViewBuilder private var eye: some View {
        if mood == .sleepy || blink {
            ClosedEye()
                .stroke(theme.outline, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .frame(width: eyeSize, height: eyeSize * 0.3)
        } else {
            let s = mood == .surprised ? eyeSize * 1.15 : eyeSize
            ZStack {
                Circle().fill(Palette.ink)
                Circle().fill(.white).frame(width: s * 0.36).offset(x: s * 0.16, y: -s * 0.16)
            }
            .frame(width: s, height: s)
        }
    }

    @ViewBuilder private var mouth: some View {
        switch mood {
        case .happy:
            SmileShape()
                .fill(Color(hex: "#C2344F"))
                .overlay(SmileShape().stroke(theme.outline, style: StrokeStyle(lineWidth: 3, lineJoin: .round)))
                .frame(width: 26, height: 14)
        case .surprised:
            Ellipse().fill(Color(hex: "#C2344F"))
                .overlay(Ellipse().stroke(theme.outline, lineWidth: 3))
                .frame(width: 14, height: 18)
        case .sleepy:
            // Esneme
            Ellipse().fill(Color(hex: "#C2344F"))
                .overlay(Ellipse().stroke(theme.outline, lineWidth: 3))
                .frame(width: 16, height: 11)
        }
    }
}

struct SmileShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addQuadCurve(to: CGPoint(x: r.minX, y: r.minY), control: CGPoint(x: r.midX, y: r.maxY * 1.8))
        p.closeSubpath()
        return p
    }
}

/// Köşeleri yuvarlatılmış beş köşeli yıldız (Yıldız karakteri ve ödüller).
struct RoundedStar: Shape {
    var points = 5
    var innerRatio: CGFloat = 0.52
    var rounding: CGFloat = 0.32

    func path(in r: CGRect) -> Path {
        let c = CGPoint(x: r.midX, y: r.midY)
        let outer = min(r.width, r.height) / 2
        let inner = outer * innerRatio
        var verts: [CGPoint] = []
        for i in 0..<(points * 2) {
            let a: CGFloat = CGFloat(i) * .pi / CGFloat(points) - .pi / 2
            let rad = i.isMultiple(of: 2) ? outer : inner
            verts.append(CGPoint(x: c.x + cos(a) * rad, y: c.y + sin(a) * rad))
        }
        var p = Path()
        let n = verts.count
        func lerp(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint { CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t) }
        p.move(to: lerp(verts[0], verts[1], rounding))
        for i in 0..<n {
            let cur = verts[(i + 1) % n]
            let prev = verts[i]
            let next = verts[(i + 2) % n]
            p.addLine(to: lerp(cur, prev, rounding))
            p.addQuadCurve(to: lerp(cur, next, rounding), control: cur)
        }
        p.closeSubpath()
        return p
    }
}

/// Köşeleri yuvarlak eşkenar dörtgen (Lodos uçurtma).
struct RoundedKite: Shape {
    func path(in r: CGRect) -> Path {
        let top = CGPoint(x: r.midX, y: r.minY), right = CGPoint(x: r.maxX, y: r.minY + r.height * 0.42)
        let bottom = CGPoint(x: r.midX, y: r.maxY), left = CGPoint(x: r.minX, y: r.minY + r.height * 0.42)
        let v = [top, right, bottom, left]
        func lerp(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint { CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t) }
        var p = Path()
        p.move(to: lerp(v[0], v[1], 0.2))
        for i in 0..<4 {
            let cur = v[(i + 1) % 4], prev = v[i], next = v[(i + 2) % 4]
            p.addLine(to: lerp(cur, prev, 0.2))
            p.addQuadCurve(to: lerp(cur, next, 0.2), control: cur)
        }
        p.closeSubpath()
        return p
    }
}

/// Kaptan Midye'nin kocaman bıyığı: iki kıvrık tutam.
struct MustacheShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        p.move(to: CGPoint(x: r.midX, y: r.minY + h * 0.2))
        p.addCurve(to: CGPoint(x: r.minX, y: r.minY + h * 0.25),
                   control1: CGPoint(x: r.minX + w * 0.3, y: r.maxY), control2: CGPoint(x: r.minX + w * 0.05, y: r.maxY))
        p.addCurve(to: CGPoint(x: r.midX, y: r.minY + h * 0.2),
                   control1: CGPoint(x: r.minX + w * 0.1, y: r.minY + h * 0.6), control2: CGPoint(x: r.minX + w * 0.35, y: r.minY))
        p.addCurve(to: CGPoint(x: r.maxX, y: r.minY + h * 0.25),
                   control1: CGPoint(x: r.maxX - w * 0.35, y: r.minY), control2: CGPoint(x: r.maxX - w * 0.1, y: r.minY + h * 0.6))
        p.addCurve(to: CGPoint(x: r.midX, y: r.minY + h * 0.2),
                   control1: CGPoint(x: r.maxX - w * 0.05, y: r.maxY), control2: CGPoint(x: r.maxX - w * 0.3, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

/// Karakterin gövdesi + yüzü. Animasyonsuz, saf çizim.
struct CharacterArt: View {
    let character: CharacterID
    var mood: CharacterMood = .happy
    var blink = false
    var mode: DisplayMode = .day
    /// Hazine Sandığı'ndan kazanılan kıyafet (7 gece arka arkaya masal).
    var outfit: Outfit? = nil

    private func c(_ hex: String) -> Color {
        let base = Color(hex: hex)
        return mode == .day ? base : base.desaturated(0.4)
    }

    var body: some View {
        ZStack {
            switch character {
            case .pamuk: pamuk
            case .findik: findik
            case .lodos: lodos
            case .nur: nur
            case .yildiz: yildiz
            case .kaptanMidye: kaptanMidye
            }
            if let outfit, outfit.character == character {
                OutfitAccessory(outfit: outfit, character: character, mode: mode)
            }
        }
        .frame(width: 200, height: 200)
    }

    // Pamuk — uykucu beyaz kuzu
    private var pamuk: some View {
        ZStack {
            // Yün bulutu
            ForEach(Array([(60.0, 70.0), (100, 50), (140, 70), (155, 115), (135, 155), (100, 165), (65, 155), (45, 115)].enumerated()), id: \.offset) { _, p in
                Inked(Circle(), c("#FFFFFF")).at(p.0, p.1, 62, 62)
            }
            Inked(Circle(), c("#FFFFFF")).at(100, 110, 120, 120)
            // Kulaklar
            Inked(Ellipse(), c("#F3D9C4")).at(44, 92, 42, 22, rotation: -25)
            Inked(Ellipse(), c("#F3D9C4")).at(156, 92, 42, 22, rotation: 25)
            // Yüz
            Inked(Ellipse(), c("#F3D9C4")).at(100, 108, 96, 86)
            // Perçem
            Inked(Circle(), c("#FFFFFF")).at(88, 62, 34, 34)
            Inked(Circle(), c("#FFFFFF")).at(112, 60, 36, 36)
            CharacterFace(mood: mood, eyeSize: 22, eyeSpacing: 40, blink: blink).offset(y: 6)
        }
    }

    // Fındık — meraklı kırmızı sincap
    private var findik: some View {
        ZStack {
            // Kuyruk
            Inked(Ellipse(), c("#E2553B")).at(158, 92, 92, 120, rotation: 15)
            Inked(Circle(), c("#F08A5D")).at(166, 70, 40, 40)
            // Kulaklar
            Inked(Ellipse(), c("#E2553B")).at(66, 46, 30, 44, rotation: -15)
            Inked(Ellipse(), c("#E2553B")).at(130, 46, 30, 44, rotation: 15)
            // Gövde + kafa
            Inked(Ellipse(), c("#E2553B")).at(98, 108, 132, 128)
            Inked(Ellipse(), c("#FFE3C2")).at(98, 122, 90, 70)
            CharacterFace(mood: mood, eyeSize: 26, eyeSpacing: 50, blink: blink).offset(x: -2, y: 0)
            // Burun
            Inked(Ellipse(), Palette.ink).at(98, 108, 12, 9)
        }
    }

    // Lodos — şakacı turuncu uçurtma
    private var lodos: some View {
        ZStack {
            // Kuyruk ve fiyonklar
            Path { p in
                p.move(to: CGPoint(x: 100, y: 180))
                p.addCurve(to: CGPoint(x: 150, y: 196), control1: CGPoint(x: 110, y: 200), control2: CGPoint(x: 130, y: 180))
            }
            .stroke(Palette.ink, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            Inked(Circle(), c("#FFC93C")).at(124, 190, 14, 14)
            Inked(Circle(), c("#5BC8F5")).at(150, 196, 14, 14)
            Inked(RoundedKite(), c("#FF9F43")).at(100, 96, 150, 170)
            Path { p in
                p.move(to: CGPoint(x: 100, y: 22)); p.addLine(to: CGPoint(x: 100, y: 172))
                p.move(to: CGPoint(x: 34, y: 82)); p.addLine(to: CGPoint(x: 166, y: 82))
            }
            .stroke(Palette.ink.opacity(0.25), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            CharacterFace(mood: mood, eyeSize: 22, eyeSpacing: 48, blink: blink).offset(y: 4)
        }
    }

    // Bilge Baykuş Nur — gözlüklü yaşlı baykuş
    private var nur: some View {
        ZStack {
            // Kulak tüyleri
            Inked(Ellipse(), c("#8C6A52")).at(58, 42, 28, 46, rotation: -25)
            Inked(Ellipse(), c("#8C6A52")).at(142, 42, 28, 46, rotation: 25)
            // Gövde
            Inked(Ellipse(), c("#A47E62")).at(100, 108, 150, 160)
            Inked(Ellipse(), c("#F3DFC4")).at(100, 138, 92, 84)
            // Kanatlar
            Inked(Ellipse(), c("#8C6A52")).at(32, 126, 34, 76, rotation: 12)
            Inked(Ellipse(), c("#8C6A52")).at(168, 126, 34, 76, rotation: -12)
            CharacterFace(mood: mood, eyeSize: 22, eyeSpacing: 52, blink: blink).offset(y: -8)
            // Gözlük
            Circle().stroke(Palette.ink, lineWidth: 4).frame(width: 42, height: 42).position(x: 74, y: 84)
            Circle().stroke(Palette.ink, lineWidth: 4).frame(width: 42, height: 42).position(x: 126, y: 84)
            Capsule().fill(Palette.ink).frame(width: 12, height: 4).position(x: 100, y: 82)
            // Gaga
            Inked(Ellipse(), c("#FFC93C")).at(100, 106, 16, 14)
        }
    }

    // Yıldız — gökten düşmüş parlayan yıldız
    private var yildiz: some View {
        ZStack {
            Circle().fill(Palette.moon.opacity(0.45)).blur(radius: 18).frame(width: 190, height: 190)
            Inked(RoundedStar(), c("#FFD23F")).at(100, 104, 184, 184)
            CharacterFace(mood: mood, eyeSize: 22, eyeSpacing: 40, blink: blink).offset(y: 12)
        }
    }

    // Kaptan Midye — bıyıklı deniz feneri bekçisi yengeç
    private var kaptanMidye: some View {
        ZStack {
            // Kıskaçlar
            Inked(Circle(), c("#F25C54")).at(24, 108, 42, 42)
            Inked(Circle(), c("#F25C54")).at(176, 108, 42, 42)
            // Göz sapları
            Inked(Capsule(), c("#F25C54")).at(76, 62, 12, 40)
            Inked(Capsule(), c("#F25C54")).at(124, 62, 12, 40)
            // Gövde
            Inked(Ellipse(), c("#F25C54")).at(100, 124, 152, 110)
            // Bacaklar
            ForEach([56.0, 78, 122, 144], id: \.self) { x in
                Inked(Capsule(), c("#D94740")).at(x, 180, 12, 24)
            }
            // Kaptan şapkası
            Inked(RoundedRectangle(cornerRadius: 10), c("#2B4C7E")).at(100, 36, 70, 30)
            Inked(Capsule(), c("#FFFFFF")).at(100, 50, 86, 12)
            Inked(Circle(), c("#FFC93C")).at(100, 34, 12, 12)
            // Gözler sapların ucunda
            ZStack {
                if mood == .sleepy || blink {
                    ClosedEye().stroke(Palette.ink, style: StrokeStyle(lineWidth: 4, lineCap: .round)).frame(width: 18, height: 6).position(x: 76, y: 44)
                    ClosedEye().stroke(Palette.ink, style: StrokeStyle(lineWidth: 4, lineCap: .round)).frame(width: 18, height: 6).position(x: 124, y: 44)
                } else {
                    Inked(Circle(), .white).at(76, 44, 26, 26)
                    Inked(Circle(), .white).at(124, 44, 26, 26)
                    Circle().fill(Palette.ink).frame(width: mood == .surprised ? 16 : 12).position(x: 78, y: 45)
                    Circle().fill(Palette.ink).frame(width: mood == .surprised ? 16 : 12).position(x: 126, y: 45)
                }
            }
            // Bıyık + ağız
            Inked(MustacheShape(), c("#F7F2E8")).at(100, 118, 96, 30)
            Group {
                switch mood {
                case .happy: SmileShape().fill(Color(hex: "#7A1F2B")).frame(width: 20, height: 10).position(x: 100, y: 140)
                case .surprised: Ellipse().fill(Color(hex: "#7A1F2B")).frame(width: 12, height: 14).position(x: 100, y: 142)
                case .sleepy: Ellipse().fill(Color(hex: "#7A1F2B")).frame(width: 14, height: 9).position(x: 100, y: 142)
                }
            }
        }
    }
}

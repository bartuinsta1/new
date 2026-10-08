import SwiftUI

/// "Uyuyan bulut": kilitli ya da ücretli içeriği kilit simgesi yerine nazikçe örter (§2.3).
/// Çocuğu satın almaya yönlendirmez; üzerinde fiyat, kilit ya da "satın al" yoktur.
struct CloudLock: View {
    var size: CGFloat = 140
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathe = false

    var body: some View {
        ZStack {
            SleepingCloudShape()
                .fill(theme.mode == .day ? Color.white : Color(hex: "#C9C3E8"))
                .overlay(SleepingCloudShape().stroke(theme.outline, style: StrokeStyle(lineWidth: Metrics.outlineWidth, lineJoin: .round)))
            // Kapalı gözler
            HStack(spacing: size * 0.16) {
                ClosedEye().stroke(theme.outline, style: StrokeStyle(lineWidth: Metrics.outlineWidth, lineCap: .round))
                ClosedEye().stroke(theme.outline, style: StrokeStyle(lineWidth: Metrics.outlineWidth, lineCap: .round))
            }
            .frame(width: size * 0.42, height: size * 0.07)
            .offset(y: size * 0.06)
            // Yanak
            HStack(spacing: size * 0.34) {
                Circle().fill(Palette.berry.opacity(0.35))
                Circle().fill(Palette.berry.opacity(0.35))
            }
            .frame(width: size * 0.56, height: size * 0.09)
            .offset(y: size * 0.13)
            // Zzz
            Text("z").masalFont(.headline, scales: false)
                .foregroundStyle(theme.ink.opacity(0.7))
                .offset(x: size * 0.42, y: breathe ? -size * 0.42 : -size * 0.3)
                .opacity(breathe ? 0.2 : 0.9)
        }
        .frame(width: size, height: size * 0.68)
        .scaleEffect(breathe ? 1.03 : 1)
        .onAppear {
            guard let anim = Motion.idle(theme.mode, reduceMotion: reduceMotion) else { return }
            withAnimation(anim) { breathe = true }
        }
        .accessibilityElement()
        .accessibilityLabel(Text("Uyuyan bulut. Bu bölge henüz uyuyor."))
    }
}

/// Yuvarlak, köşesiz bulut silueti.
struct SleepingCloudShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        p.move(to: CGPoint(x: r.minX + w * 0.18, y: r.maxY))
        p.addCurve(to: CGPoint(x: r.minX + w * 0.12, y: r.minY + h * 0.45),
                   control1: CGPoint(x: r.minX - w * 0.04, y: r.maxY), control2: CGPoint(x: r.minX - w * 0.02, y: r.minY + h * 0.5))
        p.addCurve(to: CGPoint(x: r.minX + w * 0.42, y: r.minY + h * 0.12),
                   control1: CGPoint(x: r.minX + w * 0.12, y: r.minY + h * 0.12), control2: CGPoint(x: r.minX + w * 0.3, y: r.minY + h * 0.05))
        p.addCurve(to: CGPoint(x: r.minX + w * 0.78, y: r.minY + h * 0.3),
                   control1: CGPoint(x: r.minX + w * 0.55, y: r.minY - h * 0.08), control2: CGPoint(x: r.minX + w * 0.78, y: r.minY + h * 0.05))
        p.addCurve(to: CGPoint(x: r.minX + w * 0.84, y: r.maxY),
                   control1: CGPoint(x: r.maxX + w * 0.06, y: r.minY + h * 0.32), control2: CGPoint(x: r.maxX + w * 0.08, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

/// Uykulu kapalı göz: aşağı bakan yay.
struct ClosedEye: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.minY), control: CGPoint(x: r.midX, y: r.maxY * 1.6))
        return p
    }
}

#Preview("CloudLock") {
    HStack(spacing: 32) {
        CloudLock().padding().background(Palette.grass).themed(.day)
        CloudLock().padding().background(Palette.nightSky).themed(.night)
    }
}

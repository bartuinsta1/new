import SwiftUI

/// Bölgeye dokununca alttan balon gibi süzülerek çıkan masal kartları (en fazla 6) + konuşan rehber karakter.
struct RegionStoriesOverlay: View {
    let region: Region
    let items: [LibraryItemDTO]
    var isSleeping: (LibraryItemDTO) -> Bool
    var onSelect: (LibraryItemDTO) -> Void
    var onClose: () -> Void

    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var appeared = false
    @State private var sway = false

    var body: some View {
        VStack(spacing: Metrics.spacingS) {
            HStack(alignment: .bottom) {
                VoicePromptPlayer(text: WorldLines.intro(for: region), recordingKey: "vp_intro_\(region.rawValue)",
                                  speaker: region.guide, autoplay: false)
                Spacer()
                BubbleButton(systemImage: "xmark", color: .sky, accessibilityLabel: "Kapat", action: onClose)
            }
            .padding(.horizontal, Metrics.spacingM)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Metrics.spacingM) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        balloon(item, index: index)
                    }
                }
                .padding(.horizontal, Metrics.spacingM)
                .padding(.top, 28)
                .frame(minWidth: 0, maxWidth: .infinity)
            }
            .scrollClipDisabled()
        }
        .padding(.bottom, Metrics.spacingM)
        .frame(maxWidth: sizeClass == .regular ? 760 : .infinity)
        .onAppear {
            withAnimation(reduceMotion ? Motion.reduced : Motion.standard(theme.mode, reduceMotion: false)) { appeared = true }
            if let idle = Motion.idle(theme.mode, reduceMotion: reduceMotion) { withAnimation(idle) { sway = true } }
        }
    }

    private func balloon(_ item: LibraryItemDTO, index: Int) -> some View {
        let sleeping = isSleeping(item)
        let tilt = (index.isMultiple(of: 2) ? 1.0 : -1.0) * (sway ? 2 : -1)
        return Button {
            if sleeping {
                VoicePrompter.shared.speak(WorldLines.storySleeping, recordingKey: "vp_story_sleeping")
            } else {
                onSelect(item)
            }
        } label: {
            VStack(spacing: 0) {
                // Balon ipi
                BalloonString().stroke(theme.ink.opacity(0.5), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .frame(width: 20, height: 26)
                StoryCard(title: item.title, region: item.region, durationMinutes: item.durationMinutes,
                          characters: [item.region.guide], isSleeping: sleeping, width: 150)
            }
        }
        .buttonStyle(.plain)
        .rotationEffect(.degrees(reduceMotion ? 0 : tilt), anchor: .top)
        .offset(y: appeared ? 0 : 320)
        .opacity(appeared ? 1 : 0)
        .animation(reduceMotion ? Motion.reduced
                   : Motion.standard(theme.mode, reduceMotion: false).delay(Double(index) * 0.07), value: appeared)
        .accessibilityHint(sleeping ? Text("Bu masal şimdilik uyuyor") : Text("Masalı dinlemek için dokun"))
    }
}

/// Kartın üstündeki kıvrık balon ipi.
struct BalloonString: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.midX, y: r.minY))
        p.addCurve(to: CGPoint(x: r.midX, y: r.maxY),
                   control1: CGPoint(x: r.minX, y: r.minY + r.height * 0.35),
                   control2: CGPoint(x: r.maxX, y: r.minY + r.height * 0.65))
        return p
    }
}

#Preview("RegionStoriesOverlay") {
    ZStack(alignment: .bottom) {
        Palette.sky.opacity(0.4).ignoresSafeArea()
        RegionStoriesOverlay(region: .storytellerPlane,
                             items: MockStoryAPI.sampleLibrary(.tr).filter { $0.region == .storytellerPlane },
                             isSleeping: { !$0.isFree }, onSelect: { _ in }, onClose: {})
    }
    .themed(.day)
}

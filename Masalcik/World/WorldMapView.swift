import SwiftUI

/// Masal Adası haritası — Adım 3'te Canvas + kaydırma/yakınlaştırma ile gerçek haritaya dönüşecek.
/// Şimdilik bölgeleri bir ızgarada gösteren yer tutucu.
struct WorldMapView: View {
    @Environment(\.theme) private var theme
    @State private var showsGallery = false

    var body: some View {
        ZStack {
            if theme.mode == .night { NightSkyBackground() } else { Palette.sky.opacity(0.45).ignoresSafeArea() }
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160))], spacing: 24) {
                    ForEach(Region.allCases) { region in
                        VStack(spacing: 4) {
                            IslandRegionView(region: region, isLocked: region == .starHill, size: 140)
                            RegionLabel(region: region)
                        }
                    }
                }
                .padding()
            }
        }
        #if DEBUG
        .onLongPressGesture(minimumDuration: 2) { showsGallery = true }
        .sheet(isPresented: $showsGallery) { ComponentGalleryView() }
        #endif
    }
}

#Preview { WorldMapView().themed(.day) }

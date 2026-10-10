import CoreGraphics

/// Harita kamerası: dünya koordinatlarında merkez + yakınlaştırma.
/// Ekran noktası = (dünya noktası − merkez) × zoom + görüntü alanı / 2.
/// Saf değer tipi: kaydırma, yakınlaştırma ve odaklanma matematiği UI'dan bağımsız test edilir.
struct MapCamera: Equatable, Sendable {
    var center: CGPoint
    var zoom: CGFloat

    static let minZoom: CGFloat = 0.45
    static let maxZoom: CGFloat = 1.8
    /// Bölgeye dokununca kameranın yakınlaştığı seviye.
    static let focusZoom: CGFloat = 1.15

    /// Dünyanın sol üst köşesinin ekrandaki konumu.
    func origin(in viewport: CGSize) -> CGPoint {
        CGPoint(x: viewport.width / 2 - center.x * zoom, y: viewport.height / 2 - center.y * zoom)
    }

    func screenPoint(for world: CGPoint, in viewport: CGSize) -> CGPoint {
        let o = origin(in: viewport)
        return CGPoint(x: o.x + world.x * zoom, y: o.y + world.y * zoom)
    }

    /// Parmak sürükleme: içerik parmakla birlikte gider, yani kamera ters yöne.
    func panned(by translation: CGSize) -> MapCamera {
        MapCamera(center: CGPoint(x: center.x - translation.width / zoom, y: center.y - translation.height / zoom),
                  zoom: zoom)
    }

    func zoomed(by factor: CGFloat) -> MapCamera {
        MapCamera(center: center, zoom: zoom * factor)
    }

    /// Yakınlaştırmayı sınırlar ve dünyanın dışına (boş ekrana) kaydırmayı engeller.
    /// En uzak yakınlaştırma bile ekranı dünyayla doldurur; yine de sığmazsa o eksende ortalanır.
    func clamped(world: CGSize, viewport: CGSize) -> MapCamera {
        let covering = max(viewport.width / world.width, viewport.height / world.height)
        let z = min(max(zoom, Self.minZoom, covering), Self.maxZoom)
        func clampAxis(_ value: CGFloat, worldLength: CGFloat, viewLength: CGFloat) -> CGFloat {
            let half = viewLength / (2 * z)
            if worldLength <= 2 * half { return worldLength / 2 }
            return min(max(value, half), worldLength - half)
        }
        return MapCamera(center: CGPoint(x: clampAxis(center.x, worldLength: world.width, viewLength: viewport.width),
                                         y: clampAxis(center.y, worldLength: world.height, viewLength: viewport.height)),
                         zoom: z)
    }

    /// Bir dünya noktasına odaklan. `verticalBias` 0…1: noktayı ekranın üst kısmına taşır
    /// (alttan çıkan masal kartlarına yer açmak için; 0.2 → ekran yüksekliğinin %20'si kadar yukarı).
    static func focusing(on point: CGPoint, zoom: CGFloat = focusZoom, viewport: CGSize, verticalBias: CGFloat = 0) -> MapCamera {
        MapCamera(center: CGPoint(x: point.x, y: point.y + viewport.height * verticalBias / zoom), zoom: zoom)
    }
}

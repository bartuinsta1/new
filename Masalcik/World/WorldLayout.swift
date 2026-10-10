import CoreGraphics

/// Masal Adası'nın dünya koordinatları (1200×1500). Ada merkezde, çevresi deniz.
/// Dikeyde uzun: telefonun dik ekranı en uzak yakınlaştırmada bile denizle dolsun, boş alan kalmasın.
/// Gerçek illüstrasyon geldiğinde yalnızca bu dosyadaki konumlar ayarlanır.
enum WorldLayout {
    static let size = CGSize(width: 1200, height: 1500)
    static let islandCenter = CGPoint(x: 600, y: 760)
    static let islandRadius: CGFloat = 470

    /// Bölge ada üzerindeki boyutu (dünya birimi).
    static let regionSize: CGFloat = 170
    static let sleepHouseSize: CGFloat = 230

    static func position(of region: Region) -> CGPoint {
        switch region {
        case .sleepHouse: CGPoint(x: 600, y: 760)
        case .whisperForest: CGPoint(x: 345, y: 600)
        case .starHill: CGPoint(x: 860, y: 565)
        case .lighthouseCove: CGPoint(x: 895, y: 910)
        case .storytellerPlane: CGPoint(x: 320, y: 930)
        case .feelingsGarden: CGPoint(x: 605, y: 1075)
        case .treasureChest: CGPoint(x: 605, y: 470)
        }
    }

    /// İlk açılış kamerası: Uyku Evi ortada, komşu bölgeler (Fısıltı Ormanı ↔ Yıldız Tepesi) görünür.
    /// Telefonda ~0.56, iPad'de 1.0 (neredeyse tüm ada).
    static func initialZoom(for viewport: CGSize) -> CGFloat {
        min(max(viewport.width / 700, MapCamera.minZoom), 1)
    }
}

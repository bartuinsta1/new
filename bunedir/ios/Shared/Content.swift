import Foundation
import ImageIO
import UIKit

/// content/words.json'daki bir bölüm. Uygulama ve widget aynı paketlenmiş içeriği okur.
struct Word: Codable, Identifiable, Hashable, Sendable {
    let no: Int
    let slug: String
    let word: String
    let origin: String
    let meaning: String
    let oneLiner: String
    let story: String
    let cover: String
    let scenes: [String]
    let reel: String?

    var id: Int { no }
    /// Widget arka planı olarak dönen görseller: sahneler, yoksa kapak.
    var images: [String] { scenes.isEmpty ? [cover] : scenes }
}

struct ContentFile: Codable, Sendable {
    let version: Int
    let epoch: String
    let instagram: String
    let words: [Word]
}

/// Paketteki `content` klasörü (project.yml'de klasör referansı olarak eklenir; kopya tutulmaz).
enum Content {
    static let shared: ContentFile = load(from: Bundle.main)

    static func load(from bundle: Bundle) -> ContentFile {
        guard let url = bundle.url(forResource: "words", withExtension: "json", subdirectory: "content"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(ContentFile.self, from: data) else {
            fatalError("content/words.json pakette yok ya da bozuk")
        }
        return ContentFile(version: file.version, epoch: file.epoch, instagram: file.instagram,
                           words: file.words.sorted { $0.no < $1.no })
    }

    static var words: [Word] { shared.words }

    static func word(no: Int) -> Word? { words.first { $0.no == no } }

    static func imageURL(_ path: String, bundle: Bundle = .main) -> URL? {
        bundle.resourceURL?.appendingPathComponent("content").appendingPathComponent(path)
    }

    /// Görseli istenen en büyük kenara küçülterek yükler (widget'ın bellek sınırı ~30 MB).
    static func image(_ path: String, maxPixel: CGFloat = 900) -> UIImage? {
        guard let url = imageURL(path), let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }

    static func instagramURL(for word: Word) -> URL {
        URL(string: word.reel ?? shared.instagram)!
    }
}

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
    /// `aspect` (genişlik/yükseklik) verilirse görsel o orana kırpılır; dikeyde alta yakın hizalanır, çünkü
    /// sahnelerdeki karakterler hep altyazı kartının hemen üstünde, karenin alt kısmında durur.
    static func image(_ path: String, maxPixel: CGFloat = 900, aspect: CGFloat? = nil) -> UIImage? {
        guard let url = imageURL(path), let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
        guard let aspect, let rect = cropRect(width: CGFloat(cg.width), height: CGFloat(cg.height), aspect: aspect),
              let cropped = cg.cropping(to: rect) else { return UIImage(cgImage: cg) }
        return UIImage(cgImage: cropped)
    }

    static func cropRect(width w: CGFloat, height h: CGFloat, aspect: CGFloat) -> CGRect? {
        if w / h > aspect {             // fazla geniş: yatayda ortala
            let cw = (h * aspect).rounded()
            return CGRect(x: ((w - cw) / 2).rounded(), y: 0, width: cw, height: h)
        } else if w / h < aspect {      // fazla uzun: dikeyde %80 aşağıda
            let ch = (w / aspect).rounded()
            return CGRect(x: 0, y: ((h - ch) * 0.8).rounded(), width: w, height: ch)
        }
        return nil
    }

    static func instagramURL(for word: Word) -> URL {
        URL(string: word.reel ?? shared.instagram)!
    }
}

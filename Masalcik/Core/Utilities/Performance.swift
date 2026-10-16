import os

/// Instruments ("Points of Interest" / os_signpost) ölçüm noktaları. Üretimde de açık; maliyeti ihmal edilebilir.
/// Hedefler (Adım 11, iPhone 12 sınıfı cihaz):
/// • soğuk açılış → harita ilk kare < 1,5 sn
/// • "Bu Gece"de istek → ilk paragraf sesi < 20 sn (sunucu üretim + güvenlik; bekleme ekranı var)
/// • haritada kaydırma/yakınlaştırma 60 fps (tek Canvas zemin, `.equatable()`)
/// • oynatıcıda ekran kararınca gökyüzü animasyonu durur (pil)
enum Perf {
    nonisolated(unsafe) static let signposter = OSSignposter(subsystem: "com.masalcik.app", category: .pointsOfInterest)

    /// Masal isteğinden ilk paragrafa kadar geçen süre.
    static func beginStoryGeneration() -> OSSignpostIntervalState {
        signposter.beginInterval("StoryFirstParagraph", id: signposter.makeSignpostID())
    }

    static func end(_ name: StaticString, _ state: OSSignpostIntervalState) {
        signposter.endInterval(name, state)
    }

    static func event(_ name: StaticString) {
        signposter.emitEvent(name)
    }
}

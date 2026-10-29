import Foundation
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

/// Cihaza göre görsel bütçe. Desteklenen en eski cihazlar (iOS 17: iPhone XS/XR, 2018; 3–4 GB RAM, A12) ve
/// Düşük Güç Modu / ısınma durumunda süs animasyonları kendiliğinden hafifler; içerik ve akış aynı kalır.
struct PerformanceBudget: Equatable, Sendable {
    /// Gece gökyüzündeki yıldız ve ateşböceği sayısı, animasyon kare hızı.
    var stars: Int
    var fireflies: Int
    var framesPerSecond: Double
    /// Bekleme ekranındaki uçuşan yıldızlar.
    var showsFlyingStars: Bool

    static let full = PerformanceBudget(stars: 70, fireflies: 14, framesPerSecond: 24, showsFlyingStars: true)
    static let reduced = PerformanceBudget(stars: 36, fireflies: 6, framesPerSecond: 12, showsFlyingStars: false)

    /// - Parameters:
    ///   - memoryBytes: fiziksel bellek (ProcessInfo)
    ///   - modelIdentifier: ör. "iPhone11,8" (iPhone XR)
    static func make(memoryBytes: UInt64, modelIdentifier: String, lowPowerMode: Bool,
                     thermalState: ProcessInfo.ThermalState) -> PerformanceBudget {
        if lowPowerMode || thermalState == .serious || thermalState == .critical { return .reduced }
        // 2018–2019 cihaz aileleri: iPhone11,* (XS/XR), iPad7,* / iPad8,* (6.–7. nesil iPad, 2018 iPad Pro)
        let legacyFamilies = ["iPhone11,", "iPad7,", "iPad8,"]
        if legacyFamilies.contains(where: modelIdentifier.hasPrefix) { return .reduced }
        if memoryBytes > 0 && memoryBytes < 3_500_000_000 { return .reduced }
        return .full
    }

    @MainActor static var current: PerformanceBudget {
        let info = ProcessInfo.processInfo
        return make(memoryBytes: info.physicalMemory, modelIdentifier: deviceModelIdentifier(),
                    lowPowerMode: info.isLowPowerModeEnabled, thermalState: info.thermalState)
    }

    static func deviceModelIdentifier() -> String {
        #if targetEnvironment(simulator)
        return ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? "simulator"
        #else
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { raw in
            String(decoding: raw.prefix { $0 != 0 }, as: UTF8.self)
        }
        #endif
    }
}

import MediaPlayer
import SwiftUI

/// Kilit ekranı ve Denetim Merkezi (§3.4): kapak, başlık, oynat/duraklat.
/// İleri/geri sarma ve "sonraki" kapalı: uyku dostu tasarım, sıradaki masala geçilmez.
@MainActor
final class NowPlayingController {
    private var targets: [Any] = []

    func activate(title: String, artwork: UIImage?, estimatedDuration: TimeInterval,
                  onPlay: @escaping @MainActor () -> Void, onPause: @escaping @MainActor () -> Void) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: AppConfig.appName,
            MPMediaItemPropertyPlaybackDuration: estimatedDuration,
            MPNowPlayingInfoPropertyPlaybackRate: 1.0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
        ]
        if let artwork {
            info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: artwork.size) { _ in artwork }
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        let center = MPRemoteCommandCenter.shared()
        for command in [center.nextTrackCommand, center.previousTrackCommand, center.skipForwardCommand,
                        center.skipBackwardCommand, center.changePlaybackPositionCommand] {
            command.isEnabled = false
        }
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        targets = [
            center.playCommand.addTarget { _ in MainActor.assumeIsolated { onPlay() }; return .success },
            center.pauseCommand.addTarget { _ in MainActor.assumeIsolated { onPause() }; return .success },
            center.togglePlayPauseCommand.addTarget { _ in
                MainActor.assumeIsolated {
                    if MPNowPlayingInfoCenter.default().playbackState == .playing { onPause() } else { onPlay() }
                }
                return .success
            },
        ]
    }

    func update(elapsed: TimeInterval, isPlaying: Bool) {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsed
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused
    }

    func deactivate() {
        let center = MPRemoteCommandCenter.shared()
        for target in targets {
            center.playCommand.removeTarget(target)
            center.pauseCommand.removeTarget(target)
            center.togglePlayPauseCommand.removeTarget(target)
        }
        targets = []
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    /// Kapak: bölge sahnesi + rehber karakter (gece). Gerçek kapak illüstrasyonları gelince değiştirilecek.
    static func renderArtwork(region: Region, character: CharacterID) -> UIImage? {
        let view = ZStack {
            RegionBackdrop(region: region)
            CharacterView(character: character, mood: .sleepy, size: 380, isInteractive: false)
                .offset(y: 50)
        }
        .frame(width: 600, height: 600)
        .themed(.night)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1
        return renderer.uiImage
    }
}

/// Ekran parlaklığını masal ilerledikçe yavaşça düşürür (§3.4) ve oynatıcı kapanınca/arka plana geçince geri verir.
/// Görsel kararma (siyah katman) ayrıca `DimmingCurve` ile uygulanır; parlaklık değişimi bunun üstüne yumuşak bir destektir.
@MainActor
final class ScreenDimmer {
    private var original: CGFloat?
    private var screen: UIScreen? {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen }.first
    }

    /// `dimming` 0…0.9 → parlaklık özgün değerin %100'ünden %30'una iner. Hiçbir zaman artırmaz.
    func apply(dimming: Double) {
        guard let screen else { return }
        if original == nil { original = screen.brightness }
        guard let original else { return }
        let target = original * CGFloat(1 - min(max(dimming, 0), 0.9) * 0.78)
        if abs(screen.brightness - target) > 0.01 { screen.brightness = min(target, original) }
    }

    func restore() {
        guard let original, let screen else { return }
        screen.brightness = original
        self.original = nil
    }
}

/// Çevrimdışı dinleme (§5.1): dinlenen masalın seslerini Application Support/Audio/<masal>/ altına indirir.
enum AudioDownloader {
    static func directory(for storyID: String) -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let safe = storyID.replacingOccurrences(of: "/", with: "_")
        return base.appending(path: "Audio/\(safe)", directoryHint: .isDirectory)
    }

    static func localURL(storyID: String, fileName: String) -> URL {
        directory(for: storyID).appending(path: fileName)
    }

    /// İndirilmemiş paragrafları indirir; başarılı olanların dosya adını modele yazar. Hata sessizce yutulur
    /// (bir sonraki dinlemede yeniden denenir).
    @MainActor
    static func download(_ story: Story, session: URLSession = .shared) async {
        let dir = directory(for: story.id)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // Çocuğun adını içeren ses dosyaları iCloud yedeğine gitmesin.
        var resource = URLResourceValues()
        resource.isExcludedFromBackup = true
        var mutableDir = dir
        try? mutableDir.setResourceValues(resource)

        for paragraph in story.orderedParagraphs where paragraph.localAudioFileName == nil {
            guard let remote = paragraph.audioURL else { continue }
            let name = "\(paragraph.index).mp3"
            do {
                let (tmp, response) = try await session.download(from: remote)
                guard (response as? HTTPURLResponse)?.statusCode == 200 else { continue }
                let dest = dir.appending(path: name)
                try? FileManager.default.removeItem(at: dest)
                try FileManager.default.moveItem(at: tmp, to: dest)
                paragraph.localAudioFileName = name
            } catch {
                continue
            }
        }
    }
}

import SwiftUI
import UIKit
import AudioToolbox

/// Dokunuş geri bildirimi: kısa yumuşak ses + hafif titreşim (§2.6).
/// VARSAYIM: Gerçek ses efektleri (Resources/Sounds/tap_soft.caf vb.) gelene kadar sistem tık sesi kullanılır.
@MainActor
enum Feedback {
    static var hapticsEnabled = true
    static var soundsEnabled = true

    private static let soft = UIImpactFeedbackGenerator(style: .soft)

    static func tap() {
        if hapticsEnabled { soft.impactOccurred(intensity: 0.6) }
        if soundsEnabled { AudioServicesPlaySystemSound(1104) }
    }

    static func success() {
        if hapticsEnabled { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    }

    static func error() {
        if hapticsEnabled { UINotificationFeedbackGenerator().notificationOccurred(.error) }
    }
}

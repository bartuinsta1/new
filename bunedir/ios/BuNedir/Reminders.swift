import Foundation
import UserNotifications

/// İsteğe bağlı günlük bildirim: "Günün kelimesi: Teavün". Sunucu yok; önümüzdeki 30 gün yerelde
/// planlanır ve uygulama her açıldığında ileri kaydırılır (iOS en fazla 64 bekleyen bildirim tutar).
enum Reminders {
    static let hourKey = "reminders.hour"
    static let enabledKey = "reminders.enabled"
    private static let days = 30

    static var isEnabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    static var hour: Int {
        let h = UserDefaults.standard.object(forKey: hourKey) as? Int
        return h ?? 9
    }

    static func enable(hour: Int) async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
        UserDefaults.standard.set(granted, forKey: enabledKey)
        UserDefaults.standard.set(hour, forKey: hourKey)
        if granted { await reschedule() }
        return granted
    }

    static func disable() {
        UserDefaults.standard.set(false, forKey: enabledKey)
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    static func reschedule(from date: Date = .now) async {
        guard isEnabled else { return }
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        let cal = Calendar.current
        for offset in 0..<days {
            guard let day = cal.date(byAdding: .day, value: offset, to: cal.startOfDay(for: date)),
                  let fire = cal.date(bySettingHour: hour, minute: 0, second: 0, of: day), fire > date else { continue }
            let word = Daily.word(forDay: Daily.dayIndex(for: day))
            let content = UNMutableNotificationContent()
            content.title = "Günün kelimesi: \(word.word)"
            content.body = word.oneLiner
            content.userInfo = ["no": word.no]
            let comps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: fire)
            let req = UNNotificationRequest(identifier: "word-\(offset)", content: content,
                                            trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
            try? await center.add(req)
        }
    }
}

import Foundation

/// Haftalık özet (§3.7): kaç masal dinlendi, kaç gece, tahmini uykuya dalma saati (masalın bitişine göre).
struct WeeklySummary: Equatable {
    var stories: Int
    var nights: Int
    /// Ortalama masal bitiş saati (dakika, gece yarısından itibaren; 0…1439). Veri yoksa nil.
    var averageEndMinute: Int?

    /// Son 7 gece. Bitiş saatleri 18:00'den itibaren sayılarak ortalanır; böylece 23:50 ile 00:10'un
    /// ortalaması öğlen değil, gece yarısı olur.
    static func make(endTimes: [Date], now: Date, calendar: Calendar = .current) -> WeeklySummary {
        let weekStart = now.addingTimeInterval(-7 * 86_400)
        let recent = endTimes.filter { $0 > weekStart && $0 <= now }
        let nights = Set(recent.map { RewardRules.nightKey(for: $0, calendar: calendar) }).count
        guard !recent.isEmpty else { return WeeklySummary(stories: 0, nights: 0, averageEndMinute: nil) }
        let pivot = 18 * 60
        let shifted = recent.map { d -> Int in
            let c = calendar.dateComponents([.hour, .minute], from: d)
            let m = (c.hour ?? 0) * 60 + (c.minute ?? 0)
            return (m - pivot + 1440) % 1440
        }
        let avg = shifted.reduce(0, +) / shifted.count
        return WeeklySummary(stories: recent.count, nights: nights, averageEndMinute: (avg + pivot) % 1440)
    }

    /// "20:45" biçimi (yerel ayara göre 12/24 saat).
    func formattedAverage(locale: Locale = .current) -> String? {
        guard let m = averageEndMinute else { return nil }
        var c = DateComponents()
        c.hour = m / 60
        c.minute = m % 60
        guard let date = Calendar.current.date(from: c) else { return nil }
        return date.formatted(Date.FormatStyle(date: .omitted, time: .shortened).locale(locale))
    }
}

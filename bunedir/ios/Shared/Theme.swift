import SwiftUI

/// Videolardaki kâğıt kesik görünümü: krem kart, koyu mürekkep, hardal vurgu.
enum Theme {
    static let paper = Color(red: 0.957, green: 0.933, blue: 0.882)     // #F4EEE1
    static let ink = Color(red: 0.169, green: 0.149, blue: 0.133)       // #2B2622
    static let accent = Color(red: 0.690, green: 0.478, blue: 0.165)    // #B07A2A
    static let review = Color(red: 0.690, green: 0.290, blue: 0.200)    // #B04A33
    static let sky = Color(red: 0.851, green: 0.890, blue: 0.910)
    static let grass = Color(red: 0.533, green: 0.627, blue: 0.408)

    static func word(_ size: CGFloat) -> Font { .system(size: size, weight: .bold, design: .serif) }
    static func body(_ size: CGFloat, weight: Font.Weight = .medium) -> Font { .system(size: size, weight: weight, design: .rounded) }
}

/// Kenarları hafif yamuk, gölgeli kâğıt kart.
struct PaperCard<Inner: View>: View {
    var tilt: Double = 0
    var padding: CGFloat = 12
    @ViewBuilder var content: Inner

    var body: some View {
        content
            .padding(padding)
            .background(
                Rectangle()
                    .fill(Theme.paper)
                    .shadow(color: .black.opacity(0.18), radius: 2, x: 0, y: 1.5)
            )
            .rotationEffect(.degrees(tilt))
    }
}

/// Paketteki sahne görselini dolduracak şekilde çizer; yoksa gökyüzü/çimen düz zemin.
struct SceneBackground: View {
    let path: String
    var maxPixel: CGFloat = 900
    var aspect: CGFloat? = nil

    var body: some View {
        if let img = Content.image(path, maxPixel: maxPixel, aspect: aspect) {
            Image(uiImage: img).resizable().scaledToFill()
        } else {
            LinearGradient(colors: [Theme.sky, Theme.sky, Theme.grass], startPoint: .top, endPoint: .bottom)
        }
    }
}

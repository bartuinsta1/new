import Foundation
import SwiftData
@testable import Masalcik

/// SwiftData modelleri kapsayıcılarına bağlıdır: `ModelContext` alınıp kapsayıcı bırakılırsa modele erişimde
/// çökme olur. Testler bellek içi kapsayıcıyı buradan alır; kapsayıcı test süreci boyunca yaşar.
@MainActor
enum TestStore {
    private static var retained: [ModelContainer] = []

    static func context(seed: Bool = false) -> ModelContext {
        let container = PersistenceController(inMemory: true, seed: seed).container
        retained.append(container)
        return container.mainContext
    }
}

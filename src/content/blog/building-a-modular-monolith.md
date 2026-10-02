---
title: "Building a Modular Monolith"
date: 2025-12-13
excerpt: "A practical guide to a modular monolith in Kotlin and Spring Boot: where to draw the boundaries, how to make the build enforce them, and how modules talk."
tags: ["Software Architecture"]
cover: "/blog/building-a-modular-monolith/cover.webp"
shelf: craft
---

> **[View Example on GitHub](https://github.com/wingedsheep/eco-logique)**: complete source code in Kotlin + Spring Boot

**Contents**

- [Intro: The Coupling Problem](#introduction)
- [Part 1: Where to Draw the Lines](#part-1)
- [Part 2: Enforcing the Lines](#part-2)
- [Part 3: Inside the Modules](#part-3)
- [Part 4: Isolating Data](#part-4)
- [Part 5: Module Communication](#part-5)
- [Part 6: Errors and Validation](#part-6)
- [Part 7: Testing](#part-7)
- [Part 8: Putting It All Together](#part-8)
- [Part 9: Building With Coding Agents](#part-9)
- [End: Conclusion](#conclusion)

<a id="introduction"></a>

## Introduction

Most backend codebases don't start broken. They start small, coherent, and easy to change. Then time passes.

Features ship. Teams grow. Deadlines happen. And one day you realize that changing the checkout flow requires touching seven packages, three shared utilities, and a database table that four other features depend on. You're not sure what will break, so you test everything manually and deploy on a Friday afternoon with your finger hovering over the rollback button.

This is two problems working together. **Low cohesion**: related code is scattered across the codebase instead of living together. **High coupling**: unrelated modules depend on each other's internals, so changes ripple outward in unpredictable ways.

When it gets bad enough, teams usually respond in one of two ways.

Some reach for **microservices**. Split everything into separate services. Nothing can import anything directly anymore, so the code can't tangle. The coupling doesn't go away, though: it moves into the network, and plenty of teams end up with a distributed monolith, services that still have to change and deploy together. And it trades code complexity for operational complexity: network failures become normal failures, data consistency requires careful choreography, and "running locally" becomes a research project. You wanted to fix your architecture and accidentally became a distributed systems team.

Others try **better discipline**. Add architectural guidelines. Improve folder structure. Be more careful in code review. This is cheaper and less disruptive—but discipline erodes. Someone imports an internal class because it's convenient. Someone adds a "temporary" dependency to meet a deadline. Guidelines without enforcement are aspirations.

A modular monolith is a way to make the second approach actually stick. It's a monolith where boundaries are enforced by the build system—where you *can't* import another module's internals because the compiler won't let you.

You keep the operational simplicity of a single deployable. But you get real architecture: explicit contracts between modules, isolated data, and the ability to change one module without accidentally breaking others. When something goes wrong at 3am, there's one service to check, one log to read, one thing to restart.

This guide is a practical walkthrough of building one in Kotlin and Spring Boot. I'll cover where to draw boundaries, how to enforce them with Gradle, how to structure code inside modules, how to isolate data, how modules communicate, error handling, and testing. The focus is on patterns that work in real codebases—things I've learned building systems this way, not theoretical ideals from a whiteboard.

---

<a id="part-1"></a>

## Part 1: Where to Draw the Lines

We want boundaries. But where should they go?

Domain-Driven Design has opinions about this. DDD has a reputation for academic terminology and books thicker than your laptop, but ignore all that—the part that matters for architecture is simple: organize around business domains, not technical layers.

### Domains, Not Layers

Most backend projects start with a structure like this:

```
com.example.app/
├── controllers/
│   ├── ProductController.kt
│   ├── OrderController.kt
│   └── ShippingController.kt
├── services/
│   ├── ProductService.kt
│   ├── OrderService.kt
│   └── ShippingService.kt
└── repositories/
    ├── ProductRepository.kt
    ├── OrderRepository.kt
    └── ShippingRepository.kt
```

All controllers in one folder, all services in another, all repositories in a third. It feels tidy. It looks professional in code review.

It's also a mistake.

When you add a shipping feature, you touch files in three different folders. When you want to understand how shipping works, you're jumping between layers, assembling the picture from scattered pieces. And nothing stops `OrderService` from calling `ProductRepository` directly—the folder structure creates the *appearance* of organization without any actual boundaries.

The alternative is organizing by domain:

```
com.example.app/
├── products/
│   ├── ProductController.kt
│   ├── ProductService.kt
│   └── ProductRepository.kt
├── orders/
│   ├── OrderController.kt
│   ├── OrderService.kt
│   └── OrderRepository.kt
└── shipping/
    ├── ShippingController.kt
    ├── ShippingService.kt
    └── ShippingRepository.kt
```

Now a `shipping/` folder contains everything about shipping. New developers can open one folder and understand one capability. Changes stay local. And the structure reveals where real boundaries could be enforced.

### The Same Word, Different Meanings

Ask three people in an e-commerce company what "Product" means:

The **catalog team** says name, description, price, images, sustainability rating—it's what customers browse and search. The **warehouse team** says weight, dimensions, and whether it's fragile—they need to put it in a box, not describe it. The **inventory team** says a product ID and a quantity on a shelf—they don't care what it looks like.

These aren't three views of the same thing. They're three different concepts that happen to share a name. DDD calls this a *bounded context*: a boundary within which a term has a consistent meaning. You can call it whatever you want. The point is that "Product" means something different depending on who you ask.

The instinct is to create one `Product` class that serves everyone:

```kotlin
data class Product(
    val id: ProductId,
    val name: String,
    val description: String,
    val price: Money,
    val images: List<Image>,
    val sustainabilityRating: String,
    val weightGrams: Int,
    val dimensions: Dimensions,
    val isFragile: Boolean,
    val warehouseQuantities: Map<WarehouseId, Int>,
    // ... and it keeps growing
)
```

One class, no duplication—efficient, right? But this is how coupling starts. The catalog team adds `images`; now warehouse code depends on it. The warehouse team adds `dimensions`; now catalog code carries that weight. Everyone's afraid to touch this class, and everyone has to.

The fix is recognizing that each context should define its own model:

```kotlin
// In the catalog context
data class Product(
    val id: ProductId,
    val name: String,
    val description: String,
    val price: Money,
    val images: List<Image>,
)

// In the shipping context
data class ShippableItem(
    val productId: ProductId,
    val weightGrams: Int,
    val dimensions: Dimensions,
    val isFragile: Boolean,
)
```

Yes, you now have two classes with some overlapping fields. This feels wasteful until you realize the alternative is a God object that grows until it collapses under its own weight. Duplication between contexts is healthy. Duplication within a context is a code smell. Learn the difference.

### Finding the Right Boundaries

There's no algorithm for this, but there are useful signals.

Listen for different vocabulary. When warehouse staff say "pick" and "pack" while marketing says "browse" and "wishlist," you're hearing two contexts. Language differences usually reflect model differences—this is more reliable than most technical heuristics. If you want a structured way to hear them, run an Event Storming session: put the people who know the business in a room, have them write down everything that *happens* ("order placed", "parcel picked", "payment refunded") on sticky notes along a timeline, and watch where the vocabulary and the people change. Those places are your candidate boundaries.

![](/blog/building-a-modular-monolith/image-38.webp)

Different rates of change are another clue. Pricing rules might change weekly; shipping carrier integrations change quarterly. Bundling them means every pricing change risks breaking shipping. And if different people are responsible for different areas, those are natural seams. Conway's Law isn't just an observation—it's a force you can work with instead of against.

Transaction boundaries help too. If two operations almost always happen together in the same database transaction, they probably belong together. If they don't need transactional consistency, that's a hint they could be separate. Conversely, if module A makes fifteen calls to module B for every operation, maybe they shouldn't be separate at all.

Size matters. Can you describe the module in one sentence without conjunctions? "Manages the product catalog" works. "Handles payments and shipping and user profiles" is three modules wearing a trench coat.

![](/blog/building-a-modular-monolith/image-48.webp)

Watch out for a few traps. Don't model from the database up—tables reflect storage decisions, not business boundaries. Don't share entities across contexts just because it feels DRY; if you're adding fields that only one context uses, you've got coupling. Don't slice too thin—you don't need a separate module for "OrderValidation," that's just part of orders. And don't draw boundaries that cut across team ownership. The best technical boundary won't help if nobody knows who's responsible for it.

### The Example We'll Use

For this guide, we're building an e-commerce system with six bounded contexts:

**Products** owns the catalog—names, descriptions, prices, images. **Users** owns identity and profiles. **Inventory** tracks what's in stock and where. **Orders** handles purchases and their lifecycle. **Payment** takes the money. **Shipping** manages fulfillment and delivery.

Products and Users sit at the bottom: they depend on nothing. Inventory depends on Products. Orders depends on Products (needs to know what's being ordered), Inventory (needs to check availability) and Users (needs to know who's ordering). Payment and Shipping sit on top: both depend on Orders and Users, and Shipping also needs Products for weights and dimensions. Nobody depends on Payment or Shipping.

<figure>
<img src="/blog/building-a-modular-monolith/image-62.webp" alt="" loading="lazy" />
<figcaption>Module dependencies</figcaption>
</figure>

These boundaries aren't perfect. We'll discover friction as we build, and that's normal: a boundary is a guess made at the moment you know the least about the domain.

So guess coarse. If you're unsure whether something is one module or two, make it one. Splitting a big module later is cheap: the code that moves out already lives together, and the compiler tells you every place that has to change. Merging two modules back together is the expensive direction. By then each has its own API, its own schema and its own events, and everything that grew up around the seam has to be undone. Enforced boundaries (next section) make a wrong boundary visible early, but they don't make it free to move.

---

<a id="part-2"></a>

## Part 2: Enforcing the Lines

Boundaries on a whiteboard are aspirations. Boundaries in the build system are architecture.

Without enforcement, boundaries erode. It happens slowly, always with good intentions. Someone imports an internal class because it's convenient. Someone adds a "temporary" dependency to meet a deadline. Six months later, your modules are coupled in ways nobody intended, and untangling them is a project of its own.

The solution is to make invalid dependencies a compiler error, not a code review discussion.

### Contracts, Not Implementations

When Shipping needs product information, the obvious approach is to call the Products service directly:

```kotlin
class ShippingService(
    private val productService: ProductServiceImpl
) {
    fun calculateWeight(productId: ProductId): Grams {
        val product = productService.getProduct(productId)
        return product.weightGrams
    }
}
```

This works, but it creates tight coupling. Shipping now depends on `ProductServiceImpl`—a concrete class with its own dependencies, internal structure, and implementation details. And the coupling is transitive: `ProductServiceImpl` depends on `ProductRepository`, which depends on database entities. Shipping has indirectly coupled itself to the Products database schema.

The fix is depending on a contract instead of an implementation:

```kotlin
interface ProductServiceApi {
    fun getProduct(id: ProductId): ProductDto
}

class ProductServiceImpl(
    private val repository: ProductRepository
) : ProductServiceApi {
    override fun getProduct(id: ProductId): ProductDto { ... }
}

class ShippingService(
    private val productService: ProductServiceApi  // Interface, not implementation
) {
    fun calculateWeight(productId: ProductId): Grams {
        val product = productService.getProduct(productId)
        return Grams(product.weightGrams)
    }
}
```

Now Shipping depends on `ProductServiceApi`—an interface with no implementation details. The Products team can refactor their internals, change their database, swap out libraries. As long as they fulfill the contract, Shipping won't notice.

![direct vs contract based dependencies](/blog/building-a-modular-monolith/image-52.webp)

But where does the contract live? If the interface sits inside the Products module alongside its implementation, Shipping still depends on the Products module. We need to separate the contract into its own place.

### The API/Implementation Split

In Gradle, we split each bounded context into two modules:

```
products/
├── products-api/     # The contract
└── products-impl/    # The implementation
```

The rules are simple. An `-impl` module depends on its own `-api` (it implements the contract). Other modules depend only on `-api` modules, never on `-impl`. No circular dependencies.

```kotlin
// shipping-impl/build.gradle.kts
dependencies {
    implementation(project(":shipping:shipping-api"))
    implementation(project(":products:products-api"))  // Contract only
    // Cannot add products-impl - that's the whole point
}
```

If someone tries to import a class from `products-impl`, the build fails. No discussion needed.

There's a bonus you get for free: faster builds. Gradle only recompiles a module's dependents when its public signatures (its ABI) change. Since everyone depends on `-api` modules, which change rarely, a change inside `products-impl` recompiles `products-impl` and nothing else. In a single-module monolith, every change can recompile everything.

The `-api` module contains the public contract: interfaces defining what the module can do, DTOs for data exchange, events other modules might listen to, and error types so callers know what can go wrong.

```kotlin
// products-api
interface ProductServiceApi {
    fun getProduct(id: ProductId): Result<ProductDto, ProductError>
}

data class ProductDto(
    val id: ProductId,
    val name: String,
    val weightGrams: Int,
)

sealed class ProductError {
    data class NotFound(val id: ProductId) : ProductError()
}
```

The `-impl` module contains everything private: domain models with business logic, service implementations, persistence layer, controllers. Mark these `internal` so Kotlin reinforces the boundary:

```kotlin
// products-impl
@Service
internal class ProductServiceImpl(
    private val repository: ProductRepository,
) : ProductServiceApi {
    // Maps between internal domain model and public DTOs
}

internal data class Product(
    val id: ProductId,
    val name: String,
    val price: Money,
) {
    init {
        require(name.isNotBlank()) { "Name required" }
    }
}
```

### Foreign References

There's a subtle trap when defining contracts. Consider an event that Shipping publishes when a package is delivered:

```kotlin
// shipping-api
data class ShipmentDeliveredEvent(
    val shipmentId: ShipmentId,
    val orderId: OrderId,  // Where does this come from?
)
```

`OrderId` lives in `orders-api`. So `shipping-api` depends on `orders-api`. Now if Orders wants to track shipment status and needs `ShipmentId`, you have a cycle between API modules. Gradle won't compile it.

The instinct is to extract both ID types to a common module. That works initially. Then Inventory needs `ProductId`. Then Notifications needs `CustomerId`. Soon your common module contains every ID type in the system, and you've recreated coupling with extra steps.

The fix: each module only defines types it *owns*. For foreign references, you could use primitives. Or, if you want to prevent passing a shipment id into an order id field by accident, you can create a reference type like `OrderReference` that is defined locally in the shipping module.

```kotlin
// shipping-api
@JvmInline value class OrderReference(val value: String)

data class ShipmentDeliveredEvent(
    val shipmentId: ShipmentId,
    val orderReference: OrderReference,
    val deliveredAt: Instant,
)
```

Type safety without coupling. The consuming code converts at the boundary:

```kotlin
// orders-impl
@Component
internal class ShippingEventListener(
    private val orderService: OrderService,
) {
    @ApplicationModuleListener  // more on listeners in Part 5
    fun on(event: ShipmentDeliveredEvent) {
        val orderId = OrderId(event.orderReference.value)
        orderService.markAsDelivered(orderId, event.deliveredAt)
    }
}
```

This pattern makes sense for Shipping and Orders because they're peers—each might reference the other. But not every relationship is bidirectional. Invoicing is always *for* an order, but orders never reference invoices. The dependency only flows one way, so `invoicing-api` can depend on `orders-api` and use `OrderId` directly if you are more pragmatic about this.

### Keeping Bounded Contexts Clean

With primitives or local reference types at the boundary, you won't hit Gradle cycles. But there's a subtler concern: conceptual pollution.

Products is a foundational module—it defines what you can buy. Orders tracks purchases. Conceptually, Orders needs to know about Products (you order *something*), but Products shouldn't need to know about Orders. A product exists independently of whether anyone ordered it.

This isn't a technical constraint—with primitives, you *could* make Products depend on Orders. But you shouldn't. Every dependency accumulates knowledge. When Products depends on Orders, the Products team needs to understand order concepts to work on their module.

Think of modules as layers. Foundational modules at the bottom know nothing about modules above them:

![Modules as layers: Payment and Shipping on top, then Orders, then Inventory, with Products and Users as the foundations](/blog/building-a-modular-monolith/layers.webp)

When an arrow would point upward, pause and reconsider. Usually there's an event that could flow the other direction, or an SPI waiting to be extracted.

Events don't make a dependency disappear, though. They flip who knows whom: the listener depends on the publisher's `-api`, because that's where the event class lives. The `ShippingEventListener` above means `orders-impl` depends on `shipping-api`, so there's an arrow pointing upward after all. That's a deliberate trade. It's the weakest kind of dependency (Orders knows one event class, nothing about how Shipping works), it lives in `-impl` only, and the alternative, Shipping calling `orderService.markAsDelivered()`, would make Shipping drive the order's state machine. Upward arrows like this one should be rare, deliberate, and visible in your module validation rules, not something that just happens.

### Service Provider Interfaces

Sometimes a foundational module needs input from higher-level modules without depending on them. Products wants to prevent deletion of a product with pending orders—but shouldn't know about Orders.

The solution is a Service Provider Interface (SPI). Products defines an interface for the *question* it wants to ask. Other modules provide *answers* by implementing it.

```kotlin
// products-api/spi/ProductDeletionBlocker.kt
interface ProductDeletionBlocker {
    fun canDelete(productId: ProductId): Boolean
}
```

Orders implements it:

```kotlin
// orders-impl
@Service
internal class OrderBasedDeletionBlocker(
    private val orderRepository: OrderRepository
) : ProductDeletionBlocker {
    override fun canDelete(productId: ProductId): Boolean {
        return !orderRepository.existsPendingForProduct(productId)
    }
}
```

Products consumes all implementations without knowing where they come from:

```kotlin
// products-impl
@Service
internal class ProductServiceImpl(
    private val repository: ProductRepository,
    private val deletionBlockers: List<ProductDeletionBlocker>
) : ProductServiceApi {

    fun deleteProduct(id: ProductId): Result<Unit, ProductError> {
        if (deletionBlockers.any { !it.canDelete(id) }) {
            return Err(ProductError.DeletionBlocked)
        }
        repository.delete(id)
        return Ok(Unit)
    }
}
```

Spring collects all beans implementing `ProductDeletionBlocker` and injects them as a list. Products doesn't know who's blocking or why—it just asks. The knowledge stays where it belongs.

### Source Sets Count Too

Gradle projects have `test` and `testFixtures` source sets, each with their own dependencies. Each can quietly violate your architecture.

The trap: you create `buildProduct()` in `products-impl:testFixtures`. Orders tests need products too, and there's a perfectly good builder right there. So `orders-impl:testFixtures` depends on `products-impl:testFixtures`. Now your Orders tests are coupled to Products' internal implementation.

Test fixtures follow the same rules as main code. If `a-impl:main` can't depend on `b-impl:main`, then `a-impl:testFixtures` can't depend on `b-impl:testFixtures`. The duplication this creates is intentional—each module's test fixtures stay self-contained.

![](/blog/building-a-modular-monolith/svgviewer-output.svg)

### Automated Enforcement

Gradle modules prevent most violations—you can't import what you can't depend on. But some rules need explicit checks, like ensuring no `-api` module depends on an `-impl` module, or that test fixtures respect boundaries.

Write a validation task that fails the build on violations, and run it as part of CI. The example code has one as a Gradle plugin: [module validation](https://github.com/wingedsheep/eco-logique/blob/main/docs/development/gradle/module-validation.md). If you'd rather write such rules as tests, ArchUnit (Java) and Konsist (Kotlin) do the same job for rules inside a module, like "nothing in `domain` imports Spring".

Rules about *who owns what* are worth enforcing too. A `CODEOWNERS` file that maps each module directory to a team means a change to `products-api` automatically asks the Products team for a review. The contract can't change without its owners noticing.

Architecture enforced by the build system survives deadlines, new team members, and "temporary" workarounds. Architecture enforced by documentation survives until the first Thursday afternoon crunch.

![](/blog/building-a-modular-monolith/image-49.webp)

### Alternative: Spring Modulith

The Gradle multi-module approach provides the strongest guarantees, but Spring Modulith offers a lighter-weight alternative using package structure and test-time verification.

Spring Modulith treats each top-level package as a module. Classes directly in a module's package are its API; anything in subpackages is internal:

```
com.example.app/
├── products/
│   ├── ProductService.kt        # API - accessible
│   └── internal/                # Internal - hidden
│       └── ProductRepository.kt
└── shipping/
    └── ...
```

A test verifies the structure:

```kotlin
@Test
fun `verify module structure`() {
    ApplicationModules.of(Application::class.java).verify()
}
```

You can be more precise than "top-level package = module". `@ApplicationModule(allowedDependencies = ["products", "inventory"])` on a module's `package-info` restricts which modules it may use at all, and `@NamedInterface` publishes a specific subpackage (say `products.spi`) as part of the API without opening up the rest. That gets you surprisingly close to the `-api`/`-impl` split, without the Gradle modules.

Spring Modulith also provides automatic documentation generation (C4 and UML diagrams of your modules, kept in sync with the code), `@ApplicationModuleTest` for bootstrapping one module at a time in tests, `@ApplicationModuleListener` for event listeners that behave correctly across transactions, and an event publication registry that implements the transactional outbox pattern. Since Spring Modulith 2.0 (on Spring Boot 4), the registry tracks each publication through a lifecycle—published, processing, completed, failed—so after a crash you can resubmit only the failed ones without mistaking in-progress work for failures. We'll use it in Part 5.

The tradeoff is enforcement timing. Gradle modules reject invalid imports at compile time. Spring Modulith catches them at test time. Stronger guarantees versus easier setup.

You can combine them—use Gradle modules for hard boundaries, add Spring Modulith for its eventing, testing and documentation features. That's what the rest of this guide does. Start with your situation: greenfield with clear boundaries favors Gradle modules; existing monolith with unclear boundaries favors Spring Modulith to discover structure first.

---

<a id="part-3"></a>

## Part 3: Inside the Modules

We have modules with enforced boundaries. The build system prevents coupling. The hard part is done.

What happens inside each `-impl` module matters less now. A mess in one module can't leak into others. You can refactor later without coordinating across teams. Internal structure is a local decision.

That said, one principle is worth following: dependencies point inward.

### The Three Layers

Organize code so that outer layers depend on inner layers, never the reverse.

**Domain** is the core: business logic, entities, value objects, repository interfaces. No framework dependencies—just plain Kotlin. The domain defines what the system *does*, not how it connects to the outside world.

**Application** orchestrates: it implements the API contract, coordinates domain operations, handles transactions, publishes events. Application code uses domain types and repository interfaces but doesn't know about databases or HTTP.

**Infrastructure** connects to the outside world: controllers, repository implementations, message consumers, external API clients. This is where Spring annotations live, where SQL gets written, where HTTP requests get parsed.

![](/blog/building-a-modular-monolith/image-60.webp)

The dependency direction: `infrastructure → application → domain`. A request flows inward: the controller (infrastructure) calls a handler (application), which uses domain types and a repository interface. The repository implementation (infrastructure) knows how to persist those types—but the domain doesn't know the implementation exists.

This keeps your business logic testable without frameworks, and keeps infrastructure changes contained. Swapping your HTTP client, your message broker or your persistence library touches infrastructure, not the business rules. (Don't oversell this to yourself: moving from Postgres to MongoDB changes your transaction and query model too, and that will reach past the repository. But it reaches a lot less far.)

### What Stays Internal

The `-api` module contains only what other modules actually use. If no other module needs `ProductId`, it stays in `-impl`. Don't preemptively publish types "just in case."

That said, value types, enums, and DTOs with simple init validation often do belong in `-api`. Other modules benefit from knowing they're working with a valid `ProductId`, not just a `String`.

```kotlin
// products-api
data class ProductId(val value: String) {
    init {
        require(value.isNotBlank()) { "ProductId cannot be blank" }
    }
}

enum class ProductStatus { DRAFT, ACTIVE, DISCONTINUED }

data class ProductDto(
    val id: ProductId,
    val name: String,
    val status: ProductStatus,
    val priceInCents: Long,
)
```

What stays internal is behavior. Business rules, state transitions, aggregate invariants—the logic that makes your domain more than a data container:

```kotlin
// products-impl
internal data class Product(
    val id: ProductId,
    val name: String,
    val price: Money,
    val status: ProductStatus,
) {
    fun applyDiscount(percent: Int): Product =
        copy(price = price.discountBy(percent))

    fun discontinue(): Product {
        check(status != ProductStatus.DISCONTINUED) { "Already discontinued" }
        return copy(status = ProductStatus.DISCONTINUED)
    }
}

internal fun Product.toDto() = ProductDto(
    id = id,
    name = name,
    status = status,
    priceInCents = price.toCents(),
)
```

The rule of thumb: if it's just data and validation, it can be public. If it's behavior, keep it internal.

### Organizing Inside the Module

This is less important than it seems. The module boundary protects you—a mess inside one module can't leak into others. Refactor your internal structure whenever you want without coordinating with anyone.

That said, when a module grows multiple features, vertical slices work well. Each feature gets a subpackage with its domain, persistence, messaging, and REST concerns. Shared concepts stay in the module root.

```
products-impl/
└── src/main/kotlin/com/example/products/
    ├── Product.kt                    # Shared domain
    ├── ProductRepository.kt          # Shared persistence
    ├── ProductServiceFacade.kt       # API implementation
    ├── import/
    │   ├── ImportHandler.kt
    │   ├── ImportJob.kt
    │   ├── persistence/
    │   ├── messaging/
    │   └── rest/
    └── pricing/
        ├── PricingHandler.kt
        ├── PriceCalculator.kt
        ├── persistence/
        ├── messaging/
        └── rest/
```

When you need to understand pricing, you open one folder. But don't overthink this—pick something reasonable and move on. You can always reorganize later.

### Connecting to the API Contract

Other modules depend on the `-api` interface. A facade delegates to handlers:

```kotlin
@Service
internal class ProductServiceFacade(
    private val importHandler: ImportHandler,
    private val pricingHandler: PricingHandler,
) : ProductServiceApi {

    override fun importProducts(request: ImportRequest) =
        importHandler.handle(request)

    override fun updatePrice(id: ProductId, request: UpdatePriceRequest) =
        pricingHandler.handle(id, request)
}
```

Pure delegation, no logic. Other modules see one interface; internally, work is split by feature. Controllers inject handlers directly since they're in the same module.

### When to Skip All This

Hexagonal architecture and use-case slicing add value when you have complex domain logic that benefits from isolation, multiple entry points (REST, messaging, CLI) to the same operations, or a need to swap infrastructure components.

They add overhead when you're building straightforward CRUD, when the module is small and unlikely to grow, or when you're prototyping and don't know what the domain looks like yet.

Start simple. Add structure when the code tells you it needs it—when you're afraid to touch a class because it does too many things, or when testing requires mocking half the framework. Structure is a response to pain, not a prerequisite.

---

<a id="part-4"></a>

## Part 4: Isolating Data

You can have perfectly separated modules, clean APIs, and enforced dependencies—and still end up with a tightly coupled system. The culprit? The database.

When modules share tables, they share problems. When one module writes directly to another's tables, your boundaries exist only in your imagination. When a foreign key reaches across module boundaries, you've created a dependency that no Gradle configuration can catch.

### The Shared Database Trap

It usually starts innocently. The Shipping module needs product weights. Products already has a `products` table. Why not just join?

```sql
-- In shipping code
SELECT s.*, p.weight_grams
FROM shipments s
JOIN products p ON s.product_id = p.id
WHERE s.id = ?
```

This works. It's fast. It's "just one query."

It's also invisible coupling. Now Shipping depends on the Products table structure. If Products renames `weight_grams`, Shipping breaks. If Products moves to a different database, Shipping breaks. And nobody sees this dependency in the code—it lurks in SQL strings, waiting to cause an incident during an otherwise routine deployment.

![](/blog/building-a-modular-monolith/image-53.webp)

### Schema Per Module

The fix is giving each module its own database schema. Products owns the `products` schema. Shipping owns the `shipping` schema. The module can only touch tables in its own schema.

```sql
CREATE SCHEMA products;
CREATE SCHEMA shipping;

CREATE TABLE products.product (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    weight_grams INT NOT NULL
);

CREATE TABLE shipping.shipment (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,  -- Just data, no FK
    weight_grams INT NOT NULL           -- Copied at creation time
);
```

Each module gets its own Flyway configuration pointing at its schema. Migrations live with the module code. When there's a problem with the `shipments` table, there's no ambiguity about who owns it. You can check the example implementation [here](https://github.com/wingedsheep/eco-logique/blob/main/deployables/backend/application/src/main/kotlin/com/wingedsheep/ecologique/application/config/FlywayConfig.kt).

So far, though, this is still convention. One application usually means one connection pool and one database user, and that user can read every schema. Nothing stops a `JOIN products.product` from sneaking into Shipping's SQL.

To make it a rule, let the database enforce it. Give each module its own role that can only touch its own schema:

```sql
CREATE ROLE shipping_module LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA shipping TO shipping_module;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA shipping TO shipping_module;
ALTER DEFAULT PRIVILEGES IN SCHEMA shipping
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shipping_module;
-- no grants on products, orders, ... : a cross-schema query is now "permission denied"
```

You then have two options. The strict one is a data source per module, each connecting with its own role. That's the real thing, but it means several connection pools, and a transaction can no longer span two modules—which, as Part 5 argues, is something you want to get rid of anyway. The cheap one is to keep a single data source in production, but run each module's tests (Part 7) connected as that module's role. A stray cross-schema join then fails in CI, long before it can cause an incident. Start with the cheap one; it catches nearly everything.

### No Foreign Keys Across Schemas

This is the rule that makes people uncomfortable: no foreign keys between schemas.

```sql
-- Don't do this
CREATE TABLE shipping.shipment (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) REFERENCES products.product(id)  -- No!
);

-- Do this instead
CREATE TABLE shipping.shipment (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL  -- Just a string
);
```

Referential integrity across module boundaries becomes your responsibility at the application level. When Shipping creates a shipment, it validates that the product exists by calling the Products API:

```kotlin
override fun createShipment(request: CreateShipmentRequest): Result<ShipmentDto, ShipmentError> {
    val product = productService.getProduct(request.productId)
        .getOrElse { return Err(ShipmentError.ProductNotFound(request.productId)) }

    val shipment = Shipment(
        id = ShipmentId.generate(),
        productId = request.productId,
        weightGrams = product.weightGrams,
    )

    return Ok(shipmentRepository.save(shipment).toDto())
}
```

Yes, this is more work than a foreign key. But it's explicit—visible in the code, testable, and under your control. And when you eventually need to extract a module into its own service, there are no cross-schema constraints to untangle.

### What About Joins?

The most common concern: "I used to join Orders and Products in one query. Now what?"

For single-item lookups, call both services and combine the results. For lists, batch your calls—collect all product IDs first, fetch them in one bulk call, then join in memory:

```kotlin
fun getOrderSummaries(orderIds: List<OrderId>): List<OrderSummary> {
    val orders = orderService.getOrders(orderIds)
    val productIds = orders.map { it.productId }.distinct()
    val products = productService.getProducts(productIds).associateBy { it.id }

    return orders.map { order ->
        OrderSummary(order, products[order.productId])
    }
}
```

Batching works as long as the list is shaped by one module. It breaks when another module's data decides *which* rows you get or *in what order*. "Show the customer's orders, sorted by product name, page 3" can't be batch-fetched: you'd have to load every order before you know which twenty land on page 3.

For queries like that, build a read model. The module that owns the screen keeps its own copy of the foreign data it needs, shaped for the query, and keeps it up to date by listening to events (plus a one-off backfill through the Products API when you first add it):

```kotlin
// orders-impl
@Component
internal class ProductNameProjection(
    private val productNames: ProductNameRepository,  // table orders.product_name
) {
    @ApplicationModuleListener
    fun on(event: ProductRenamedEvent) {
        productNames.upsert(event.productId, event.newName)
    }
}
```

Now Orders can join `orders.order_line` with `orders.product_name` in its own schema, with paging and sorting in SQL, without touching Products' tables. The cost is that the copy is eventually consistent: for a moment after a rename, the order list shows the old name. For a list screen, that's almost always fine. If it isn't, that's a sign the two things belong in the same module.

For historical accuracy, denormalize at write time. An order should show the product name and price *at the time of purchase*, not whatever the product is called today. Copy the relevant fields when creating the order. The data belongs to the order now—it's capturing a moment in time.

For analytics and reporting, pragmatism wins. A read-only reporting schema with cross-module views is fine for dashboards—just keep it separate from your application code.

### The Tradeoff

Data isolation requires more code. You lose database-enforced referential integrity across modules. If a product is deleted while a shipment references it, the database won't stop you—your application code has to handle that.

What you get is independence. Products can restructure its tables without Shipping noticing. Module tests can use a real database for their own schema and stand in for every other module. And if you ever extract a module into its own service, the path is clear—no foreign keys to remove, no shared tables to split.

---

<a id="part-5"></a>

## Part 5: Module Communication

Modules need to talk to each other. An order needs product information. A shipment needs to know when payment completes. The question isn't whether modules communicate—it's how they communicate without reintroducing the coupling we worked so hard to eliminate.

Two patterns cover most cases: synchronous calls when you need an answer now, and asynchronous events when you're announcing something happened.

### Synchronous Calls

The simplest pattern: one module calls another's API and waits for the response.

```kotlin
@Service
internal class ShipmentServiceImpl(
    private val productService: ProductServiceApi,
    private val shipmentRepository: ShipmentRepository,
) : ShipmentServiceApi {

    override fun createShipment(request: CreateShipmentRequest): Result<ShipmentDto, ShipmentError> {
        val product = productService.getProduct(request.productId)
            .getOrElse { return Err(ShipmentError.ProductNotFound(request.productId)) }

        val shipment = Shipment(
            id = ShipmentId.generate(),
            productId = request.productId,
            weightGrams = product.weightGrams,
            status = ShipmentStatus.PENDING,
        )

        return Ok(shipmentRepository.save(shipment).toDto())
    }
}
```

This is appropriate when you need data to proceed and the operation should fail if the dependency fails. The tradeoff is runtime coupling—if Products is slow, Shipping is slow. For many operations, that's exactly right.

Two things to watch, because in-process calls *feel* free.

The first is chains. There's no network latency, no retries, no circuit breakers to remind you each call has a cost, so it's easy to let Orders call Inventory, which calls Products, which calls Pricing, a little deeper every quarter. Under load, one hot endpoint fans out through half the system. If a call graph between modules is more than one or two hops deep, the data probably wants to live closer to where it's used (a read model, Part 4) or the work wants to be an event.

The second is transactions. If `createOrder` is `@Transactional` and calls `inventoryService.reserve()`, the reservation silently joins the order's transaction. Roll back the order and the reservation rolls back too. It works, and it's convenient, and it's a dependency that doesn't appear in any Gradle file: Orders now relies on Inventory's writes being atomic with its own. If you ever pull Inventory out into its own service, that guarantee is the first thing that breaks. Prefer one module per transaction. When a business operation has to change two modules, let the first one commit and the second react to its event.

When the external module returns data shaped for their needs rather than yours, translate it at the boundary. Shipping doesn't need product descriptions or images—it needs weight and dimensions. Create an adapter that fetches what you need and discards the rest:

```kotlin
@Component
internal class ProductAdapter(
    private val productService: ProductServiceApi
) {
    fun getShippableItem(productId: ProductId): ShippableItem? {
        val dto = productService.getProduct(productId).get() ?: return null

        return ShippableItem(
            productId = productId,
            weightGrams = dto.weightGrams,
            dimensions = Dimensions(dto.width, dto.height, dto.depth),
            isFragile = dto.tags.contains("FRAGILE"),
        )
    }
}
```

Now your domain code works with `ShippableItem`—a type you control—instead of `ProductDto` which might change when the Products team refactors.

### Events

Sometimes a module doesn't need a response. It's announcing that something happened, and other modules react if they care.

```kotlin
// payment-api
data class PaymentCompletedEvent(
    val paymentId: String,
    val orderReference: String,
    val amountInCents: Long,
    val currency: String,
    val timestamp: Instant,
)
```

The publisher doesn't know who's listening. Shipping might start fulfillment. Inventory might confirm a reservation. Notifications might send an email. Each listener is independent.

![](/blog/building-a-modular-monolith/image-55.webp)

For in-process events, Spring's `ApplicationEventPublisher` is all you need to publish:

```kotlin
@Service
internal class PaymentServiceImpl(
    private val eventPublisher: ApplicationEventPublisher,
) : PaymentServiceApi {

    @Transactional
    override fun completePayment(paymentId: PaymentId): Result<PaymentDto, PaymentError> {
        val payment = // ... complete the payment

        eventPublisher.publishEvent(PaymentCompletedEvent(
            paymentId = payment.id.value,
            orderReference = payment.orderReference.value,
            amountInCents = payment.amount.toCents(),
            currency = payment.amount.currency.code,
            timestamp = Instant.now(),
        ))

        return Ok(payment.toDto())
    }
}
```

The obvious way to listen is a `@TransactionalEventListener`:

```kotlin
// shipping-impl: looks right, isn't
@Component
internal class PaymentEventListener(
    private val shipmentService: ShipmentService,
) {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun on(event: PaymentCompletedEvent) {
        shipmentService.startFulfillment(OrderReference(event.orderReference))
    }
}
```

The `AFTER_COMMIT` phase makes sure the listener only fires if the payment transaction actually commits. No point starting fulfillment for a payment that rolled back. So far, so good. But this listener has two problems that won't show up in a demo.

**It isn't asynchronous.** Spring events are delivered on the publisher's thread. `completePayment` doesn't return until fulfillment has started, so the caller waits for downstream work after all. And if the listener throws, the payment is already committed: the exception reaches the caller of a payment that succeeded, and fulfillment never happens.

**Its writes can vanish.** After commit, the payment's transaction is finished but still bound to the thread. If `startFulfillment` is a plain `@Transactional` method, it *joins* that finished transaction instead of starting a new one, and its inserts are never committed. No error, just a shipment that doesn't exist. The fix is `@Transactional(propagation = Propagation.REQUIRES_NEW)` on the listener.

Spring Modulith bundles all of this into one annotation. `@ApplicationModuleListener` is `@TransactionalEventListener` + `@Async` + `@Transactional(propagation = REQUIRES_NEW)`:

```kotlin
// shipping-impl
@Component
internal class PaymentEventListener(
    private val shipmentService: ShipmentService,
) {
    @ApplicationModuleListener
    fun on(event: PaymentCompletedEvent) {
        shipmentService.startFulfillment(OrderReference(event.orderReference))
    }
}
```

Now the listener runs after the payment commits, on its own thread, in its own transaction. A failure in Shipping can't reach Payment, and Payment doesn't wait for Shipping. Use this as your default for listeners in other modules. (Enable async execution with `@EnableAsync`, and give it a sized executor rather than the default.)

### The Dual-Write Problem

One problem is left. Consider this sequence:

1. The payment transaction commits.
2. The event is handed to a listener on another thread.
3. The listener starts fulfillment.

What if the application stops between 1 and 3? A deploy, an out-of-memory kill, a node that disappears. The payment is complete, but nobody knows. Shipping never starts, and nothing will ever retry it, because the event only existed in memory.

This is the dual-write problem: two things have to happen (save the payment, deliver the event), and only one of them is in the transaction.

The solution is making the event part of the database transaction, using a transactional outbox. Instead of only publishing in memory, write the event to an outbox table in the same transaction as your business data:

```kotlin
@Transactional
override fun completePayment(paymentId: PaymentId): Result<PaymentDto, PaymentError> {
    val payment = // ... complete the payment

    outboxRepository.save(OutboxEvent(
        id = EventId.generate(),
        type = "PaymentCompleted",
        payload = Json.encodeToString(PaymentCompletedEvent(...)),
        createdAt = Instant.now(),
    ))

    return Ok(payment.toDto())
}
```

A separate process reads the outbox and delivers the events to their listeners. If the business transaction rolls back, the outbox entry rolls back too. If it commits, the event will be delivered eventually.

This guarantees at-least-once delivery. If the publisher crashes after delivering but before marking the entry as done, it delivers again on restart. Listeners need to handle duplicates—make them idempotent:

```kotlin
fun startFulfillment(order: OrderReference) {
    if (shipmentRepository.existsForOrder(order)) return  // already started: a redelivery
    // ...
}
```

![](/blog/building-a-modular-monolith/image-56.webp)

You rarely need to build this yourself. Spring Modulith's event publication registry *is* an outbox. Add `spring-modulith-starter-jdbc` (or `-jpa`), and every event headed for an `@ApplicationModuleListener` is written to an `event_publication` table in the publisher's transaction, then marked completed when its listener succeeds. Since 2.0, publications that failed are distinguishable from ones still in progress, so a scheduled job can resubmit just the failures, and `spring.modulith.events.republish-outstanding-events-on-restart=true` picks up what a crash left behind. The publishing code stays a plain `publishEvent`.

### Events Are Contracts

An event class in an `-api` module is as much a public API as an interface, with one extra catch: events get *stored*. The registry keeps serialized events until they're delivered, so during a deploy, the new version of your code may have to read events the old version wrote.

Treat them accordingly. Add fields with defaults; don't rename or remove them. Don't move event classes to another package without checking how your registry identifies them. When the meaning changes, publish a new event (`PaymentCompletedEventV2`, or better, a name that says what's different) next to the old one, and retire the old one once nobody listens.

### When to Use What

Use synchronous calls when you need an answer to proceed, and keep the chains short.

Use events for reactions: when other modules might care that something happened, and the publisher shouldn't wait for or depend on what they do with it. Listen with `@ApplicationModuleListener`.

Persist the events (the registry) whenever losing one would leave the system wrong. Payment → fulfillment is the textbook case: a lost event is a customer who paid and never gets a parcel. In-memory events are fine only for things you can afford to drop, like refreshing a cache or bumping a metric. When in doubt, persist; the cost is one table.

The patterns aren't mutually exclusive. A checkout flow might make a synchronous call to check inventory, commit the order and its event in one transaction, then let Payment, Inventory and Notifications each react in their own transactions.

---

<a id="part-6"></a>

## Part 6: Errors and Validation

Errors are where modular codebases quietly rot. One team throws exceptions, another returns nulls, a third invents custom result types. The controller layer becomes a graveyard of catch blocks trying to translate chaos into HTTP status codes.

### Make Errors Explicit

The traditional approach:

```kotlin
fun getProduct(id: ProductId): Product {
    return repository.findById(id)
        ?: throw ProductNotFoundException(id)
}
```

Nothing in the type signature hints that this might throw. You discover `ProductNotFoundException` exists when it crashes in production—or if you're lucky, by reading documentation that probably doesn't exist.

But "product not found" isn't exceptional. It's a normal business case—the user typed a wrong ID, the product was deleted. This happens all the time, and the code should make it obvious.

Return errors as values instead. Define them in the `-api` module as a sealed type:

```kotlin
// products-api
sealed interface ProductError {
    data class NotFound(val id: ProductId) : ProductError
    data class InvalidData(val reason: String) : ProductError
    data object DuplicateName : ProductError
    data object DeletionBlocked : ProductError
}

interface ProductServiceApi {
    fun getProduct(id: ProductId): Result<ProductDto, ProductError>
    fun createProduct(request: CreateProductRequest): Result<ProductDto, ProductError>
}
```

Now the type signature tells you everything. And because `ProductError` is sealed, the compiler knows every possible case: a `when` over it has to cover them all. Add a new error and every exhaustive `when` stops compiling until someone decides what it means there. (That only works if you leave out the `else` branch. An `else` quietly swallows the cases nobody has thought about yet.)

It also means adding an error is a change to the contract, just like adding a method. That's as it should be: callers have to decide what the new case means for them.

```kotlin
// products-impl
@Service
internal class ProductServiceImpl(
    private val repository: ProductRepository,
) : ProductServiceApi {

    override fun getProduct(id: ProductId): Result<ProductDto, ProductError> {
        val product = repository.findById(id) ?: return Err(ProductError.NotFound(id))
        return Ok(product.toDto())
    }
}
```

Callers handle both cases explicitly:

```kotlin
productService.getProduct(productId).fold(
    success = { product -> /* use it */ },
    failure = { error -> /* handle it */ },
)
```

No try-catch. No wondering what might throw.

![](/blog/building-a-modular-monolith/image-57.webp)

> **A note on Result types:** Kotlin's built-in `Result<T>` won't do here. It has a single type parameter, and its failure is always a `Throwable`, so it can't carry a `ProductError`. The examples use [kotlin-result](https://github.com/michaelbull/kotlin-result), whose `Result<V, E>` is either `Ok(value)` or `Err(error)`. Arrow's `Either` does the same, with a lot more around it. Whichever you choose, choose one for the whole codebase.

### Validation in Init Blocks

Where should validation live? The traditional answer in Spring is JSR-303 annotations—`@NotBlank`, `@Positive`, `@Valid`. It works, but scatters validation rules across annotations that are easy to miss and harder to test than plain code.

A better approach: validate at construction time. If an object exists, it's valid. Your init blocks act as a firewall, keeping garbage out of your implementation layer. It's the spirit of "Parse, don't validate": instead of checking a `String` everywhere it's used, check it once while turning it into a type that can't be invalid.

Kotlin gives you `require` for validating inputs and `check` for validating state. Both throw on failure, but they signal different problems. `require` throws `IllegalArgumentException`—the caller passed bad input. `check` throws `IllegalStateException`—something is wrong internally.

#### Structural vs. Business Validation

Not all validation belongs in the same place:

| Type | Definition | Location |
| --- | --- | --- |
| **Structural** | Checks data against itself. No external context needed. (e.g., "Quantity > 0", "Name not blank") | API Module (`init` block) |
| **Business** | Checks data against state or rules. Needs database or config. (e.g., "Email is unique", "Product in stock") | Implementation Module (Service) |

Structural validation in API modules works well: bad input fails as soon as the request is deserialized, the code documents the requirements for consumers, and your domain logic doesn't need defensive checks everywhere.

```kotlin
// orders-api
data class CreateOrderRequest(
    val customerId: String,
    val items: List<OrderItemDto>,
) {
    init {
        require(customerId.isNotBlank()) { "Customer ID is required" }
        require(items.isNotEmpty()) { "Order must contain at least one item" }
    }
}

data class OrderItemDto(
    val productId: String,
    val quantity: Int,
) {
    init {
        require(productId.isNotBlank()) { "Product ID is required" }
        require(quantity > 0) { "Quantity must be positive" }
    }
}
```

One limitation: an init block stops at the first failure. For an API called by other code, that's fine. For a form where a person wants to see every invalid field at once, annotation-based validation, which collects them all, gives the better experience. You can mix the two.

**Avoid encoding volatile rules in the API.** `require(password.isNotEmpty())` is fine; `require(password.length >= 10)` couples your contract to a policy that might change. Check rules like that in the service.

For internal domain objects, use `check`:

```kotlin
// products-impl
internal data class Product(
    val id: ProductId,
    val name: String,
    val price: Money,
) {
    init {
        check(name.isNotBlank()) { "Product name cannot be blank" }
        check(name.length <= MAX_NAME_LENGTH) { "Product name too long" }
    }

    companion object {
        const val MAX_NAME_LENGTH = 200
    }
}
```

If these fail, it means your application code tried to create an invalid domain object—a bug, not bad user input.

That only holds if nothing unchecked reaches the constructor. The length limit is exactly the kind of volatile rule we kept out of the API, so a 300-character name sails through `CreateProductRequest`. The service has to turn it into an error before it builds a `Product`:

```kotlin
override fun createProduct(request: CreateProductRequest): Result<ProductDto, ProductError> {
    if (request.name.length > Product.MAX_NAME_LENGTH) {
        return Err(ProductError.InvalidData("Name can be at most ${Product.MAX_NAME_LENGTH} characters"))
    }
    // ...
}
```

The user gets a 400 that explains itself. The `check` in `Product` stays as a safety net: if it ever fires, someone skipped the service, and a 500 is the honest answer.

### Translating Errors to HTTP

The domain layer doesn't know about HTTP. It returns `ProductError.NotFound`. Somewhere, that needs to become a 404.

That translation happens at the controller:

```kotlin
@RestController
internal class ProductController(
    private val productService: ProductServiceApi,
) {
    @GetMapping("/products/{id}")
    fun getProduct(@PathVariable id: ProductId): ProductDto =
        productService.getProduct(id).getOrElse { throw it.toResponseStatusException() }
}

private fun ProductError.toResponseStatusException() = when (this) {
    is ProductError.NotFound -> ResponseStatusException(NOT_FOUND, "Product not found: ${id.value}")
    is ProductError.InvalidData -> ResponseStatusException(BAD_REQUEST, reason)
    ProductError.DuplicateName -> ResponseStatusException(CONFLICT, "Product name already exists")
    ProductError.DeletionBlocked -> ResponseStatusException(CONFLICT, "Product is still in use")
}
```

With `spring.mvc.problemdetails.enabled=true`, Spring Boot renders `ResponseStatusException` as a Problem Details response (RFC 9457, the successor to RFC 7807). The domain stays clean. The HTTP translation is explicit and in one place. And because the `when` has no `else`, a new error type won't compile until you've decided which status it maps to.

A global exception handler deals with the init block validations. One subtlety: when a `require` fails while Jackson is building a request body, Spring doesn't pass you the `IllegalArgumentException`. It arrives wrapped in an `HttpMessageNotReadableException`, so handle that too and dig out the cause:

```kotlin
@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleUnreadable(ex: HttpMessageNotReadableException): ProblemDetail {
        val invalid = ex.findCause<IllegalArgumentException>()
        return ProblemDetail.forStatusAndDetail(BAD_REQUEST, invalid?.message ?: "Malformed request")
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleBadInput(ex: IllegalArgumentException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(BAD_REQUEST, ex.message ?: "Invalid request")

    @ExceptionHandler(IllegalStateException::class)
    fun handleBug(ex: IllegalStateException): ProblemDetail {
        log.error("Invariant violated", ex)
        return ProblemDetail.forStatusAndDetail(INTERNAL_SERVER_ERROR, "Something went wrong")
    }
}

private inline fun <reified T : Throwable> Throwable.findCause(): T? =
    generateSequence(cause) { it.cause }.filterIsInstance<T>().firstOrNull()
```

### When Exceptions Are Still Fine

This doesn't mean exceptions are always wrong. Use them for genuinely exceptional situations: database connection lost, file system full, external service unreachable. These aren't business cases your callers should handle individually—they're infrastructure failures that bubble up to a global handler.

The distinction: if the caller can reasonably do something about it, return a `Result`. If it's an unexpected failure that should abort the operation, throw.

---

<a id="part-7"></a>

## Part 7: Testing

A modular architecture should make testing easier, not harder. If you need to spin up the entire application to test whether a discount calculation works, something has gone wrong.

The module boundaries we've enforced create natural test boundaries. Each module has a clear API and explicit dependencies. This suggests a strategy: test one module completely, stand in for the others.

### Module Tests

The Shipping module depends on `ProductServiceApi`, not `ProductServiceImpl`. In tests, provide a stand-in for Products and test Shipping in isolation—real database, real transactions, real queries—without Products existing at all. Connect as the module's own database role (Part 4), and a stray query into another module's schema fails right here.

Gherkin works well for expressing what a module should do:

```gherkin
Feature: Shipment Creation

  Scenario: Create shipment for valid product
    Given a product "PROD-123" with weight 500 grams
    When I create a shipment for product "PROD-123" to "123 Main St"
    Then the shipment should be created with weight 500 grams
    And the shipment status should be "PENDING"

  Scenario: Fail when product does not exist
    Given no product "UNKNOWN" exists
    When I create a shipment for product "UNKNOWN" to "123 Main St"
    Then the shipment should fail with "ProductNotFound"
```

The step definitions don't create real products. "Given a product exists" puts one into a fake Products module:

```kotlin
class ShipmentSteps(
    private val shippingService: ShippingServiceApi,
    private val products: FakeProductService,
) {
    private var result: Result<ShipmentDto, ShipmentError>? = null

    @Given("a product {string} with weight {int} grams")
    fun givenProduct(productId: String, weight: Int) {
        products.add(buildProductDto(id = ProductId(productId), weightGrams = weight))
    }

    @When("I create a shipment for product {string} to {string}")
    fun createShipment(productId: String, address: String) {
        result = shippingService.createShipment(CreateShipmentRequest(ProductId(productId), address))
    }

    @Then("the shipment should be created with weight {int} grams")
    fun verifyWeight(expectedWeight: Int) {
        assertThat(result?.get()?.weightGrams).isEqualTo(expectedWeight)
    }
}
```

When a module test fails, you know which module broke. When it passes, you have confidence the module actually fulfills its contract against a real database. These are often your highest-value tests—fast enough to run frequently, realistic enough to catch real bugs.

### Fakes and Contract Tests

Where does `FakeProductService` come from? The Products team ships it, in the test fixtures of `products-api`:

```kotlin
// products-api testFixtures
class FakeProductService : ProductServiceApi {
    private val products = mutableMapOf<ProductId, ProductDto>()

    fun add(product: ProductDto) {
        products[product.id] = product
    }

    override fun getProduct(id: ProductId): Result<ProductDto, ProductError> =
        products[id]?.let(::Ok) ?: Err(ProductError.NotFound(id))

    // ... the rest of the interface
}
```

You could stub `ProductServiceApi` with a mocking library in every test instead. It works, but each test then encodes its own guess about how Products behaves. Does an unknown id give `NotFound`, or an empty result, or an exception? Twenty test files, twenty guesses, and nothing tells you when one of them stops being true. A shared fake is one guess, owned by the team that knows the answer.

And that guess can be checked. Write the expected behavior once, as an abstract test, and run it against both the fake and the real thing:

```kotlin
// products-api testFixtures
abstract class ProductServiceContract {
    abstract val service: ProductServiceApi
    abstract fun givenProduct(product: ProductDto)

    @Test
    fun `returns a product that exists`() {
        val product = buildProductDto()
        givenProduct(product)

        assertThat(service.getProduct(product.id).get()).isEqualTo(product)
    }

    @Test
    fun `returns NotFound for an unknown id`() {
        val id = ProductId("unknown")

        assertThat(service.getProduct(id).getError()).isEqualTo(ProductError.NotFound(id))
    }
}
```

`products-api` runs it against `FakeProductService`; `products-impl` runs it against `ProductServiceImpl` with a real database. If the two ever disagree, a test fails in the Products build, before anyone else's tests start lying to them. This is the in-process version of consumer-driven contract testing, and it's the piece that makes "test one module, stand in for the others" trustworthy.

### Unit and Repository Tests

Module tests cover most scenarios, but some things deserve focused tests.

Complex logic that doesn't need a database—calculations, state machines, validation rules—these are faster to test in isolation:

```kotlin
class MoneyTest {
    @Test
    fun `discount reduces amount correctly`() {
        val money = Money(BigDecimal("100"), EUR)

        assertThat(money.discountBy(20).amount).isEqualByComparingTo(BigDecimal("80"))
    }
}
```

Complex queries where the logic lives in SQL also deserve their own tests. Filters, pagination, edge cases with NULL values—these are hard to get right and easy to break. Use Testcontainers to test against a real Postgres. Don't use H2 "because it's faster"—it behaves differently in ways that will bite you.

```kotlin
@Testcontainers
@DataJdbcTest
@Import(FlywayConfig::class)
class ProductRepositoryTest(
    @Autowired private val repository: ProductRepository,
) {
    companion object {
        @Container
        @ServiceConnection
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:18")
    }

    @Test
    fun `finds products by category with price range`() {
        // Given
        repository.save(buildProduct(category = "electronics", priceInCents = 5000))
        repository.save(buildProduct(category = "electronics", priceInCents = 15000))
        repository.save(buildProduct(category = "clothing", priceInCents = 3000))

        // When
        val results = repository.findByCategoryAndPriceRange(
            category = "electronics", minPrice = 1000, maxPrice = 10000
        )

        // Then
        assertThat(results).hasSize(1)
        assertThat(results.first().priceInCents).isEqualTo(5000)
    }
}
```

If a method just does `findById` or delegates to a repository and maps the result, skip the dedicated test—the module test already covers it.

### Application-Level Tests

Sometimes you need to verify the full flow—all modules wired together, real database, real event publishing. Save these for critical user journeys where integration failures would be costly.

```gherkin
Feature: Checkout

  Scenario: Complete purchase creates order and schedules shipment
    Given I am logged in as a customer
    And a product "Widget" priced at €29.99
    And the product is in stock
    When I place an order for 1 "Widget"
    Then an order should be created
    And a shipment should be scheduled with status "PENDING"
```

The step definitions wire this to real services—no mocks. These tests are slow and brittle. When they fail, the cause isn't always obvious. Write few of them and let module tests handle the detailed behavior.

### Test Fixtures

Tests need data. You don't want every test constructing objects from scratch, but you also don't want shared fixtures that create invisible dependencies between tests.

Builder functions with default arguments hit the sweet spot:

```kotlin
fun buildProductDto(
    id: ProductId = ProductId(UUID.randomUUID().toString()),
    name: String = "Test Product",
    weightGrams: Int = 100,
) = ProductDto(id = id, name = name, weightGrams = weightGrams)

// Only specify what matters for this test
val lightweight = buildProductDto(weightGrams = 50)
```

When you read a test that says `buildProductDto(weightGrams = 500)`, you know the weight matters. Everything else is scaffolding.

Keep fixtures independent across modules. Shipping tests use `FakeProductService` and `buildProductDto()` from the `-api` test fixtures. They don't reach into Products' internal test helpers. The same boundary rules apply to test code.

### Test Behavior, Not Implementation

Ask "what should happen" rather than "how does it happen internally."

```kotlin
// Good - tests outcome
@Test
fun `order fails when product is out of stock`() {
    inventory.setStock(productId, 3)

    val result = orderService.createOrder(buildCreateOrderRequest(productId, quantity = 5))

    assertThat(result.getError()).isEqualTo(OrderError.InsufficientStock(available = 3))
}

// Brittle - tests mechanics
@Test
fun `createOrder calls inventory then repository then publisher`() {
    orderService.createOrder(request)

    inOrder(inventoryService, orderRepository, eventPublisher).apply {
        verify(inventoryService).checkAvailability(any(), any())
        verify(orderRepository).save(any())
        verify(eventPublisher).publishEvent(any())
    }
}
```

The first test survives refactoring. Reorder the internal calls, add caching, change how you publish events—the test still passes because the behavior is the same. The second test breaks the moment you touch the implementation, even if nothing is actually wrong.

Don't chase coverage numbers. A codebase with 70% coverage and thoughtful tests beats one with 95% coverage and useless tests. Coverage tells you what code ran, not whether your tests would catch a bug.

---

<a id="part-8"></a>

## Part 8: Putting It All Together

We've covered modules, boundaries, data isolation, communication, errors, and testing. How does it actually become a running application?

The good news: it's simpler than you might expect. One application module pulls in the implementations, Spring wires them together, and you deploy a single JAR.

### The Application Module

The application module is the composition root—the place where all the pieces come together. Its `build.gradle.kts` depends on all the `-impl` modules:

```kotlin
// application/build.gradle.kts
dependencies {
    implementation(project(":products:products-impl"))
    implementation(project(":orders:orders-impl"))
    implementation(project(":shipping:shipping-impl"))
    implementation(project(":inventory:inventory-impl"))

    // Spring Boot, database drivers, etc.
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.postgresql:postgresql")
}
```

This is the only place that depends on `-impl` modules. Everyone else depends on `-api` modules. The application module breaks that rule because its job is to assemble everything.

The application class itself is just a standard Spring Boot entry point:

```kotlin
@SpringBootApplication(scanBasePackages = ["com.example"])
class Application

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}
```

The `scanBasePackages` needs to cover your root namespace so Spring discovers components in all your `-impl` modules.

### How Spring Wires It

A common question: if `ShippingServiceImpl` needs `ProductServiceApi`, and they're in different Gradle modules, how does Spring connect them?

Spring doesn't care about Gradle modules—it cares about the classpath. When the application starts, all the `-impl` modules are on the classpath. Spring scans for components, finds `ProductServiceImpl` (which implements `ProductServiceApi`), and registers it as a bean. When it creates `ShippingServiceImpl`, it sees a constructor parameter of type `ProductServiceApi`, finds the matching bean, and injects it.

```kotlin
// products-impl
@Service
internal class ProductServiceImpl(...) : ProductServiceApi

// shipping-impl
@Service
internal class ShippingServiceImpl(
    private val productService: ProductServiceApi  // Spring injects ProductServiceImpl
) : ShippingServiceApi
```

The interface is public (in `-api`). The implementation is internal (in `-impl`). Spring wires them together because at runtime, they're all in the same application context.

This is one of the key benefits of a modular monolith over microservices—no service discovery, no HTTP clients, no serialization overhead. Just dependency injection.

### Project Structure

The overall structure follows naturally from what we've covered:

```
project-root/
├── build-logic/                    # Shared Gradle conventions
│   └── src/main/kotlin/
│       └── kotlin-conventions.gradle.kts
├── common/
│   ├── common-types/               # Shared value types
│   └── common-result/              # Result type
├── products/
│   ├── products-api/
│   └── products-impl/
├── orders/
│   ├── orders-api/
│   └── orders-impl/
├── shipping/
│   ├── shipping-api/
│   └── shipping-impl/
├── application/                    # Composition root
└── settings.gradle.kts
```

The `common` modules are the one place every module may depend on, which is exactly why they need a strict rule. Part 2 warned against a common module full of everyone's ID types; this is a different thing. What belongs here is a *shared kernel*: a handful of types that mean the same thing in every context and almost never change. `Money`, `Email`, the `Result` setup. No business logic, no types owned by one module, nothing with a "for now" in its commit message. A good sign: changes to `common` are rare enough that each one gets a real discussion. If it changes every sprint, something in it belongs to a module.

The `build-logic` module contains convention plugins that centralize shared Gradle configuration. Instead of repeating Kotlin version, test configuration, and dependencies in every `build.gradle.kts`, modules apply a plugin like `id("kotlin-conventions")`. Change the convention once, every module picks it up.

Use `gradle/libs.versions.toml` to manage dependency versions in one place:

```toml
[versions]
kotlin = "2.4.20"
spring-boot = "4.1.1"
spring-modulith = "2.1.1"
kotlin-result = "2.3.1"
testcontainers = "2.0.5"

[libraries]
spring-boot-starter-webmvc = { module = "org.springframework.boot:spring-boot-starter-webmvc", version.ref = "spring-boot" }
spring-boot-starter-data-jdbc = { module = "org.springframework.boot:spring-boot-starter-data-jdbc", version.ref = "spring-boot" }
spring-modulith-starter-jdbc = { module = "org.springframework.modulith:spring-modulith-starter-jdbc", version.ref = "spring-modulith" }
kotlin-result = { module = "com.michael-bull.kotlin-result:kotlin-result", version.ref = "kotlin-result" }
testcontainers-postgresql = { module = "org.testcontainers:testcontainers-postgresql", version.ref = "testcontainers" }

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
spring-boot = { id = "org.springframework.boot", version.ref = "spring-boot" }
```

Then in any module:

```kotlin
dependencies {
    implementation(libs.spring.boot.starter.webmvc)
    testImplementation(libs.testcontainers.postgresql)
}
```

No more version strings scattered across dozens of `build.gradle.kts` files. Update a version once in the TOML, and every module picks it up.

### Running It

The Spring Boot plugin packages everything into a single executable JAR. Run `./gradlew :application:bootJar` and you get one artifact containing all modules, all dependencies, and an embedded server. Deploy it anywhere that runs Java.

For local development, you typically need a database. A simple Docker Compose handles that:

```yaml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    ports:
      - "5432:5432"
```

Start the container, run `./gradlew :application:bootRun`, and you're developing.

### One Process, Many Modules

One deployable means one thing to monitor at 3am. It also means one thing that falls over. The module boundaries protect you at compile time; at runtime, everything shares the same heap, the same threads and the same connection pool. A memory leak in Notifications or a slow query in Reporting can take down checkout.

A few habits keep a module's runtime trouble its own:

- **Know which module you're looking at.** Put the module name in your logs and metrics, so "the app is slow" becomes "Inventory's queries are slow". Spring Modulith's observability support does this for you: it creates a tracing span whenever a call crosses into another module.
- **Give async work its own pools.** If every `@ApplicationModuleListener` runs on one shared executor, one module's slow listener queues up everyone else's events. Separate executors for the modules that do heavy work keep the rest moving.
- **Put limits on the shared things.** Statement timeouts on the database, sensible pool sizes, timeouts on outbound HTTP calls. In a monolith, an unbounded wait in one module is everyone's wait.

### When You Outgrow It

The architecture is designed to be "split-ready," even if you never split.

If a module eventually needs to become a separate service, most of the work is already done. The database is isolated—each module has its own schema and its own role, so you move it to a new database without untangling shared tables. The API is defined—the `-api` module becomes the contract for the new service. The tests are structured—the contract tests from Part 7 can run against the remote client too.

You're not refactoring a tangled mess. You're promoting a module that's already isolated.

But don't mistake split-ready for free. Swapping dependency injection for an HTTP client changes what a call *means*:

- **Calls can fail halfway.** An in-process call either happens or throws. A network call can time out after the other side did the work. Your `Result` types model `NotFound`; now they also need "unavailable" and "unknown", and retries need idempotency.
- **Chatty becomes slow.** The batched calls from Part 4 are fine in-process. Over a network, every round trip costs milliseconds, and a page that makes fifty calls takes a second.
- **Shared transactions disappear.** Any place where two modules relied on one database transaction (Part 5) now needs an event, a saga or a rethink. This is why it pays to avoid them from the start.

The modules that have been talking through events all along are the easy ones to extract: the events move onto a broker, and the listeners barely change.

Most teams never need to do this. The modular monolith scales further than people expect—both technically and organizationally. Shopify runs one of the largest Rails codebases in the world as a modular monolith. Multiple teams can work on different modules without stepping on each other, and you can keep deploying one thing for a long time.

But knowing the escape hatch exists makes the choice less risky. You're not betting everything on a monolith forever. You're choosing the simplest architecture that works today while keeping your options open.

![](/blog/building-a-modular-monolith/image-59.webp)

---

<a id="part-9"></a>

## Part 9: Building With Coding Agents

A growing share of the code in a codebase like this is now written by coding agents: Claude Code, Codex, Cursor and the like. That changes the cost-benefit sums of a modular monolith, mostly in its favor. Everything in this guide that helps a new team member also helps an agent, only more so. An agent starts every task as a new team member.

### A Module Fits in a Context Window

An agent can only reason about what it has read, and reading costs context. In a tangled codebase, "add discount codes to orders" means reading half the system to find out what might break. In a modular monolith, the task has a natural scope: `orders-impl`, plus the `-api` modules Orders depends on.

Those `-api` modules are a compact map of the whole system. Every capability, every DTO, every event and every error type, without a line of implementation. An agent can read the APIs of all six modules in a few thousand tokens and know what the rest of the system can do for it, without guessing.

Microservices give you small scopes too, but they hide the neighbors behind a network: the agent sees an HTTP client and has to guess what the other side does. In a monolith, the contract is right there in the repository, and the compiler checks it.

### The Build Is the Reviewer

Agents take the same shortcuts as a developer on a deadline, only faster and more often. The test needs a product, and there's a perfectly good builder in `products-impl`. The query needs a weight, and the `products` table is right there.

This is where enforcement pays off twice. A rule in a wiki page gets broken; a rule in the build gets followed, because the agent sees the failure and fixes it in the same loop, before a human ever looks. Every check in this guide becomes feedback an agent can act on:

- an import from another module's `-impl`: a compile error;
- an upward dependency or a test fixture crossing a boundary: a failed module validation task;
- a join into another module's schema: "permission denied" in the module tests;
- a fake that drifted from the real implementation: a failed contract test.

The faster those checks run, the more useful they are. Make sure every module can be verified on its own, so an agent working in Shipping runs `./gradlew :shipping:shipping-impl:check` in seconds instead of the whole suite in minutes.

One thing to guard: an agent that can't get past a failing check may "fix" the check. It adds `products-impl` to the dependencies, or loosens the validation rule. Keep the rules in `build-logic`, put the build files and the module validation config under `CODEOWNERS`, and tell your agents explicitly that changing dependencies between modules is a question for a human, not a fix.

### Tell Each Module What It Is

Most agents read instruction files from the repository (`AGENTS.md`, `CLAUDE.md`). Put one at the root with the architecture rules and the commands, and a short one in each module with what only that module knows:

```markdown
# Orders

Owns orders and their lifecycle, from placed to delivered.

- Public contract: `orders-api`. Changing it needs review from the Orders team.
- Publishes: OrderPlacedEvent, OrderCancelledEvent.
- Listens to: PaymentCompletedEvent, ShipmentDeliveredEvent.
- An order's lines are fixed once it is placed. Changes create a new order.
- Test: ./gradlew :orders:orders-impl:check
```

Keep it short and keep it true. The structure of the code already says most of it; the file is for the invariants and decisions that the code can't show.

### Where Humans Look

With agents writing more of the code, review attention becomes the scarce resource, and the module structure tells you where to spend it. A change inside one `-impl` module is contained: if it's wrong, it's wrong in one place, and the module tests say so. Changes to the seams are different. A new method or error in an `-api` module, a new event, a database migration, a new dependency between modules: those shape everyone else's code, and they're worth a careful human read.

The same seams make it practical to run several agents at once. Two agents working in Shipping and Inventory rarely touch the same files, so their work merges cleanly. When both need a change to the same `-api`, that's your signal to coordinate first.

And the oldest objection to all this structure, the ceremony, has largely gone away. An `-api` module, a mapper, a DTO and a fake are tedious to write by hand and trivial for an agent. The boilerplate is cheap now. The boundaries are what it buys you.

---

<a id="conclusion"></a>

## Conclusion

A modular monolith isn't a compromise or a stepping stone to microservices. For most teams, it's the destination.

You get boundaries that hold—not because everyone remembered the guidelines, but because the compiler enforces them. You get changes that stay local, because modules can't reach into each other's internals. You get deployment that stays simple, because it's still one JAR, one process, one thing to monitor at 3am when something goes wrong.

Not everything in this guide carries equal weight. Some things are load-bearing: enforcement through Gradle modules, the API/implementation split, data isolation. Skip these, and the "modular" part of your monolith will erode within months. Other things—how you organize packages inside a module, whether you use Cucumber, what you name your handlers—are local decisions. Get them wrong and you have a mess, but it's a contained mess. The module boundary limits the blast radius.

That's the real payoff. In a traditional monolith, every shortcut becomes everyone's problem. In a modular monolith, a messy module is just a messy module. Clean it up later, on your own schedule, without coordinating across teams. (At runtime it still shares a process with everyone else, so give it limits.)

And it pays off more now than when the pattern got its name. When agents write a growing part of the code, the boundaries that the build enforces are the rules that actually get followed, and a module is a unit of work small enough to hold in one head, human or not.

Build the boundaries. Enforce them. Ship the JAR.

---

Finally, a cheat sheet as quick reference. Click it to hold it up, and click again to zoom in:

<figure>
<img src="/blog/building-a-modular-monolith/image-64.webp" alt="Modular monolith cheat sheet for Kotlin and Spring Boot" data-zoom="2800" />
</figure>

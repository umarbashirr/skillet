# Dependency injection & auto-configuration

## Bean stereotypes (component scanning)
All are `@Component` specializations; scanning registers them as beans. Use the most specific:
- **`@Component`** — generic Spring-managed bean.
- **`@Service`** — business/service layer (semantic; no extra behavior by default).
- **`@Repository`** — persistence layer; adds **persistence-exception translation** (vendor
  exceptions → Spring's `DataAccessException`).
- **`@Controller`** / **`@RestController`** — web layer (see web-rest.md).

Scanning starts at the package of `@SpringBootApplication` and recurses **downward**. A stereotype
outside that subtree is never registered. (SKILL gotcha #1.)

## `@Bean` in `@Configuration`
For beans you don't own (library types) or that need wiring logic, declare factory methods:
```java
@Configuration
class AppConfig {
  @Bean
  RestClient restClient(RestClient.Builder builder) {       // params injected by type
    return builder.baseUrl("https://api.example.com").build();
  }
}
```
- `@Configuration` classes are CGLIB-proxied so `@Bean` calls return the *same* singleton. Use
  `@Configuration(proxyBeanMethods = false)` (the style Boot's own auto-config uses) when methods don't
  call each other — it's faster and avoids the proxy.
- `@Bean` method **name** = bean name (override with `@Bean("id")`).

## Injection: constructor (preferred) vs field
```java
@Service
class OrderService {
  private final PaymentGateway gateway;
  private final OrderRepository repo;
  OrderService(PaymentGateway gateway, OrderRepository repo) {   // single ctor ⇒ no @Autowired needed
    this.gateway = gateway;
    this.repo = repo;
  }
}
```
- **Constructor injection** — immutable `final` fields, fully-initialized objects, fails fast on a
  missing/ambiguous dependency, trivially testable (just `new` it in tests). **Default choice.**
- **Field injection** (`@Autowired` on a field) — hides dependencies, can't be `final`, needs
  reflection/Spring context to test, allows circular deps to slip through. Avoid.
- **Setter/optional** injection for genuinely optional collaborators (`@Autowired(required = false)`,
  `Optional<T>`, or `ObjectProvider<T>` for lazy/multiple).

## Disambiguation: `@Qualifier` / `@Primary`
When more than one bean of a type exists, injection by type is ambiguous
(`NoUniqueBeanDefinitionException`). Resolve with:
- **`@Primary`** on the default bean — picked when no qualifier is given.
- **`@Qualifier("name")`** at the injection point — selects a specific bean by name/qualifier.
```java
@Bean @Primary DataSource main(...) { ... }
@Bean @Qualifier("audit") DataSource audit(...) { ... }

OrderService(@Qualifier("audit") DataSource ds) { ... }
```
- Inject **all** beans of a type with `List<T>`/`Map<String,T>` (map key = bean name).

## Conditional beans
Conditions decide whether a bean/configuration is registered — the backbone of auto-config and a tool
for your own optional wiring:
- **`@ConditionalOnMissingBean`** — register only if the user hasn't defined one (the "back off"
  mechanism).
- **`@ConditionalOnBean`**, **`@ConditionalOnClass`** / **`@ConditionalOnMissingClass`** (classpath),
  **`@ConditionalOnProperty(name = "...", havingValue = "true")`**, **`@ConditionalOnWebApplication`**,
  **`@ConditionalOnResource`**, **`@Profile`**, and the generic **`@Conditional(MyCondition.class)`**.
```java
@Bean
@ConditionalOnMissingBean
@ConditionalOnProperty(name = "app.cache.enabled", havingValue = "true", matchIfMissing = true)
CacheManager cacheManager() { return new CaffeineCacheManager(); }
```

## How auto-configuration works
1. A **starter** (`spring-boot-starter-*`) drops a coherent set of libraries on the classpath.
2. **`@EnableAutoConfiguration`** (inside `@SpringBootApplication`) loads candidate
   `@AutoConfiguration` classes listed in each jar's
   **`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`** file (one
   fully-qualified class name per line). *(Pre-2.7 this lived under
   `spring.factories` as `EnableAutoConfiguration=…`; the imports file is the current mechanism —
   check the project's Boot version.)*
3. Each candidate is gated by `@Conditional*` (mostly `@ConditionalOnClass` + `@ConditionalOnMissingBean`),
   so it applies only when relevant classes are present and **you haven't already supplied the bean**.
4. **You override by supplying your own bean or flipping a property** — never by editing framework
   code. Inspect what matched/backed off via the `conditions` actuator endpoint or running with
   `--debug` (prints the auto-configuration report).

Writing your own: annotate with `@AutoConfiguration`, add conditions, list it in the imports file (or
expose it as `@Configuration` via `@Import`/an `@Enable…` annotation in a starter).

## Bean scopes & lifecycle
- **Scopes:** `singleton` (default — one per context), `prototype` (new instance per lookup),
  and web scopes `request`/`session`/`application`. Set with `@Scope("prototype")`.
  ⚠️ Injecting a shorter-lived scope (prototype/request) into a singleton needs a proxy
  (`@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)`) or `ObjectProvider`, else the singleton captures
  one instance forever.
- **Lifecycle hooks:** `@PostConstruct` / `@PreDestroy` (Jakarta), or implement
  `InitializingBean`/`DisposableBean`, or `@Bean(initMethod=…, destroyMethod=…)`. `@PreDestroy` runs
  only for singletons on context close — **not** for prototypes.
- **`@Lazy`** defers creation until first use (and breaks some circular-dependency cases, though the
  real fix is usually to restructure).

## Profiles affecting beans
- `@Profile("prod")` on a `@Component`/`@Configuration`/`@Bean` registers it only under that profile;
  combine with `@ConditionalOnMissingBean` for "prod default, override-able" patterns.
- Use profile-specific `@Configuration` classes to swap whole implementations (e.g. a fake
  `PaymentGateway` under `@Profile("test")`). Activation is config-driven (see config-actuator.md).

> Conditional-annotation names and the auto-config registration file have changed across major
> versions — verify against `/spring-projects/spring-boot` (context7) or
> `https://docs.spring.io/spring-boot/` for the project's detected version.

# Configuration, profiles & Actuator

## `.properties` vs `.yml`
- Spring Boot loads `application.properties` **or** `application.yml` from the classpath (and
  `config/`, the working dir, etc.). Pick one format per file — don't split the same keys across both.
- YAML is hierarchical and supports lists naturally; properties is flat. They're equivalent in power.

```yaml
# application.yml
server:
  port: 8080
app:
  feature-flags: [search, export]      # list
  retry:
    max-attempts: 3
```
```properties
# application.properties — same thing, flat
server.port=8080
app.feature-flags[0]=search
app.feature-flags[1]=export
app.retry.max-attempts=3
```

## Profiles
- A **profile** is a named slice of config/beans (`dev`, `prod`, `test`, …).
- Activate with `spring.profiles.active`:
  ```yaml
  spring:
    profiles:
      active: "dev,hsqldb"     # comma-separated; multiple allowed
  ```
  or at launch: `java -jar app.jar --spring.profiles.active=prod`, or env
  `SPRING_PROFILES_ACTIVE=prod`.
- **Profile-specific files** are loaded *in addition to* and **override** the base:
  `application-dev.yml`, `application-prod.properties`. They take precedence over `application.yml`.
- In a single YAML file, separate profile documents with `---` and `spring.config.activate.on-profile`.
- **`@Profile("dev")`** on a `@Component`/`@Bean`/`@Configuration` includes it only when that profile
  is active (`@Profile("!prod")` for negation). See di-autoconfig.md for bean-level effects.

## `@ConfigurationProperties` vs `@Value`
- **`@ConfigurationProperties(prefix = "app")`** — type-safe binding of a whole tree to a POJO/record.
  Preferred for grouped/structured config; supports validation, relaxed binding, and nested objects.
  ```java
  @ConfigurationProperties(prefix = "app.retry")
  record RetryProps(int maxAttempts, Duration backoff) {}   // binds app.retry.max-attempts, app.retry.backoff
  ```
  Register it with **`@EnableConfigurationProperties(RetryProps.class)`** on a config class, or scan
  with **`@ConfigurationPropertiesScan`** on the application class. (Record/immutable types use
  constructor binding automatically.)
- **`@Value("${app.timeout:5s}")`** — single value with SpEL + default after `:`. Fine for a one-off;
  doesn't give you a typed object, validation, or IDE metadata. Avoid for groups of related keys.
- **Relaxed binding:** `app.maxAttempts`, `app.max-attempts`, `APP_MAXATTEMPTS` all bind the same
  target. Env vars use **uppercase with underscores**, dots/dashes → `_`.

## Externalized config precedence (later wins)
Boot layers many sources; values from a **higher-precedence** source override lower ones. From lowest
to highest, the key ones:

1. Default properties (`SpringApplication.setDefaultProperties`)
2. `@PropertySource` on `@Configuration` classes
3. **Config data files** (`application.properties`/`.yml`, then profile-specific)
4. OS environment variables
5. Java system properties (`-Dkey=value`)
6. `SPRING_APPLICATION_JSON` (inline JSON in env var or system property)
7. **Command-line arguments** (`--server.port=9000`)
8. (in tests) `@TestPropertySource` / `@DynamicPropertySource` override everything above

So a `--server.port=9000` CLI arg beats an env var, which beats `application.yml`. Use this to keep
secrets/per-env values out of the jar.

## Actuator
Add `spring-boot-starter-actuator`. Endpoints live under `/actuator`.
- **Exposure (security default):** only **`/health`** is exposed over HTTP by default. Opt in:
  ```yaml
  management:
    endpoints:
      web:
        exposure:
          include: health,info,metrics,env      # or "*" for all (use with care)
          # exclude: env                          # exclude wins over include
  ```
- **Health:** `/actuator/health` aggregates indicator beans (DB, disk, etc.). Show details with
  `management.endpoint.health.show-details=when-authorized` (or `always`/`never`). Define custom checks
  by implementing `HealthIndicator`.
- **Info:** `/actuator/info` — populate from `management.info.*` / `info.*` properties or `InfoContributor`s
  (git/build info appears if `git-commit-id` / build-info are generated).
- **Metrics:** `/actuator/metrics` (drill into a name, e.g. `/actuator/metrics/jvm.memory.used`) backed
  by **Micrometer** — a vendor-neutral metrics facade. Add a registry dependency (e.g.
  `micrometer-registry-prometheus`) to export to your monitoring system; the `/actuator/prometheus`
  endpoint then appears.
- **Other useful endpoints:** `env`, `configprops`, `beans`, `mappings`, `loggers` (change log levels
  at runtime), `conditions` (the auto-config report — invaluable for debugging "why is this bean here").

## Securing endpoints
- If **Spring Security** is on the classpath and you haven't defined a `SecurityFilterChain`, Boot
  auto-secures all actuators **except `/health`**.
- Only expose what you need; keep `env`, `configprops`, `beans`, `heapdump`, `threaddump`, `loggers`
  off the open web — they can leak secrets or allow runtime changes. Put management on a separate port
  (`management.server.port`) and/or behind auth.
- Tune health detail visibility (`show-details`) so unauthenticated callers don't see DB/host info.

> Property keys and Actuator endpoint behavior shift across versions — verify exact keys against the
> application-properties appendix (`https://docs.spring.io/spring-boot/`) or context7
> (`/spring-projects/spring-boot`).

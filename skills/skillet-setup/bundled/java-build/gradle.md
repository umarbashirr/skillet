# Gradle — DSL, task graph, plugins, configurations, toolchains, multi-project

## build.gradle (Groovy DSL) vs build.gradle.kts (Kotlin DSL)
Same model, two languages. **Detect which the repo uses** by file extension:
- `build.gradle` → **Groovy DSL**. `id 'java'`, single or double quotes, optional parens.
- `build.gradle.kts` → **Kotlin DSL**. `id("java")`, double quotes + parens required, type-safe,
  better IDE completion. Core plugins use backticks: `` `java-library` ``.

```kotlin
// build.gradle.kts (Kotlin DSL)
plugins { `java-library` }
repositories { mavenCentral() }
dependencies { implementation("com.google.guava:guava:33.3.1-jre") }
```
```groovy
// build.gradle (Groovy DSL)
plugins { id 'java-library' }
repositories { mavenCentral() }
dependencies { implementation 'com.google.guava:guava:33.3.1-jre' }
```

## The task graph
Gradle builds a **DAG of tasks**, each with inputs/outputs. It runs them in dependency order and **skips
`UP-TO-DATE` tasks** whose inputs/outputs are unchanged (incremental builds + build cache). `build`
depends on `assemble` (produce artifacts) + `check` (run `test` etc.). Run an arbitrary task by name;
`./gradlew tasks` lists them.

## The `plugins {}` block
Applies plugins (which add tasks + conventions). Core plugins use an id with no version; community ones
need a version (or are pinned in `settings.gradle[.kts]`). Common plugins (verify ids via context7
`/websites/gradle_current_userguide`):
- **`java`** / **`java-library`** — compile/test/jar; `java-library` adds the `api` configuration.
- **`application`** — adds `run` + `installDist`/`distZip`; set `application { mainClass = ... }`.
- **`java-platform`** — author a BOM-equivalent platform of dependency constraints.
- **`org.springframework.boot`** — Spring Boot's plugin: `bootJar`/`bootRun` executable-jar tasks.
- **`io.spring.dependency-management`** — Spring's dependency-management plugin (imports BOMs);
  on newer setups you can instead use Gradle's native `platform(...)`. (Details: `spring-boot` skill.)

```kotlin
plugins {
  java
  application
  id("org.springframework.boot") version "3.4.0"   // pin per project; detect, don't assume
  id("io.spring.dependency-management") version "1.1.7"
}
```

## Dependency configurations
The configuration expresses *how* a dependency is used (the analogue of Maven scopes). From the `java` /
`java-library` plugins:
- **implementation** — compile + runtime; **not** exposed to consumers (implementation detail).
- **api** (java-library only) — compile + runtime **and** leaked to consumers' compile classpath. Use
  only when the dependency appears in your public types.
- **compileOnly** — compile only, not packaged/runtime (e.g. Lombok, `provided`-style APIs).
- **runtimeOnly** — runtime only, not on compile classpath (e.g. a JDBC driver).
- **testImplementation** / **testCompileOnly** / **testRuntimeOnly** — the test-classpath equivalents.

```kotlin
dependencies {
  api("org.slf4j:slf4j-api:2.0.16")             // part of our public API
  implementation("com.google.guava:guava:33.3.1-jre")
  compileOnly("org.projectlombok:lombok:1.18.34")
  runtimeOnly("org.postgresql:postgresql:42.7.4")
  testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")
}
```
(`compile`/`runtime` are removed — superseded by `implementation`/`runtimeOnly`.)

## `dependencies` / `repositories` blocks
`repositories {}` declares where to resolve from — almost always `mavenCentral()` (and/or
`gradlePluginPortal()`, internal `maven { url = ... }`). `dependencies {}` declares deps per
configuration as `"group:name:version"` GAV strings.

## Java toolchains
The modern, version-agnostic way to pin the JDK used to compile/test — independent of the JDK running
Gradle (which auto-provisions a matching JDK). **Detect** `languageVersion`; don't assume.

```kotlin
java {
  toolchain { languageVersion = JavaLanguageVersion.of(21) }
}
```
(Legacy projects may use `sourceCompatibility`/`targetCompatibility` instead — prefer toolchains.)

## Multi-project (`settings.gradle[.kts]`)
`settings.gradle[.kts]` names the build and `include`s subprojects; each subproject has its own build
file. Depend on a sibling via `project(":path")`.

```kotlin
// settings.gradle.kts
rootProject.name = "app"
include("app-core", "app-web")
```
```kotlin
// app-web/build.gradle.kts
dependencies { implementation(project(":app-core")) }
```

## Common `./gradlew` tasks
```bash
./gradlew build                   # assemble + check (compile, test, jar) — use the wrapper
./gradlew test                    # run tests
./gradlew test --tests "FooTest"  # run a single test class
./gradlew build -x test           # build but skip the test task
./gradlew dependencies            # print configurations + resolved tree (see deps-ci.md)
./gradlew :app-web:build          # build one subproject
./gradlew tasks                   # list available tasks
./gradlew clean                   # delete build outputs
```

## Build cache & daemon (note)
Gradle runs a long-lived **daemon** (JVM kept warm) and reuses task outputs from the **build cache**
(local, and optionally remote/shared in CI). This makes incremental builds fast but can serve **stale**
results when something outside Gradle's input tracking changed. Escape hatches: `--rerun-tasks`
(ignore up-to-date), `--no-build-cache`, `--no-daemon`, and `./gradlew --stop` to kill daemons. Enable
the cache via `org.gradle.caching=true` in `gradle.properties`.

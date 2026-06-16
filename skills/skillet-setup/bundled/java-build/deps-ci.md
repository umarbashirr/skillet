# Dependency resolution, conflicts, BOMs/platforms & CI

## How each tool resolves a version conflict
When the transitive graph requests several versions of one GAV, the tool picks **one** — and the two
tools pick differently:
- **Maven — "nearest wins" (shortest path).** The version closest to your project in the dependency
  tree wins (fewest hops). Ties break by declaration order. This can pick an **older** version if it
  sits nearer the root, which surprises people. Override by declaring the version in
  `<dependencyManagement>` (which always wins over transitive picks).
- **Gradle — highest version wins.** Among all requested versions, Gradle selects the **highest**
  (treating them as a single requirement), then applies any constraints/rules. Override via
  `constraints`, a `platform`, or `resolutionStrategy.force` (below).

Neither default is "right" — both can yield a version no single dependency asked for, so **inspect**.

## Inspect the tree
```bash
# Maven
./mvnw dependency:tree                                  # full graph
./mvnw dependency:tree -Dincludes=com.google.guava:guava   # filter to one artifact
./mvnw dependency:analyze                               # used-but-undeclared / declared-but-unused

# Gradle
./gradlew dependencies                                  # tree per configuration
./gradlew dependencies --configuration runtimeClasspath # one configuration only
./gradlew dependencyInsight --dependency guava --configuration runtimeClasspath  # why this version?
```
`dependencyInsight` is the key Gradle tool: it explains **why** a given version was selected.

## Exclude or force a version
**Exclude** a transitive artifact you don't want:
```xml
<!-- Maven -->
<dependency>
  <groupId>com.example</groupId><artifactId>lib</artifactId><version>1.0</version>
  <exclusions>
    <exclusion><groupId>commons-logging</groupId><artifactId>commons-logging</artifactId></exclusion>
  </exclusions>
</dependency>
```
```kotlin
// Gradle
implementation("com.example:lib:1.0") {
  exclude(group = "commons-logging", module = "commons-logging")
}
```
**Force / pin** a specific version:
```xml
<!-- Maven: dependencyManagement always wins over transitive resolution -->
<dependencyManagement><dependencies>
  <dependency><groupId>commons-codec</groupId><artifactId>commons-codec</artifactId>
    <version>1.17.1</version></dependency>
</dependencies></dependencyManagement>
```
```kotlin
// Gradle: prefer constraints; force is the blunt instrument
dependencies {
  constraints { implementation("commons-codec:commons-codec:1.17.1") }
}
// or, last resort:
configurations.all { resolutionStrategy.force("commons-codec:commons-codec:1.17.1") }
```

## BOMs / platforms for alignment
Align a whole family of artifacts to one consistent set of versions — declare versions in **one** place,
then reference deps without versions.
```xml
<!-- Maven: import a BOM -->
<dependencyManagement><dependencies>
  <dependency><groupId>com.fasterxml.jackson</groupId><artifactId>jackson-bom</artifactId>
    <version>2.18.2</version><type>pom</type><scope>import</scope></dependency>
</dependencies></dependencyManagement>
```
```kotlin
// Gradle: consume a BOM via platform() (enforcedPlatform() to hard-override transitives)
dependencies {
  implementation(platform("com.fasterxml.jackson:jackson-bom:2.18.2"))
  implementation("com.fasterxml.jackson.core:jackson-databind")   // version comes from the BOM
}
```
You can also **author** alignment: Maven via a `pom`-packaged BOM module; Gradle via the
`java-platform` plugin with a `constraints {}` block.

## Reproducible builds & the wrapper
- **Always invoke the wrapper** (`./mvnw`, `./gradlew`) so the build-tool version is pinned by
  `maven-wrapper.properties` / `gradle-wrapper.properties` — identical locally and in CI.
- Depend only on **fixed versions** for releases; avoid `-SNAPSHOT` and dynamic ranges
  (`1.+`, `[1.0,2.0)`) in anything you ship — they make builds non-reproducible.
- Gradle can lock versions with **dependency locking** (`gradle.lockfile`) / a **version catalog**
  (`gradle/libs.versions.toml`); Maven pins via `dependencyManagement` + the wrapper.

## Running build + test in CI
Core idea: use the wrapper, run the full verify, and **cache the dependency store** so CI doesn't
re-download the world each run — the local Maven repo (`~/.m2/repository`) or the Gradle caches
(`~/.gradle/caches`, plus the build cache).
- Maven: `./mvnw -B clean verify` (`-B` = batch/non-interactive; add `-ntp` to quiet transfer logs).
- Gradle: `./gradlew build` (the official `setup-gradle`/`gradle-build-action` handles cache + the
  Gradle build cache for you).

### Minimal CI job shape (GitHub Actions, generic)
```yaml
# Maven
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'        # match the project's toolchain — detect, don't assume
          cache: maven              # caches ~/.m2/repository
      - run: ./mvnw -B clean verify
```
```yaml
# Gradle
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'        # match the toolchain
      - uses: gradle/actions/setup-gradle@v4   # caches ~/.gradle + enables the build cache
      - run: ./gradlew build
```
Adapt the `java-version` to the detected toolchain, and the runner/secrets to your platform (the same
shape maps onto GitLab CI, Jenkins, etc.). For publishing, add `deploy`/`publish` after a green
`verify`/`build`, with credentials supplied via CI secrets (Maven `settings.xml` `<server>` /
`-s settings.xml`, or Gradle publishing properties) — never committed.

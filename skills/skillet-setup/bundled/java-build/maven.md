# Maven — POM, lifecycle, scopes, plugins, multi-module

## POM anatomy (`pom.xml`)
The POM is the project's identity + build config. Minimum: `modelVersion`, GAV (`groupId`,
`artifactId`, `version`), and (usually) `packaging` (`jar` default; `pom` for parents/aggregators, `war`).

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>jar</packaging>

  <properties>
    <maven.compiler.release>21</maven.compiler.release>   <!-- the Java release; detect, don't assume -->
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <dependencies> ... </dependencies>
  <dependencyManagement> ... </dependencyManagement>
  <build><plugins> ... </plugins></build>
</project>
```
Inherit shared config from a `<parent>`; `<dependencies>` are direct deps; `<build><plugins>` configure
the build. Versions/config can be centralized via `<properties>` and `<dependencyManagement>`.

## The default lifecycle (phases run in order)
Running a phase runs **every earlier phase** too. Key phases of the *default* lifecycle:
`validate → compile → test → package → integration-test → verify → install → deploy`.
Two other lifecycles: **clean** (`pre-clean → clean → post-clean`) and **site**.
- `mvn package` → compile + run unit tests + build the jar/war.
- `mvn verify` → also runs integration tests + checks.
- `mvn install` → puts the artifact in your **local** repo (`~/.m2/repository`) for other local builds.
- `mvn deploy` → pushes to a **remote** repository (release/snapshot). `mvn clean deploy` is common in CI.

Plugin **goals** bind to phases (e.g. `compiler:compile` → `compile`). A goal can also be run directly,
`plugin:goal`, e.g. `mvn dependency:tree`.

## Dependency scopes (six)
Scope controls which classpaths a dependency is on and whether it is transitive:
- **compile** (default) — on all classpaths (compile, test, runtime); transitive.
- **provided** — needed to compile but supplied at runtime by the JDK/container (e.g. servlet API);
  not packaged, not transitive.
- **runtime** — not needed to compile, needed to run (e.g. a JDBC driver); on runtime + test classpaths.
- **test** — only for compiling/running tests (e.g. JUnit); not transitive, not packaged.
- **system** — like `provided` but you point at an explicit local `<systemPath>` jar. Avoid; brittle.
- **import** — only valid inside `<dependencyManagement>` with `<type>pom</type>`; pulls another POM's
  managed versions in (BOM import). Not a real classpath scope.

```xml
<dependency>
  <groupId>org.postgresql</groupId><artifactId>postgresql</artifactId>
  <version>42.7.4</version>
  <scope>runtime</scope>
</dependency>
```

## dependencyManagement & BOM import
`<dependencyManagement>` declares **versions/config without adding the dependency** — child modules and
`<dependencies>` then omit the version and inherit it. Import a **BOM** (a `pom`-packaged version list)
to align a whole family of artifacts:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson</groupId>
      <artifactId>jackson-bom</artifactId>
      <version>2.18.2</version>
      <type>pom</type>
      <scope>import</scope>     <!-- BOM import: aligns all jackson-* versions -->
    </dependency>
  </dependencies>
</dependencyManagement>
```

## Plugins & goals
Plugins do the work; configure them in `<build><plugins>`. Common ones (pin versions per project;
verify coordinates via context7 `/apache/maven-site`):
- **maven-compiler-plugin** — compiles sources. Prefer `<release>` (single flag) over `source`/`target`.
  Often unneeded if `maven.compiler.release` property is set.
- **maven-surefire-plugin** — runs **unit** tests during the `test` phase (`*Test.java` by default).
- **maven-failsafe-plugin** — runs **integration** tests (`*IT.java`) bound to `integration-test` +
  `verify`, so a failure fails `verify` not `test` (lets teardown run).
- **spring-boot-maven-plugin** (groupId `org.springframework.boot`) — repackages into an executable
  ("fat") jar via its `repackage` goal, and adds `spring-boot:run`. (Details: `spring-boot` skill.)

```xml
<build><plugins>
  <plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.13.0</version>
    <configuration><release>21</release></configuration>
  </plugin>
</plugins></build>
```

## Profiles
`<profiles>` carry alternate config (deps, props, plugins) activated by `-P<id>`, OS, JDK, a property,
or a file. Use for env-specific or opt-in builds — not for things that should always apply.

```xml
<profiles>
  <profile>
    <id>ci</id>
    <properties><skipITs>false</skipITs></properties>
  </profile>
</profiles>
```
Activate: `mvn verify -Pci`.

## Multi-module (parent / aggregator)
A `pom`-packaged parent lists child `<modules>`; building the parent builds them all (the **reactor**
orders them by inter-module deps). The parent typically holds shared `dependencyManagement` + plugin
config; children declare a `<parent>` and add module-specific deps.

```xml
<!-- parent/pom.xml -->
<packaging>pom</packaging>
<modules>
  <module>app-core</module>
  <module>app-web</module>
</modules>
```
`mvn -pl app-web -am package` builds just `app-web` **a**nd its needed **m**odules.

## Common `mvn` commands
```bash
./mvnw clean package              # clean, compile, unit-test, build jar (use the wrapper)
./mvnw verify                     # also integration tests + checks
./mvnw test -Dtest=FooTest        # run a single test class
./mvnw package -DskipTests        # build but skip running tests (still compiles them)
./mvnw dependency:tree            # print the resolved dependency graph (see deps-ci.md)
./mvnw -pl module -am install     # build one module and its dependencies
./mvnw help:effective-pom         # the fully-resolved POM after inheritance/profiles
```

## settings.xml & mirrors (brief)
User config lives in `~/.m2/settings.xml` (not in the project): server credentials, proxies, active
profiles, and **mirrors** that redirect all/some repository requests (e.g. to a corporate Nexus/
Artifactory). A `<mirror>` with `<mirrorOf>*</mirrorOf>` (or `external:*`) routes resolution through your
internal repo — common in enterprises. Keep secrets here, never in `pom.xml`.

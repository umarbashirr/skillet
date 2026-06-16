# Spring Boot test support — slices, MockMvc, Testcontainers

Reach for the **lightest** thing that exercises the behaviour: a plain unit test (no Spring) first,
then a **slice**, then full `@SpringBootTest` only when you truly need the whole context. For JPA
entity/query behaviour itself, see the **`jpa-hibernate`** skill.

## What `spring-boot-starter-test` gives you
One test dependency pulls in **JUnit 5 (Jupiter)**, **Mockito** (+ `mockito-junit-jupiter`),
**AssertJ**, **Hamcrest**, **JSONassert**, **JsonPath**, and **Spring Test** (`spring-test`,
`@SpringBootTest`, slice annotations, `MockMvc`, `TestRestTemplate`). So on a Spring Boot project you
usually don't add JUnit/Mockito/AssertJ separately.

## `@SpringBootTest` — full application context
```java
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class OrderIntegrationTest {
    @LocalServerPort int port;
    @Autowired TestRestTemplate rest;     // available with a real port
}
```
`webEnvironment`:
- **`MOCK`** (default) — loads the web context but a **mock** servlet environment, no embedded server.
  Pair with `@AutoConfigureMockMvc` to drive it via `MockMvc`.
- **`RANDOM_PORT`** — real embedded server on a random port; use `TestRestTemplate`/`WebTestClient`.
- **`DEFINED_PORT`** — real server on the configured/`8080` port.
- **`NONE`** — context, no web environment.

`@Transactional` on a `@SpringBootTest` rolls back each test method (does **not** apply to server-side
transactions under `RANDOM_PORT`/`DEFINED_PORT` — separate threads).

## Slice tests — load only one layer

### `@WebMvcTest` — controller + MVC infrastructure only
No services/repos in the context — mock them. Use `MockMvc` to drive requests:
```java
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired   MockMvc mvc;
    @MockitoBean UserService service;     // replaces the bean in the sliced context

    @Test
    void returnsUser() throws Exception {
        given(service.find(1L)).willReturn(new UserDto("Ada"));
        mvc.perform(get("/users/1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.name").value("Ada"));
    }
}
```
`@MockitoBean` is the current annotation (Spring 6.2+/Boot 3.4+); on older versions it's
`@MockBean` from `org.springframework.boot.test.mock.mockito` (now deprecated). `@MockitoSpyBean`
(ex-`@SpyBean`) is the spy equivalent. Newer Boot also offers `MockMvcTester` (AssertJ-flavoured).

### `@DataJpaTest` — JPA/repository slice
Configures JPA, repositories, and a `TestEntityManager`; **`@Transactional` + rollback per test**.
By default it **replaces** your datasource with an in-memory embedded DB (H2). To test against the
real database, disable the swap:
```java
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;

@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)   // use the real/Testcontainers DB, not H2
class UserRepositoryTest {
    @Autowired UserRepository repo;
    @Autowired TestEntityManager em;
}
```

### Other slices
`@JsonTest` (Jackson/Gson (de)serialization with `JacksonTester`), `@WebFluxTest` (+ `WebTestClient`),
`@RestClientTest`, `@JdbcTest`. Each loads only the beans relevant to that layer.

## `@TestConfiguration` — extra/override beans for a test
A nested or imported config that adds or overrides beans without replacing the app's main config:
```java
@TestConfiguration
static class Beans {
    @Bean Clock fixedClock() { return Clock.fixed(INSTANT, ZoneOffset.UTC); }
}
// import it: @Import(Beans.class) on the test
```

## Profiles & properties
```java
@ActiveProfiles("test")                                  // activates application-test.yml etc.
@SpringBootTest(properties = "feature.x.enabled=true")   // inline property overrides
```

## `@Sql` — run SQL around a test
```java
import org.springframework.test.context.jdbc.Sql;

@Sql("/seed-users.sql")                                  // before the test method
@Sql(scripts = "/clean.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
@Test void usesSeededData() {}
```

## Testcontainers — real DBs/brokers in integration tests
Add `org.testcontainers:junit-jupiter` (+ `postgresql` etc.) and Boot's `spring-boot-testcontainers`.
```java
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class OrderRepositoryIT {
    @Container @ServiceConnection                         // Boot wires datasource props automatically
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired OrderRepository repo;
}
```
`@ServiceConnection` (Boot 3.1+) auto-creates the connection details — no manual property wiring.
On older Boot, do it by hand with `@DynamicPropertySource`:
```java
@DynamicPropertySource
static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", postgres::getJdbcUrl);
    r.add("spring.datasource.username", postgres::getUsername);
    r.add("spring.datasource.password", postgres::getPassword);
}
```
`static` `@Container` is started once for the class; non-static is per test method (slower).

## When to use which
- **Pure logic, no Spring needed?** Plain JUnit + Mockito (fastest). Not here.
- **A controller's HTTP/JSON contract?** `@WebMvcTest` + `MockMvc` + `@MockitoBean` services.
- **A repository / query / mapping?** `@DataJpaTest` (real DB via Testcontainers + `Replace.NONE` if
  you need DB-specific behaviour; otherwise embedded H2).
- **(De)serialization only?** `@JsonTest`.
- **End-to-end wiring / cross-layer behaviour?** `@SpringBootTest` (+ Testcontainers for real infra).

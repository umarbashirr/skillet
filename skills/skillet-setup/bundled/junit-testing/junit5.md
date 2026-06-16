# JUnit 5 (Jupiter) — tests, lifecycle, assertions, parameterized

Everything here is `org.junit.jupiter.api.*`. If imports say `org.junit.*` you're on JUnit 4 — see the
mapping at the bottom. No `public` needed on Jupiter test classes/methods (package-private is fine).

## A test
```java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class CalculatorTest {
    @Test
    void adds_two_numbers() {
        assertEquals(4, new Calculator().add(2, 2));
    }
}
```

## Lifecycle
```java
import org.junit.jupiter.api.*;

class LifecycleTest {
    @BeforeAll  static void initOnce() {}   // once before all tests (static, unless PER_CLASS)
    @BeforeEach void setUp()      {}        // before EACH test — fresh fixtures here
    @AfterEach  void tearDown()   {}        // after each test
    @AfterAll   static void done() {}       // once after all tests (static)
}
```
`@BeforeAll`/`@AfterAll` are `static` by default. They become non-static only under
`@TestInstance(Lifecycle.PER_CLASS)` (see test instance lifecycle below).

## Assertions (built-in)
```java
import static org.junit.jupiter.api.Assertions.*;

assertEquals(expected, actual);                 // optional message is the LAST arg (vs JUnit 4: first)
assertEquals(4, x, () -> "lazy message");       // Supplier<String> — only built on failure
assertTrue(cond); assertFalse(cond);
assertNull(x); assertNotNull(x);
assertSame(a, b);                               // reference identity
assertArrayEquals(expectedArr, actualArr);

// Exceptions — assert the throw AND inspect it:
IllegalArgumentException ex = assertThrows(
    IllegalArgumentException.class, () -> svc.parse("bad"));
assertEquals("bad input", ex.getMessage());
assertDoesNotThrow(() -> svc.parse("ok"));

// Grouped — ALL run, failures reported together (not short-circuited):
assertAll("user",
    () -> assertEquals("Ada", user.name()),
    () -> assertEquals(36, user.age()));

assertTimeout(Duration.ofMillis(100), () -> work());            // runs in same thread
assertTimeoutPreemptively(Duration.ofSeconds(1), () -> work()); // separate thread, aborts on timeout
```

### AssertJ (preferred when on the classpath)
`spring-boot-starter-test` bundles AssertJ. Fluent, readable, great failure messages:
```java
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

assertThat(user.name()).isEqualTo("Ada");
assertThat(list).hasSize(3).contains("a").doesNotContain("z");
assertThat(opt).isPresent().contains(value);
assertThatThrownBy(() -> svc.parse("bad"))
    .isInstanceOf(IllegalArgumentException.class)
    .hasMessage("bad input");
```

## Readability & structure
```java
@DisplayName("Shopping cart")
class CartTest {
    @Test @DisplayName("totals line items including tax")
    void totals() { /* ... */ }

    @Nested @DisplayName("when empty")
    class WhenEmpty {                 // groups related tests; inner @BeforeEach runs after outer
        @Test void totalIsZero() {}
    }

    @Test @Disabled("flaky — see TICKET-123")
    void skipped() {}

    @Test @Tag("slow")               // filter at run time: -Dgroups=slow / excludedGroups
    void heavy() {}
}
```

## Assumptions (abort, don't fail)
When a precondition isn't met, **abort** the test instead of failing it:
```java
import static org.junit.jupiter.api.Assumptions.*;

assumeTrue("CI".equals(System.getenv("ENV")));         // aborts (skips) if false
assumingThat(isProd(), () -> assertEquals(prod, cfg)); // only assert the block when condition holds
```

## Parameterized tests
Add `org.junit.jupiter:junit-jupiter-params`. Use `@ParameterizedTest` **instead of** `@Test`:
```java
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

@ParameterizedTest
@ValueSource(ints = {1, 2, 3})
void positive(int n) { assertTrue(n > 0); }

@ParameterizedTest
@CsvSource({"2,3,5", "0,0,0", "-1,1,0"})
void adds(int a, int b, int sum) { assertEquals(sum, a + b); }

@ParameterizedTest
@EnumSource(Status.class)            // one run per enum constant; names=/mode= to filter
void everyStatus(Status s) { assertNotNull(s); }

@ParameterizedTest
@MethodSource("cases")               // for complex/object args
void fromMethod(String in, int expected) { assertEquals(expected, in.length()); }
static Stream<Arguments> cases() {
    return Stream.of(Arguments.of("ab", 2), Arguments.of("xyz", 3));
}
```
Also available: `@CsvFileSource(resources = "/data.csv")`, `@NullSource`, `@EmptySource`,
`@NullAndEmptySource`. A static `@MethodSource` factory may be omitted only when its name matches
the test method name.

## Test instance lifecycle
Default is **`PER_METHOD`** — a fresh test-class instance per `@Test` (no leaked state). Opt into one
instance per class with `@TestInstance(TestInstance.Lifecycle.PER_CLASS)`, which also lets `@BeforeAll`/
`@AfterAll` be non-static and enables non-static `@MethodSource` factories.

## Extension model (brief)
Jupiter replaces JUnit 4 runners/rules with **extensions**:
```java
@ExtendWith(MockitoExtension.class)              // e.g. Mockito; see mockito.md
@ExtendWith({SpringExtension.class})             // Spring (implied by @SpringBootTest etc.)
class SomeTest {}
```
`@RegisterExtension` registers a programmatic (field) extension instance when you need configuration.

## JUnit 4 → 5 mapping (flag these when migrating)
| JUnit 4 | JUnit 5 (Jupiter) |
|---------|-------------------|
| `org.junit.Test` | `org.junit.jupiter.api.Test` |
| `@Before` / `@After` | `@BeforeEach` / `@AfterEach` |
| `@BeforeClass` / `@AfterClass` | `@BeforeAll` / `@AfterAll` |
| `@Ignore` | `@Disabled` |
| `@Category` | `@Tag` |
| `@RunWith(X.class)` | `@ExtendWith(X.class)` |
| `@Rule` / `@ClassRule` | `@ExtendWith` / `@RegisterExtension` |
| `@Test(expected = Foo.class)` | `assertThrows(Foo.class, () -> ...)` |
| `@Test(timeout = 100)` | `assertTimeout(Duration.ofMillis(100), ...)` |
| message is **first** arg of `assertEquals` | message is the **last** arg |

`junit-vintage-engine` runs old JUnit 4 tests on the JUnit 5 Platform during migration — useful, but
don't write **new** tests against JUnit 4.

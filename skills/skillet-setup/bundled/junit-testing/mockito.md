# Mockito — mocks, stubbing, verification

Static imports come from `org.mockito.Mockito.*` (and `org.mockito.BDDMockito.*` for BDD style).
Mock the **collaborators** of the unit under test — never the unit itself, never value/data classes.

## Creating mocks

**Programmatic** (any test):
```java
import static org.mockito.Mockito.*;

UserRepository repo = mock(UserRepository.class);
```

**Annotation-driven** (JUnit 5 — the common case). The extension wires the fields:
```java
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;   // from mockito-junit-jupiter

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock        UserRepository repo;     // a fresh mock per test
    @InjectMocks UserService service;     // real SUT; @Mock fields injected via constructor

    @Test
    void loadsUser() {
        when(repo.findById(1L)).thenReturn(Optional.of(new User(1L, "Ada")));
        assertEquals("Ada", service.nameOf(1L));
    }
}
```
Without `@ExtendWith(MockitoExtension.class)` the `@Mock`/`@InjectMocks` fields are **null**.
`@InjectMocks` prefers **constructor** injection (then setter, then field) — constructor injection in
the SUT makes this clean and also lets you just `new UserService(repo)` by hand.

The extension is strict by default (`Strictness.STRICT_STUBS`): unused stubs and argument mismatches
fail the test. That is a feature — it catches dead/over-stubbing.

## Stubbing
```java
when(repo.findById(1L)).thenReturn(Optional.of(user));   // value-returning methods
when(repo.count()).thenReturn(2L, 5L);                    // consecutive calls return 2 then 5
when(repo.load(anyLong())).thenThrow(new NotFoundException());
when(repo.find(any())).thenAnswer(inv -> inv.getArgument(0)); // dynamic answer
```

**Void methods** — `when(...)` won't compile, so put the action first:
```java
doThrow(new IllegalStateException()).when(repo).deleteById(1L);
doNothing().when(repo).flush();
```
The `doReturn(...).when(mock).call()` form is also how you stub on **spies** (see below) and bypass
strict stubbing when you must.

## Verification
```java
verify(repo).save(user);                 // exactly once (default)
verify(repo, times(2)).save(any());
verify(repo, never()).deleteById(anyLong());
verify(repo, atLeastOnce()).flush();
verify(repo, atLeast(2)).save(any());
verify(repo, atMost(3)).save(any());
verifyNoInteractions(auditLog);          // nothing was called on it
verifyNoMoreInteractions(repo);          // nothing beyond what you already verified
```
**Don't over-verify.** Assert the *outcome*; reserve `verify()` for interactions that *are* the
behaviour (e.g. "an email was sent", "the row was deleted"). Verifying every call couples the test to
implementation detail.

## ArgumentCaptor — assert on what was passed
```java
import org.mockito.ArgumentCaptor;

ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
verify(repo).save(captor.capture());
assertEquals("Ada", captor.getValue().name());   // getAllValues() for multiple invocations
```
(`@Captor ArgumentCaptor<User> captor;` field form works under `MockitoExtension`.)

## Argument matchers — and the rule
Matchers: `any()`, `any(Type.class)`, `anyLong()`, `anyString()`, `eq(value)`, `isNull()`,
`argThat(x -> x.age() > 18)`, etc.
**Hard rule: if you use a matcher for ONE argument, you must use matchers for ALL of them.** Wrap raw
values in `eq(...)`:
```java
when(repo.find(eq("ada"), anyInt())).thenReturn(user);   // correct
// when(repo.find("ada", anyInt()))  -> InvalidUseOfMatchersException
```

## Spies — partial mocks of real objects
A spy calls **real** methods unless stubbed. Use rarely (a need to spy often signals a design issue):
```java
List<String> spy = spy(new ArrayList<>());
spy.add("a");                       // real method runs
assertEquals(1, spy.size());        // real
doReturn(99).when(spy).size();      // stub ONE method — use doReturn, NOT when(spy.size())
```
Use `doReturn(...).when(spy)...` on spies: `when(spy.size())` would call the **real** `size()` first.

## BDDMockito — given/when/then naming
Same engine, more readable in given/when/then tests:
```java
import static org.mockito.BDDMockito.*;

given(repo.findById(1L)).willReturn(Optional.of(user));   // == when(...).thenReturn(...)
given(repo.load(anyLong())).willThrow(new NotFoundException());
// ... act ...
then(repo).should().save(user);                            // == verify(repo).save(user)
then(repo).should(never()).deleteById(anyLong());
```

## Static mocking (last resort)
For unavoidable static calls in legacy code (`mockito-inline` / Mockito 5 default). Always
try-with-resources so it's unregistered on the current thread:
```java
try (MockedStatic<Instant> mocked = mockStatic(Instant.class)) {
    mocked.when(Instant::now).thenReturn(fixed);
    // ... test ...
}
```
Prefer injecting a `Clock`/collaborator over static mocking where you can change the code.

## `@MockitoBean` (Spring) — not the same as `@Mock`
`@Mock` is a plain unit-test mock. To replace a **bean inside a Spring `ApplicationContext`** use
`@MockitoBean` (Spring Framework 6.2+/Boot 3.4+; the old `@MockBean` is deprecated). It only works
inside a Spring test (`@SpringBootTest`, `@WebMvcTest`, …) — see **spring-testing.md**.

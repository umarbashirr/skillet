# Transactions & the persistence context

`@Transactional` here is **Spring's** `org.springframework.transaction.annotation.Transactional`
(prefer it over `jakarta.transaction.Transactional`, which has fewer knobs — no `isolation`,
`readOnly`, or `rollbackFor`). Persistence-context behavior is the same JPA/Hibernate regardless of
provider.

## Where the transaction boundary belongs

Put `@Transactional` on the **service layer** — it's the unit of business work, and it keeps the
persistence context open for the whole operation (so lazy loads work and a single context spans all
the repository calls).

```java
@Service
public class OrderService {

    private final OrderRepository orders;
    private final CustomerRepository customers;

    @Transactional                                   // one tx, one persistence context
    public Order placeOrder(Long customerId, OrderRequest req) {
        Customer c = customers.findById(customerId).orElseThrow();
        Order o = new Order(c, req.items());         // o.customer is managed → lazy access OK here
        return orders.save(o);
    }

    @Transactional(readOnly = true)                  // read path: no dirty-check flush, hints provider
    public OrderView view(Long id) {
        Order o = orders.findById(id).orElseThrow();
        return OrderView.from(o);                     // touch lazy assoc INSIDE the tx → no LIE
    }
}
```

Don't put it on controllers (request lifecycle ≠ tx) or, generally, on repositories for multi-step
work (each call would be its own tx). Spring Data repository methods are already transactional
individually; the service `@Transactional` composes them into one.

## `@Transactional` attributes

```java
@Transactional(
    propagation = Propagation.REQUIRED,      // default: join existing tx, else start one
    isolation   = Isolation.READ_COMMITTED,  // default: DEFAULT (uses the DB's default)
    readOnly    = true,                      // optimization hint + Hibernate FlushMode.MANUAL
    timeout     = 10,                        // seconds
    rollbackFor = Exception.class)           // also roll back on checked exceptions
public void doWork() { ... }
```

- **Propagation:** `REQUIRED` (default) joins/creates; `REQUIRES_NEW` suspends the outer tx and runs
  in a new one (separate commit — use for audit/outbox writes that must survive an outer rollback);
  `MANDATORY` requires an existing tx; `NESTED` uses a savepoint; `SUPPORTS`/`NOT_SUPPORTED`/`NEVER`
  for non-tx cases.
- **Rollback default:** Spring rolls back on **unchecked** (`RuntimeException`) + `Error` only —
  **checked exceptions commit** unless you set `rollbackFor`. Catching an exception inside the method
  also prevents rollback. After a tx is marked rollback-only, further work in it fails.
- **`readOnly = true`** sets Hibernate's flush mode to MANUAL (skips dirty-check flushes) and lets the
  DB/driver optimize; it does **not** by itself make the data immutable.
- **Isolation** is only honored when starting a tx (not when joining one with `REQUIRED`).

## The persistence-context lifecycle & flush timing

- The context (Hibernate `Session` / JPA `EntityManager`) opens with the tx and closes at commit. All
  entities loaded within are **managed** until then.
- **Flush** (sync pending changes to the DB) happens: at **commit**, **before a query** that could be
  affected (default `AUTO` flush mode), or on an explicit `entityManager.flush()`/`repo.flush()`.
  Flush ≠ commit — flushed changes are still rolled back if the tx aborts.
- **Dirty checking:** mutate a managed entity and at flush Hibernate diffs it against its load
  snapshot and emits the UPDATE — no `save` call needed for managed entities.

## `LazyInitializationException` — causes & real fixes

**Cause:** you access a LAZY association (or uninitialized proxy) **after** the persistence context
that loaded the entity has closed — typically in a controller, serializer, or template *after* the
`@Transactional` service method returned and the entity became **detached**.

```java
@Transactional
public Order load(Long id) { return orders.findById(id).orElseThrow(); }  // tx ends here
// later, in a controller: order.getItems().size()  →  LazyInitializationException
```

**Fixes — fetch what the caller needs while the context is still open:**
1. **Fetch join / `@EntityGraph`** on the query (see repositories-queries.md) — load the association
   eagerly for that call.
2. **Map to a DTO inside the tx** — initialize everything needed and return a flat DTO/record; the
   detached entity never escapes. This is the cleanest fix and the recommended default.
3. **Initialize explicitly inside the tx** — touch the association, or
   `Hibernate.initialize(order.getItems())`.

**Open-Session-In-View (OSIV)** — Spring Boot enables `spring.jpa.open-in-view=true` by default,
which keeps the context open for the whole web request so lazy loads in the view "just work" and the
exception disappears. **Treat this as a footgun, not the fix.** Tradeoffs: it hides N+1s (lazy loads
fire during view rendering, outside any service tx), holds a DB connection for the full request, and
blurs the tx boundary. Prefer to **set `open-in-view=false`** and fetch eagerly/return DTOs from the
service. Explain OSIV when you see it, and steer toward DTOs/fetch plans.

## Self-invocation pitfall

`@Transactional` works via a Spring proxy around the bean. A call through `this` doesn't go through
the proxy, so the annotation is **ignored**:

```java
@Service
public class ReportService {
    public void run() {
        generate();                  // self-call → proxy bypassed → @Transactional ignored
    }
    @Transactional
    public void generate() { ... }   // also ineffective if private/final/package-private
}
```

Fixes: move `generate()` to a **separate bean** and inject it; or self-inject the proxy; or use
`AopContext.currentProxy()` (requires `exposeProxy = true`). The same proxy limitation means
`@Transactional` has no effect on `private`/`final`/package-private methods.

## Detached entities & `merge`

Once the context closes, an entity is **detached** — changes to it are not tracked. To reapply them:

```java
@Transactional
public void update(Order detached) {
    Order managed = orders.save(detached);   // save() → EntityManager.merge for a detached entity
    // 'managed' is the tracked copy; mutate THAT, not 'detached'
}
```

`merge` copies the detached state onto a **managed** instance and **returns the managed one** — the
argument stays detached. Always use the return value. `merge` will overwrite the row with the
detached state (lost-update risk for stale data) — guard with **optimistic locking** below.

## Optimistic locking — `@Version`

Add a version column; the provider increments it on update and fails if another tx changed the row
since you read it (no DB locks held).

```java
@Entity
public class Account {
    @Id @GeneratedValue private Long id;

    @Version
    private long version;            // long/int/short, or @Version Instant/Timestamp
    // ...
}
```

On a stale write, Hibernate throws `OptimisticLockException` (Spring wraps it as
`ObjectOptimisticLockingFailureException`) → catch it and retry or surface a conflict. This is the
right concurrency control for typical read-modify-write web flows; reach for **pessimistic locking**
(`@Lock(LockModeType.PESSIMISTIC_WRITE)` on the query / `em.lock`) only when contention is high and
retries are too costly.

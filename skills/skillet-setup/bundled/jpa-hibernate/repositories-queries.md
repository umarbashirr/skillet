# Repositories & queries (Spring Data JPA)

These all assume **Spring Data JPA** on the classpath. Without it, the same queries run through the
raw `EntityManager` (`em.createQuery(...)` / `em.find(...)`). Imports are `jakarta.persistence.*` on
Hibernate 6+/Boot 3+, `javax.persistence.*` on older stacks.

## Repository interfaces

```java
public interface UserRepository extends JpaRepository<User, Long> { }
```

- `Repository` (marker) → `CrudRepository` (CRUD) → `PagingAndSortingRepository` (adds `Pageable`/
  `Sort`) → `JpaRepository` (JPA extras: `flush()`, `saveAllAndFlush`, `getReferenceById`, batch
  deletes). Use **`JpaRepository`** by default. Spring generates the implementation at runtime — you
  write **interfaces only**.
- `save()` does an `EntityManager.persist` for new entities and `merge` for detached ones. For an
  already-**managed** entity inside a tx, mutating it is enough (dirty checking) — `save` is optional.
- Prefer `Optional<T> findById(ID)` and check presence; avoid the deprecated/eager `getById`.

## Derived query methods

Method names are parsed into queries — no JPQL needed:

```java
List<User> findByName(String name);
Optional<User> findByEmail(String email);
List<User> findByNameAndActiveTrue(String name);
List<User> findByAgeGreaterThanEqualOrderByNameAsc(int age);
List<User> findByNameContainingIgnoreCase(String fragment);
long countByActiveTrue();
boolean existsByEmail(String email);
@Transactional long deleteByActiveFalse();
List<User> findTop10ByOrderByCreatedAtDesc();
```

Keywords: `And/Or`, `Between`, `LessThan/GreaterThan(Equal)`, `Like/Containing/StartingWith`,
`In`, `IsNull/IsNotNull`, `True/False`, `IgnoreCase`, `OrderBy…Asc/Desc`, `Distinct`, `Top/First`.
Keep names short — once a derived name gets unreadable, switch to `@Query`.

## `@Query` — JPQL and native

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // JPQL (entity/field names, not table/column names)
    @Query("select u from User u where u.email = :email")
    Optional<User> findByEmailAddress(@Param("email") String email);

    // positional binding (?1) also works, but @Param is refactor-safe
    @Query("select u from User u where u.name = ?1")
    List<User> findAllByName(String name);

    // native SQL — real table/column names
    @Query(value = "select * from app_user where email = :email", nativeQuery = true)
    Optional<User> findByEmailNative(@Param("email") String email);
}
```

- `@Query` takes precedence over derived parsing and over a `@NamedQuery`. JPQL is portable and
  validated against the model; native SQL is for DB-specific features at the cost of portability.
- Bind with **`@Param("name")`** + `:name`, or positional `?1`. `@Param` survives parameter reordering.
- Spring Data also exposes `@NativeQuery` as a shorthand for `@Query(nativeQuery = true)` on recent
  versions — confirm availability for the project's version before using it.

## Pagination & sorting

```java
Page<User> findByActiveTrue(Pageable pageable);     // includes total count (extra COUNT query)
Slice<User> findByName(String name, Pageable pageable);  // no count — "has next?" only
List<User> findByName(String name, Sort sort);

Page<User> page = repo.findByActiveTrue(PageRequest.of(0, 20, Sort.by("name").ascending()));
page.getContent(); page.getTotalElements(); page.getTotalPages(); page.hasNext();
```

- **`Page`** runs an extra `count` query for `totalElements`; **`Slice`** skips it (cheaper when you
  only need "is there a next page"). `Sort.by("field")` sorts by **entity property**, not column.
- For large/deep result sets prefer **keyset (seek) pagination** over high offsets — offset pagination
  degrades as the page number grows.

## Projections (return less than the whole entity)

**Interface projection** (closed — Spring proxies it):

```java
interface UserSummary {
    String getName();
    String getEmail();
}
List<UserSummary> findByActiveTrue();   // selects only name, email
```

**DTO / class-based projection** — needs an all-args constructor; with `@Query` use a JPQL
**constructor expression**:

```java
public record UserDto(String name, String email) {}

@Query("select new com.example.UserDto(u.name, u.email) from User u where u.active = true")
List<UserDto> findActiveSummaries();
```

For derived methods, returning the DTO type lets Spring rewrite the select to the DTO's properties.
Closed projections also let the provider select only the needed columns — a cheap N+1 mitigation.

## Modifying queries

```java
@Modifying(clearAutomatically = true)               // clear stale managed entities after the bulk op
@Transactional
@Query("update User u set u.active = false where u.lastLogin < :cutoff")
int deactivateStale(@Param("cutoff") Instant cutoff);
```

- `@Modifying` is required for `update`/`delete`/DDL `@Query`s; return `int`/`void` (rows affected).
- **Bulk update/delete bypasses the persistence context** — it does not run cascades, lifecycle
  callbacks, or dirty checking, and managed entities can go stale. Use `clearAutomatically = true`
  (or `flushAutomatically`) when entities are already loaded in the same context.

## Specifications & Criteria (dynamic queries, briefly)

For runtime-composed filters, extend `JpaSpecificationExecutor<T>` and compose type-safe
`Specification`s:

```java
public interface UserRepository
        extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> { }

Specification<User> active = (root, query, cb) -> cb.isTrue(root.get("active"));
Specification<User> named  = (root, query, cb) -> cb.equal(root.get("name"), "Sam");
repo.findAll(active.and(named), PageRequest.of(0, 20));
```

This builds on the JPA **Criteria API** (`CriteriaBuilder`/`CriteriaQuery`). Good for optional filter
combinations; verbose for static queries — use `@Query` there.

---

## The N+1 problem (read this)

**Symptom:** one query loads N parents, then accessing a lazy association fires **one extra query per
parent** → 1 + N queries. Classic example:

```java
List<Order> orders = orderRepo.findAll();          // 1 query
for (Order o : orders) o.getCustomer().getName();  // N more queries (lazy @ManyToOne per order)
```

Turn on SQL logging (`spring.jpa.show-sql=true` + `org.hibernate.SQL=DEBUG`, or Hibernate's
`hibernate.generate_statistics=true`) to *count* queries and catch it. Fixes, in order of preference:

### 1. Fetch join (load the association in one query)

```java
@Query("select o from Order o join fetch o.customer")
List<Order> findAllWithCustomer();
```

`join fetch` initializes the association in the same SELECT. **Caveat:** fetch-joining a *collection*
returns duplicate parent rows — use `select distinct` (or a `Set`), and **you can't combine a
collection fetch join with `Pageable`** (Hibernate paginates in memory and warns). For paged
collections, use `@EntityGraph` + batching, or fetch ids first then the collection.

### 2. `@EntityGraph` (declarative fetch plan)

```java
@EntityGraph(attributePaths = {"customer", "items"})   // ad-hoc graph on a derived/@Query method
List<Order> findByStatus(String status);

@EntityGraph(value = "Order.withCustomer", type = EntityGraph.EntityGraphType.LOAD)
Optional<Order> findById(Long id);                      // references a @NamedEntityGraph
```

Same effect as a fetch join but composable and reusable across methods. `attributePaths` lists the
associations to load eagerly for that call only.

### 3. Batch fetching (Hibernate — fewer round trips for lazy loads)

```java
import org.hibernate.annotations.BatchSize;

@OneToMany(mappedBy = "order")
@BatchSize(size = 25)                 // initialize up to 25 collections per extra query
private List<Item> items;
```

Or globally: `spring.jpa.properties.hibernate.default_batch_fetch_size=25`. Batching turns 1+N into
1 + ⌈N/size⌉ queries (an `IN (...)` per batch). `@Fetch(FetchMode.SUBSELECT)` instead refetches all
collections via one subselect keyed off the original query. Batching is the best default when you
*do* want lazy loading but want to bound the query count; fetch joins/`@EntityGraph` are best when you
know up front you'll need the association.

> Do **not** "fix" N+1 by switching associations to `FetchType.EAGER` — that just moves the cost to
> every load and risks cartesian-product blowups when several eager associations combine.

# Entity mapping & relationships

Imports below use `jakarta.persistence.*` (Hibernate 6+ / Spring Boot 3+). On older stacks swap to
`javax.persistence.*` — **the annotations are otherwise identical**. `@BatchSize`/`@Fetch` are
Hibernate-only (`org.hibernate.annotations.*`).

## The basic entity

```java
import jakarta.persistence.*;

@Entity
@Table(name = "app_user",
       uniqueConstraints = @UniqueConstraint(columnNames = "email"),
       indexes = @Index(name = "idx_user_email", columnList = "email"))
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String bio;

    protected User() {}            // JPA needs a no-arg constructor (any visibility ≥ protected)
    // getters/setters…
}
```

- `@Entity` requires a no-arg constructor and a non-final class. `@Table` is optional (defaults to the
  entity name). `@Column` is optional too — omit it unless you need `nullable`, `length`, `name`,
  `unique`, `columnDefinition`, `insertable`/`updatable`.
- `@Transient` excludes a field from persistence. `@Lob` for large text/binary. `@Basic(fetch = LAZY)`
  for lazy scalar columns (provider may ignore without bytecode enhancement).

## Identifiers & `@GeneratedValue`

```java
@Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;   // DB auto-increment
```

Strategies:
- **`IDENTITY`** — DB identity/auto-increment column. Simple, but **disables JDBC batch inserts** (the
  id is only known after the INSERT).
- **`SEQUENCE`** — DB sequence; the recommended default where supported (Postgres, Oracle). Allows
  batching and id pre-allocation. Pair with `@SequenceGenerator(name=…, sequenceName=…, allocationSize=…)`.
- **`TABLE`** — emulates a sequence via a table. Portable but slow; avoid unless forced.
- **`AUTO`** — provider picks. On Hibernate 6 this often resolves to a sequence-style generator.

For natural/assigned keys, use a plain `@Id` (no `@GeneratedValue`) and set it before `persist`.

## `@Column` and value types

```java
@Column(precision = 19, scale = 4) private BigDecimal amount;   // money: never double
@Column(nullable = false) private Instant createdAt;            // prefer java.time
```

## Embeddables — `@Embeddable` / `@Embedded`

Group value-object columns into the owning table (no separate identity).

```java
@Embeddable
public class Address {
    private String street;
    private String city;
    @Column(length = 16) private String zip;
}

@Entity
public class Customer {
    @Id @GeneratedValue private Long id;

    @Embedded
    private Address billing;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "street", column = @Column(name = "ship_street")),
        @AttributeOverride(name = "city",   column = @Column(name = "ship_city")),
        @AttributeOverride(name = "zip",    column = @Column(name = "ship_zip"))
    })
    private Address shipping;       // reuse the embeddable; rename collided columns
}
```

## Enums — `@Enumerated`

```java
@Enumerated(EnumType.STRING)        // ALWAYS prefer STRING
private Status status;
```

**Never use `EnumType.ORDINAL`** (the default): reordering or inserting enum constants silently
corrupts existing rows. `STRING` stores the name and is reorder-safe.

## Relationships

### `@ManyToOne` (owning side — holds the FK)

```java
@Entity
public class Order {
    @Id @GeneratedValue private Long id;

    @ManyToOne(fetch = FetchType.LAZY)            // override the EAGER default!
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;
}
```

### `@OneToMany` (inverse side — `mappedBy`)

```java
@Entity
public class Customer {
    @Id @GeneratedValue private Long id;

    @OneToMany(mappedBy = "customer",             // = the field name on Order
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

    public void addOrder(Order o) {               // keep BOTH sides in sync
        orders.add(o); o.setCustomer(this);
    }
    public void removeOrder(Order o) {
        orders.remove(o); o.setCustomer(null);    // with orphanRemoval → deletes the row
    }
}
```

- **Owning side** = the side *without* `mappedBy` (here `Order.customer`, which owns the FK). Hibernate
  reads the relationship from the owning side **only** — setting `customer.orders` without setting
  `order.customer` persists nothing. Always update both sides via helper methods.
- A unidirectional `@OneToMany` without `mappedBy` forces an extra join table (or per-row UPDATEs) —
  usually a mistake. Prefer a bidirectional mapping owned by the `@ManyToOne`.

### `@OneToOne`

```java
@OneToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "profile_id")
private Profile profile;                          // owning side

// inverse:
@OneToOne(mappedBy = "profile", fetch = FetchType.LAZY)
private User user;
```

Lazy `@OneToOne` on the **inverse** (`mappedBy`) side is often eagerly loaded anyway (Hibernate must
check for null) — make it owning, or use a shared `@MapsId` PK, if laziness matters.

### `@ManyToMany`

```java
@ManyToMany
@JoinTable(name = "user_role",
           joinColumns = @JoinColumn(name = "user_id"),
           inverseJoinColumns = @JoinColumn(name = "role_id"))
private Set<Role> roles = new HashSet<>();        // Set, not List, for M:N
```

The inverse side uses `@ManyToMany(mappedBy = "roles")`. When the join table needs its own columns
(e.g. `assignedAt`), **model it as a separate `@Entity` with two `@ManyToOne`s** instead.

## Fetch, cascade, orphanRemoval — the defaults that bite

| Association | Default fetch |
|-------------|---------------|
| `@ManyToOne` | **EAGER** |
| `@OneToOne` | **EAGER** |
| `@OneToMany` | LAZY |
| `@ManyToMany` | LAZY |

- Make to-one associations **`fetch = LAZY`** and fetch them explicitly where needed (fetch join /
  `@EntityGraph`). Cascade per association — `CascadeType.PERSIST`/`MERGE` are usually enough;
  `ALL` includes `REMOVE`. `orphanRemoval = true` deletes a child when it leaves the collection.

## Inheritance (briefly)

```java
@Entity @Inheritance(strategy = InheritanceType.SINGLE_TABLE)   // default
@DiscriminatorColumn(name = "type")
public abstract class Payment { @Id @GeneratedValue Long id; }

@Entity @DiscriminatorValue("CARD")  public class CardPayment  extends Payment {}
@Entity @DiscriminatorValue("BANK")  public class BankPayment  extends Payment {}
```

- **`SINGLE_TABLE`** (default) — one table + discriminator; fastest, but subclass columns must be
  nullable. **`JOINED`** — normalized, one table per class joined by PK; cleaner, costs joins.
  **`TABLE_PER_CLASS`** — a table per concrete class; problematic for polymorphic queries, avoid.
- **`@MappedSuperclass`** shares mapped fields *without* being an entity (no table, not queryable as
  a type). Good for `id`/audit columns; use when you don't need polymorphic queries.

## equals() / hashCode() — get this right

Entities live across the transient→managed boundary and inside `Set`s/`Map`s, so a wrong
`equals`/`hashCode` causes lost set members and subtle bugs.

- **Don't** rely on the database-generated `@Id`: it's `null` before persist, so an entity added to a
  `HashSet` while transient changes its hash once an id is assigned and becomes unfindable.
- **Don't** include mutable business fields, and never include relationship collections.
- **Preferred:** a stable business key (e.g. an immutable email/SKU), or assign a `UUID` in the
  constructor and base identity on that. A common safe pattern:

```java
@Override public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof User other)) return false;
    return id != null && id.equals(other.id);     // unequal until both persisted
}
@Override public int hashCode() { return getClass().hashCode(); }  // constant; OK for entities
```

This "id-once-assigned, constant hashCode" pattern is the widely-recommended compromise when no
business key exists. With a real business key, prefer that instead.

# REST & web (Spring MVC / WebFlux)

Servlet (Spring MVC, `spring-boot-starter-web`) is assumed below. WebFlux mirrors most annotations;
reactive-specific notes are flagged. Detect the stack first (see SKILL).

## Controllers & request mapping
- `@RestController` = `@Controller` + `@ResponseBody` — return values are serialized to the body
  (Jackson → JSON by default), not resolved as view names.
- `@RequestMapping` is the general form; the HTTP-verb shortcuts are
  `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`.
- Class-level `@RequestMapping("/api/users")` prefixes every method path.

```java
@RestController
@RequestMapping("/api/users")
class UserController {
  private final UserService users;
  UserController(UserService users) { this.users = users; }   // constructor injection, no @Autowired

  @GetMapping("/{id}")
  UserDto get(@PathVariable Long id) { return users.find(id); }

  @GetMapping
  Page<UserDto> list(@RequestParam(defaultValue = "0") int page,
                     @RequestParam(name = "q", required = false) String query) {
    return users.search(query, page);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  UserDto create(@Valid @RequestBody CreateUserRequest req) { return users.create(req); }
}
```

## Binding the request
- **`@PathVariable`** — URI template segment (`/{id}`). Name optional if the method param name matches
  (requires `-parameters` compilation, which Spring Boot's build plugin enables).
- **`@RequestParam`** — query string or form field. `required` (default `true`), `defaultValue`
  (implies not required). Bind many with a `Map<String,String>` or a `@ModelAttribute` POJO.
- **`@RequestBody`** — deserialize the body (JSON → object). Combine with `@Valid` to validate.
- **`@RequestHeader`**, **`@CookieValue`**, **`@RequestPart`** (multipart) round it out.
- **`ResponseEntity<T>`** when you need to control status + headers + body explicitly; otherwise return
  the body object and use `@ResponseStatus` for non-200 success codes.

## Validation (Bean Validation / Jakarta)
Add `spring-boot-starter-validation` (brings Hibernate Validator). Annotate the DTO with
`jakarta.validation.constraints.*`, then trigger with `@Valid` (or `@Validated`).

```java
record CreateUserRequest(
    @NotBlank String name,
    @Email String email,
    @Min(0) @Max(150) int age) {}
```
- `@Valid @RequestBody` validates the body; a violation throws `MethodArgumentNotValidException`
  (servlet) → **400** by default.
- Validating `@RequestParam`/`@PathVariable` (method-level) needs `@Validated` **on the controller
  class**; violations throw `ConstraintViolationException`.
- Use validation **groups** or nested `@Valid` for object graphs.

## Exception handling
Centralize with `@RestControllerAdvice` (= `@ControllerAdvice` + `@ResponseBody`) and
`@ExceptionHandler` methods. Map domain exceptions to HTTP semantics here, not in controllers.

```java
@RestControllerAdvice
class ApiExceptionHandler {

  @ExceptionHandler(UserNotFoundException.class)
  ProblemDetail handleNotFound(UserNotFoundException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    pd.setTitle("User not found");
    pd.setProperty("userId", ex.getId());   // extension members serialized flat at the root
    return pd;
  }
}
```
- **`ProblemDetail`** (Spring Framework 6+) implements **RFC 9457** `application/problem+json`
  (`type`, `title`, `status`, `detail`, `instance` + custom members via `setProperty`). Build with
  `ProblemDetail.forStatus(...)` / `forStatusAndDetail(...)`.
- To make Spring's **built-in** error responses use `ProblemDetail`, set
  `spring.mvc.problemdetails.enabled=true` (servlet) or `spring.webflux.problemdetails.enabled=true`
  (reactive) — **both default to `false`**.
- For framework MVC exceptions (415, 405, body-not-readable, etc.) extend
  `ResponseEntityExceptionHandler` in your advice to override their rendering consistently.
- `@ResponseStatus(HttpStatus.CONFLICT)` on a custom exception class is a lightweight alternative when
  you don't need a body.
- Without any advice, unmapped exceptions hit the default error handling (`BasicErrorController`,
  the `/error` mapping) — fine for prototypes, not for a real API contract.

## Content negotiation & status codes
- Default response is JSON via Jackson. Add `produces`/`consumes` to constrain:
  `@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)`.
- Negotiation is driven by the `Accept` header (and optionally a path/param strategy via
  `spring.mvc.contentnegotiation.*`). XML support requires Jackson XML / JAXB on the classpath.
- Use status codes deliberately: **201 Created** (+ `Location` header) for creation, **204 No Content**
  for deletes/empty PUTs, **400** for validation, **404** for missing, **409** for conflicts, **422**
  for semantically-invalid-but-well-formed. Don't return 200 with an error payload.

## REST gotchas
- **`@RestController` vs `@Controller`:** forgetting `@ResponseBody`/`@RestController` makes Spring try
  to resolve your return value as a **view name** → 404/template error, not JSON.
- **Method param names lost.** If `-parameters` isn't enabled and names don't match, name your bindings
  explicitly: `@PathVariable("id")`, `@RequestParam("q")`.
- **`@Valid` does nothing without a validator** on the classpath — add `spring-boot-starter-validation`.
- **Returning entities directly** leaks the persistence model and risks lazy-loading serialization
  errors; map to DTOs/records at the boundary.
- **WebFlux:** controllers return `Mono<T>`/`Flux<T>`; **don't block** (`.block()`) on the event loop.
  Servlet idioms like `HttpServletRequest` injection don't apply — use `ServerWebExchange`/
  `ServerHttpRequest`.
- **Validation errors expose internals** if you echo raw messages; shape them into `ProblemDetail`
  with field-level errors from `MethodArgumentNotValidException.getBindingResult()`.

> Verify exact property keys and any version-renamed annotations via the Live docs protocol
> (`/spring-projects/spring-boot`, `https://docs.spring.io/spring-boot/`).

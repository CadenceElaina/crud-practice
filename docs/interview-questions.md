Topic areas, roughly in order of depth:

HTTP & REST — status codes, methods, idempotency, what makes a good API
Express internals — middleware chain, next(), error handling, req/res lifecycle
Async JS — promises, async/await, event loop basics, why Node handles concurrency the way it does
PostgreSQL & SQL — joins, indexes, transactions, ACID, parameterized queries, NULL behavior
Auth — how bcrypt actually works, what a JWT is and isn't, what "stateless" means and its tradeoffs
TypeScript — structural typing, type vs interface, generics basics, how Omit / Pick work
Security — what your rate limiter actually prevents vs doesn't, helmet headers, SQL injection, the enumeration attack in your login flow
Architecture — why the service/controller split exists, what breaks without it, what a "pure function" means in a service context

1.Your login endpoint returns 401 for both "email not found" and "password incorrect." Why deliberately use the same response for both, and what does this prevent?
-Using different responses for 'email note found' and 'wrong password' enables user enumeration. An attacker could iterate through a list of emails and use the distinct error to confirm which emails have accounts. Once they know what accounts exist its easier to target one with brute-force or credential stuffing attacks. Using a generic message removes that signal.
-credential stuffing: taking leaded email/pasword lists and trying those pairs - betting on password reuse.

- distributed attacks (many IPs) can bypass the rate limiter on /api/login

2. Express
   You have this in index.ts:
   typescriptapp.use(express.json());
   What does this actually do, what happens if you remove it, and why does it need to come before your route definitions?
   -express.json() is a built-in middleware function in Express.js that parses incoming JSON data from requests and makes it accessible through the req.body property. This is essential for handling JSON payloads in HTTP requests, especially in POST requests.
   -HTTP req body arrives as a raw byte stream. -> express.json() -> parses it as JSON and attaches the result to req.body
   -Without this req.body is undefined on each request
   - no crash no error to the server but any route that tries to destructure req.body like const {email, password} = req.body // req.body is undefined // -> TypeError: cannot destructure property 'email' of undefined...
     -Silent until a req hits a route like that - needs to come before routes because Express rocesses middleware in registration order, top to bottom. By the time a request reaches a route handle, every app.use() above it has already ran. If express.json() is registered after the routes, the body is still a raw stream when the handler runs - req.body is still undefined. - anything a route depends on must be registered first.
     express.json() → parses the request body into req.body
     res.json() → serializes data into the response
3. Express
   What is middleware in Express, what does next() do, and what happens if you forget to call it?
   "Middleware acts as functions that can be ran on each or some HTTP requests. For example if you have protected routes you may attach authenticateToken to the noteRouter to ensure only users with valid JWT can CRUD notes. Next() is called at the end of every request to close the promise of the async request. It runs the next request / action in the server. If you forget it then you app will get stuck on an action."
   -Middleware as functions that intercept requests
   -authenticateToken example is correct
   -Forgetting next() causes a hang
   next() has nothing to do with promises or async.
   next() tells Express "Im done with this middleware, pass the request to the next one in the chain - for this same request."

- POST /api/notes
  -> express.json() (parses body, calls next())
  -> loginLimiter (checks rate limit, calls next())
  -> authenticateToken (verifies JWT, attaches req.userId, calls next())
  -> postNote controller (does the work, sends res - no next() needed)
  -same req traveling down the chain
- not calling next() requst just stops no error thrown - client sits waiting until it times out.
- next(err); // pass an error object - skips all remaining regular middleware and jumps straight to any error-handling middleware - an exit condition - (err, req, res, next). centralize error handling over res.status(500) in every single catch block.
  next() = "pass control to the next middleware for this request" — nothing to do with promises or async. Forgetting it silently hangs the request. next(err) skips to error-handling middleware.

4. In noteService.ts the createNote function does this:
   const client = await pool.connect();
   try {
   await client.query('BEGIN');
   // ... queries ...
   await client.query('COMMIT');
   } catch (err) {
   await client.query('ROLLBACK');
   throw err;
   } finally {
   client.release();
   }
   -"If you release a transaction that should fail and be rolledback then you cannot retroactively (without effort) roll back that transaction or transactions. If its more than one it becomes a nightmare. This is important to adhere to ACID principles like atomicity all or nothing on transactions and moving from one consistent state to another."

- client.release() - doesnt touch transactions but simply reutrns the connection back to the pool so other requests can use it.
  What goes wrong if release() is in try:
  try {
  await client.query('BEGIN');
  await client.query('INSERT ...'); // ← throws here
  await client.query('COMMIT');
  client.release(); // ← never reached
  } catch (err) {
  await client.query('ROLLBACK');
  throw err;
  // connection is never returned to the pool
  } --- the error causes execution to jump straight to catch. skipping release(). Rollback runs correctly the transaction is safe but the conection is NEVER returned to the pool - a connection leak.

Request 1 errors → leaks connection 1
Request 2 errors → leaks connection 2
...
Request 5 errors → leaks connection 5
Request 6 arrives → pool has 0 free connections → hangs until timeout
Request 7, 8, 9... → all hang

- deadlocks the app on any error condition
- if you have max: 5 for pools all it takes is 5 failed transactions
- and then your server is down. No crash no error log - just every
- req is left incomplete silently.

finally runs unconditionally - success, error, even if catch itself throws.
try{
// no issues -> COMMIT runs, then finally runs -> release
} catch{
// error path -> ROLLBACK runs, then finally runs -> release
} finally {
client.release(); // always, no matter what
}
connection goes back to the pool in each case.

client.release() in finally prevents connection leaks. If an error skips release(), that connection is gone from the pool permanently. With max: 5, then five leaked connetions deadlocks the entire app silently without error.

5. SQL and Postgres:
   What's the difference between WHERE user_id = $1 and just WHERE user_id = 1 hardcoded in the query string, and why does one of them appear in every single query in your codebase while the other never should?
   // NEVER do this
   const query = `SELECT * FROM notes WHERE user_id = ${req.params.id}`;
   await pool.query(query);

- this is dynamic it also uses a variable from the request but its wrong.
- SQL injection: $1 isnt just "grab a variable" its a parameterized query - the value and the SQL are sent to Postgres as two completely separate things. Postgres compiles the query structure first, then slots the value as pure data. The value can NEVER be interpreted as SQL.
  -String concatenation sends one combined string. Postgres has to parse the whole thing and a malicious user can break out the value and write their own SQL:

// attacker sends: id = "1 OR 1=1"
const query = `SELECT * FROM notes WHERE user_id = ${req.params.id}`;
// Postgres sees: SELECT \* FROM notes WHERE user_id = 1 OR 1=1
// -> returns every note from every user
// SELECT \* FROM notes WHERE user_id = 1; DROP TABLE notes; -- notes gone no auth req

await pool.query('SELECT \* FROM notes WHERE user_id = $1', [req.params.id]);
-Postgres receives teh query structure and "1; DROP TABLE notes; --" as a raw string value. It looks for a user_id equal to that string finds nothing and returns empty. No injeciton.
"$1 is a parameterized query placeholder. The SQL structure and the user-supplied value are sent to Postgres separately, so the value can never be intercepted as SQL. Hardcoding or concatenating values into query strings opens the app to SQL injection where an attacker crafts a value that breaks out the intended query and executes arbitrary SQL, potentially reading all users data or destroying tables entirely."
Parameterized queries ($1, $2...) send SQL structure and values separately to the DB. Values can never be interpreted as SQL. String concatenation into queries = SQL injection vulnerability. Always parameterize — no exceptions, even for values that "look safe."

6. auth / jwt implementation
   What is a JWT, what are its three parts, and why does it mean your server doesn't need to hit the database to authenticate most requests? Then — what's the tradeoff that comes with that property?
   server gets token: take the header + payload from the incoming token

- re run HMAC-SHA256 (header + payload, SECRET)
  compare result to the signature on the token
  if they match -> token is legit and not tampered with
  -tradeoff: you cannot invalidate a JWT before it expires. If a user clicks log out the token still works until the 1d is up. If an attacker steals a token its valid until expiry you cant revoke it.
- keep expiry very short (15min) + refresh tokens - adds complexity
- maintain a server-side blocklist of revoked tokens - requires a DB hit on every request, which kills the stateless benefit
  -Accept the tradeoff
- also consider UX vs security
- JWT are singed not encrypted. The header and payload are just base 64url encoded - anyone can decode them and read the contents. Never put any sensitive data in a jWT payload (passwords, card numbers etc.)
  JWT verification is a pur crypto operation no DB is needed. Server recomputes the signature from header + payload + secret, compares to the token's signature. Match = legitimate.
  Core tradeoff: stateless = cant revoke. Stolen or logged out tokens remain valid until expiry. Mitigation is short expiry + refresh tokens, or a server-side blocklist (which trades away the stateless benefit)
  Good on stateless — yes, exactly. No session write on login, no session delete on logout, no lookup on every request. The cost is losing revocation.

7. TypeScript
   types.ts
   export type PublicUser = Omit<User, 'password'>;
   What does Omit do here, why is this better than writing a separate PublicUser interface by hand with the fields listed out, and what's the difference between type and interface in TypeScript?
   Omit
   // instead of this:
   export interface PublicUser {
   user_id: number;
   name: string;
   email: string;
   created_at: Date;
   last_login: Date | null;
   // you manually kept password out
   }
   // You write this:
   export type PublicUser = Omit<User, 'password'>;
   derived version is better because it uses a single source of truth. Say later we add profile_picture to User with a handwirtten PublicUser you have to remember to add it there too instead of just on User.
   Interface supports declaration merging - you can declare the same interface twice and TypeScript merges them:'
   interface User { name: string; }
   interface User { email: string; }
   // TypeScript sees: { name: string; email: string; }

This is how @types/express works under the hood — libraries extend existing interfaces to add properties. It's also why AuthenticatedRequest extends Request works: Request is an interface, so it's extensible.
type can represent things interface can't - unions, intersections, mapped types:
type Status = 'private' | 'draft' | 'published'; // union - interface cannot do this
type NoteOrUser = Note | User; // interface cant do this
-interface for object shapes - anything that can be extended
-types for unions, utility types(Omit, Pick, Partial) and aliases

Omit<T, K> creates a new type by removing key K from type T. Better than handwritting the result because it derives from the sources and stays in sync automatically if T changes.
interface -> object shapes, supports declaration merging and extends. type -> unions, utility types, aliases. Mostly interchangable for plain objects - use interface for things you might extend, type for most others.

8. Architecture
   Why does noteService.ts have no imports from Express — no Request, no Response, nothing — while noteController.ts imports both? What breaks, practically, if you collapse them into one file and write DB queries directly in the controller?
   "are all abstractions that are easier to read and understand. You extract functions like creating a note, updating, etc. to the services file for the controller / route and then you can call / reuse them in the requests easily. It makes the code more readable easier to maintain and understand imo. If you collapse them into one file then you end up rewritting code in a monolithic file."
   Why is the separation drawn exactly there, at the EXPRESS BOUNDARY?

   noteService.ts takes plain values in, returns plain data out. No req, no res, no HTTP concepts anywhere. That means it's independently testable - you can call createNote(1, 'title', 'content') directly in a test without spinning up an HTTP server, faking a request object or mocking Express internals.

   // you can test this directly
   const note = await createNote(1, 'My Note', 'Some content');
   assert(note.title === 'My Note');

// you cannot test this without an HTTP layer
app.post('/api/notes', authenticateToken, async (req, res) => {
const note = await pool.query('INSERT INTO notes...');
res.json(note);
});

Service - talks to - DB thats it
Controller - talks to - HTTP thats it
neither knows how to do the others job and that is intentional

When you collapse them into one long file. To test a DB query you now need a full Express request object. So you either mock req and res (fragile, verbose) or you write integration tests that make real HTTP calls for everything including unit-level logic.
Reuse disappears. Say later CLI tool + cron job + websocket handler - each all needing to create notes - if the logic lives in a controller its tangled to Express you cant call it without req/res. If it lives in service you just import and call it.

Single responsibility breaks. A function is now doing two unrelated jobs: parsing HTTP input AND writing to a database. - when something goes wrong how do you determine which layer the bug is in?

"The service layer contains pure business logic - it only knows about data, not about how it was requested or how the response will be delivered. That separation means ervices are independently testable, reusable across different entry points, and easier to reason about. Controllers are thin by design - validate input, call the service, format the response." - separation of concerns. HTTP vs data access
presentation layer vs business logic layer (same idea larger scale)

Service layer = pure data logic, no Express imports. Testable in isolation, reusable from any entry point (HTTP, CLI, cron, websocket).
Controller = thin HTTP layer only. Parse request -> call service -> format response.

- services dont know HTTP exists and controlelrs dont know SQL exists

9
Your helmet() call in index.ts adds several HTTP response headers automatically. Name two of those headers, what attack each one mitigates, and why this kind of protection lives in a response header rather than in your application code.
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options
MIME sniffing: if a server says a file is text/plain but the content looks like JavaScript, some browsers will execute it as JavaScript anyway, ignoring the declared type. An attacker who can upload content to your server (an avatar, an attachment) can exploit this to get their file executed as a script even if you serve it with the wrong content type.

nosniff tells the browser: trust the Content-TYpe header, dont guees, never execute something as a different type than declared.

https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
Content-Security-Policy
Tells the browser which sources are allowed to load scripts, styles ,images, and other resources on your page. Default helmet CSP blocks inline scripts and external sources not on the allowlist. Main defense against Cross-Site-Scripting (XSS) - injection of a malicous script - stealing tokens or data via a users browser

X-Frame-Options: DENY - prevents your app being embedded in an <iframe> on another site. Blocks clickjacking - where an attacker overlays your app invisibly and tricks a user into clicking buttons they can't see.

Strict-Transport-Security: tells browsers to only ever connect via HTTPS, even if the user types http://
Prevents SSL stripping attacks

Why headers and not application code:
These protections are enforced by the browser, not the server. The server cant control what a browser does with a response but it can instruct the browser via headers. Headers are the only channel your server has to communicate security policy to the client. Application code runs on teh server; by the time its done running the response is already on the wire.
-helmet ensures those instructions are attached to every response

---

express.json() - is a built-in middleware function in Express.js that parses incoming JSON data from requests and makes it accessible through the req.body property.
res.json() method sends a JSON response to the client and is commonly used in Express.js to return data as JSON. It can be used with objects arrays or primitives like numbers and strings.
next() - passes control to next middlware for the same requst - sync concept
client.release() - Returns connection to pool - if forgotten it leaks connections and deadlocks the app
Omit - Derived types stay in sync with source automatically - single source of truth
Helmet headers - each header instructs the browser to enforce a specific security policy

day8/ticketing-design.md
------------------------

markdown

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML``   # TicketHub — Design Document  TicketHub sells tickets for concerts and events. This document follows the  six-part framework: requirements, estimates, API, data model, architecture,  and trade-offs. The central correctness requirement is that **two people can  never buy the same seat**.  Scale facts used throughout:  - 2,000,000 registered users  - Normal day: 50,000 visitors × 10 pages = 500,000 page views; 5,000 tickets sold  - Big sale: 200,000 people contending for 20,000 seats in the first 10 minutes  ---  ## 1. Requirements  ### Functional requirements  1. Users can browse events (list and detail pages, with search/filter by date,     venue, artist).  2. Users can view the seat map of an event and see which seats are available,     held, or sold.  3. A logged-in user can **hold** a seat for a short time (e.g. 10 minutes),     during which it is reserved for them and nobody else can buy it.  4. A user can pay for their held seats; on success the seats become `SOLD`     and an order is created.  5. If payment fails or the hold expires, the seat returns to `AVAILABLE`     automatically.  6. Users can view their own orders and tickets.  7. Admins can create events and generate seat maps.  ### Non-functional requirements  **Speed**  - Event browse pages: p95 < 300 ms. These are the overwhelming majority of    traffic (500k page views/day normally) and must be served from cache/CDN.  - Seat map read: p95 < 500 ms even during the big sale, served from a cached    read model refreshed frequently.  - Hold / purchase writes: p95 < 1 s. During the big sale we accept that 200k    users cannot all be served instantly; the queue-and-hold design (below)    keeps the system responsive rather than fast-for-everyone.  **Correctness (the important one)**  - **Zero double-sales.** A seat is sold at most once. This is enforced at the    database level, not just in application code (see §5).  - Holds are exclusive: at most one active hold per seat.  - Money is consistent: an order is only marked paid after the payment    provider confirms, and seat state changes atomically with order creation.  **Fairness**  - No user or bot can grab many seats unfairly: per-user limits on concurrent    holds (e.g. max 8 seats) and rate limiting per account/IP.  - During the big sale, entry is **queued** (virtual waiting room) so that    arrival order is respected and the database isn't stampeded by 200k    simultaneous requests. Users who arrive first get a fair shot at seats;    nobody gains an advantage by hammering refresh.  **Availability / durability**  - Browsing must stay up even while purchasing is under extreme load    (read/write separation, §6).  - Orders and payments are durable — no lost sales.  ---  ## 2. Estimates  ### Normal traffic  - Visitors/day: 50,000; page views/day: 50,000 × 10 = **500,000**.  - Average rate: 500,000 / 86,400 s ≈ **5.8 page views/s**; peak maybe 5–10×    average → **~30–60 req/s**.  - Tickets sold/day: **5,000** → writes ≈ 5,000 / 86,400 ≈ 0.06/s (peak ~1/s).  - Read:write ratio ≈ 100:1. This is a **read-dominated** workload: caching and    read replicas do almost all the work.  ### Big-sale peak  - 200,000 people in the first 10 minutes (600 s) → ~333 people/s arriving.  - If each user makes ~1 seat-map fetch + a few hold attempts, expect    **~1,000–3,000 req/s** on the seat/booking path, with bursty spikes.  - Contention: 200,000 buyers for **20,000 seats** → at best 10% succeed;    ~180,000 users must be told "sold out" or queued. **Write contention on    20,000 hot rows** is the real problem — not raw request volume.  ### Comparison  | | Normal | Big sale |  |---|---|---|  | Read req/s | ~30–60 | ~1,000–3,000 (bursty) |  | Write req/s (seat/order) | ~1 | hundreds |  | Hot rows | spread out | 20,000 seats, all contended |  | Dominant risk | none | contention + stampede |  The big sale is ~50× the read rate and ~100–1000× the write rate, concentrated  on a tiny set of rows. The design therefore must (a) keep browsing off the  booking database, and (b) serialize access to seat rows.  ---  ## 3. API  Base: `https://api.tickethub.example/v1`. Auth: bearer token (JWT).  | # | Method & path | Purpose | Notes |  |---|---|---|---|  | 1 | `GET /events?date=&q=` | Browse events | Cached; paginated |  | 2 | `GET /events/{eventId}` | Event detail | Cached |  | 3 | `GET /events/{eventId}/seats` | Seat map with status | Cached read model, `ETag` |  | 4 | `POST /events/{eventId}/holds` | Hold seat(s) for current user | Body `{seatIds:[...]}`; 409 if any seat unavailable; returns `holdId`, `expiresAt`; idempotency key required |  | 5 | `DELETE /holds/{holdId}` | Release a hold early | Frees seats immediately |  | 6 | `POST /holds/{holdId}/pay` | Pay for held seats | Body `{paymentToken}`; idempotency key; 201 with order on success |  | 7 | `GET /me/orders` | List my orders/tickets | Auth required |  | 8 | `GET /me/orders/{orderId}` | Order detail + tickets | Auth required |  **Booking flow:** browse (1–3) → `POST /holds` (4) → `POST /holds/{id}/pay` (6).  A hold expires server-side after 10 minutes and the seats are released by a  background job; the client is told `expiresAt` so it can count down.  Errors: `409 Conflict` when a seat is held/sold by someone else (with the  offending `seatIds`), `410 Gone` when a hold has expired, `429` when rate  limited/queued.  ---  ## 4. Data model  Four core tables plus a hold/order-item join.   ``

usersid PKemail UNIQUEpassword\_hashcreated\_at

eventsid PKnamevenuestarts\_atstatus (DRAFT | ON\_SALE | SOLD\_OUT | ENDED)

seatsid PKevent\_id FK -> events.idsection, row, numberstatus (AVAILABLE | HELD | SOLD) -- single source of truthhold\_id FK -> holds.id NULL -- which hold owns itprice\_centsUNIQUE (event\_id, section, row, number) -- no duplicate seats existINDEX (event\_id, status)

holdsid PKuser\_id FK -> users.idevent\_id FK -> events.idcreated\_atexpires\_at

ordersid PKuser\_id FK -> users.idhold\_id FK -> holds.idamount\_centsstatus (PENDING | PAID | FAILED | EXPIRED)payment\_refcreated\_at

order\_itemsorder\_id FK -> orders.idseat\_id FK -> seats.idPRIMARY KEY (order\_id, seat\_id)UNIQUE (seat\_id) -- a seat can appear in at most ONE order

text

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML``   Relationships: `users 1—N orders`; `events 1—N seats`; `users 1—N holds`;  `holds 1—0..1 orders`; `orders N—M seats` via `order_items`.  The two critical constraints:  - `seats` has one row per physical seat (`UNIQUE(event_id, section, row, number)`).  - `order_items.UNIQUE(seat_id)` guarantees **at the database level** that a    seat can never appear in two orders — even if application code has a bug.  ---  ## 5. Preventing double-booking  Two people must never buy the same seat. This is enforced in layers:  **Layer 1 — Transactional conditional update (the core mechanism).**  Holding a seat is a single atomic statement inside a transaction:  ```sql  BEGIN;  -- claim every requested seat only if it is still available  UPDATE seats     SET status = 'HELD', hold_id = :holdId   WHERE id = ANY(:seatIds)     AND event_id = :eventId     AND status = 'AVAILABLE';  -- application checks: rows affected == number of seats requested  -- if not, ROLLBACK and return 409 with the conflicting seats  COMMIT;   ``

Under a row lock (Postgres takes row locks on UPDATE; MySQL/InnoDB likewise),two concurrent claims for the same seat serialize: the first setsstatus='HELD'; the second's WHERE status='AVAILABLE' matches zero rows andit fails cleanly. **The check and the write are one atomic operation**, sothere is no check-then-act race. No seat can be held twice.

**Layer 2 — Database constraints as a backstop.**Even if a bug bypassed Layer 1, order\_items.UNIQUE(seat\_id) makes a secondsale of the same seat fail at commit time. The database, not the app, is thefinal authority. seats.status has a CHECK constraint limiting it to thethree legal values, and a partial unique indexUNIQUE(hold\_id) WHERE hold\_id IS NOT NULL is not needed because one hold mapsto a set of seat rows; instead hold\_id on seats plus seats.status='HELD'identifies the owner.

**Layer 3 — Expiry, done transactionally.**A background worker runs:

sql

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   UPDATE seats SET status='AVAILABLE', hold_id=NULL   WHERE status='HELD' AND hold_id IN         (SELECT id FROM holds WHERE expires_at < now());   `

so expired holds free seats exactly once, atomically. Payment flipsHELD → SOLD for the hold's seats and inserts order\_items in onetransaction; if the hold expired first, the conditional UPDATE ... WHERE hold\_id = :holdId AND status='HELD' affects zero rows and the payment isrefused/refunded.

**Layer 4 — Idempotency.**Hold and pay endpoints require an idempotency key so a client retry (common onflaky mobile networks) cannot create two holds or charge twice.

Because every state change is a conditional UPDATE inside a transaction witha unique constraint behind it, **two people cannot buy the same seat**: thefirst transaction wins the row lock, the second sees the seat is no longerAVAILABLE, and the unique index makes a double sale impossible even underbugs.

6\. Architecture
----------------

text

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML            `┌──────────┐   Users ───▶ │   CDN    │  (static assets, cached event pages, seat-map snapshots)              └────┬─────┘                   │ miss              ┌────▼──────────┐              │  API Gateway  │  TLS, auth (JWT), rate limiting, routing              └──┬────────┬───┘          reads  │        │  writes (holds, pay)        ┌────────▼──┐  ┌──▼─────────────┐        │ Read API  │  │ Booking API    │        │ (stateless│  │ (stateless,    │        │  replicas)│  │  autoscaled)   │        └────┬──────┘  └──┬───────┬─────┘             │            │       │      ┌──────▼─────┐  ┌───▼───┐ ┌─▼──────────────┐      │ Cache      │  │ Queue │ │ Payments       │      │ (Redis)    │  │(Redis │ │ provider (3rd  │      │ event/seat │  │Streams│ │ party, webhook)│      │ read model │  │ wait- │ └────────────────┘      └──────┬─────┘  │ room) │             │        └───┬───┘             │            │      ┌──────▼────────────▼────────────┐      │  Primary DB (Postgres, row     │      │  locks + unique constraints)   │      │  ── async replication ──▶      │      │  Read replicas (event/seat     │      │  map queries, order history)   │      └───────────────┬────────────────┘                      │             ┌────────▼─────────┐             │ Expiry worker    │  frees expired holds             │ (cron, idempotent)│             └──────────────────┘`

**Components and why they exist**

*   **CDN** — serves the 500k/day browse pages and caches seat-map snapshots.Normal traffic never touches the database for reads.
    
*   **API Gateway** — auth, per-user/IP rate limits, and routes reads and writesto different services.
    
*   **Read API + Redis** — serves events and seat maps from a read model. Theseat map is refreshed every few seconds from the DB (or on change events),so a user may see a seat as available a moment after it was held; the holdcall is the authoritative check. This keeps browsing fast under load.
    
*   **Booking API** — the only path that writes seats. It executes the atomicconditional UPDATE (§5). Autoscaled, but the DB row locks serializeper-seat work.
    
*   **Virtual waiting room (Redis Streams queue)** — during the big sale, userswho click "buy" are admitted at a controlled rate (e.g. a few hundred/s)instead of 200k hitting the Booking API at once. This protects the database,gives waiting users a clear position, and makes entry order roughly fair.Browsing is unaffected because it's served by the Read API/CDN.
    
*   **Primary DB** — single writer, row-level locks, unique constraints. This isthe correctness bottleneck _by design_: correctness beats throughput on theseat rows.
    
*   **Read replicas** — absorb browse/seat-map and order-history reads so theprimary only does writes.
    
*   **Expiry worker** — periodically releases expired holds (idempotent SQL).
    
*   **Payment provider** — charged via the Booking API; the order is markedPAID only after webhook confirmation, then seats flip to SOLD in thesame transaction as order\_items insertion.
    

**How it survives the big sale**

1.  Browsing (the 50× read spike) is served by CDN/Redis/read replicas — theprimary DB barely sees it.
    
2.  The waiting room smooths 200k buyers into a controlled write stream, so theBooking API and primary DB never see a stampede.
    
3.  Per-seat row locks mean contention is on exactly the 20,000 hot rows, andthe conditional UPDATE makes losers fail fast (409) instead of queueingon locks.
    
4.  Unique constraints guarantee correctness even under retries and races.
    
5.  Stateless read/booking services autoscale horizontally; the DB is the onlystateful tier, and its write load is bounded by the waiting room.
    
6.  Expiry workers keep held-but-unpaid seats circulating so the 20,000 seatsare actually sold, not stranded.
    

7\. Trade-offs
--------------

**1\. Strong consistency on the primary vs. read scalability.**We accept that the seat-map read model can be a few seconds stale (a seat mayshow "available" and then be taken). The alternative — reading seat state fromthe primary on every page view — would collapse under the big sale. We mitigateby making the _hold_ authoritative: users only ever "lose" at the hold step,which returns a precise 409. Chosen: fast, cached reads + strongly consistentwrites.

**2\. Fairness/queueing vs. latency.**The virtual waiting room makes some users wait minutes before they can buy,and the "sold out" outcome is determined by arrival order rather than rawspeed. That's a deliberate UX/latency cost paid for fairness and stability —without it, bots and refresh-spammers would win and the DB would fall over.We accept a slower individual experience to protect the system and most users.

**3\. Single-writer primary vs. horizontal write scaling.**All seat writes go to one primary with row locks. This limits writethroughput, but sharding seat rows or using multi-master would make the"no double sale" guarantee much harder. Since the waiting room bounds writeload to what one primary can handle, we choose the simple, provably correctsingle-writer design over premature write sharding.

**4\. Reservation TTL vs. inventory utilization.**A 10-minute hold is a compromise: too long and unpaid holds block seats(under-selling, angry fans); too short and real buyers lose their seats atcheckout. We chose 10 minutes with an explicit client countdown and abackground release, accepting some churn for a smooth checkout.
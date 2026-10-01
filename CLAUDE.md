# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                                              # install deps (amqplib, nodemon)

# direct_exchange/001 — one queue, one consumer
node direct_exchange/001_producer.js                     # publish one message, then exit
npx nodemon direct_exchange/001_consumer.js              # long-lived consumer

# direct_exchange/002 — two queues, two consumers (note the space in the producer's filename)
npx nodemon direct_exchange/002_multi_consumer_1.js
npx nodemon direct_exchange/002_multi_consumer_2.js
node "direct_exchange/002_producer_with multi_consumer.js"

# topic_exchange — start both services first, then the producer
npx nodemon topic_exchange/order_notification_service.js
npx nodemon topic_exchange/payment_notification_service.js
node topic_exchange/producer.js
```

There is no test script, linter, or build step — `npm test` is still the npm-init placeholder that exits 1.

A broker must be listening on `amqp://localhost` before any script runs. This repo has no Dockerfile or compose file despite its name; the broker is started outside the repo (e.g. `docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management`, which also enables the management UI on 15672).

## Architecture

Eight standalone scripts in two topology directories, with no shared module and no imports between them. Each connects, declares its own topology, and runs. `direct_exchange/001_*` is the single-queue case, `direct_exchange/002_*` the two-queue case, and `topic_exchange/` the wildcard-routing case.

The contract between producers and consumers is a set of string constants **duplicated independently in every file**:

| | Exchange | Routing key | Queue | Binding declared by |
|---|---|---|---|---|
| direct 001 | `mail_exchange` (direct) | `send_mail` | `mail_queue` | producer |
| direct 002 A | `mail_exchange` (direct) | `send_mail_to_subscribed_user` | `mail_queue_sub` | producer |
| direct 002 B | `mail_exchange` (direct) | `send_mail_to_normal_user` | `mail_queue_normal` | producer |
| topic order | `notification_exchange` (topic) | `order.placed` | `order_queue`, bound `order.*` | **consumer** |
| topic payment | `notification_exchange` (topic) | `payment.processed` | `payment_queue`, bound `payment.*` | **consumer** |

Renaming any of these in one file silently breaks delivery unless the matching file is updated too — the message still publishes successfully and simply lands nowhere.

The payload is JSON-encoded via `Buffer.from(JSON.stringify(...))` and parsed with `JSON.parse`: `{ to, from, subject, body }` throughout `direct_exchange/`, and `{ orderId, status }` / `{ paymentId, status }` in `topic_exchange/`.

**The two topologies differ in who owns the binding, which is the point of the second directory.** In `direct_exchange/` the producer declares the queues *and* the bindings, so it must know every routing key up front. In `topic_exchange/` the producer declares only the exchange and its own routing keys; each service declares its own queue and its binding pattern, which turns a binding into a subscription (`order.*`). Adding a shipping-notification service there means adding one consumer file and touching nothing else.

Topology is declared with `assertQueue`/`assertExchange`/`bindQueue` on every run, which is how the scripts are order-independent: whichever starts first creates the entities. The exception is `topic_exchange/` — a message published before any queue is bound is dropped by the exchange rather than queued, so the services must be running first.

Each script is an independent copy of the same skeleton — `002_multi_consumer_1.js` and `002_multi_consumer_2.js` differ only in the queue name they hardcode, and likewise the two `topic_exchange` services.

## Docs

`README.md` is the user-facing entry point. `direct_exchange/001_ARCHITECTURE.md` and `direct_exchange/002_ARCHITECTURE.md` explain those topologies; `topic_exchange/ARCHITECTURE.md` covers the topic case, including the durability/persistence pairing. Diagrams live at the repo root — `rabbit.png`, `rabbit2.png`, `topic_exchnage_rabbitmq.png` — and the architecture docs embed them by relative path, so moving or renaming one breaks the doc that points at it. If you change any constant in the table above, the matching diagram and architecture doc go stale in the same commit: the diagrams have the old names baked in as raster text.

## Gotchas

- **A direct exchange routes by exact key match, so one `publish` reaches one queue.** In `direct_exchange/002` the producer binds *both* queues but publishes only under `send_mail_to_subscribed_user`, so `002_multi_consumer_2.js` receives nothing as written. This is a real behavior, not a wiring bug — see `002_ARCHITECTURE.md` for how to fan out (publish per key, fanout exchange, or topic exchange, which is what `topic_exchange/` demonstrates).
- **Durability differs between the two directories, deliberately.** `direct_exchange/` declares `{ durable: false }` while publishing `{ persistent: true }`, so the flag is inert there. `topic_exchange/` declares `{ durable: true }` throughout, which makes `persistent` live: a persistent message on a durable queue survives a broker restart. Persistence is still asynchronous, so without publisher confirms there is no way to know a given message reached disk.
- **`durable` is part of the `assert*` equivalence check.** Changing it on an entity that already exists on the broker fails the run with `PRECONDITION_FAILED` (406) and the broker closes the channel. The error message names the offending entity, so delete just that one (management UI, or `curl -u guest:guest -X DELETE http://localhost:15672/api/exchanges/%2F/<name>`) and rerun. Nothing downstream of the failure runs: the order is `assertQueue` → `assertExchange` → `bindQueue`, so a stale *exchange* leaves the queue created but **unbound** — it appears with no bindings and receives nothing, which looks identical to a service that simply has nothing to do.
- Producers rely on `setTimeout(..., 500)` to let the publish flush before closing. There are no publisher confirms, so this is a timing assumption, not a guarantee. `topic_exchange/producer.js` awaits the same delay so its two publishes stay strictly ordered.
- The AMQP URL is hardcoded as `amqp://localhost` in every file, with no environment-variable override and no credentials.
- Errors are usually caught and only `console.log`ged — a failed connection leaves a producer exiting normally and a consumer alive but idle. A `PRECONDITION_FAILED` is the exception: the broker closes the channel, which emits an `error` event that escapes the surrounding `try`/`catch` and crashes the process with a stack trace.

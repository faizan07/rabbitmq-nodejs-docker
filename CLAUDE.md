# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                                  # install deps (amqplib, nodemon)

# 001 — one queue, one consumer
node 001_producer.js                         # publish one message, then exit
npx nodemon 001_consumer.js                  # long-lived consumer

# 002 — two queues, two consumers (note the space in the producer's filename)
npx nodemon 002_multi_consumer_1.js
npx nodemon 002_multi_consumer_2.js
node "002_producer_with multi_consumer.js"
```

There is no test script, linter, or build step — `npm test` is still the npm-init placeholder that exits 1.

A broker must be listening on `amqp://localhost` before any script runs. This repo has no Dockerfile or compose file despite its name; the broker is started outside the repo (e.g. `docker run -p 5672:5672 rabbitmq`).

## Architecture

Five standalone scripts with no shared module and no imports between them. Each connects, declares its own topology, and runs — `001_*` is the single-queue case, `002_*` the two-queue case.

The contract between producers and consumers is a set of string constants **duplicated independently in every file**:

| | Exchange | Routing key | Queue |
|---|---|---|---|
| 001 | `mail_exchange` (direct) | `send_mail` | `mail_queue` |
| 002 branch A | `mail_exchange` (direct) | `send_mail_to_subscribed_user` | `mail_queue_sub` |
| 002 branch B | `mail_exchange` (direct) | `send_mail_to_normal_user` | `mail_queue_normal` |

Renaming any of these in one file silently breaks delivery unless the matching file is updated too — the message still publishes successfully and simply lands nowhere. The payload shape is `{ to, from, subject, body }`, JSON-encoded via `Buffer.from(JSON.stringify(...))` and parsed with `JSON.parse`.

Topology is declared with `assertQueue`/`assertExchange`/`bindQueue` on every run, which is how the scripts are order-independent: whichever starts first creates the entities.

Each script is an independent copy of the same skeleton — `002_multi_consumer_1.js` and `002_multi_consumer_2.js` differ only in the queue name they hardcode.

## Docs

`README.md` is the user-facing entry point; `001_ARCHITECTURE.md` and `002_ARCHITECTURE.md` explain each topology and embed `rabbit.png` and `rabbit2.png`. If you change any constant in the table above, the matching diagram and architecture doc go stale in the same commit — the diagrams have the old names baked in as raster text.

## Gotchas

- **A direct exchange routes by exact key match, so one `publish` reaches one queue.** In 002 the producer binds *both* queues but publishes only under `send_mail_to_subscribed_user`, so `002_multi_consumer_2.js` receives nothing as written. This is a real behavior, not a wiring bug — see `002_ARCHITECTURE.md` for how to fan out (publish per key, fanout exchange, or topic exchange).
- Producers declare queues with `{ durable: false }` but publish with `{ persistent: true }`. The flag is inert on a non-durable queue. The arguments to `assertQueue`/`assertExchange` must also match across files, or the broker closes the second script's channel with `PRECONDITION_FAILED`.
- Producers rely on `setTimeout(..., 500)` to let the publish flush before closing. There are no publisher confirms, so this is a timing assumption, not a guarantee.
- The AMQP URL is hardcoded as `amqp://localhost` in every file, with no environment-variable override and no credentials.
- Errors are caught and only `console.log`ged — a failed connection leaves a producer exiting normally and a consumer alive but idle.

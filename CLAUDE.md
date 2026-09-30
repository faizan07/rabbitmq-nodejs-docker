# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                  # install deps (amqplib, nodemon)
node producer.js             # publish one mail message, then exit
npx nodemon consumer.js      # run the consumer (long-lived; nodemon restarts on edit)
```

There is no test script, linter, or build step — `npm test` is still the npm-init placeholder that exits 1.

A RabbitMQ broker must be listening on `amqp://localhost` before either script runs. This repo has no Dockerfile or compose file despite its name; the broker is expected to be started outside the repo (e.g. `docker run -p 5672:5672 rabbitmq`).

## Architecture

Two standalone scripts that communicate only through a broker-defined topology — they never import each other:

- `producer.js` — `sendEmail()` connects, declares the topology, publishes one JSON mail message, waits 500 ms for the publish to flush, then closes the channel and connection and lets the process exit.
- `consumer.js` — `receiveEmail()` connects, declares the same queue, and blocks in `channel.consume`, acking each message and logging it. It never closes its connection, so the process runs until killed.

The contract between them is the triple `mail_exchange` (direct) / routing key `send_mail` / queue `mail_queue`, declared **independently in both files**. Changing an exchange name, routing key, or queue name in one file silently breaks delivery unless the other file is updated to match. Message payload shape is the `{ to, from, subject, body }` object in `producer.js`, parsed with `JSON.parse` in `consumer.js`.

Topology is declared with `assertQueue`/`assertExchange`/`bindQueue` on every run, which is how the scripts are order-independent: whichever starts first creates the exchange, queue, and binding.

## Gotchas

- `producer.js` declares the queue with `{ durable: false }` but publishes with `{ persistent: true }`. The persistent flag has no effect on a non-durable queue — messages are lost on broker restart regardless. Also note the arguments passed to `assertQueue`/`assertExchange` must match on both sides, or the broker closes the channel with a `PRECONDITION_FAILED` error; if you change durability, change it in both files.
- `producer.js` relies on a `setTimeout(..., 500)` to let the publish reach the broker before closing. There are no publisher confirms, so this is a timing hack, not a guarantee.
- The AMQP URL is hardcoded as `amqp://localhost` in both files, with no environment-variable override and no credentials (the broker must allow guest access over localhost).
- Errors are caught and only `console.log`ged. A failure to connect leaves the producer exiting normally and the consumer process alive but idle.

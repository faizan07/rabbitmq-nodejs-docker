# rabbitmq-nodejs-docker

A minimal RabbitMQ producer/consumer example in Node.js using [amqplib](https://amqp-node.github.io/amqplib/).

`producer.js` publishes a single JSON "mail" message to a direct exchange; `consumer.js` subscribes to the bound queue and logs each message it receives. The two scripts share no code — they communicate only through the RabbitMQ broker.

## Requirements

- Node.js 18+ (developed against v22)
- A running RabbitMQ broker reachable at `amqp://localhost`

If you don't have a broker yet, start one with Docker:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```

Port `5672` is the AMQP port both scripts connect to. Port `15672` serves the management UI at http://localhost:15672 (default login `guest` / `guest`) — useful for inspecting the exchange, queue, and message counts.

## Setup

```bash
npm install
```

## Running

Start the consumer first, then the producer in a second terminal:

```bash
# terminal 1 — stays running, prints each message as it arrives
npx nodemon consumer.js
```

```bash
# terminal 2 — publishes one message, then exits
node producer.js
```

The consumer logs reception and acknowledges the message:

```
[x] Received mail: { to: '...', from: '...', subject: 'RabbitMQ test 2', body: '...' }
```

`nodemon` restarts the consumer automatically on file changes. Plain `node consumer.js` works too if you don't want that.

## How it works

| | |
|---|---|
| Exchange | `mail_exchange` (type `direct`) |
| Routing key | `send_mail` |
| Queue | `mail_queue` |
| Message body | JSON — `{ to, from, subject, body }` |

Both scripts declare the exchange, queue, and binding on startup (`assertExchange` / `assertQueue` / `bindQueue`), so either can be started first — whichever runs first creates the topology.

The producer publishes to `mail_exchange` with routing key `send_mail`; the direct exchange routes it to `mail_queue` because the queue is bound with that exact key. The consumer reads from `mail_queue`, parses the buffer back into an object, and acks.

To change the message content, edit the `message` object in `producer.js`. Message text is buffered via `Buffer.from(JSON.stringify(message))` — the broker only ever carries bytes, so the JSON encoding is the two scripts' own convention, not something AMQP enforces.

## Notes

- **The queue is not durable and messages are not persistent.** `producer.js` declares the queue with `{ durable: false }` and publishes with `{ persistent: true }`, but the persistent flag has no effect on a non-durable queue. Messages still sitting in the queue are lost if the broker restarts.
- **`assertQueue`/`assertExchange` arguments must match on both sides.** If you change durability in one file but not the other, whichever script starts second will have its channel closed by the broker with a `PRECONDITION_FAILED` error.
- **The connection URL is hardcoded** as `amqp://localhost` in both files, with no environment-variable override. Guest access without a password only works because the broker is on localhost.
- **The producer uses a `setTimeout(..., 500)` to flush before closing** the channel and connection. There are no publisher confirms, so this is a timing assumption rather than a delivery guarantee — publishing to a slow or remote broker may drop the message.
- **Errors are only logged** with `console.log`, so a failed connection will not produce a non-zero exit code.

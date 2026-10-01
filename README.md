# rabbitmq-nodejs-docker

Minimal RabbitMQ producer/consumer examples in Node.js using [amqplib](https://amqp-node.github.io/amqplib/).

Two topologies, one directory each:

| Directory | Scripts | Topology |
|---|---|---|
| `direct_exchange/` | `001_*` | one producer, one exchange, one queue, one consumer |
| | `002_*` | one producer, one exchange, two queues, two consumers, routed by routing key |
| `topic_exchange/` | `producer.js` | one producer, one topic exchange, two queues, two notification services, routed by wildcard binding |

See the `ARCHITECTURE.md` in each directory for diagrams and how the topology actually routes.

## Requirements

- Node.js 18+ (developed against v22)
- A RabbitMQ broker reachable at `amqp://localhost`

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```

`5672` is the AMQP port; `15672` serves the management UI at http://localhost:15672 (default login `guest` / `guest`).

## Setup

```bash
npm install
```

## Running

**`direct_exchange/001`** — consumer first, then the producer:

```bash
npx nodemon direct_exchange/001_consumer.js     # terminal 1
node direct_exchange/001_producer.js            # terminal 2
```

**`direct_exchange/002`** — the producer's filename contains a space, so quote it:

```bash
npx nodemon direct_exchange/002_multi_consumer_1.js        # terminal 1
npx nodemon direct_exchange/002_multi_consumer_2.js        # terminal 2
node "direct_exchange/002_producer_with multi_consumer.js" # terminal 3
```

**`topic_exchange`** — start both services *before* the producer; a topic exchange with no matching binding drops the message:

```bash
npx nodemon topic_exchange/order_notification_service.js    # terminal 1
npx nodemon topic_exchange/payment_notification_service.js  # terminal 2
node topic_exchange/producer.js                             # terminal 3
```

Consumers log each message and stay running; producers publish and exit.

## Topology

| | `direct_exchange/001` | `direct_exchange/002` | `topic_exchange` |
|---|---|---|---|
| Exchange | `mail_exchange` (direct) | `mail_exchange` (direct) | `notification_exchange` (topic) |
| Routing keys | `send_mail` | `send_mail_to_subscribed_user`, `send_mail_to_normal_user` | `order.placed`, `payment.processed` |
| Queues | `mail_queue` | `mail_queue_sub`, `mail_queue_normal` | `order_queue`, `payment_queue` |
| Bindings declared by | producer | producer | **consumer** (`order.*`, `payment.*`) |
| Payload | `{ to, from, subject, body }` | same | `{ orderId, status }` / `{ paymentId, status }` |

Scripts declare the exchange, queues, and bindings on startup, so either side can be started first — except in `topic_exchange`, where the binding is the consumer's subscription and the message is dropped if no consumer has bound yet.

## Notes

- In `direct_exchange/002`, the producer binds both queues but publishes only under `send_mail_to_subscribed_user`, so Consumer 2 stays idle unless you also publish to `send_mail_to_normal_user`. A direct exchange routes by exact key match — one publish reaches one queue. `topic_exchange` is the same flow done with a topic exchange, where one publish still reaches one queue but the *consumer* chooses what it receives.
- `direct_exchange` declares its queues non-durable while publishing `{ persistent: true }`, so the persistent flag is inert there. `topic_exchange` declares everything `durable: true`, which makes the flag live: a persistent message on a durable queue survives a broker restart.
- There are no publisher confirms anywhere, and the broker URL is hardcoded as `amqp://localhost` in every file.

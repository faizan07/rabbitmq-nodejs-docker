# rabbitmq-nodejs-docker

Minimal RabbitMQ producer/consumer examples in Node.js using [amqplib](https://amqp-node.github.io/amqplib/).

Four topologies, one directory each:

| Directory | Scripts | Topology |
|---|---|---|
| `direct_exchange/` | `001_*` | one producer, one exchange, one queue, one consumer |
| | `002_*` | one producer, one exchange, two queues, two consumers, routed by routing key |
| `topic_exchange/` | `producer.js`, `*_notification_service.js` | one producer, one topic exchange, two queues, two notification services, routed by wildcard binding |
| `fan_out_exchange/` | `producer.js`, `pushNotification.js`, `smsNotification.js` | one producer, one fanout exchange, two notification services, each on its own temporary queue — broadcast, no routing key |
| `header_exchange/` | `producer.js`, `newVideoNotifications.js`, `liveStreamNotifications.js`, `commentsLikeNotifications.js` | one producer, one headers exchange, three notification services, routed on message metadata — no routing key |

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

**`fan_out_exchange`** — start both services *before* the producer; their queues are temporary and only exist while they are connected:

```bash
npx nodemon fan_out_exchange/pushNotification.js   # terminal 1
npx nodemon fan_out_exchange/smsNotification.js    # terminal 2
node fan_out_exchange/producer.js                  # terminal 3
```

Both services log the same product launch, each from its own queue.

**`header_exchange`** — start all three services *before* the producer, for the same reason:

```bash
npx nodemon header_exchange/newVideoNotifications.js        # terminal 1
npx nodemon header_exchange/liveStreamNotifications.js      # terminal 2
npx nodemon header_exchange/commentsLikeNotifications.js    # terminal 3
node header_exchange/producer.js                            # terminal 4
```

Each service logs only the events whose headers satisfy its own binding.

Consumers log each message and stay running; producers publish and exit.

## Topology

| Directory | Exchange | Routing keys | Queues | Bindings declared by |
|---|---|---|---|---|
| `direct_exchange/001` | `mail_exchange` (direct) | `send_mail` | `mail_queue` | producer |
| `direct_exchange/002` | `mail_exchange` (direct) | `send_mail_to_subscribed_user`, `send_mail_to_normal_user` | `mail_queue_sub`, `mail_queue_normal` | producer |
| `topic_exchange` | `notification_exchange` (topic) | `order.placed`, `payment.processed` | `order_queue`, `payment_queue` | consumer, bound `order.*` / `payment.*` |
| `fan_out_exchange` | `new_product_launch` (fanout) | none — a fanout ignores the key | server-generated `amq.gen-…`, one per service, deleted on disconnect | consumer, empty key |
| `header_exchange` | `video_platform_exchange` (headers) | none — a headers exchange ignores the key and matches on binding arguments | `new_video_queue`, `live_stream_queue`, `comments_like_queue` | consumer, `x-match` + header arguments |

Payloads are JSON: `{ to, from, subject, body }` throughout `direct_exchange/`, `{ orderId, status }` and `{ paymentId, status }` in `topic_exchange/`, `{ productId, name, status }` in `fan_out_exchange/`, and per-event objects (`{ videoId, title, status }`, `{ commentId, videoId, body }`, …) in `header_exchange/`.

For `header_exchange` the routing rule is the binding arguments, not a key: `x-match: "all"` requires every listed header to be present and equal, `"any"` requires at least one. `header_exchange/ARCHITECTURE.md` has the full header vocabulary and which event reaches which service.

Scripts declare the exchange, queues, and bindings on startup, so either side can be started first — except in `topic_exchange`, `fan_out_exchange`, and `header_exchange`, where the subscription belongs to the consumer and a message published before any consumer is listening is dropped by the exchange rather than queued.

## Notes

- In `direct_exchange/002`, the producer binds both queues but publishes only under `send_mail_to_subscribed_user`, so Consumer 2 stays idle unless you also publish to `send_mail_to_normal_user`. A direct exchange routes by exact key match — one publish reaches one queue. `topic_exchange` is the same flow done with a topic exchange, where one publish still reaches one queue but the *consumer* chooses what it receives. `fan_out_exchange` is the third take on the same idea: one publish reaches **both** services.
- **`fan_out_exchange` is the one directory where a single publish reaches every consumer.** Two services, two queues, so both receive a copy — that is broadcast. Contrast with two consumers on the *same* queue, which round-robins so each message goes to exactly one of them; the patterns are not interchangeable.
- Because `fan_out_exchange` queues are temporary and private to each service, nothing is left behind on the broker between runs — but a launch published while a service is down is dropped rather than queued. `direct_exchange/002` makes the opposite trade-off, declaring fixed queue names precisely so its messages wait. Getting both means fixed durable queues behind a fanout exchange.
- **`header_exchange` routes on metadata instead of keys.** Each service binds an arguments object — `x-match: "all"` (every listed header must be present and equal; this is the default) or `"any"` (at least one). Two consequences are worth remembering: a header key holds one value, so matching "comment or like" needs two distinct flag headers rather than one key with two values; and bindings are additive, so editing the arguments and rebinding leaves the old binding in place — delete the queue to clear it.
- `direct_exchange`, `fan_out_exchange`, and `header_exchange` declare non-durable exchanges and queues while publishing `{ persistent: true }`, so the persistent flag is inert in all three — in `fan_out_exchange` the queues are transient by construction. `topic_exchange` declares everything `durable: true`, which makes the flag live: a persistent message on a durable queue survives a broker restart.
- There are no publisher confirms anywhere, and the broker URL is hardcoded as `amqp://localhost` in every file.

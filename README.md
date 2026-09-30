# rabbitmq-nodejs-docker

Minimal RabbitMQ producer/consumer examples in Node.js using [amqplib](https://amqp-node.github.io/amqplib/).

- **`001_*`** — one producer, one exchange, one queue, one consumer
- **`002_*`** — one producer, one exchange, two queues, two consumers, routed by user type

See [001_ARCHITECTURE.md](001_ARCHITECTURE.md) and [002_ARCHITECTURE.md](002_ARCHITECTURE.md) for diagrams and how each topology works.

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

**001** — consumer first, then the producer:

```bash
npx nodemon 001_consumer.js     # terminal 1
node 001_producer.js            # terminal 2
```

**002** — the producer's filename contains a space, so quote it:

```bash
npx nodemon 002_multi_consumer_1.js               # terminal 1
npx nodemon 002_multi_consumer_2.js               # terminal 2
node "002_producer_with multi_consumer.js"        # terminal 3
```

Consumers log each message and stay running; producers publish one message and exit.

## Topology

| | 001 | 002 |
|---|---|---|
| Exchange | `mail_exchange` (direct) | `mail_exchange` (direct) |
| Routing keys | `send_mail` | `send_mail_to_subscribed_user`, `send_mail_to_normal_user` |
| Queues | `mail_queue` | `mail_queue_sub`, `mail_queue_normal` |
| Payload | `{ to, from, subject, body }` as JSON | same |

Both scripts in each pair declare the exchange, queues, and bindings on startup, so either can be started first.

## Notes

- In **002**, the producer binds both queues but publishes only under `send_mail_to_subscribed_user`, so Consumer 2 stays idle unless you also publish to `send_mail_to_normal_user`. A direct exchange routes by exact key match — one publish reaches one queue.
- Queues are declared non-durable, and there are no publisher confirms, so messages can be lost on a broker restart or slow publish.
- The broker URL is hardcoded as `amqp://localhost` in every file.

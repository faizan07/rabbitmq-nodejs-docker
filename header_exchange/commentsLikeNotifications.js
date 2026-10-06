const amqplib = require("amqplib")

async function commentsLikeNotifications() {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "video_platform_exchange"
        const queue = "comments_like_queue"

        //x-match "any": the message needs only one of the headers below.
        //two different keys are required because a header key holds a single
        //value — one key cannot be bound to both "comment" and "like"
        const bindingArgs = {
            "x-match": "any",
            "is-comment": "true",
            "is-like": "true"
        }

        await channel.assertQueue(queue, { durable: false })
        await channel.assertExchange(exchange, "headers", { durable: false })
        await channel.bindQueue(queue, exchange, "", bindingArgs)

        console.log(`[*] ${queue} waiting for comment and like events`)

        //consume the message
        channel.consume(
            queue,
            (msg) => {
                if (msg === null) return

                const event = JSON.parse(msg.content.toString())
                console.log(`[x] Comments/like notification:`, event)
                channel.ack(msg)
            }
        )
    } catch (error) {
        console.log(error)
    }
}

commentsLikeNotifications()

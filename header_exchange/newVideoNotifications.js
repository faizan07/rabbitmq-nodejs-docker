const amqplib = require("amqplib")

async function newVideoNotifications() {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "video_platform_exchange"
        const queue = "new_video_queue"

        //the consumer owns its queue and the arguments that bind it.
        //x-match "all": every header below must be present and equal
        const bindingArgs = {
            "x-match": "all",
            "notification-type": "new-video",
            "media-type": "video"
        }

        await channel.assertQueue(queue, { durable: false })
        await channel.assertExchange(exchange, "headers", { durable: false })
        await channel.bindQueue(queue, exchange, "", bindingArgs)

        console.log(`[*] ${queue} waiting for new video events`)

        //consume the message
        channel.consume(
            queue,
            (msg) => {
                if (msg === null) return

                const event = JSON.parse(msg.content.toString())
                console.log(`[x] New video notification:`, event)
                channel.ack(msg)
            }
        )
    } catch (error) {
        console.log(error)
    }
}

newVideoNotifications()

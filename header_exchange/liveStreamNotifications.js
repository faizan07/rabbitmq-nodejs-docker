const amqplib = require("amqplib")

async function liveStreamNotifications() {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "video_platform_exchange"
        const queue = "live_stream_queue"

        //the consumer owns its queue and the arguments that bind it.
        //x-match "all": every header below must be present and equal
        const bindingArgs = {
            "x-match": "all",
            "notification-type": "live-stream",
            "media-type": "video"
        }

        await channel.assertQueue(queue, { durable: false })
        await channel.assertExchange(exchange, "headers", { durable: false })
        await channel.bindQueue(queue, exchange, "", bindingArgs)

        console.log(`[*] ${queue} waiting for live stream events`)

        //consume the message
        channel.consume(
            queue,
            (msg) => {
                if (msg === null) return

                const event = JSON.parse(msg.content.toString())
                console.log(`[x] Live stream notification:`, event)
                channel.ack(msg)
            }
        )
    } catch (error) {
        console.log(error)
    }
}

liveStreamNotifications()

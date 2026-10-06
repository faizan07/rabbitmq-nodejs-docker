const amqplib = require("amqplib")

const exchange = "video_platform_exchange"

//publish one platform event. a headers exchange routes on the message
//headers, so the headers are the routing decision, not the routing key
async function publishEvent(headers, payload) {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()

        //headers exchange: the producer declares the exchange only.
        //the queues and their binding arguments belong to the consumers
        await channel.assertExchange(exchange, "headers", { durable: false })

        //the routing key is ignored by a headers exchange, so it stays empty
        channel.publish(
            exchange,
            "",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true, headers }
        )
        console.log(`Sent -> ${headers["notification-type"]}:`, payload)

        //give the publish a moment to flush before tearing down
        await new Promise((resolve) => setTimeout(resolve, 500))
        await channel.close()
        await connection.close()
    } catch (error) {
        console.log(error)
    }
}

async function main() {
    //a video platform: two video events, then two engagement events
    await publishEvent(
        { "notification-type": "new-video", "media-type": "video" },
        { videoId: 101, title: "RabbitMQ in 10 minutes", status: "published" }
    )
    await publishEvent(
        { "notification-type": "live-stream", "media-type": "video" },
        { streamId: 202, title: "Live Q&A on exchanges", status: "live" }
    )
    await publishEvent(
        { "notification-type": "comment", "is-comment": "true" },
        { commentId: 303, videoId: 101, body: "Great explanation" }
    )
    await publishEvent(
        { "notification-type": "like", "is-like": "true" },
        { likeId: 404, videoId: 101 }
    )
}

main()

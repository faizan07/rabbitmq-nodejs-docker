const amqplib = require("amqplib")

async function pushNotification() {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "new_product_launch"

        await channel.assertExchange(exchange, "fanout", { durable: false })

        //no queue name: the broker invents one (amq.gen-...), and because the
        //queue is exclusive it is deleted the moment this connection closes.
        //every run of this service therefore gets its own private queue
        const queue = await channel.assertQueue("", { exclusive: true })

        //a fanout exchange ignores the binding key, so there is nothing to match
        await channel.bindQueue(queue.queue, exchange, "")

        console.log(`[*] ${queue.queue} waiting for ${exchange} broadcasts`)

        //consume the message
        channel.consume(
            queue.queue,
            (msg) => {
                if (msg === null) return

                const product = JSON.parse(msg.content.toString())
                console.log(`[x] Push notification for ${product.name}:`, product)
                channel.ack(msg)
            }
        )
    } catch (error) {
        console.log(error)
    }
}

pushNotification()

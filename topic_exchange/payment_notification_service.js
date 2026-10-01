const amqplib = require("amqplib")

async function paymentNotificationService() {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "notification_exchange"
        const paymentQueue = "payment_queue"
        const bindingKey = "payment.*"

        //the consumer owns its queue and its binding to the topic exchange
        await channel.assertQueue(paymentQueue, { durable: true })
        await channel.assertExchange(exchange, "topic", { durable: true })
        await channel.bindQueue(paymentQueue, exchange, bindingKey)

        console.log(`[*] ${paymentQueue} waiting for ${bindingKey} messages`)

        //consume the message
        channel.consume(
            paymentQueue,
            (msg) => {
                if (msg === null) return

                const notification = JSON.parse(msg.content.toString())
                console.log(`[x] Received ${msg.fields.routingKey} on ${paymentQueue}:`, notification)
                channel.ack(msg)
            }
        )
    } catch (error) {
        console.log(error)
    }
}

paymentNotificationService()

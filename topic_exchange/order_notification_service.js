const amqplib = require("amqplib")

async function orderNotificationService() {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "notification_exchange"
        const orderQueue = "order_queue"
        const bindingKey = "order.*"

        //the consumer owns its queue and its binding to the topic exchange
        await channel.assertQueue(orderQueue, { durable: true })
        await channel.assertExchange(exchange, "topic", { durable: true })
        await channel.bindQueue(orderQueue, exchange, bindingKey)

        console.log(`[*] ${orderQueue} waiting for ${bindingKey} messages`)

        //consume the message
        channel.consume(
            orderQueue,
            (msg) => {
                if (msg === null) return

                const notification = JSON.parse(msg.content.toString())
                console.log(`[x] Received ${msg.fields.routingKey} on ${orderQueue}:`, notification)
                channel.ack(msg)
            }
        )
    } catch (error) {
        console.log(error)
    }
}

orderNotificationService()

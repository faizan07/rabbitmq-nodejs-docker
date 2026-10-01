const amqplib = require("amqplib")

const exchange = "notification_exchange"

//publish one notification; the routing key decides which queues receive it
async function publishNotification(routingKey, message) {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()

        //topic exchange: the producer declares the exchange only.
        //the queues and the bindings belong to the consumers
        await channel.assertExchange(exchange, "topic", { durable: true })

        //publish the message in form of a buffer
        channel.publish(
            exchange,
            routingKey,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        )
        console.log(`Sent -> ${routingKey}:`, message)

        //give the publish a moment to flush before tearing down
        await new Promise((resolve) => setTimeout(resolve, 500))
        await channel.close()
        await connection.close()
    } catch (error) {
        console.log(error)
    }
}

async function main() {
    //a real world e-commerce flow: the order is placed, then its payment is processed
    await publishNotification("order.placed", { orderId: 2424, status: "placed" })
    await publishNotification("payment.processed", { paymentId: 1212, status: "processed" })
}

main()

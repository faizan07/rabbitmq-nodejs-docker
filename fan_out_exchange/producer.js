const amqplib = require("amqplib")

const exchange = "new_product_launch"

//broadcast a product launch to every service listening on the exchange
async function announceLaunch(product) {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()

        //fanout exchange: the producer declares the exchange only.
        //it has no idea which queues exist, or how many
        await channel.assertExchange(exchange, "fanout", { durable: false })

        //no routing key: a fanout exchange copies the message into every
        //queue bound to it, so the key is ignored
        channel.publish(
            exchange,
            "",
            Buffer.from(JSON.stringify(product)),
            { persistent: true }
        )
        console.log(`Sent -> ${exchange}:`, product)

        //give the publish a moment to flush before tearing down
        await new Promise((resolve) => setTimeout(resolve, 500))
        await channel.close()
        await connection.close()
    } catch (error) {
        console.log(error)
    }
}

const product = {
    productId: 1234,
    name: "Wireless Headphones",
    status: "launched"
}

announceLaunch(product)

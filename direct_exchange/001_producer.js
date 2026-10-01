const amqplib = require("amqplib")

async function sendEmail(params) {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "mail_exchange"
        const routingKey = "send_mail"
        const mailqueue = "mail_queue"
        const message = {
            to: "hqfzn_2@telegmail.com",
            from: "faizan97haque@gmail.com",
            subject: "RabbitMQ test 2",
            body: "This is a test mail 2"
        }
        //create mail queue from channel
        await channel.assertQueue(mailqueue, { durable: false })

        //create the exchange and bind the queue to it
        await channel.assertExchange(exchange, "direct", { durable: false })
        await channel.bindQueue(mailqueue, exchange, routingKey)

        //publish the message in form of a buffer
        channel.publish(
            exchange,
            routingKey,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        )
        console.log(`Sent -> ${routingKey}:`, message.subject)

        //give the publish a moment to flush before tearing down
        setTimeout(() => {
            channel.close()
            connection.close()
        }, 500)
    } catch (error) {
        console.log(error)
    }
}

sendEmail()
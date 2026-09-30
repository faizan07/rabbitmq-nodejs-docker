const amqplib = require("amqplib")

async function sendEmail(params) {
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const exchange = "mail_exchange"
        const routingKeySubscribedUser = "send_mail_to_subscribed_user"
        const routingKeyNormalUser = "send_mail_to_normal_user"
        const mailQueueSubsUser = "mail_queue_sub"
        const mailQueueNormalUser = "mail_queue_normal"
        const message = {
            to: "hqfzn_@telegmail.com",
            from: "faizanhaque@gmail.com",
            subject: "I am a normal user",
            body: "NORMAL user mail body"
        }
        //create mail queue from channel
        await channel.assertQueue(mailQueueSubsUser, { durable: false })
        await channel.assertQueue(mailQueueNormalUser, { durable: false })

        //create the exchange and bind the queue to it
        await channel.assertExchange(exchange, "direct", { durable: false })
        await channel.bindQueue(mailQueueSubsUser, exchange, routingKeySubscribedUser)
        await channel.bindQueue(mailQueueNormalUser, exchange, routingKeyNormalUser)

        //publish the message in form of a buffer
        channel.publish(
            exchange,
            routingKeySubscribedUser,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        )
        console.log(`Sent -> ${routingKeySubscribedUser}:`, message.subject)

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
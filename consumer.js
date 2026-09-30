const amqplib = require("amqplib")

async function receiveEmail(){
    try {
        const connection = await amqplib.connect("amqp://localhost")
        const channel = await connection.createChannel()
        const mailqueue = "mail_queue"

        await channel.assertQueue(mailqueue, { durable: false })
        

        //consume the message
         channel.consume(
            mailqueue,
            (msg) => {
                if (msg === null) return

                const mail = JSON.parse(msg.content.toString())
                console.log("[x] Received mail:", mail)
                channel.ack(msg)
            }
        )
    } catch (error) {
        console.log(error)
    }
}

receiveEmail()

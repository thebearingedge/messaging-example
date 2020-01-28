import amqp from 'amqplib'

(async () => {
  const connection = await amqp.connect('amqp://localhost')
  const channel = await connection.createChannel()
  const q =  await channel.assertQueue('service-three')
  await channel.bindQueue(q.queue, 'todos-service')
  channel.consume(q.queue, message => {
    console.log(JSON.parse(message.content.toString()))
    channel.ack(message)
  })
})()

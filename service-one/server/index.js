import pg from 'pg'
import amqp from 'amqplib'
import express from 'express'

(async () => {
  const connection = await amqp.connect('amqp://localhost')
  const channel = await connection.createChannel()
  const exchange = await channel.assertExchange('todos-service', 'fanout')

  channel.on('error', err => {
    console.error(err)
    process.exit(1)
  })

  const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  })

  const app = express()

  app.use(express.json())

  app.get('/api/todos', (req, res, next) => {
    const sql = `
      select "todoId",
            "task",
            "isCompleted",
            "createdAt"
        from "todos"
      order by "createdAt"
    `
    db.query(sql)
      .then(({ rows }) => res.json(rows))
      .catch(next)
  })

  app.post('/api/todos', ({ body }, res, next) => {
    const { task, isCompleted = false } = body
    const sql = `
      insert into "todos" ("task", "isCompleted")
      values ($1, $2)
      returning *
    `
    const values = [task, isCompleted]
    db.query(sql, values)
      .then(({ rows: [todo] }) => {
        channel.publish('todos-service', '', Buffer.from(JSON.stringify({
          action: 'todo_created',
          payload: todo
        })), { persistent: true })
        res.status(201).json(todo)
      })
      .catch(next)
  })

  app.put('/api/todos/:todoId', ({ params, body }, res, next) => {
    const { todoId } = params
    const { task, isCompleted } = body
    const sql = `
      update "todos"
        set "task"        = $1,
            "isCompleted" = $2
      where "todoId"      = $3
      returning *
    `
    const values = [task, isCompleted, todoId]
    db.query(sql, values)
      .then(({ rows: [todo] }) => {
        if (!todo) {
          res.status(404).json({
            statusCode: 404,
            error: 'Not Found',
            message: `Cannot find todo with todoId ${todoId}`
          })
        } else {
          res.json(todo)
        }
      })
      .catch(next)
  })

  app.delete('/api/todos/:todoId', ({ params }, res, next) => {
    const { todoId } = params
    const sql = `
      delete from "todos"
      where "todoId" = $1
      returning "todoId"
    `
    const values = [todoId]
    db.query(sql, values)
      .then(({ rows: [todo] }) => {
        if (!todo) {
          res.status(404).json({
            statusCode: 404,
            error: 'Not Found',
            message: `Cannot find todo with todoId ${todoId}`
          })
        } else {
          res.sendStatus(204)
        }
      })
  })

  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    })
  })

  app.listen(process.env.PORT, () => {
    console.log('Listening on port', process.env.PORT)
  })

})()

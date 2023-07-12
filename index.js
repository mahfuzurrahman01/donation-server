const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;
require('dotenv').config()

// middleware's
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w6iptv2.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function bootstrap() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log('successfully connected database')
    const donationUsers = client.db('usersData').collection('users')
  

    app.post('/register', async (req, res) => {
      // in the time of register user we first need to check this email is already exist or not
      const user = req.body
      const query = { email: user.email };
      const findExisting = await donationUsers.findOne(query)
      if (findExisting) {
        res.status(400).json({
          ok: false,
          data: 'User already exists'
        })
        return
      } else {
        const result = await donationUsers.insertOne(user)
        res.status(200).json({
          ok: true,
          data: result
        })
      }

    })


  } catch (error) {
    console.log(error)
  }
}
bootstrap().catch(err => console.log(err))


app.get('/', (req, res) => {
  res.send('Donation app server is running successfully')
})

app.listen(port, () => {
  console.log(`Donation listening on port ${port}`)
})
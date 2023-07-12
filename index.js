const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()

// middleware's
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w6iptv2.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// this function is verifying the token for granting access
function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ massage: 'unauthorized access' })
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ massage: 'unauthorized access' })
    }
    req.decoded = decoded;
    next()
  })
}


async function bootstrap() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log('successfully connected database')
    const donationUsers = client.db('usersData').collection('users')

    // We are sending access token after successful authentication
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN);
      res.send({ token })
    })

    app.post('/register', async (req, res) => {
      // AT the time of register user we first need to check this email is already exist or not
      const user = req.body
      const query = { email: user.email };
      const findExisting = await donationUsers.findOne(query)
      if (findExisting) {
        res.send({ ok: false, message: "User already exists" })
        return
      }
      const result = await donationUsers.insertOne(user)
      res.status(200).json({
        ok: true,
        data: result
      })

    })

    // ==================Login ==========================
    app.post('/login', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      // we are checking first this user is in our db or not : log in access 
      const validUser = await donationUsers.findOne(query)
      if (!validUser) {
        res.send({
          ok: false,
          message: "Invalid user"
        })
        return
      } else {
        if (validUser.password === user.password) {
          res.status(200).json({
            ok: true,
            data: { message: "Valid user" }
          })
        } else {
          res.send({
            ok: false,
            message: "Incorrect password"
          })
        }
      }
    })
    // check role 
    app.get('/checkRole', verifyJwt, async (req, res) => {
      const query = { email: req.decoded.email }
      const result = await donationUsers.findOne(query)
      res.status(200).json({
        ok: true,
        userInfo: result
      })
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
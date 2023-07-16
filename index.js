const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const donationUsers = client.db('donations').collection('users')
    const donationLists = client.db('donations').collection('donationsList')
    const donorLists = client.db('donations').collection('donorLists')
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
      const newResult = {
        name: result?.name,
        email: result?.email,
        role: result?.role
      }
      res.status(200).json({
        ok: true,
        userInfo: newResult
      })
    })
    // create donation by admin 
    app.post('/create/donation', verifyJwt, async (req, res) => {
      const body = req.body
      const query = { email: req?.decoded?.email }
      const result = await donationUsers.findOne(query)
      if (result?.role !== 'admin') {
        res.send({ ok: false, message: "Access Restricted: Admin Only" })
        return
      }
      const response = await donationLists.insertOne(body)
      res.status(200).json({
        ok: true,
        data: response
      })
    })

    app.get('/all-donation', verifyJwt, async (req, res) => {
      let query = {}
      if(req?.query?.sortingName !== "all"){
        query = {category: req.query.sortingName}
      }
      const result = await donationLists.find(query).toArray()
      res.status(200).json({
        ok: true,
        data: result
      })
    })
    // updating donation
    app.patch('/donation/update/:id', verifyJwt, async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const updateDoc = {
        $set: body,
      };
      const query = { email: req?.decoded?.email }
      const result = await donationUsers.findOne(query)
      if (result?.role !== 'admin') {
        res.send({ ok: false, message: "Access Restricted: Admin Only" })
        return
      }
      const updateResult = await donationLists.updateOne(filter, updateDoc, options)
      res.status(200).json({
        ok: true,
        data: updateResult
      })
    })
    // delete any donation
    app.delete('/donation/delete/:id', verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await donationLists.deleteOne(query)
      res.status(200).json({
        ok: true,
        data: result
      })
    })
    // donate by donors 
    app.post('/donate', verifyJwt, async (req, res) => {
      const body = req.body;
      if (body?.donorEmail !== req.decoded.email) {
        res.send({
          ok: false,
          message: "You're not an authorized user"
        })
        return
      }
      const query = { _id: ObjectId(body.donationId) }
      const filter = { _id: ObjectId(body.donationId) }
      const getDonations = await donationLists.findOne(query)
      const previousFund = getDonations?.fundCollected;
      const newDonation = body.donatedAmount;
      let lastFund;
      if (typeof (previousFund) !== 'number') {
        lastFund = parseFloat(previousFund)
      } else {
        lastFund = previousFund
      }
      const newAmount = lastFund + newDonation;
      const updateDoc = {
        $set: {
          fundCollected: newAmount
        },
      };
      const options = { upsert: true };
      const updateAmount = await donationLists.updateOne(filter, updateDoc, options)
      if (updateAmount?.acknowledged) {
        const result = await donorLists.insertOne(body)
        res.status(200).json({
          ok: true,
          data: result
        })
      }
    })
    app.get('/userDonation', verifyJwt, async (req, res) => {
      const query = { donorEmail: req.decoded.email }
      const result = await donorLists.find(query).toArray()
      res.status(200).json({
        ok: true,
        data: result
      })
    })
    // get all report 
    app.get('/reports', verifyJwt, async(req,res) => {
      const userQuery = {email: req.decoded.email}
      const getUser = await donationUsers.findOne(userQuery)
      if(getUser?.role !== "admin"){
        res.send({
          ok: false,
          message: "Access Restricted: Admin Only"
        })
        return
      }
      let reportQuery = {}
      if(req.query.sortingName !== "all"){
        reportQuery = {donationCategory : req.query.sortingName}
      }

      const result = await donorLists.find(reportQuery).toArray()

      if(result){
        return res.status(200).json({
          ok: true,
          data: result
        })
      }
    })

  //  app.patch('/update/all',async(req,res) =>{

  //     const filter = { donationId: "64b2fe216ccb5dbdc3802b61"}
  //     const options = { upsert: true };
  //     const updateDoc = {
  //       $set: {
  //         donationCategory:"Shelter"
  //       },
  //     };
  //    const result  = await donorLists.updateMany(filter,updateDoc)
  //     console.log(result)
  //  })

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
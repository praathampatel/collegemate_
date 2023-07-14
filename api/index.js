require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const salt = bcrypt.genSaltSync(10);
const jwt = require('jsonwebtoken');
const secret = 'akjfhasdnkfcnyiuwenaicslfcn';
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({dest:'uploads/'});
const fs = require('fs');
const path = require('path');
const Post = require('./models/Post');
app.use(cors({ credentials: true, origin: 'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads',express.static('uploads'));
const mongoUrl = process.env.MONGO_URL;
console.log(mongoUrl);
mongoose.connect(mongoUrl);
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const newUser = new User({ username, password: bcrypt.hashSync(password, salt) });
    await newUser.save();
    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if(passOk)
  {
    jwt.sign({username,id:userDoc._id},secret,{},(err,token)=>{
      if(err)
      {
        throw err;
      }
      else
      {
        res.cookie('token',token).json({
          id:userDoc._id,
          username
        });
      }
    })
  }
  else
  {
    res.status(400).json({ error: 'Invalid username or password' });
  }
});



app.get('/profile', (req,res) => {
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, (err,info) => {
    if (err) throw err;
    res.json(info);
  });
});



app.post('/logout',(req,res)=>{
  res.cookie('token','').json('ok');
});


app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
  const {originalname,path} = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path+'.'+ext;
  fs.renameSync(path, newPath);

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover:newPath,
      author:info.id,
    });
    res.json(postDoc);
  });
});

app.put('/post',uploadMiddleware.single('file'),async(req,res)=>{
  let newPath = null;
  if(req.file)
  {
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path+'.'+ext;
    fs.renameSync(path, newPath);
  }
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if(!isAuthor)
    {
      return res.status(403).json({error:'You are not the author of this post'});
    }
    postDoc.title = title;
    postDoc.summary = summary;
    postDoc.content = content;
    postDoc.cover = newPath ? newPath : postDoc.cover;
    await postDoc.save();
    res.json(postDoc);
  });
});


app.get('/post', async (req,res) => {
  res.json(
    await Post.find()
    .populate('author', ['username'])
    .sort({createdAt:-1})
    .limit(20)
    );
});

app.get('/post/:id', async (req,res) => {
  const {id} = req.params;
  const postDoc= await Post.findById(id).populate('author',['username']);
  res.json(postDoc);
});

app.listen(4000, () => console.log('Server started on port 4000'));
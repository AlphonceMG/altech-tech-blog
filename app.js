const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const argon2 = require('argon2');
const cookieParser = require('cookie-parser');

const homeStartingContent = 'Welcome to the ALTech blog! We are a tech company dedicated to providing cutting-edge solutions and innovations. Our team of experts is passionate about technology and committed to delivering exceptional products and services.';

const aboutContent = 'At ALTech, we strive to revolutionize the tech industry. With a strong focus on research and development, we aim to create groundbreaking solutions that address the challenges of today and shape the future. Our team consists of highly skilled engineers, designers, and visionaries who work tirelessly to push the boundaries of what\'s possible.';

const contactContent = 'We\'d love to hear from you! Whether you have questions, feedback, or partnership inquiries, feel free to get in touch with us. Our dedicated support team is available to assist you and provide the information you need. Reach out to us via phone, email, or by filling out the contact form below.';

const app = express();

// Middleware
app.use(cookieParser()); // Parse cookies
app.use(
    session({
        secret: process.env.SECRET_KEY, // Secret key used to sign the session ID cookie
        resave: false, // Do not save the session if it hasn't been modified
        saveUninitialized: false, // Do not save uninitialized sessions
        store: new MongoStore({ mongooseConnection: mongoose.connection }), // Store sessions in MongoDB
        cookie: {
            maxAge: 60 * 60 * 1000, // Set the session cookie to expire after 1 hour
        },
    })
);

app.set('view engine', 'ejs'); // Set EJS as the view engine
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(express.static('public')); // Serve static files from the "public" directory

mongoose.connect('mongodb://localhost:27017/blogDB', { useNewUrlParser: true, useUnifiedTopology: true }); // Connect to MongoDB

// Define the Mongoose schemas for sessions, users, and posts
const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
    },
    data: {
        type: Object,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    isAdmin: Boolean
});

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

// Create Mongoose models for sessions, users, and posts
const Session = mongoose.model('Session', sessionSchema);
const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Home route
app.get('/', function(req, res) {
    // Fetch all posts from the database
    Post.find({})
        .then((posts) => {
            // Render the home page with the fetched posts
            res.render('home', {
                startingContent: homeStartingContent,
                posts: posts,
            });
        })
        .catch((error) => {
            console.error('Error finding posts:', error);
            res.status(500).send('Error finding posts');
        });
});

// Register, login, admin, compose, posts, about, contact routes (remaining code)

app.listen(3000, function() {
    console.log('Server started on port 3000'); // Start the server on port 3000
});
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

// Create Mongoose schema and models for sessions, users, and posts

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

// Register route
app.route('/register')
    .get(function(req, res) {
        // Render the registration form
        res.render('register');
    })
    .post(async function(req, res) {
        try {
            // Generate a salt and hash the user's password using argon2
            const salt = await argon2.generateSalt();
            const hashedPassword = await argon2.hash(req.body.password, { salt });

            // Create a new user with the provided email, hashed password, and admin status
            const newUser = new User({
                email: req.body.email,
                password: hashedPassword,
                isAdmin: req.body.isAdmin === 'true',
            });

            // Save the new user to the database
            await newUser.save();
            res.redirect('/login'); // Redirect to the login page
        } catch (err) {
            console.log(err);
            res.redirect('/register'); // Redirect back to the registration page on error
        }
    });

// Login route
app.route('/login')
    .get(function(req, res) {
        // Render the login form
        res.render('login');
    })
    .post(function(req, res) {
        const email = req.body.email;
        const password = req.body.password;

        // Find the user with the provided email in the database
        User.findOne({ email: email })
            .then((foundUser) => {
                if (foundUser) {
                    // Verify the password using argon2.verify
                    argon2.verify(foundUser.password, password)
                        .then((match) => {
                            if (match) {
                                req.session.user = foundUser; // Set session user
                                res.redirect('/'); // Redirect to the home page
                            } else {
                                res.redirect('/login'); // Redirect back to the login page if the password is incorrect
                            }
                        })
                        .catch((err) => {
                            console.log(err);
                            res.redirect('/login'); // Redirect back to the login page on error
                        });
                } else {
                    res.redirect('/login'); // Redirect back to the login page if the user is not found
                }
            })
            .catch((err) => {
                console.log(err);
                res.redirect('/login'); // Redirect back to the login page on error
            });
    });

// Admin route
app.get('/admin', function(req, res) {
    // Check if the user is authenticated and is an admin
    if (req.session.user && req.session.user.isAdmin) {
        res.render('admin'); // Render the admin page
    } else {
        res.redirect('/login'); // Redirect to the login page if not authenticated or not an admin
    }
});

// Compose route
app.route('/compose')
    .get(function(req, res) {
        // Check if the user is authenticated
        if (req.session.user) {
            res.render('compose'); // Render the compose page
        } else {
            res.redirect('/login'); // Redirect to the login page if not authenticated
        }
    })
    .post(function(req, res) {
        // Check if the user is authenticated
        if (req.session.user) {
            // Create a new post with the provided title, content, and author (current user)
            const post = new Post({
                title: req.body.postTitle,
                content: req.body.postBody,
                author: req.session.user._id,
            });

            // Save the new post to the database
            post.save(function(err) {
                if (!err) {
                    res.redirect('/'); // Redirect to the home page after saving the post
                }
            });
        } else {
            res.redirect('/login'); // Redirect to the login page if not authenticated
        }
    });

// Single post route
app.get('/posts/:postId', function(req, res) {
    const requestedPostId = req.params.postId;

    // Find the post with the provided ID in the database
    Post.findOne({ _id: requestedPostId }, function(err, post) {
        res.render('post', {
            title: post.title,
            content: post.content,
        }); // Render the post page with the fetched post
    });
});

// Edit post route
app.get('/posts/:postId/edit', function(req, res) {
    const requestedPostId = req.params.postId;

    // Check if the user is authenticated and is the author of the post
    if (req.session.user) {
        Post.findOne({ _id: requestedPostId, author: req.session.user._id }, function(err, post) {
            if (err || !post) {
                res.redirect('/'); // Redirect to the home page if the post is not found or the user is not the author
            } else {
                res.render('edit', {
                    post: post,
                }); // Render the edit page with the post data
            }
        });
    } else {
        res.redirect('/login'); // Redirect to the login page if not authenticated
    }
});

// Update post route
app.post('/posts/:postId/edit', function(req, res) {
    const requestedPostId = req.params.postId;
    const updatedTitle = req.body.postTitle;
    const updatedContent = req.body.postBody;

    // Check if the user is authenticated and is the author of the post
    if (req.session.user) {
        // Find the post by ID and update the title and content
        Post.findOneAndUpdate({ _id: requestedPostId, author: req.session.user._id }, { $set: { title: updatedTitle, content: updatedContent } },
            function(err) {
                if (!err) {
                    res.redirect('/'); // Redirect to the home page after updating the post
                }
            }
        );
    } else {
        res.redirect('/login'); // Redirect to the login page if not authenticated
    }
});

// Delete post route
app.post('/posts/:postId/delete', function(req, res) {
    const requestedPostId = req.params.postId;

    // Check if the user is authenticated and is the author of the post
    if (req.session.user) {
        // Find the post by ID and delete it
        Post.findOneAndDelete({ _id: requestedPostId, author: req.session.user._id }, function(err) {
            if (!err) {
                res.redirect('/'); // Redirect to the home page after deleting the post
            }
        });
    } else {
        res.redirect('/login'); // Redirect to the login page if not authenticated
    }
});

// About route
app.get('/about', function(req, res) {
    res.render('about', { aboutContent: aboutContent }); // Render the about page with the aboutContent
});

// Contact route
app.get('/contact', function(req, res) {
    res.render('contact', { contactContent: contactContent }); // Render the contact page with the contactContent
});

app.listen(3000, function() {
    console.log('Server started on port 3000'); // Start the server on port 3000
});
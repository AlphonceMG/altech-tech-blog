const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const session = require('express-session');
const argon2 = require("argon2");

const homeStartingContent = "Welcome to the ALTech blog! We are a tech company dedicated to providing cutting-edge solutions and innovations. Our team of experts is passionate about technology and committed to delivering exceptional products and services.";

const aboutContent = "At ALTech, we strive to revolutionize the tech industry. With a strong focus on research and development, we aim to create groundbreaking solutions that address the challenges of today and shape the future. Our team consists of highly skilled engineers, designers, and visionaries who work tirelessly to push the boundaries of what's possible.";

const contactContent = "We'd love to hear from you! Whether you have questions, feedback, or partnership inquiries, feel free to get in touch with us. Our dedicated support team is available to assist you and provide the information you need. Reach out to us via phone, email, or by filling out the contact form below.";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose.connect("mongodb://localhost:27017/blogDB", { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    isAdmin: { type: Boolean, default: false }
});


const User = mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
});

const Post = mongoose.model("Post", postSchema);

app.get("/", function(req, res) {
    Post.find({})
        .then(posts => {
            res.render("home", {
                startingContent: homeStartingContent,
                posts: posts
            });
        })
        .catch(error => {
            console.error('Error finding posts:', error);
            res.status(500).send("Error finding posts");
        });
});


app.route("/register")
    .get(function(req, res) {
        res.render("register");
    })
    .post(async function(req, res) {
        try {
            const salt = await argon2.generateSalt();
            const hashedPassword = await argon2.hash(req.body.password, { salt });
            const newUser = new User({
                email: req.body.email,
                password: hashedPassword,
                isAdmin: req.body.isAdmin === "true"
            });

            await newUser.save();
            res.redirect("/login");
        } catch (err) {
            console.log(err);
            res.redirect("/register");
        }
    });



app.route("/login")
    .get(function(req, res) {
        res.render("login");
    })
    .post(function(req, res) {
        const username = req.body.username;
        const password = req.body.password;

        User.findOne({ username: username })
            .then(foundUser => {
                if (foundUser) {
                    // Verify the password using argon2.verify
                    argon2.verify(foundUser.password, password)
                        .then(match => {
                            if (match) {
                                res.redirect("/");
                            } else {
                                res.redirect("/login");
                            }
                        })
                        .catch(err => {
                            console.log(err);
                            res.redirect("/login");
                        });
                } else {
                    res.redirect("/login");
                }
            })
            .catch(err => {
                console.log(err);
                res.redirect("/login");
            });
    });
app.get("/admin", function(req, res) {
    // Check if the user is authenticated and is an admin
    if (req.isAuthenticated() && req.user.isAdmin) {
        res.render("admin");
    } else {
        res.redirect("/login");
    }
});

app.route("/compose")
    .get(function(req, res) {
        // Check if the user is authenticated
        if (req.isAuthenticated()) {
            res.render("compose");
        } else {
            res.redirect("/login");
        }
    })
    .post(function(req, res) {
        // Check if the user is authenticated
        if (req.isAuthenticated()) {
            const post = new Post({
                title: req.body.postTitle,
                content: req.body.postBody,
                author: req.user._id // Set the author field to the current user's ID
            });

            post.save(function(err) {
                if (!err) {
                    res.redirect("/");
                }
            });
        } else {
            res.redirect("/login");
        }
    });

app.get("/posts/:postId", function(req, res) {
    const requestedPostId = req.params.postId;

    Post.findOne({ _id: requestedPostId }, function(err, post) {
        res.render("post", {
            title: post.title,
            content: post.content
        });
    });
}); // Add route for editing a post
app.get("/posts/:postId/edit", function(req, res) {
    const requestedPostId = req.params.postId;

    Post.findOne({ _id: requestedPostId, author: req.user._id }, function(err, post) {
        if (err || !post) {
            res.redirect("/");
        } else {
            res.render("edit", {
                post: post
            });
        }
    });
});

// Add route for updating a post
app.post("/posts/:postId/edit", function(req, res) {
    const requestedPostId = req.params.postId;
    const updatedTitle = req.body.postTitle;
    const updatedContent = req.body.postBody;

    Post.findOneAndUpdate({ _id: requestedPostId, author: req.user._id }, { $set: { title: updatedTitle, content: updatedContent } },
        function(err) {
            if (!err) {
                res.redirect("/");
            }
        }
    );
});

// Add route for deleting a post
app.post("/posts/:postId/delete", function(req, res) {
    const requestedPostId = req.params.postId;

    Post.findOneAndDelete({ _id: requestedPostId, author: req.user._id }, function(err) {
        if (!err) {
            res.redirect("/");
        }
    });
});


app.get("/about", function(req, res) {
    res.render("about", { aboutContent: aboutContent });
});

app.get("/contact", function(req, res) {
    res.render("contact", { contactContent: contactContent });
});

app.listen(3000, function() {
    console.log("Server started on port 3000");
});
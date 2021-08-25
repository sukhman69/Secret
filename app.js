//jshint esversion:6

require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({   //setup session
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize()); //use passport to initialize passport package
app.use(passport.session()); //use passport to deal with our session

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});


userSchema.plugin(passportLocalMongoose);// we're gonna use passportLocalMongoose to salt and hash our passoword and to save our users into our MongoDB database.
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
});


// initiate authentication with google
app.get('/auth/google', passport.authenticate('google', {scope: ["profile"]})); // use passport to authenticate our user using google strategy
    // the second parameter we tell google what we want if the users profile which includes their email and their user id

app.get("/auth/google/secrets", passport.authenticate('google', {failureRedirect: '/login'}), function(req, res){ // if authentication fails redirects to login page
    //Successful authentication redirect home.
    res.redirect("/secrets");
})

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register" ,function(req, res){
    res.render("register");
});

app.get("/secrets", function(req, res){
    // looks through all of our users collection 
    // look through secret fields
    // picks the user where the secret field is not equal to null
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
        if(err){
            console.log(err);
        }else{
            if(foundUsers){
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        }
    });
});

app.get("/submit", function(req, res){
    if(req.isAuthenticated()){  //if user is authenticated
        res.render("submit");
    }else{  // if not then force them to login first
        res.redirect("/login");
    }
});

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret; // tap in to the secret message from in the ejs file by the element name.

    console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
        if(err){
            console.log(err);
        }else{
            if(foundUser) // if user exist
            foundUser.secret = submittedSecret; // save the secret in the variable
            foundUser.save(function(){
                res.redirect("/secrets");
            })
        }
        
    })
})

app.get("/logout",  function(req, res){
    req.logout(); // deauthenticate the user logout the user and will delete cookie
    res.redirect("/"); // after logging out go to homepage  
})

app.post("/register", function(req, res){
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.render("/register");
        }else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            }); //sends cookie
        }
    });
});

app.post("/login", function(req, res){
    const user= new User({
        username: req.body.username,
        passowrd: req.body.password
    });

    req.login(user, function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req, res, function(){    // authenticate the user
                res.redirect("/secrets");
            }); //sends cookie
        }
    });
});




app.listen("3000", function(req, res){
    console.log("Server running on Port 3000.");
});
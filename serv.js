let DBoptions = {
  server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } },
  replset: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }
};

const fs = require('fs-extra')
const colors = require('colors')
const express = require('express')
const cookieParser = require('cookie-parser')
const randomstring = require("randomstring");
const sha256 = require('sha256')
const bodyParser = require('body-parser')
const shell = require('shelljs')
const watch = require('node-watch')
const sass = require('npm-sass')
const fetch = require('node-fetch')
const request = require('request')
const ejs = require('ejs')
const path = require('path')
const CryptoJS = require('crypto-js')
const MongoClient = require('mongodb').MongoClient

// some config shilz
const app = express()
const dburl = "mongodb://localhost:27017/campingsite";
const port = 6060;

// check if mongodb works
MongoClient.connect(dburl, function(err, db) {
  if (err) {
    console.log(colors.red.bold('no connection to mongodb database'));
    db.close();
    process.exit()
  } else {
    db.createCollection("customers", function(err, res) {
      if (err) {
        console.log(colors.red.bold('Cant create collection'));
        db.close();
        process.exit()
      } else {
        db.createCollection("users", function(err, res) {
          if (err) {
            console.log(colors.red.bold('Cant create collection'));
          } else {
            console.log(colors.green("Connected to database!"));
          }
        });
      }
    });
  }
// some more config
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/www'));
app.use(express.static('./www/'))
app.use('/node', express.static('./node_modules/'))
app.use(bodyParser.json(true));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser(randomstring.generate(200)))

// index
app.get('/', function(req, res){
  res.render('index.ejs', {
    page: 'home'
  });
});

// info page
app.get('/info', function(req, res){
  res.render('index.ejs', {
    page: 'info'
  });
});

// activitijten page
app.get('/activitijten', function(req, res){
  res.render('index.ejs', {
    page: 'activitijten'
  });
});

// booking page
app.get('/booking', function(req, res){
  res.render('index.ejs', {
    page: 'booking'
  });
});

// login page
app.get('/login',function(req,res) {
  let username = req.signedCookies.username;
  if (username) {
    res.redirect('/admin');
  } else {
    res.render('index.ejs', {
      page: 'login'
    });
  }
})

// admin page
app.get('/admin',function(req,res) {
  let username = req.signedCookies.username;
  if (username) {
    res.render('index.ejs', {
      page: 'admin'
    })
  } else {
    res.clearCookie('username');
    res.redirect('/login');
  }
})

// send login data to the user
app.post('/getsalt', function(req,res) {
  let b = req.body
  if (b.username) {
    db.collection("users").find({username: {$in:[b.username]}}).toArray(function(err, result) {
      if (err || !result[0]) {
        res.json({
          status: false
        })
      } else {
        res.json({
          status: true,
          salt: result[0].salt,
          key: '' + CryptoJS.AES.encrypt(result[0].key, result[0].password)
        })
      }
    })
  }
})

// test if the user can Login
app.post('/testlogin', function(req,res) {
  let b = req.body
  if (b.username && b.testkey) {
    db.collection("users").find({username: {$in:[b.username]}}).toArray(function(err, result) {
      console.log(err);
      if (err || !result[0] || b.testkey != CryptoJS.SHA256(CryptoJS.SHA256(result[0].key).toString()).toString()) {
        res.json({
          status: false
        })
      } else {
        res.cookie('username', b.username, { signed: true });
        res.json({
          status: true
        })
      }
    })
  } else {
    res.json({
      status: false
    })
  }
})

// remove login cookies
app.post('/deletecookies',function(req,res) {
  res.clearCookie('username');
  res.json({status: true})
})

// booking
app.post('/bookingdata',function(req,res) {
  let username = req.signedCookies.username;
  if (username) {
    GetUserKey(username, function(keydata) {
      db.collection("customers").find().toArray(function(err, result) {
        if (err || !keydata.status) {
          res.json({
            status: false
          })
        } else {
          res.json({
            status: true,
            data: encrypt(result, keydata.data)
          })
        }
      })
    })
  } else {
    res.json({
      status: false
    })
  }
})

// book a place
app.post('/sendmessagedetails',function(req,res) {
  let b = req.body
  if (b.form &&
  b.form.naam &&
  b.form.achternaam &&
  b.form.tel &&
  b.form.email &&
  b.bookinginfo &&
  b.bookinginfo.StandingPlace &&
  b.bookinginfo.FromDate &&
  b.bookinginfo.ToDate) {
    db.collection("customers").insertOne({
      name: {
        first: b.form.naam,
        last: b.form.achternaam
      },
      tel: b.form.tel,
      email: b.form.email,
      booking: {
        from: b.bookinginfo.FromDate,
        to: b.bookinginfo.ToDate,
        place: b.bookinginfo.StandingPlace
      },
      NumberDateFrom: timetonumbers(b.bookinginfo.FromDate),
      NumberDateTo: timetonumbers(b.bookinginfo.ToDate)
    }, function(err, ress) {
      if (err) {
        res.json({
          status: false,
          why: 'db-err'
        })
      } else {
        res.json({
          status: true
        })
      }
    })
  } else {
    res.json({
      status: false,
      why: 'not-all-data'
    })
  }
})

// 404 page
app.get('*', function(req, res){
  res.render('404.ejs');
});

// start webserver
app.listen(port);
console.log(colors.green('Started server on port:' + port));

// sass compiler
watch('./www/css/', { recursive: true }, function(evt, name) {
  if (evt == 'update' && name.endsWith('.sass')) {
    sass('./' + name, { outputStyle: 'compressed' },function (err, result) {
      if (!err) {
        console.log('compiled sass file: ' + result.stats.entry);
        fs.writeFile(result.stats.entry.replace('.sass','.css'),result.css)
      }
    });
  }
});
fs.readdir('./www/css/', function(err, items) {
  for (let i = 0; i < items.length; i++) {
    let name = 'www/css/' + items[i]
    if (name.endsWith('.sass')) {
      sass('./' + name, { outputStyle: 'compressed' }, function (err, result) {
        if (!err) {
          console.log('compiled sass file: ' + result.stats.entry);
          fs.writeFile(result.stats.entry.replace('.sass','.css'),result.css)
        }
      });
    }
  }
});

function GetUserKey(username, callback) {
  db.collection("users").find({username: {$in:[username]}}).toArray(function(err, result) {
    if (err || !result[0]) {
      callback({status: false})
    } else {
      callback({status: true, data: result[0].key})
    }
  })
}

function encrypt(data,key) {
  if (typeof(data) == 'object') {
    return(CryptoJS.AES.encrypt(JSON.stringify(data), key).toString())
  } else {
    return(CryptoJS.AES.encrypt(data, key).toString())
  }
}

function timetonumbers(time) {
  let fulldate = new Date(time)
  let month = (((fulldate.getMonth() + 1) + '').length == 1) ? '0' + (fulldate.getMonth() + 1) : (fulldate.getMonth() + 1) + ''
  let day = (((fulldate.getDate()) + '').length == 1) ? '0' + fulldate.getDate() : fulldate.getDate() + ''
  let year = fulldate.getFullYear() + ''
  return (Number(year + month + day))
}
})

let GlobalPrices = {
  dog: 10,
  day: 7.50,
  tent: 2
}

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
const moment = require('moment')
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
    page: 'home',
    prijzen: JSON.stringify(GlobalPrices)
  });
});

// info page
app.get('/info', function(req, res){
  res.render('index.ejs', {
    page: 'info',
    prijzen: JSON.stringify(GlobalPrices)
  });
});

// activitijten page
app.get('/activitijten', function(req, res){
  res.render('index.ejs', {
    page: 'activitijten',
    prijzen: JSON.stringify(GlobalPrices)
  });
});

// booking page
app.get('/booking', function(req, res){
  res.render('index.ejs', {
    page: 'booking',
    prijzen: JSON.stringify(GlobalPrices)
  });
});

// Prices page
app.get('/prijzen', function(req, res) {
  res.render('index.ejs', {
    page: 'prijzen',
    prijzen: JSON.stringify(GlobalPrices)
  });
})


// login page
app.get('/login',function(req,res) {
  let username = req.signedCookies.username;
  if (username) {
    res.redirect('/admin');
  } else {
    res.render('index.ejs', {
      page: 'login',
      prijzen: JSON.stringify(GlobalPrices)
    });
  }
})

// admin page
app.get('/admin',function(req,res) {
  let username = req.signedCookies.username;
  if (username) {
    res.render('index.ejs', {
      page: 'admin',
      prijzen: JSON.stringify(GlobalPrices)
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
  if (typeof(b.form) == 'object' &&
  typeof(b.form.naam) == 'string' &&
  typeof(b.form.achternaam) == 'string' &&
  typeof(b.form.tel) == 'string' &&
  typeof(b.form.email) == 'string' &&
  typeof(b.form.dog) == 'boolean' &&
  typeof(b.form.tent) == 'boolean' &&
  typeof(b.bookinginfo) == 'object' &&
  typeof(b.bookinginfo.StandingPlace) == 'number' &&
  typeof(b.bookinginfo.FromDate) == 'string' &&
  typeof(b.bookinginfo.ToDate) == 'string' &&
  moment(b.bookinginfo.FromDate, "MM/DD/YYYY", true).isValid() &&
  moment(b.bookinginfo.ToDate, "MM/DD/YYYY", true).isValid()) {
    let days = (Math.floor(( Date.parse(b.bookinginfo.ToDate) - Date.parse(b.bookinginfo.FromDate) ) / 86400000) + 1)
    let priceperday = days * GlobalPrices.day
    let dog = (b.form.dog) ? GlobalPrices.dog : 0
    let tent = (b.form.tent) ? GlobalPrices.tent * days : 0
    let totalprice = (priceperday + dog + tent).toFixed(2)
    db.collection("customers").insertOne({
      name: {
        first: b.form.naam,
        last: b.form.achternaam
      },
      totalprice: totalprice,
      tel: b.form.tel,
      email: b.form.email,
      booking: {
        from: b.bookinginfo.FromDate,
        to: b.bookinginfo.ToDate,
        place: b.bookinginfo.StandingPlace,
        dog: b.form.dog,
        tent: b.form.tent
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

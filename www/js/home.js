let GlobalPrices = window.GlobalPrices

function daysInMonth(month, year){
  return month == 2 ? (year %4 ? 28 : (year %100 ? 29 : (year %400 ? 28 :29))) : ((month -1) %7% 2 ? 30 :31);
}

const today = new Date()

Vue.component('date-picker', {
  props: ['type','submittext','meta','blockedfrom'],
  template: '#calender',
  data: function() {
    return ({
      today: {
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      },
      block: [],
      blockto: {
        day: 9999,
        month: 9999,
        year: 9999
      },
      blockfrom: {
        day: 0,
        month: 0,
        year: 0
      },
      selected: {
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear()
      },
      months: [1,2,3,4,5,6,7,8,9,10,11,12],
      datum: ''
    })
  },
  methods: {
    daysInMonth: function() {
      let vm = this;
      return(daysInMonth(vm.selected.month, vm.selected.year))
    },
    makdedate: function() {
      return (this.selected.day + '-' + this.selected.month + '-' + this.selected.year)
    },
    getDay: function(day) {
      let vm = this;
      let testdate = new Date(vm.selected.month + '/' + day + '/' + vm.selected.year).getDay()
      return testdate;
    },
    updatedate: function() {
      this.datum = this.selected.month + '/' + this.selected.day + '/' + this.selected.year
    },
    creation: function() {
      if (this.blockedfrom) {
        let blockeddate = new Date(this.blockedfrom)
        this.blockfrom = {
          day: blockeddate.getDate(),
          month: blockeddate.getMonth(),
          year: blockeddate.getFullYear()
        }
      }
    }
  },
  watch: {
    blockedfrom: function() {
      this.creation()
    },
    'selected.day': function() {
      this.updatedate()
    },
    'selected.month': function() {
      this.updatedate()
    },
    'selected.year': function() {
      this.updatedate()
    },
    datum: {
    	handler: function() {
      	this.$emit('senddatum', {
          datum: this.datum,
          from: this.meta || ''
        });
      },
    	deep: true
    }
  },
  created: function() {
    this.creation()
  }
})

let home = new Vue({
  el: '.header',
  data: {
    text: 'Camping site'
  }
})

let links = new Vue({
  el: '.side-links',
  data: {
    currentsite: location.pathname,
    links: [
      {
        href: '/',
        icon: 'home',
        title: 'Home'
      },
      {
        href: '/booking',
        icon: 'view_agenda',
        title: 'Booken'
      },
      {
        href: '/info',
        icon: 'info',
        title: 'Camping info'
      },
      {
        href: '/activitijten',
        icon: 'local_activity',
        title: 'Activitijten'
      },
      {
        href: '/prijzen',
        icon: 'attach_money',
        title: 'prijzen'
      }
    ]
  }
})

if (document.querySelector(".login-block")) {
  let login = new Vue({
    el: '.login-block',
    data: {
      password: '',
      username: '',
      fixedUsername: ''
    },
    methods: {
      getsalt: function(callback) {
        let vm = this
        fetch('/getsalt', {
          method: "post",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache': 'no-cache'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            username: vm.username
          })
        }).then(function(response) {
          return response.json();
        }).then(function(json) {
          callback(json);
        }).catch(function(error) {
          console.log('Request failed', error)
        });
      },
      givemeacookie: function(key) {
        let vm = this;
        let hashedKey = CryptoJS.SHA256(CryptoJS.SHA256(key).toString()).toString()
        fetch('/testlogin', {
          method: "post",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache': 'no-cache'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            username: vm.fixedUsername,
            testkey: hashedKey
          })
        }).then(function(response) {
          return response.json();
        }).then(function(json) {
          if (json && json.status) {
            Lockr.set('username', vm.fixedUsername)
            Lockr.set('key', key)
            setTimeout(function () {
              location.href = location.origin + '/admin'
            }, 100);
          }
        }).catch(function(error) {
          console.log('Request failed', error)
        });
      },
      trylogin: function() {
        let vm = this;
        vm.fixedUsername = [vm.username][0];
        vm.getsalt(function(data) {
          if (data.status && data.salt && data.key) {
            try {
              let password = CryptoJS.SHA256(data.salt + vm.password).toString()
              let key = CryptoJS.AES.decrypt(data.key, password).toString(CryptoJS.enc.Utf8)
              vm.givemeacookie(key)
            } catch (e) {
              console.log('wrong password');
            }
          }
        })
      }
    }
  })
  // console.log(CryptoJS.SHA256('hello world').toString());
  // console.log(CryptoJS.AES.encrypt('Message', 'Secret Passphrase').toString());
}

if (document.querySelector('.prijzen-block')) {
  let prijzen = new Vue({
    el: '.prijzen-block',
    data: {
      prices: GlobalPrices
    }
  })
}

if (document.querySelector(".admin-pannel")) {
  let AdminPannel = new Vue({
    el: '.admin-pannel',
    data: {
      tab: 'bookingen',
      key: undefined,
      username: undefined,
      bookings: [],
      detialsopen: undefined
    },
    methods: {
      decrypt: function(data) {
        if (IsJsonString(data)) {
          return(CryptoJS.AES.decrypt(JSON.parse(data), this.key).toString(CryptoJS.enc.Utf8))
        } else {
          return(CryptoJS.AES.decrypt(data, this.key).toString(CryptoJS.enc.Utf8))
        }
      },
      LoadBookingsData: function() {
        let vm = this
        fetch('/bookingdata', {
          method: "post",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache': 'no-cache'
          },
          credentials: 'same-origin'
        }).then(function(response) {
          return response.json();
        }).then(function(json) {
          if (json.status) {
            let output = JSON.parse(vm.decrypt(json.data))
            vm.bookings = output
          }
        }).catch(function(error) {
          console.log('Request failed', error)
        });
      }
    },
    created: function() {
      let vm = this
      vm.key = Lockr.get('key')
      vm.username = Lockr.get('username')
      if (vm.username && vm.key) {
        this.LoadBookingsData()
      } else {
        Lockr.rm('username')
        Lockr.rm('key')
        fetch('/deletecookies', {
          method: "post",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache': 'no-cache'
          },
          credentials: 'same-origin'
        }).then(function(response) {
          return response.json();
        }).then(function(json) {
          location.reload()
        }).catch(function(error) {
          console.log('Request failed', error)
        });
      }
    }
  })
}

if (document.querySelector(".booking")) {
  let booking = new Vue({
    el: '.booking',
    data: {
      today: {
        day: today.getDate(),
        month: today.getMonth(),
        year: today.getFullYear()
      },
      DatePickerBlockedFrom: (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear(),
      TotalPlaces: 7,
      BookingProcess: 1,
      totalprice: 0,
      everytingdune: false,
      prices: GlobalPrices,
      bookinginf: {
        FromDate: '',
        ToDate: '',
        StandingPlace: '',
        StandingPlaceHover: ''
      },
      form: {
        dog: false,
        tent: false,
        naam: '',
        achternaam: '',
        tel: '',
        email: ''
      }
    },
    methods: {
      fulldate: function(month,day,year) {
        month = month + ''
        day = day + ''
        if (month.length == 1) {
          month = 0 + month
        }
        if (day.length == 1) {
          day = 0 + day
        }
        let fulldate = year + month + day
        return (Number(fulldate))
      },
      datepicker: function(e) {
        if (e.from == 'from') {
          let date = new Date(e.datum)
          if (this.fulldate(this.today.month,this.today.day - 1,this.today.year) < this.fulldate(date.getMonth() + 1,date.getDate(),date.getFullYear())) {
            this.DatePickerBlockedFrom = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear()
          }
          this.bookinginf.FromDate = e.datum
        } else if (e.from == 'to') {
          this.bookinginf.ToDate = e.datum
        }
      }
    },
    watch: {
      BookingProcess: function(n) {
        let vm = this;
        if (n == 4) {
          let days = (Math.floor(( Date.parse(vm.bookinginf.ToDate) - Date.parse(vm.bookinginf.FromDate) ) / 86400000) + 1)
          let priceperday = days * vm.prices.day
          let dog = (vm.form.dog) ? vm.prices.dog : 0
          let tent = (vm.form.tent) ? vm.prices.tent * days : 0
          vm.totalprice = (priceperday + dog + tent).toFixed(2)
        }
        if (n == 1 || n == 2 || n == 3 || n == 4 ) {
          document.querySelector('.booking .step' + n).scrollIntoView({ behavior: 'smooth' })
        } else if (n == 5) {
          fetch('/sendmessagedetails', {
            method: "post",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache': 'no-cache'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
              form: vm.form,
              bookinginfo: vm.bookinginf
            })
          }).then(function(response) {
            return response.json();
          })
          .then(function(json) {
            if (json && json.status) {
              vm.everytingdune = true
            }
          })
          .catch(function(error) {
            console.log('Request failed', error)
          });
        }
      }
    },
    created: function() {
      let startdate = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear()
      this.bookinginf.FromDate = startdate
      this.bookinginf.ToDate = startdate
    }
  })
}

function IsJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

function timetonumbers(time) {
  let fulldate = new Date(time)
  let month = (((fulldate.getMonth() + 1) + '').length == 1) ? '0' + (fulldate.getMonth() + 1) : (fulldate.getMonth() + 1) + ''
  let day = (((fulldate.getDate()) + '').length == 1) ? '0' + fulldate.getDate() : fulldate.getDate() + ''
  let year = fulldate.getFullYear() + ''
  return (Number(year + month + day))
}

var banks = window.banksList;

var services = window.services;
var templates = {};
var responseComponents = {};

/**
 * Util methods start
 */
// forEach method, could be shipped as part of an Object Literal/Module
var forEach = function(array, callback, scope) {
  for (var i = 0; i < array.length; i++) {
    callback.call(scope, i, array[i]); // passes back stuff we need
  }
};

String.prototype.paddingLeft = function(paddingValue) {
  return String(paddingValue + this).slice(-paddingValue.length);
};

// Handle google-analytics blocks gracefully
if (!window.gtag) {
  window.gtag = function() {};
}

/**
 * Util methds end
 */

var mailUrlOpts = {
  mailto: {
    base: 'mailto:',
    subject: 'subject',
    cc: 'cc',
    bcc: 'bcc',
    body: 'body'
  },
  gmail: {
    base:
      'https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&source=mailto&to=',
    subject: 'su',
    cc: 'cc',
    bcc: 'bcc',
    body: 'body'
  },
  yahoo: {
    base: 'http://compose.mail.yahoo.com/?To=',
    subject: 'Subject',
    cc: 'Cc',
    bcc: 'Bcc',
    body: 'Body'
  }
};

var i18n = new VueI18n({
  locale: window.localStorage.getItem('locale') || 'en',
  messages: i18nMsgs,
  fallbackLocale: 'en'
});

forEach(document.querySelectorAll('script[id^=draft-notice-]'), function(
  index,
  el
) {
  var key = el.id.substr('draft-notice-'.length);
  templates[key] = el.innerText;

  responseComponents[key] = {
    props: ['addressee', 'address', 'body'],
    delimiters: ['((', '))'],
    template:
      '<textarea @copy="copied" cols="70" rows="10" name="content" id="response-content">' +
      templates[key] +
      '</textarea>',
    methods: {
      copied: function() {
        this.$emit('copied');
      }
    }
  };
});

var app = new Vue({
  i18n: i18n,
  delimiters: ['[{', '}]'],
  el: '#app',
  data: {
    // This is the list of all locales
    // we have loaded so far from a separate file
    // successfully
    localeLoaded: ['en'],
    banks: {},
    locale: 'en',
    serviceIndex: 'PAN',
    bankIFSC: 'ALLA',
    state: 'UP',
    constituencyCode: 'UP-18',
    mps: {
      'UP-18': {
        index: 18,
        name: 'Agra',
        state: 'UP',
        mp: 'Dr. Prof. Ram Shankar',
        email: 'office.mpagra@gmail.com'
      }
    },
    constituencies: [],
    campaign: 'mp',
    mailMethod: null,
    templates: {
      mp: '',
      bank: '',
      service: ''
    },
    showcopymsg: false
  },
  methods: {
    setLocale: function(val) {
      gtag('event', 'setLocale', {
        lang: val
      });
      this.$i18n.locale = val;
      window.localStorage.setItem('locale', val);

      if (this.localeLoaded.indexOf(val) === -1) {
        // Try to load the locale
        this.$http
          .get('/locales/' + val + '.json', { responseType: 'json' })
          .then(
            function(response) {
              this.$i18n.mergeLocaleMessage(val, response.body);
              this.localeLoaded.push[val];
              this.$forceUpdate();
            },
            function(response) {
              // If there is no such file
              this.localeLoaded.push[val];
            }
          );
      }
    },
    getMailUrl(opts, encodedBody) {
      return (
        opts.base +
        encodeURIComponent(this.email) +
        (opts.base === 'mailto:' ? '?' : '&') +
        opts.subject +
        '=' +
        encodeURIComponent(this.subject) +
        '&' +
        opts.cc +
        '=' +
        encodeURIComponent(this.cc) +
        '&' +
        opts.bcc +
        '=' +
        encodeURIComponent(this.bcc) +
        '&' +
        opts.body +
        '=' +
        encodedBody
      );
    },
    /**
     * On desktop, we show 3 buttons for gmail/yahoo/mailto
     * since desktops likely don't have a default email client
     *
     * On desktop (and IE Mobile) we
     * - try to copy the text automatically
     * - show a message asking user to paste it
     * - and then open the mail client to let the user paste it
     *
     * On mobiles: Just open the mailto link with complete body
     */

    sendGmail: function(event) {
      this.sendEmail('gmail', event);
    },

    sendYahoo: function(event) {
      this.sendEmail('yahoo', event);
    },

    sendMailto: function(event) {
      this.sendEmail('mailto', event);
    },

    sendEmail: function(method, event) {
      this.mailMethod = method;
      gtag('event', 'sendEmail', {
        email: this.email,
        subject: this.subject,
        bcc: this.bcc,
        cc: this.cc,
        mobile: this.mobile,
        method: method
      });

      var encodedBody = encodeURIComponent(this.response);

      if (this.mobile) {
        // Do nothing, already opened.
      } else {
        var responseEl = document.querySelector('#response-content');
        responseEl.select();
        try {
          var successful = document.execCommand('copy');
        } catch (err) {
          successful = false;
        }

        if (successful) {
          // TODO: i18n this.
          alert(this.$t('copied_msg'));
          return;
        } else if (!this.showcopymsg) {
          // Show message asking user to copy, and don't open the new tab
          this.showcopymsg = true;
          event.preventDefault();
        }
      }
    },
    // We are assuming here that the user has copied the whole
    // content of the textarea.
    // TODO: See if we can detect a partial copy and not open the mail link
    copied: function() {
      // Do nothing
    },
    tweet: function() {
      gtag('event', 'sendTweet');
    },
    updateConstituencies: function() {
      var self = this;

      this.constituencies = [];

      for (var code in this.mps) {
        if (code.substr(0, 2) === this.state) {
          this.constituencies.push(this.mps[code]);
        }
      }

      this.constituencyCode = this.constituencies[0].code;
    },
    initTemplates: function() {
      var self = this;
      self.templates = templates;
    },
    // We have 3 values for the campaign:
    // mp/service/bank
    setInitialCampaign: function() {
      // TODO: Use the page template to export a variable
      switch (window.location.pathname) {
        case '/mp/':
          this.campaign = 'mp';
          break;
        case '/service/':
          this.campaign = 'gov';
          break;
        case '/bank/':
          this.campaign = 'bank';
          break;
      }
    }
  },
  watch: {
    state: function(newState) {
      this.updateConstituencies();
    },
    locale: function(newLocale) {
      this.setLocale(newLocale);
    }
  },
  created: function() {
    var locale = (this.locale = window.localStorage.getItem('locale') ||
      (window.location.search.split('lang=')[1] + '').substr(0,2) ||
      window.navigator.languages
        .map(function(l) {
          return l.split('-')[0];
        })
        .filter(function(l) {
          return !!i18nMsgs[l];
        })[0] ||
      window.navigator.language.split('-')[0]);

    this.setLocale(locale);

    var self = this;

    this.initTemplates();

    this.setInitialCampaign();

    switch (this.campaign) {
      case 'mp':
        var self = this;
        this.$http
          .get('/public/mps.json', { responseType: 'json' })
          .then(function(response) {
            // Set this.mps
            var self = this,
              msgs = {
                constituencies: {}
              };
            for (var i = 0; i < response.body.length; i++) {
              var row = response.body[i];
              self.mps[row.code] = row;

              msgs.constituencies[row.code] = row.name;
            }
            self.$i18n.mergeLocaleMessage('en', msgs);

            // Also, set the constituencies inside the english locale
            self.updateConstituencies();
          });

        break;

      case 'bank':
        for (var i = 0; i < banks.length; i++) {
          this.banks[banks[i].ifsc] = banks[i];
        }
        break;

      case 'gov':
        // Setup service inside translations
        console.log(this.services);
        var msgs = {
          services: this.services
        };
        self.$i18n.mergeLocaleMessage('en', msgs);
        break;
    }
  },
  computed: {
    tweettext: function() {
      // TODO: localize this as well
      // TODO: find a better twitter message
      return encodeURIComponent(
        'Hey ' +
          this.twitter +
          ', please stop harrassing me for my aadhaar. @speakforme'
      );
    },
    states: function() {
      return [
        'AN',
        'AP',
        'AR',
        'AS',
        'BI',
        'CH',
        'CT',
        'DN',
        'DD',
        'DL',
        'GO',
        'GJ',
        'HA',
        'HP',
        'JK',
        'JH',
        'KA',
        'KE',
        'LD',
        'MP',
        'MH',
        'MA',
        'ME',
        'MI',
        'NA',
        'OR',
        'PO',
        'PB',
        'RJ',
        'SK',
        'TG',
        'TN',
        'TR',
        'UP',
        'UT',
        'WB'
      ];
    },
    constituency: function() {
      return this.mps[this.constituencyCode];
    },
    tweeturl: function() {
      return 'https://twitter.com/intent/tweet?text=' + this.tweettext;
    },
    facebookhref: function () {
      return 'https://www.facebook.com/sharer/sharer.php?u=' + window.location.href
    },
    facebookurl: function () {
      return `https://www.facebook.com/plugins/share_button.php?href=${window.location.href}&layout=button&size=small&mobile_iframe=true&width=59&height=20`


    },
    fullmailtourl: function() {
      return this.getMailUrl(
        mailUrlOpts.mailto,
        encodeURIComponent(this.response)
      );
    },
    mailtourl: function() {
      return this.getMailUrl(mailUrlOpts.mailto, 'Paste+Here');
    },
    gmailurl: function() {
      return this.getMailUrl(mailUrlOpts.gmail, 'Paste+Here');
    },
    yahoourl: function() {
      return this.getMailUrl(mailUrlOpts.yahoo, 'Paste+Here');
    },
    mobile: function() {
      var IEMobile = /IEMobile/i.test(navigator.userAgent);

      // TODO: check needs to be more robust
      // UCBrowser etc?
      return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini/i.test(
          navigator.userAgent
        ) && !IEMobile
      );
    },
    services: function() {
      return window.services;
    },
    // This is maintained manually
    cc: function() {
      switch (this.campaign) {
        case 'mp':
          return '';
        case 'bank':
          return 'cabinet@nic.in,urjitrpatel@rbi.org.in,governor@rbi.org.in';
        case 'gov':
          return 'cabinet@nic.in,narendramodi@narendramodi.in';
        case 'telco':
          return 'cp@trai.gov.in';
      }
    },
    bcc: function() {
      var code = this.campaign + '-';
      switch (this.campaign) {
        case 'gov':
          code += this.service.code;
          break;
        case 'bank':
          code += this.bank.ifsc;
          break;
        case 'mp':
          code += this.constituencyCode;
          break;
      }
      return (code + '@email.speakforme.in').toLowerCase();
    },
    twitter: function() {
      if (this.service.twitter) {
        return this.service.twitter
          .split(' ')
          .map(function(handle) {
            return '@' + handle;
          })
          .join(' ');
      }
      return false;
    },
    subject: function() {
      switch (this.campaign) {
        case 'bank':
          return 'Threats to make bank accounts inoperable without Aadhaar';
        case 'gov':
          return (
            'Threats to make ' +
            this.service.name +
            ' inoperable without Aadhaar'
          );
        case 'mp':
          return 'An appeal to raise my concerns regarding Aadhaar in Winter Session of Parliament';
      }
    },
    service: function() {
      switch (this.campaign) {
        case 'bank':
          return this.banks[this.bankIFSC];
        case 'gov':
          return this.services[this.serviceIndex];
          break;
        // TODO: use a setter for constituency
        // and make sure that it works before the mps.json
        // file is loaded
        case 'mp':
          if (this.constituency) {
            return this.constituency;
          }

          // TODO: Pick a random constituency
          return {
            index: '18',
            name: 'Agra',
            state: 'UP',
            name: 'Dr. Prof. Ram Shankar',
            email: 'office.mpagra@gmail.com, rs.katheria@sansad.nic.in',
            code: 'UP-18'
          };
      }
    },
    bank: function() {
      return this.banks[this.bankIFSC];
    },
    personName: function() {
      switch (this.campaign) {
        case 'bank':
          return 'Chairman and MD (' + this.bank.name + ')';
        case 'mp':
          return this.constituency ? this.constituency.mp : '';
        case 'gov':
          return this.service.personName;
      }
    },
    serviceName: function() {
      return this.service.name;
    },
    email: function() {
      var e = this.service.email;

      var self = this;
      // email cleanup
      // TODO: TRIM trailing commas
      return e
        .replace(';', ',')
        .replace(/[\[\(]dot[\]\)]/g, '.')
        .replace(/[\[\(]at[\]\)]/g, '@')
        .replace(' ', ',')
        .split(',')
        .filter(function(t) {
          return t.trim().length > 0;
        })
        .map(function(e) {
          return self.personName + ' <' + e + '>';
        })
        .join(', ');
    },
    response: function() {
      var template = '';

      switch (this.campaign) {
        case 'bank':
          template = this.templates.bank;
	  break;
        case 'service':
          template = this.templates.service;
	  break;
        case 'mp':
          template = this.templates.mp;
	  break;
      }
      return template.trim()
        .replace(/\(\(addressee\)\)/g, this.personName)
        .replace(/\(\(address\)\)/g, this.service.address);
    }
  },
  components: responseComponents
});

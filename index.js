// init project
const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const emoji = require("node-emoji");
const Twit = require("twit");
const config = {
  // Be sure to update the .env file with your API keys.
  twitter: {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  }
};
var T = new Twit(config.twitter);
var currentTweetDeets;


// Creates png to tweet out
async function makeImg() {
  cacheImage();

  console.log("starting puppeteer bit");
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  console.log("new page");

  // Adjustments particular to this page to ensure we hit desktop breakpoint.
  //page.setViewport({ width: 510, height: 510, deviceScaleFactor: 1 });

  // options with timeout: 0 mean NO Navigation Timeout errors
  await page.goto("https://mediumpurplesiennaalgorithm.thomtimtam.repl.co/fortweet", {
    waitUntil: "networkidle2",
    timeout: 0
  });
  console.log("open page");

  // to make sure create-img.js can create the image
  await delay(1000 * 30);
  console.log("delay over");

  // Takes a screenshot of a DOM element on the page, with optional padding.
  async function screenshotDOMElement(opts = {}) {
    const padding = "padding" in opts ? opts.padding : 0;
    const path = "path" in opts ? opts.path : null;
    const selector = opts.selector;

    if (!selector) {
      throw Error("Please provide a selector.");
    }

    const rect = await page.evaluate(selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { left: x, top: y, width, height, id: element.id };
    }, selector);

    if (!rect)
      throw Error(`Could not find element that matches selector: ${selector}.`);

    // screeshot png of p5js canvas stored in app filesystem
    return await page.screenshot({
      path,
      clip: {
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      }
    });
  }

  // create the image via puppeteer screenshot
  var imgBuff = await screenshotDOMElement({
    path: "imagecache/next.png",
    selector: "canvas",
    padding: 0
  });

  console.log("ib", imgBuff);

  await browser.close();
  console.log('finished with puppeteer');



}

// promisified setTimeout so i can use it async
function delay(ms) {
  var ctr,
    rej,
    p = new Promise(function(resolve, reject) {
      ctr = setTimeout(resolve, ms);
      rej = reject;
    });
  p.cancel = function() {
    clearTimeout(ctr);
    rej(Error("Cancelled"));
  };
  return p;
}

function cacheImage() {
  try {
    var files = fs.readdirSync("imagecache/");

    console.log(files);

    fs.renameSync("imagecache/5.png", "imagecache/6.png");
    console.log("renamed 5-6");

    fs.renameSync("imagecache/4.png", "imagecache/5.png");
    console.log("renamed 4-5");

    fs.renameSync("imagecache/3.png", "imagecache/4.png");
    console.log("renamed 3-4");

    fs.renameSync("imagecache/2.png", "imagecache/3.png");
    console.log("renamed 2-3");

    fs.renameSync("imagecache/1.png", "imagecache/2.png");
    console.log("renamed 1-2");

    fs.copyFileSync("imagecache/next.png", "imagecache/1.png");
    console.log("copied new image to 1");

    setupNextTweet();
  } catch (err) {
    console.log(err);
  }
}


function setupNextTweet() {
  try {
    let rawdata = fs.readFileSync("imgDeets.json");
    let deetsArray = JSON.parse(rawdata);

    let len = deetsArray.length;
    let rand = Math.floor(Math.random() * len);
    let nextTweetDeets = deetsArray[rand];

    console.log(nextTweetDeets);
    console.log(nextTweetDeets.altText);

    let data = JSON.stringify(nextTweetDeets);
    console.log(data);

    fs.writeFileSync("public/imgurl.json", data);


  } catch (err) {
    console.log(err);
  }
}

app.use(express.static("public"));

app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/fortweet", function(request, response) {
  response.sendFile(__dirname + "/views/fortweet.html");
});

app.all("/new", function(request, response) {
  makeImg();
  if (response) {
    response.send("done");
  }
});

app.all("/next", function(request, response) {
  response.sendFile(__dirname + "/imagecache/next.png");
})

app.all("/test", function(request, response) {
  //cacheImage();
  setupNextTweet();
  response.send("done");
})

app.all("/image1", function(request, response) {
  response.sendFile(__dirname + "/imagecache/1.png");
})

app.all("/image2", function(request, response) {
  response.sendFile(__dirname + "/imagecache/2.png");
})

app.all("/image3", function(request, response) {
  response.sendFile(__dirname + "/imagecache/3.png");
})

app.all("/image4", function(request, response) {
  response.sendFile(__dirname + "/imagecache/4.png");
})

app.all("/image5", function(request, response) {
  response.sendFile(__dirname + "/imagecache/5.png");
})

app.all("/image6", function(request, response) {
  response.sendFile(__dirname + "/imagecache/6.png");
})

app.all("/" + process.env.TWEET, function(request, response) {
  // make cron job happy
  response.send("done");

  let rawdata = fs.readFileSync("public/imgurl.json");
  currentTweetDeets = JSON.parse(rawdata);
  console.log("got old deets");

  // grab the image from file system
  var sortedImg = fs.readFileSync("imagecache/next.png", { encoding: "base64" });

  // first we must post the media to Twitter
  T.post("media/upload", { media_data: sortedImg }, function(err, data, response) {
    var mediaIdStr = data.media_id_string;
    var altText = "a pixel sorted photo of " + currentTweetDeets.altText;
    var tweetStatus = emoji.get("cloud") + "\n(photo: " + currentTweetDeets.imgLink + ")";
    var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } };
    if (err) {
      console.log("issues again" + err);
    } else {
      T.post("media/metadata/create", meta_params, function(err, data, response) {
        if (!err) {
          // now we can reference the media and post a tweet (media will attach to the tweet)
          var params = { status: tweetStatus, media_ids: [mediaIdStr] };

          T.post("statuses/update", params, function(err, data, response) {
            if (err) {
              console.log("more issues" + err);
            } else {
              console.log("tweeted");
            }
          });
        } else if (err) {
          //response.sendStatus(500);
          console.log("issues " + err);
        }
      });
    }
  });

  // create the image
  makeImg();
});

//var listener = app.listen(process.env.PORT, function() {
//  console.log("Your bot is running on port " + listener.address().port);
//});
app.listen(process.env.PORT, () => console.log("Your app is listening on port " + process.env.PORT))
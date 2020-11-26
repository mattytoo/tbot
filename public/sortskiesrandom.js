/*global createCanvas, Array, loadJSON, loadImage, loadStrings, image, select, random, round, constrain, floor, map, BLUR, GRAY, POSTERIZE, DILATE, ERODE*/

let img, baseImg, textureImg; //img is for manipulating, baseImg to keep the image's original state
let imgUrls = [
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Fmargaux-bellott-ZezlPiN2XjU-unsplash.jpg?v=1605683445826",
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Flukasz-lada-q7z-AUlHPaw-unsplash.jpg?v=1605683450269",
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Fluca-dugaro-tuueCVnYN0s-unsplash.jpg?v=1605683456935",
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Fjerry-zhang-aQx1sz3cbpQ-unsplash.jpg?v=1605683461923",
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Fdiego-ph-vTitvl4O2kE-unsplash.jpg?v=1605683465984",
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Fdareen0987-F4Gxr-9otzg-unsplash.jpg?v=1605683535790",
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Fanton-repponen-wxxAx26SXys-unsplash.jpg?v=1605782964315",
  "https://cdn.glitch.com/df053be7-c519-4614-beaf-cdd502de931e%2Fdewang-gupta-e96mMAgHl6E-unsplash.jpg?v=1605782974582"
];

let sortDir = "V"; //sort image (V)ertically, (H)orizontally
let sortBy = "BR"; //(R)ed, (G)reen, (B)lue, (BR)ightness, (H)ue, (S)aturation, (F)lip
let sortRev = false; //reverse the direction of the sorted lines

let sortLineLengthMin = 15; //minimum length of sorted lines
let sortLineLengthMax = 40; //maximum length of sorted lines
let sortLengthWeighted = "N"; //(N)ot weighted, weighted (F)or sortBy, weighted (A)gainst sortBy
let lineThickness = 1;
let lineThicknessChange = 100; //weighted 100% to current (no change) -> weighted 0% to current (almost deffo change)

let useTexture = true;
let posterizeFirst = true;
let blurAmt = 5;
let posterizeAmt = 5;
let erodeAmt = 4;
let dilateAmt = 4;
let skipBrightest = false;
let skipDarkest = false;
let skipAlternate = false;
let shadeList = [];
let brightest = 0;
let darkest = 255;

let imgx = 0; //to keep track of x position while going over the image
let imgy = 0; //to keep track of y position while going over the image
let imgurl;

let lts = [];

function preload() {
  baseImg = loadImage(random(imgUrls));
}

function setup() {
  if (baseImg.width >= baseImg.height) {
    baseImg.resize(1000, 0);
  } else {
    baseImg.resize(0, 1000);
  }

  img = baseImg.get();
  img.loadPixels();

  let cnv = createCanvas(img.width, img.height);
  cnv.id("ca-canvas");

  randomiseSettings();
  //useTexture = true;
  //lineThickness = 1;//round(random(3,20));
  //skipBrightest = false;
  //skipDarkest = false;
  //skipAlternate = false;
  //posterizeAmt = 5;
  //posterizeFirst = false;
  //sortDir = "V";

  if (useTexture) {
    textureImg = img.get();
    textureImg.filter(BLUR, blurAmt);
    if (posterizeFirst) textureImg.filter(POSTERIZE, posterizeAmt);
    textureImg.filter(GRAY);
    textureImg.filter(DILATE, dilateAmt);
    textureImg.filter(ERODE, erodeAmt);
    if (!posterizeFirst) textureImg.filter(POSTERIZE, posterizeAmt);

    textureImg.loadPixels();

    if (skipAlternate == true) {
      //compile list of all the unique shades in the texture image
      let prevPixel = textureImg.pixels[0];
      shadeList.push(prevPixel);

      for (let x = 0; x < textureImg.width; x++) {
        for (let y = 0; y < textureImg.height; y++) {
          let nextPixel = textureImg.pixels[4 * (x + textureImg.width * y)];

          //same as previous pixel? ditch it
          if (nextPixel != prevPixel) {
            //different than previous pixel? check if it's already in the list. otherwise ditch it
            let foundMatch = false;
            for (let i = 0; i < shadeList.length; i++) {
              if (nextPixel == shadeList[i]) {
                foundMatch = true;
                break;
              }
            }
            if (foundMatch == false) {
              shadeList.push(nextPixel);
            }
            prevPixel = nextPixel;
          }
        }
      }

      //sort list to find darkest/brightest
      shadeList.sort();
      shadeList.reverse();

      let tempList = [];
      for (let i = 0; i < shadeList.length; i += 2) {
        tempList.push(shadeList[i]);
      }
      shadeList = tempList;
    }
    if (skipBrightest == true) {
      for (let i = 0; i < textureImg.pixels.length; i += 4) {
        if (textureImg.pixels[i] > brightest) brightest = textureImg.pixels[i];
      }
    }
    if (skipDarkest == true) {
      for (let i = 0; i < textureImg.pixels.length; i += 4) {
        if (textureImg.pixels[i] < darkest) darkest = textureImg.pixels[i];
      }
    }
  }

  let sortLineLength = 1;

  //main loop
  for (
    let progress = 0;
    progress < img.pixels.length;
    progress = 4 * (imgx + img.width * imgy)
  ) {
    let lineToSort = [];

    if (useTexture) {
      lineToSort = getLineToSort(textureImg, img, sortDir, imgx, imgy);
      sortLineLength = lineToSort.length;

      if (!skipThisLine()) {
        //time to sort!
        lineToSort = sortLine(lineToSort, sortBy);
        if (sortRev) lineToSort.reverse();

        //replace img.pixels with newly sorted pixels
        replaceSortedPixels(img, lineToSort, sortDir, imgx, imgy);
        
        //rpt if linethickness > 1
        repeatLine(sortLineLength);
      }
    } else if (!useTexture) {
      //calculate sort line length with weighting if selected & not sorted by 'flip', else random
      if (sortLengthWeighted != "N" && sortBy != "F")
        sortLineLength = weightSortLineLength(
          fastGet(img, imgx, imgy),
          sortLengthWeighted,
          sortBy
        );
      else sortLineLength = round(random(sortLineLengthMin, sortLineLengthMax));

      //if the section to sort would stretch off the img, just stop at the bottom
      if (sortDir === "V") {
        if (imgy + sortLineLength >= img.height)
          sortLineLength = img.height - imgy;
      } else if (sortDir === "H") {
        if (imgx + sortLineLength >= img.width)
          sortLineLength = img.width - imgx;
      }

      //grab from pixels array, add to the array to be sorted
      if (sortDir === "V") {
        for (let i = 0; i < sortLineLength; i++) {
          lineToSort.push(fastGet(img, imgx, imgy + i));
        }
      } else if (sortDir === "H") {
        for (let i = 0; i < sortLineLength; i++) {
          lineToSort.push(fastGet(img, imgx + i, imgy));
        }
      }

      //time to sort!
      lineToSort = sortLine(lineToSort, sortBy);
      if (sortRev) lineToSort.reverse();

      //replace img.pixels with newly sorted pixels
      replaceSortedPixels(img, lineToSort, sortDir, imgx, imgy);

      //rpt if linethickness > 1
      repeatLine(sortLineLength);
    }

    if (sortDir === "V") {
      imgy += sortLineLength;
      if (imgy >= img.height) {
        imgx += lineThickness;
        if(imgx >= img.width) break;
        imgy = 0;
         //change lineThickness?
        changeThickness();
      }
    } else if (sortDir === "H") {
      imgx += sortLineLength;
      if (imgx >= img.width) {
        if(imgy >= img.height) break;
        imgy += lineThickness;
        imgx = 0;
         //change lineThickness?
        changeThickness();
      }
    }
   
  }

 logSettings();
  
  img.updatePixels();
  image(img, 0, 0);
  //image(textureImg, 0, 0);
}

function changeThickness(){
  //weighted 100% to current (no change) -> weighted 0% to current (almost deffo change)
  // lineThickness = constrain(floor(random(-50, 21)), 1, 20);
  
  let weight = round(constrain(random(-lineThicknessChange, 100 - lineThicknessChange),0,100));
  let change = round(map(weight, 0, 100, 0, 20));
  if(random([true,false])) change = -change;
  if((lineThickness + change > 20)||(lineThickness + change < 1)){
    lineThickness -= change;
  }else {
     lineThickness += change;
  }
  lineThickness = constrain(lineThickness, 1, 30);
  lts.push(lineThickness);
}

function repeatLine(sortLineLength){
  let lineToSort = [];
  for (let lt = 2; lt <= lineThickness; lt++) {
          if (sortDir === "V") {
            let x = imgx + lt - 1;
            lineToSort = [];
            for (let i = 0; i < sortLineLength; i++) {
              lineToSort.push(fastGet(img, x, imgy + i));
            }

            //time to sort!
            lineToSort = sortLine(lineToSort, sortBy);
            if (sortRev) lineToSort.reverse();

            //replace img.pixels with newly sorted pixels
            for (let j = 0; j < lineToSort.length; j++) {
              fastSet(img, x , imgy + j, lineToSort[j]);
            }
          }else if (sortDir === "H") {
            let y = imgy + lt - 1;
            lineToSort = [];
            for (let i = 0; i < sortLineLength; i++) {
              lineToSort.push(fastGet(img, imgx + i, y));
            }

            //time to sort!
            lineToSort = sortLine(lineToSort, sortBy);
            if (sortRev) lineToSort.reverse();

            //replace img.pixels with newly sorted pixels
            for (let j = 0; j < lineToSort.length; j++) {
              fastSet(img, imgx + j, y, lineToSort[j]);
            }
          }
  }
}

function replaceSortedPixels(imgToReplace, sortedLine, dir, x, y) {
  if (dir === "V") {
    for (let i = 0; i < sortedLine.length; i++) {
      fastSet(imgToReplace, x, y + i, sortedLine[i]);
    }
  } else if (dir === "H") {
    for (let i = 0; i < sortedLine.length; i++) {
      fastSet(imgToReplace, x + i, y, sortedLine[i]);
    }
  }
}

function skipThisLine() {
  if (
    skipBrightest &&
    textureImg.pixels[4 * (imgx + textureImg.width * imgy)] == brightest
  ) {
    return true;
  } else if (
    skipDarkest &&
    textureImg.pixels[4 * (imgx + textureImg.width * imgy)] == darkest
  ) {
    return true;
  } else if (skipAlternate) {
    for (let i = 0; i < shadeList.length; i++) {
      if (
        textureImg.pixels[4 * (imgx + textureImg.width * imgy)] == shadeList[i]
      ) {
        return true;
      }
    }
  }
  return false;
}

function getLineToSort(imgTexture, imgToSort, dir, x, y) {
  let lineToSort = [];
  let startColor = fastGet(imgTexture, x, y);

  lineToSort.push(fastGet(imgToSort, x, y));
  if (dir === "V") {
    y++;

    for (y; y < imgToSort.height; y++) {
      let nextColor = fastGet(imgTexture, x, y);
      if (compareColors(startColor, nextColor)) {
        lineToSort.push(fastGet(imgToSort, x, y));
      } else break;
    }
  } else if (dir === "H") {
    x++;

    for (x; x < imgToSort.width; x++) {
      let nextColor = fastGet(imgTexture, x, y);
      if (compareColors(startColor, nextColor)) {
        lineToSort.push(fastGet(imgToSort, x, y));
      } else break;
    }
  }
  return lineToSort;
}

function compareColors(c1, c2) {
  if (
    c1[0] === c2[0] &&
    c1[1] === c2[1] &&
    c1[2] === c2[2] &&
    c1[3] === c2[3]
  ) {
    return true;
  } else return false;
}

function sortLine(lineToSort, sortType) {
  switch (sortType) {
    case "R": //red
      lineToSort.sort((a, b) => (a[0] > b[0] ? 1 : -1));
      break;
    case "G": //green
      lineToSort.sort((a, b) => (a[1] > b[1] ? 1 : -1));
      break;
    case "B": //blue
      lineToSort.sort((a, b) => (a[2] > b[2] ? 1 : -1));
      break;
    case "A": //alpha
      lineToSort.sort((a, b) => (a[3] > b[3] ? 1 : -1));
      break;
    case "BR":
      //brightness - formula shortcut from here stackoverflow.com/questions/596216/formula-to-determine-brightness-of-rgb-color
      lineToSort.sort((a, b) =>
        fastBrightness(a[0], a[1], a[2]) > fastBrightness(b[0], b[1], b[2])
          ? 1
          : -1
      );
      break;
    case "H":
      //hue - formula from stackoverflow.com/questions/23090019/fastest-formula-to-get-hue-from-rgb
      lineToSort.sort((a, b) =>
        fastHue(a[0], a[1], a[2]) > fastHue(b[0], b[1], b[2]) ? 1 : -1
      );
      break;
    case "S":
      //saturation - formula from www.niwa.nu/2013/05/math-behind-colorspace-conversions-rgb-hsl/
      lineToSort.sort((a, b) =>
        fastSaturation(a[0], a[1], a[2]) > fastSaturation(b[0], b[1], b[2])
          ? 1
          : -1
      );
      break;
    case "F": //flip
      lineToSort.reverse();
      break;
    default:
      //add r+g+b
      lineToSort.sort((a, b) =>
        a[0] + a[1] + a[2] > b[0] + b[1] + b[2] ? 1 : -1
      );
  }
  return lineToSort;
}

function weightSortLineLength(pixel, weightDirection, weightBy) {
  //grabs the value of the first pixel in the line to sort & maps its value to be between
  //sortLineLengthMin & Max. for ex: the brighter first pixel, the closer the line length is to max length
  let c;

  switch (weightBy) {
    case "R":
      c = pixel[0];
      break;
    case "G":
      c = pixel[1];
      break;
    case "B":
      c = pixel[2];
      break;
    case "A":
      c = pixel[3];
      break;
    case "BR":
      c = fastBrightness(pixel[0], pixel[1], pixel[2]);
      break;
    case "H":
      c = round(
        map(fastHue(pixel[0], pixel[1], pixel[2]), 0, 360, 0, 255, true)
      );
      break;
    case "S":
      c = round(
        map(fastSaturation(pixel[0], pixel[1], pixel[2]), 0, 1, 0, 255, true)
      );
      break;
  }
  //if weighted against is selected, get "opposite" number
  if (weightDirection === "A") c = 255 - c;

  return round(map(c, 0, 255, sortLineLengthMin, sortLineLengthMax, true));
}

function fastSaturation(red, green, blue) {
  //saturation - formula from www.niwa.nu/2013/05/math-behind-colorspace-conversions-rgb-hsl/
  let min = Math.min(Math.min(red, green), blue);
  let max = Math.max(Math.max(red, green), blue);

  let brightness = fastBrightness(red, green, blue);
  let saturation;
  //changed formula here because fastBrightness returns values from 0-255. (127.5 is 1/2, 510 is *2)
  if (brightness <= 127.5) saturation = (max - min) / (max + min);
  if (brightness > 127.5) saturation = (max - min) / (510 - max - min);

  //value between 0-1
  return saturation;
}

function fastBrightness(red, green, blue) {
  //brightness - formula shortcut from here stackoverflow.com/questions/596216/formula-to-determine-brightness-of-rgb-color
  //value between 0-255
  return (red + red + blue + green + green + green) / 6;
}

function fastHue(red, green, blue) {
  //hue - formula from stackoverflow.com/questions/23090019/fastest-formula-to-get-hue-from-rgb
  let min = Math.min(Math.min(red, green), blue);
  let max = Math.max(Math.max(red, green), blue);

  if (min == max) {
    return 0;
  }

  let newhue = 0;
  if (max == red) {
    newhue = (green - blue) / (max - min);
  } else if (max == green) {
    newhue = 2 + (blue - red) / (max - min);
  } else {
    newhue = 4 + (red - green) / (max - min);
  }

  newhue = newhue * 60;
  if (newhue < 0) newhue = newhue + 360;
  //value between 0-360
  return Math.round(newhue);
}

function fastGet(imageToUse, x, y) {
  //from https://medium.com/@pasquini/lets-build-digital-sand-paintings-with-p5js-a44a3d8587e7
  let index = 4 * (x + imageToUse.width * y);
  return [
    imageToUse.pixels[index],
    imageToUse.pixels[index + 1],
    imageToUse.pixels[index + 2],
    imageToUse.pixels[index + 3]
  ];
}

function fastSet(imageToUse, x, y, c) {
  //from https://medium.com/@pasquini/lets-build-digital-sand-paintings-with-p5js-a44a3d8587e7
  let index = 4 * (x + imageToUse.width * y);
  imageToUse.pixels[index] = c[0];
  imageToUse.pixels[index + 1] = c[1];
  imageToUse.pixels[index + 2] = c[2];
  imageToUse.pixels[index + 3] = c[3];
}

function randomiseSettings() {
  //randomise everything
  sortBy = random(["R", "G", "B", "BR", "BR", "H", "F"]);

  sortDir = random(["V", "H"]);

  sortLengthWeighted = random(["N", "N", "F", "A"]);

  sortRev = random([true, false]);
  if (sortBy === "F") sortRev = false; //flip + reverse = normal image, so stop that from happening

  let rnd = floor(random(0, 4));
  if (rnd === 0) {
    sortLineLengthMin = floor(random(1, img.height));
    sortLineLengthMax = floor(random(sortLineLengthMin, img.height));
  } else if (rnd === 1) {
    sortLineLengthMax = floor(random(1, img.height));
    sortLineLengthMin = floor(random(1, sortLineLengthMax));
  } else {
    sortLineLengthMax = floor(random(1, img.height / 2));
    sortLineLengthMin = floor(random(1, sortLineLengthMax));
  }

  lineThickness = constrain(floor(random(-60, 21)), 1, 20);
  lineThicknessChange = constrain(round(random(0,400)),0,100);

  useTexture = random([true, false]);
  blurAmt = constrain(random(8), 0, 4);
  posterizeFirst = random([true, false]);
  posterizeAmt = random(2, 5);
  erodeAmt = constrain(random(-7, 10), 0, 10);
  dilateAmt = constrain(random(-7, 10), 0, 10);
  skipBrightest = random([true, false]);
  skipDarkest = random([true, false]);
  skipAlternate = random([true, false]);
  
  if (skipBrightest || skipDarkest) skipAlternate = false;
  if (!posterizeFirst) {
    posterizeAmt = random(2, 7);
    if(posterizeAmt <= 3){
      if(skipBrightest == true ){
        skipDarkest = false;
      }
    }
  }
}

function logSettings(){
   console.log("sort: " + sortDir);
  console.log("lt: " + lineThickness);
  console.log("usetxt: " + useTexture);
  console.log(skipBrightest + " " + skipDarkest + " " + skipAlternate);
  console.log("imgx: " + imgx + "   imgy: " + imgy);
console.log("sortBy = "+sortBy); //(R)ed, (G)reen, (B)lue, (BR)ightness, (H)ue, (S)aturation, (F)lip
console.log(" sortRev ="+sortRev ); //reverse the direction of the sorted lines

console.log(" sortLineLengthMin = "+ sortLineLengthMin); //minimum length of sorted lines
console.log(" sortLineLengthMax = "+sortLineLengthMax); //maximum length of sorted lines
console.log(" sortLengthWeighted = "+sortLengthWeighted); //(N)ot weighted, weighted (F)or sortBy, weighted (A)gainst sortBy

console.log(" lineThicknessChange = "+lineThicknessChange); //weighted 100% to current (no change) -> weighted 0% to current (almost deffo change)

console.log(" posterizeFirst = "+posterizeFirst);
console.log(" blurAmt = "+blurAmt);
console.log(" posterizeAmt = "+posterizeAmt);
console.log(" erodeAmt = "+erodeAmt);
console.log(" dilateAmt = "+dilateAmt);
  console.log(lts);

}
